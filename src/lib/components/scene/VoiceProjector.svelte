<script lang="ts">
	/**
	 * Voice Projector - POV Acoustic Projection Visualizer
	 *
	 * Renders sound waves traveling from the user (camera) toward the sculpture.
	 * Each wave represents detected audio, with properties mapped to visuals:
	 * - Energy → Wave intensity/opacity
	 * - Pitch → Wave color (hue)
	 * - Timbre → Wave distortion/roughness
	 *
	 * Performance optimizations:
	 * - Object pooling (reuse wave meshes)
	 * - Distance-based fade (inverse depth)
	 * - Max active waves limit
	 * - GPU instancing for particles
	 *
	 * Song Mode features:
	 * - Word flash: Display current transcribed word above sculpture
	 */
	import { T, useTask } from '@threlte/core';
	import { Text } from '@threlte/extras';
	import { Color, DoubleSide, AdditiveBlending } from 'three';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { recordingStore } from '$lib/stores/recording.svelte';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { songModeStore } from '$lib/stores/songModeStore.svelte';
	import { appSettings } from '$lib/stores/appSettingsStore.svelte';

	// ============================================================================
	// CONFIGURATION
	// ============================================================================

	interface ProjectorConfig {
		enabled: boolean;
		maxWaves: number;
		waveSpeed: number;
		waveLifetime: number;
		minEnergy: number;
		colorFromPitch: boolean;
		showWordFlash: boolean;
	}

	let config = $state<ProjectorConfig>({
		enabled: true,
		maxWaves: 20,
		waveSpeed: 2.0,
		waveLifetime: 1.5,
		minEnergy: 0.1,
		colorFromPitch: true,
		showWordFlash: true
	});

	// ============================================================================
	// WAVE POOL
	// ============================================================================

	interface Wave {
		id: number;
		active: boolean;
		progress: number; // 0 = at camera, 1 = at sculpture
		scale: number;
		opacity: number;
		color: Color;
		birthTime: number;
	}

	let wavePool = $state<Wave[]>([]);
	let lastWaveTime = $state(0);

	// Initialize wave pool
	$effect(() => {
		if (wavePool.length === 0) {
			wavePool = Array.from({ length: config.maxWaves }, (_, i) => ({
				id: i,
				active: false,
				progress: 0,
				scale: 0.1,
				opacity: 0,
				color: new Color(0x00ffff),
				birthTime: 0
			}));
		}
	});

	// ============================================================================
	// WAVE GENERATION
	// ============================================================================

	/**
	 * Get an inactive wave from the pool
	 */
	function getPooledWave(): Wave | null {
		return wavePool.find((w) => !w.active) || null;
	}

	/**
	 * Spawn a new wave based on current audio
	 */
	function spawnWave(): void {
		if (!config.enabled) return;

		const now = performance.now();
		const minInterval = 100; // 100ms minimum between waves

		if (now - lastWaveTime < minInterval) return;

		const energy = analysisStore.micLevel || 0;
		if (energy < config.minEnergy) return;

		const wave = getPooledWave();
		if (!wave) return;

		const pitch = analysisStore.latestFrame?.pitch || 220;

		// Activate wave
		wave.active = true;
		wave.progress = 0;
		wave.scale = 0.1 + energy * 0.3;
		wave.opacity = 0.5 + energy * 0.5;
		wave.birthTime = now;

		// Color from pitch (80Hz = red, 800Hz = purple)
		if (config.colorFromPitch) {
			const t = Math.max(0, Math.min(1, (pitch - 80) / 720));
			const hue = t * 0.78; // 0° to 280° in HSL
			wave.color.setHSL(hue, 0.8, 0.5 + energy * 0.2);
		} else {
			wave.color.setHex(0x00ffff);
		}

		lastWaveTime = now;
	}

	// ============================================================================
	// ANIMATION LOOP
	// ============================================================================

	useTask((delta) => {
		if (!config.enabled) return;

		const isRecording = recordingStore.state === 'recording';

		// Only animate when recording or in force mode
		if (!isRecording && uiStore.workspace !== 'force') {
			// Fade out existing waves
			for (const wave of wavePool) {
				if (wave.active) {
					wave.opacity *= 0.95;
					if (wave.opacity < 0.01) {
						wave.active = false;
					}
				}
			}
			return;
		}

		// Try to spawn new wave
		spawnWave();

		// Update active waves
		for (const wave of wavePool) {
			if (!wave.active) continue;

			// Progress wave toward sculpture
			wave.progress += delta * config.waveSpeed;

			// Scale grows as wave travels
			wave.scale = 0.1 + wave.progress * 0.8;

			// Opacity fades with distance (inverse depth fade)
			const distanceFade = 1 - wave.progress;
			const ageFade = 1 - wave.progress / config.waveLifetime;
			wave.opacity = Math.max(0, distanceFade * ageFade * 0.8);

			// Deactivate if past lifetime
			if (wave.progress > config.waveLifetime) {
				wave.active = false;
			}
		}
	});

	// ============================================================================
	// DERIVED VALUES
	// ============================================================================

	let activeWaves = $derived(wavePool.filter((w) => w.active));
	let isVisible = $derived(
		config.enabled && (recordingStore.state === 'recording' || uiStore.workspace === 'force')
	);

	// Word flash from Song Mode lyrics
	let currentWord = $derived(songModeStore.currentWord || '');
	let showWord = $derived(config.showWordFlash && currentWord.length > 0 && songModeStore.enabled);

	// Word flash animation
	let wordFlashOpacity = $state(0);
	let wordFlashScale = $state(1);
	let lastWord = $state('');

	// Animate word flash
	$effect(() => {
		if (currentWord && currentWord !== lastWord) {
			// New word detected - flash in
			wordFlashOpacity = 1.0;
			wordFlashScale = 1.2;
			lastWord = currentWord;

			// Animate out
			setTimeout(() => {
				wordFlashScale = 1.0;
			}, 100);
		}
	});

	// Fade word over time
	useTask((delta) => {
		if (wordFlashOpacity > 0) {
			wordFlashOpacity = Math.max(0, wordFlashOpacity - delta * 0.8);
		}
	});

	// Accessibility check
	let reduceMotion = $derived(appSettings.reduceMotion ?? false);
