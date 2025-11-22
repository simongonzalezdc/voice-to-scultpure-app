<script lang="ts">
	import { T, Canvas } from '@threlte/core';
	import { uiStore, setActiveGlaze } from '$lib/stores/uiStore.svelte';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { recordingStore } from '$lib/stores/recording.svelte';
	import { useTask } from '@threlte/core';
	import { Color } from 'three';

	// Voice-driven color mixing
	let currentHue = $state(0); // 0-360 (HSL)
	let currentRoughness = $state(0.5); // 0-1

	// Smooth interpolation for visual feedback
	const RESPONSIVENESS = 0.1; // How quickly it responds (0-1, lower = smoother)

	// Update hue and roughness based on voice input
	useTask(() => {
		const frame = analysisStore.latestFrame;
		if (frame && recordingStore.state === 'recording') {
			// Pitch → Hue: Low pitch = Red (0°), High pitch = Blue (240°)
			// Map pitch range (80-400 Hz typical) to hue (0-240°)
			const pitch = frame.pitch || 0;
			if (pitch > 0) {
				const normalizedPitch = Math.max(0, Math.min(1, (pitch - 80) / (400 - 80)));
				const targetHue = normalizedPitch * 240; // 0° (red) to 240° (blue)
				currentHue += (targetHue - currentHue) * RESPONSIVENESS;
			}

			// Timbre → Roughness: Smooth timbre = Gloss (low roughness), Rough timbre = Matte (high roughness)
			const timbre = frame.timbre?.spectralCentroid || 0;
			// Normalize timbre (typical range 1000-5000 Hz) to roughness (0-1)
			const normalizedTimbre = Math.max(0, Math.min(1, (timbre - 1000) / (5000 - 1000)));
			// Invert: High timbre (bright) = Low roughness (glossy), Low timbre (dark) = High roughness (matte)
			const targetRoughness = 1 - normalizedTimbre;
			currentRoughness += (targetRoughness - currentRoughness) * RESPONSIVENESS;
		}
	});

	// Convert HSL to hex color
	function hslToHex(h: number, s: number, l: number): string {
		const c = new Color().setHSL(h / 360, s, l);
		return '#' + c.getHexString();
	}

	let previewColor = $derived(hslToHex(currentHue, 0.8, 0.6)); // Saturated, medium lightness

	function handleSaveGlaze() {
		setActiveGlaze(previewColor, currentRoughness);
		alert(`Glaze saved! Color: ${previewColor}, Roughness: ${currentRoughness.toFixed(2)}`);
	}
</script>

<div class="surface-panel p-6 rounded-lg max-w-md w-full">
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-2xl font-bold">Glaze Mixer</h2>
	</div>

	<div class="space-y-4">
		<!-- Preview Sphere -->
		<div class="flex justify-center mb-4">
			<div class="w-48 h-48 rounded-full border-2 border-[#4a4a4a] overflow-hidden bg-[#1a1a1a]">
				<Canvas>
					<T.PerspectiveCamera makeDefault position={[0, 0, 3]} fov={50} />
					<T.AmbientLight intensity={0.5} />
					<T.DirectionalLight position={[5, 5, 5]} intensity={1} />
					<T.Mesh>
						<T.SphereGeometry args={[1, 32, 32]} />
						<T.MeshPhysicalMaterial
							color={previewColor}
							roughness={currentRoughness}
							metalness={0.1}
							clearcoat={1 - currentRoughness}
							clearcoatRoughness={currentRoughness * 0.5}
						/>
					</T.Mesh>
				</Canvas>
			</div>
		</div>

		<!-- Voice Input Status -->
		{#if recordingStore.state === 'recording'}
			<div class="text-sm text-[#888] mb-2">
				🎵 Pitch → Hue: {Math.round(currentHue)}° | 
				🌬️ Timbre → Roughness: {currentRoughness.toFixed(2)}
			</div>
		{:else}
			<div class="text-sm text-[#888] mb-2">
				Start recording to mix glaze with your voice
			</div>
		{/if}

		<!-- Current Values Display -->
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<span class="text-sm text-secondary">Color:</span>
				<div class="flex items-center gap-2">
					<div
						class="w-8 h-8 rounded border border-[#4a4a4a]"
						style="background-color: {previewColor}"
					></div>
					<span class="text-xs font-mono text-secondary">{previewColor.toUpperCase()}</span>
				</div>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-sm text-secondary">Roughness:</span>
				<span class="text-sm text-secondary">{currentRoughness.toFixed(2)}</span>
			</div>
		</div>

		<!-- Save Button -->
		<button
			class="button-primary px-4 py-2 w-full text-sm"
			type="button"
			onclick={handleSaveGlaze}
		>
			Save Glaze
		</button>

		<p class="text-xs text-[#888] mt-2">
			Speak or sing while recording to mix your glaze. Pitch controls color (low=red, high=blue), 
			timbre controls texture (smooth=glossy, rough=matte).
		</p>
	</div>
</div>

