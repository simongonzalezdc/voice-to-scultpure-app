<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import {
		playbackStore,
		getPlaybackProgress,
		updatePlaybackTime
	} from '$lib/stores/playbackStore.svelte';
	import { pitchToColor, hexToRgb } from '$lib/engine/colorMapping';
	import { MIN_PITCH_HZ, MAX_PITCH_HZ, DEFAULT_HEIGHT_MM } from '$lib/config/constants';
	import { TubeGeometry, Vector3, Color } from 'three';

	let tubeGeometry = $state<TubeGeometry | undefined>(undefined);
	let isVisible = $state(false);
	let playheadPosition = $state(new Vector3());
	let playheadColor = $state(new Color(0xffffff));

	// Landmark markers
	interface Landmark {
		position: Vector3;
		type: 'highest-pitch' | 'loudest' | 'beat';
		label: string;
		color: Color;
	}

	let landmarks = $state<Landmark[]>([]);

	// Calculate landmarks from audio frames
	function calculateLandmarks() {
		const sculpture = sculptureStore.currentSculpture;
		const frames = sculpture?.layers?.[0]?.sourceFrames;

		if (!frames || frames.length < 2) {
			landmarks = [];
			return;
		}

		const heightScale = sculpture.physical.height / DEFAULT_HEIGHT_MM;
		const newLandmarks: Landmark[] = [];

		// Find highest pitch
		let maxPitchIdx = 0;
		let maxPitch = 0;
		let maxEnergy = 0;
		let maxEnergyIdx = 0;

		for (let i = 0; i < frames.length; i++) {
			const frame = frames[i];

			// Track highest pitch
			if ((frame.pitch || 0) > maxPitch) {
				maxPitch = frame.pitch || 0;
				maxPitchIdx = i;
			}

			// Track loudest moment
			if ((frame.energy || 0) > maxEnergy) {
				maxEnergy = frame.energy || 0;
				maxEnergyIdx = i;
			}
		}

		// Calculate position for highest pitch marker
		if (maxPitch > 0) {
			const normalizedHeight = maxPitchIdx / (frames.length - 1);
			const yPos = normalizedHeight * heightScale - 0.5;
			const spiralAngle = (maxPitchIdx / frames.length) * Math.PI * 2 * 3;
			const radiusAtHeight = 0.35 + 0.95 * 0.2; // High pitch

			newLandmarks.push({
				position: new Vector3(
					Math.cos(spiralAngle) * radiusAtHeight,
					yPos,
					Math.sin(spiralAngle) * radiusAtHeight
				),
				type: 'highest-pitch',
				label: '🎵 Peak',
				color: new Color(0xff4444)
			});
		}

		// Calculate position for loudest moment
		if (maxEnergy > 0) {
			const normalizedHeight = maxEnergyIdx / (frames.length - 1);
			const yPos = normalizedHeight * heightScale - 0.5;
			const spiralAngle = (maxEnergyIdx / frames.length) * Math.PI * 2 * 3;
			const radiusAtHeight = 0.35 + 0.5 * 0.2;

			newLandmarks.push({
				position: new Vector3(
					Math.cos(spiralAngle) * radiusAtHeight,
					yPos,
					Math.sin(spiralAngle) * radiusAtHeight
				),
				type: 'loudest',
				label: `📊 Loudest`,
				color: new Color(0xffaa00)
			});
		}

		landmarks = newLandmarks;
	}

	// Get frames and generate pitch curve
	function generatePitchCurve(): Vector3[] {
		const sculpture = sculptureStore.currentSculpture;
		if (!sculpture?.layers?.[0]) return [];

		const frames = sculpture.layers[0].sourceFrames;
		if (!frames || frames.length === 0) return [];

		const curve: Vector3[] = [];
		const heightScale = sculpture.physical.height / DEFAULT_HEIGHT_MM;

		for (let i = 0; i < frames.length; i++) {
			const frame = frames[i];
			if (!frame) continue;

			// Normalized height (Y axis)
			const normalizedHeight = i / (frames.length - 1);
			const yPos = normalizedHeight * heightScale - 0.5; // Center at 0

			// Pitch-based radius (spiral offset from center)
			let pitch = frame.pitch || 220;
			const hzToSemitones = (hz: number) => 12 * Math.log2(hz / 440);
			const minSemitones = hzToSemitones(MIN_PITCH_HZ);
			const maxSemitones = hzToSemitones(MAX_PITCH_HZ);
			const semitones = hzToSemitones(pitch);
			const normalizedPitch = Math.max(
				0,
				Math.min(1, (semitones - minSemitones) / (maxSemitones - minSemitones))
			);

			// Spiral around the sculpture (radius offset based on pitch)
			const spiralAngle = (i / frames.length) * Math.PI * 2 * 3; // 3 turns around sculpture
			const radiusAtHeight = 0.35 + normalizedPitch * 0.2; // Varies with pitch

			const xPos = Math.cos(spiralAngle) * radiusAtHeight;
			const zPos = Math.sin(spiralAngle) * radiusAtHeight;

			curve.push(new Vector3(xPos, yPos, zPos));
		}

		return curve;
	}

	// Generate geometry for pitch contour ribbon
	function createGeometry() {
		const curve = generatePitchCurve();
		if (curve.length < 2) return undefined;

		// Use TubeGeometry for the ribbon
		const tubeRadius = 0.03; // Thin ribbon
		const radialSegments = 8;
		const tubularSegments = curve.length - 1;

		try {
			return new TubeGeometry(
				{
					getPoint: (t: number) => {
						const idx = Math.floor(t * (curve.length - 1));
						return curve[idx] || curve[0];
					}
				} as any,
				tubularSegments,
				tubeRadius,
				radialSegments
			);
		} catch (err) {
			console.warn(`⚠️ [PITCH CONTOUR] Failed to create geometry:`, err);
			return undefined;
		}
	}

	// Update playhead position during playback
	function updatePlayhead() {
		const sculpture = sculptureStore.currentSculpture;
		const frames = sculpture?.layers?.[0]?.sourceFrames;

		if (!frames || frames.length === 0) return;

		const progress = getPlaybackProgress();
		const frameIndex = Math.floor(progress * (frames.length - 1));
		const frame = frames[frameIndex];

		if (!frame) return;

		// Replicate pitch contour calculation
		const heightScale = sculpture.physical.height / DEFAULT_HEIGHT_MM;
		const normalizedHeight = frameIndex / (frames.length - 1);
		const yPos = normalizedHeight * heightScale - 0.5;

		const pitch = frame.pitch || 220;
		const hzToSemitones = (hz: number) => 12 * Math.log2(hz / 440);
		const minSemitones = hzToSemitones(MIN_PITCH_HZ);
		const maxSemitones = hzToSemitones(MAX_PITCH_HZ);
		const semitones = hzToSemitones(pitch);
		const normalizedPitch = Math.max(
			0,
			Math.min(1, (semitones - minSemitones) / (maxSemitones - minSemitones))
		);

		const spiralAngle = (frameIndex / frames.length) * Math.PI * 2 * 3;
		const radiusAtHeight = 0.35 + normalizedPitch * 0.2;

		playheadPosition = new Vector3(
			Math.cos(spiralAngle) * radiusAtHeight,
			yPos,
			Math.sin(spiralAngle) * radiusAtHeight
		);

		// Color based on pitch
		const hexColor = pitchToColor(normalizedPitch);
		const [r, g, b] = hexToRgb(hexColor);
		playheadColor = new Color(r, g, b);
	}

	// Initialize geometry and landmarks
	$effect(() => {
		const sculpture = sculptureStore.currentSculpture;
		isVisible = !!sculpture?.layers?.[0]?.sourceFrames && uiStore.workspace !== 'glaze';

		if (isVisible) {
			tubeGeometry = createGeometry();
			calculateLandmarks();
		} else {
			landmarks = [];
		}
	});

	// Animation loop for playhead and timing
	useTask(() => {
		// Sync playback time with actual audio context timing
		updatePlaybackTime();

		// Update playhead visualization if playing
		if (playbackStore.state === 'playing') {
			updatePlayhead();
		}
	});
