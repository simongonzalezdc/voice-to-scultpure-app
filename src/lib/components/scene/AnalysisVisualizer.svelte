<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { recordingStore } from '$lib/stores/recording.svelte';

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

	// Visibility check: only show during active recording
	let isVisible = $derived(recordingStore.state === 'recording' && analysisStore.micLevel > 0.01);
</script>

<!-- Ring visualizer - visible only during active recording -->
{#if isVisible}
	<T.Group position={[0, 1.5, 0]}>
		<!-- Outer ring (energy indicator) -->
		<T.Mesh>
			<T.TorusGeometry args={[currentScale, 0.02, 16, 32]} />
			<T.MeshBasicMaterial color={ringColor} transparent opacity={0.6 + colorIntensity * 0.4} />
		</T.Mesh>

		<!-- Inner ring (pitch indicator) -->
		{#if analysisStore.latestFrame?.pitch && analysisStore.latestFrame.pitch > 0}
			{@const pitchScale = Math.min(1, analysisStore.latestFrame.pitch / 1000) * 0.5}
			<T.Mesh>
				<T.TorusGeometry args={[currentScale * pitchScale, 0.01, 8, 16]} />
				<T.MeshBasicMaterial color="#ffffff" transparent opacity={0.4} />
			</T.Mesh>
		{/if}
	</T.Group>
{/if}
