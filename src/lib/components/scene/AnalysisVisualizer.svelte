<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { recordingStore, getPlaybackFrames } from '$lib/stores/recording.svelte';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';

	// DIRECTIVE 1: Dynamic Ring Orientation based on uiStore.orientation
	// Pottery (Vertical): Ring lies flat on XZ plane (parallel to floor)
	// Lathe (Horizontal): Ring stands up, facing X-axis (perpendicular to floor)
	let ringOrientation = $derived(
		uiStore.orientation === 'horizontal'
			? [0, Math.PI / 2, 0] // Lathe: Rotate 90° around Y-axis to face X-axis
			: [Math.PI / 2, 0, 0] // Pottery: Rotate 90° around X-axis to lie flat
	);

	// Ring visualizer that scales with energy/mic level
	// Base scale and responsive range
	const BASE_SCALE = 0.3;
	const MAX_SCALE = 1.5;
	const SCALE_RESPONSIVENESS = 0.15; // How quickly it responds (0-1, lower = smoother)

	let currentScale = $state(BASE_SCALE);
	let targetScale = $derived(BASE_SCALE + analysisStore.micLevel * (MAX_SCALE - BASE_SCALE));

	// Smooth interpolation for visual feedback using useTask (runs every frame)
	useTask(() => {
		const diff = targetScale - currentScale;
		currentScale += diff * SCALE_RESPONSIVENESS;
	});

	// Color intensity based on energy
	let colorIntensity = $derived(Math.min(1, analysisStore.micLevel * 2));
	let ringColor = $derived(
		`rgb(${Math.floor(143 + colorIntensity * 50)}, ${Math.floor(62 + colorIntensity * 30)}, ${Math.floor(72 + colorIntensity * 30)})`
	);

	// Calculate current height based on recording progress
	// Get the number of frames captured (current index)
	let currentIndex = $derived(getPlaybackFrames().length);

	// Get sculpture height scale (normalized to 150mm reference)
	let heightScale = $derived(
		sculptureStore.currentSculpture?.physical.height
			? sculptureStore.currentSculpture.physical.height / 150
			: 1.0
	);

	// Estimate current height: assume ~60 frames per second, max recording ~5 seconds = 300 frames
	// Normalize currentIndex to 0-1, then multiply by heightScale
	let currentHeight = $derived((currentIndex / 300) * heightScale);

	// Position ring at forming edge based on orientation
	let ringPosition = $derived(
		uiStore.orientation === 'vertical'
			? ([0, currentHeight, 0] as [number, number, number]) // Pottery: Y-axis
			: ([currentHeight, 0, 0] as [number, number, number]) // Lathe: X-axis
	);

	// DIRECTIVE 4: Hide ring visualizer for non-lathe shapes (especially sphere)
	// In Force Mode, the "Reticle" (cursor ring) IS the visualizer
	const baseShape = $derived(sculptureStore.currentSculpture?.baseShape || 'lathe');

	// Visibility check: only show during active recording AND for lathe shapes
	let isVisible = $derived(
		recordingStore.state === 'recording' && analysisStore.micLevel > 0.01 && baseShape === 'lathe' // Only show ring visualizer for lathe shapes
	);

	// DIRECTIVE 2: Virtuoso Visualizer
	// If Virtuoso Mode is active, the visualizer behaves differently:
	// Radius = Pitch
	// Rotation = Volume
	// Color = Timbre
	let isVirtuoso = $derived(uiStore.controlMode === 'melodic');

	// Scale Logic
	// Standard: Scale = Volume
	// Virtuoso: Scale = Pitch (Low pitch = Wide, High pitch = Narrow)
	let virtuosoScale = $derived.by(() => {
		if (!analysisStore.latestFrame?.pitch || analysisStore.latestFrame.pitch === 0)
			return BASE_SCALE;
		// Map 80Hz-800Hz to Scale 1.5-0.3
		const pitch = analysisStore.latestFrame.pitch;
		const normalizedPitch = Math.max(0, Math.min(1, (pitch - 80) / 720));
		return 1.5 - normalizedPitch * 1.2;
	});

	let targetVisualScale = $derived(
		isVirtuoso ? virtuosoScale : BASE_SCALE + analysisStore.micLevel * (MAX_SCALE - BASE_SCALE)
	);

	// Smooth interpolation for visual feedback using useTask (runs every frame)
	useTask((delta) => {
		const diff = targetVisualScale - currentScale;
		currentScale += diff * SCALE_RESPONSIVENESS;

		// Virtuoso Rotation: Spin based on volume
		if (isVirtuoso) {
			// Spin faster with more energy
			const _spinSpeed = analysisStore.micLevel * 5 * delta;
			// Mutating props is generally not recommended if they are passed down, but here 'rotation' is a prop to T.Group
			// We need a local rotation state.
			// Ideally we'd bind rotation to a local state variable.
		}
	});

	// Local rotation state for Virtuoso spin (additional rotation on Y-axis)
	let spinRotation = $state(0);

	useTask((delta) => {
		if (isVirtuoso) {
			spinRotation += analysisStore.micLevel * 10 * delta;
		} else {
			spinRotation = 0;
		}
	});

	// Combined rotation: base orientation + Virtuoso spin
	// Spin rotation is applied to Y-axis (second element)
	let finalRotation = $derived([
		ringOrientation[0],
		ringOrientation[1] + spinRotation,
		ringOrientation[2]
	] as [number, number, number]);

	// Virtuoso Color: Timbre -> Color
	// Standard: Red/Garnet intensity
	// Virtuoso: Blue (Pure) -> Orange (Raspy)
	let virtuosoColor = $derived.by(() => {
		const centroid = analysisStore.latestFrame?.timbre?.spectralCentroid || 0;
		// Normalize 0-5000Hz
		const t = Math.min(1, centroid / 5000);
		// Lerp Blue to Orange
		// Blue: rgb(50, 100, 255)
		// Orange: rgb(255, 150, 50)
		const r = Math.floor(50 + t * 205);
		const g = Math.floor(100 + t * 50);
		const b = Math.floor(255 - t * 205);
		return `rgb(${r}, ${g}, ${b})`;
	});

	let finalColor = $derived(isVirtuoso ? virtuosoColor : ringColor);
</script>

<!-- Ring visualizer - visible only during active recording -->
<!-- DIRECTIVE 1: Dynamic orientation based on uiStore.orientation -->
<!-- Pottery (Vertical): Ring flat on XZ plane - rotation={[Math.PI/2, 0, 0]} -->
<!-- Lathe (Horizontal): Ring standing up, facing X-axis - rotation={[0, Math.PI/2, 0]} -->
{#if isVisible}
	<T.Group position={ringPosition} rotation={finalRotation}>
		<!-- Outer ring (energy/pitch indicator) -->
		<T.Mesh>
			<T.TorusGeometry args={[currentScale, 0.02, 16, 32]} />
			<T.MeshBasicMaterial color={finalColor} transparent opacity={0.6 + colorIntensity * 0.4} />
		</T.Mesh>

		<!-- Inner ring (pitch/timbre indicator) -->
		{#if analysisStore.latestFrame?.pitch && analysisStore.latestFrame.pitch > 0}
			{@const pitchScale = Math.min(1, analysisStore.latestFrame.pitch / 1000) * 0.5}
			<T.Mesh>
				<T.TorusGeometry args={[currentScale * (isVirtuoso ? 0.8 : pitchScale), 0.01, 8, 16]} />
				<T.MeshBasicMaterial color="#ffffff" transparent opacity={0.4} />
			</T.Mesh>
		{/if}
	</T.Group>
{/if}