</script>

<!-- Pitch Contour Ribbon (Spiral around sculpture) -->
{#if isVisible && tubeGeometry}
	<T.Group>
		<!-- Main pitch contour ribbon (color-coded by pitch) -->
		<T.Mesh geometry={tubeGeometry}>
			<T.MeshPhysicalMaterial
				color="#8888ff"
				metalness={0.1}
				roughness={0.3}
				transmission={0.2}
				thickness={0.5}
				emissive="#4444ff"
				emissiveIntensity={0.3}
				transparent={true}
				opacity={0.7}
				wireframe={false}
			/>
		</T.Mesh>

		<!-- Playhead sphere (glowing dot along contour during playback) -->
		{#if playbackStore.state === 'playing'}
			<T.Mesh position={playheadPosition}>
				<T.SphereGeometry args={[0.08, 16, 16]} />
				<T.MeshPhysicalMaterial
					color={playheadColor}
					emissive={playheadColor}
					emissiveIntensity={1.0}
					metalness={0.5}
					roughness={0.1}
				/>
			</T.Mesh>
		{/if}

		<!-- Landmark markers (highest note, loudest moment, etc.) -->
		{#each landmarks as landmark (landmark.type)}
			<T.Mesh position={landmark.position}>
				<!-- Star geometry for peak marker -->
				{#if landmark.type === 'highest-pitch'}
					<T.OctahedronGeometry args={[0.1, 2]} />
				{:else}
					<!-- Sphere for other markers -->
					<T.SphereGeometry args={[0.12, 12, 12]} />
				{/if}
				<T.MeshPhysicalMaterial
					color={landmark.color}
					emissive={landmark.color}
					emissiveIntensity={0.6}
					metalness={0.4}
					roughness={0.2}
				/>
			</T.Mesh>
		{/each}
	</T.Group>
{/if}