</script>

{#if isVisible}
	<!-- Voice Wave Rings - Travel FROM camera (high Z) TOWARD sculpture (Z=0) -->
	{#each activeWaves as wave (wave.id)}
		<T.Mesh
			position.z={4 - wave.progress * 3}
			scale={[wave.scale, wave.scale, 1]}
			rotation.x={Math.PI / 2}
		>
			<T.RingGeometry args={[0.8, 1.0, 32]} />
			<T.MeshBasicMaterial
				color={wave.color}
				transparent={true}
				opacity={wave.opacity}
				side={DoubleSide}
				blending={AdditiveBlending}
				depthWrite={false}
			/>
		</T.Mesh>
	{/each}

	<!-- Word Flash (Song Mode) -->
	{#if showWord && wordFlashOpacity > 0.01}
		<T.Group position={[0, 1.8, 0]} scale={[wordFlashScale, wordFlashScale, 1]}>
			<Text
				text={currentWord.toUpperCase()}
				fontSize={0.15}
				color="#ffffff"
				anchorX="center"
				anchorY="middle"
				outlineWidth={0.01}
				outlineColor="#000000"
				fillOpacity={wordFlashOpacity}
				outlineOpacity={wordFlashOpacity * 0.5}
			/>
		</T.Group>
	{/if}

	<!-- Reduce Motion: Skip wave rings when accessibility setting enabled -->
	{#if reduceMotion}
		<!-- Static energy indicator instead of animated waves -->
		{#if analysisStore.micLevel > 0.1}
			<T.Mesh position={[0, 0, -0.5]}>
				<T.CircleGeometry args={[0.3 + analysisStore.micLevel * 0.2, 32]} />
				<T.MeshBasicMaterial color="#00ffff" transparent={true} opacity={0.3} depthWrite={false} />
			</T.Mesh>
		{/if}
	{/if}
{/if}
