<script lang="ts">
	import { T, Canvas } from '@threlte/core';
	import { onMount } from 'svelte';
	import { uiStore, setActiveGlaze } from '$lib/stores/uiStore.svelte';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { getAudioContext, startVisualizerBypass } from '$lib/audio/audioContext';
	import { Color } from 'three';

	// Live monitoring: Reactive color based on voice input (no recording needed)
	let livePitch = $derived(analysisStore.latestFrame?.pitch || 0);
	let liveEnergy = $derived(analysisStore.micLevel);
	let liveTimbre = $derived(analysisStore.latestFrame?.timbre?.spectralCentroid || 0);

	// Map Pitch (Hz) to Hue (0-360)
	// 100Hz = Red (0°), 800Hz = Blue (240°)
	let hue = $derived(
		livePitch > 0 
			? Math.min(240, Math.max(0, ((livePitch - 100) / 700) * 240))
			: 0
	);

	// Map Energy to Lightness (Pulse effect)
	// Quiet = 30%, Loud = 80%
	let lightness = $derived(30 + (liveEnergy * 50));

	// Map Timbre to Roughness
	// Smooth timbre = Gloss (low roughness), Rough timbre = Matte (high roughness)
	let roughness = $derived(
		liveTimbre === 0 
			? 0.5 
			: 1 - Math.max(0, Math.min(1, (liveTimbre - 1000) / (5000 - 1000))) // Invert: bright = glossy, dark = matte
	);

	// Convert HSL to hex for preview
	function hslToHex(h: number, s: number, l: number): string {
		const c = new Color().setHSL(h / 360, s / 100, l / 100);
		return '#' + c.getHexString();
	}

	// Reactive preview color (HSL format for smooth transitions)
	let previewColorHSL = $derived(`hsl(${Math.round(hue)}, 100%, ${Math.round(lightness)}%)`);
	let previewColorHex = $derived(hslToHex(hue, 100, lightness));

	// Audio context state check
	let audioContextState = $state<'suspended' | 'running' | 'closed' | 'unknown'>('unknown');
	let showActivateButton = $derived(audioContextState === 'suspended');

	onMount(() => {
		// Check audio context state on mount
		const checkAudioContext = async () => {
			const ctx = getAudioContext();
			if (ctx) {
				audioContextState = ctx.state as 'suspended' | 'running' | 'closed';
				
				// If suspended, try to resume
				if (ctx.state === 'suspended') {
					try {
						await ctx.resume();
						audioContextState = 'running';
					} catch (err) {
						console.warn('Failed to resume audio context:', err);
					}
				}
				
				// Start visualizer bypass for live monitoring (if not already running)
				if (ctx.state === 'running') {
					try {
						await startVisualizerBypass();
					} catch (err) {
						console.warn('Visualizer bypass already running or failed:', err);
					}
				}
			} else {
				audioContextState = 'unknown';
			}
		};

		checkAudioContext();
		// Poll for state changes
		const interval = setInterval(checkAudioContext, 500);
		return () => clearInterval(interval);
	});

	async function handleActivateMic() {
		const ctx = getAudioContext();
		if (ctx && ctx.state === 'suspended') {
			await ctx.resume();
			audioContextState = 'running';
		}
	}

	// Save feedback state
	let saveFlash = $state(false);

	function handleSaveGlaze() {
		// Capture current color and roughness
		setActiveGlaze(previewColorHex, roughness);
		
		// Visual feedback flash
		saveFlash = true;
		setTimeout(() => {
			saveFlash = false;
		}, 300);
	}
</script>

<div class="surface-panel p-6 rounded-lg max-w-md w-full">
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-2xl font-bold">Glaze Mixer</h2>
	</div>

	<div class="space-y-4">
		<!-- Preview Sphere -->
		<div class="flex justify-center mb-4 relative">
			<div class="w-48 h-48 rounded-full border-2 border-[#4a4a4a] overflow-hidden bg-[#1a1a1a] relative">
				<Canvas>
					<T.PerspectiveCamera makeDefault position={[0, 0, 3]} fov={50} />
					<T.AmbientLight intensity={0.5} />
					<T.DirectionalLight position={[5, 5, 5]} intensity={1} />
					<T.Mesh>
						<T.SphereGeometry args={[1, 32, 32]} />
						<T.MeshPhysicalMaterial
							color={previewColorHex}
							roughness={roughness}
							metalness={0.1}
							clearcoat={1 - roughness}
							clearcoatRoughness={roughness * 0.5}
						/>
					</T.Mesh>
				</Canvas>
				
				<!-- Tap to Activate Mic Overlay -->
				{#if showActivateButton}
					<div class="absolute inset-0 flex items-center justify-center bg-black/70 rounded-full z-10">
						<button
							class="px-4 py-2 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded text-sm font-medium"
							type="button"
							onclick={handleActivateMic}
						>
							🎤 Tap to Activate Mic
						</button>
					</div>
				{/if}
				
				<!-- Save Flash Feedback -->
				{#if saveFlash}
					<div class="absolute inset-0 flex items-center justify-center bg-green-500/50 rounded-full z-10 pointer-events-none animate-pulse">
						<span class="text-white font-bold text-lg">✓ Glaze Captured!</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Live Voice Input Status -->
		<div class="text-sm text-[#888] mb-2">
			{#if livePitch > 0}
				🎵 Pitch → Hue: {Math.round(hue)}° | 
				🌬️ Timbre → Roughness: {roughness.toFixed(2)} | 
				🔊 Energy: {Math.round(liveEnergy * 100)}%
			{:else if liveEnergy > 0}
				<span class="text-[#888]">🔊 Mic active ({Math.round(liveEnergy * 100)}%) - Start recording for pitch analysis</span>
			{:else}
				<span class="text-[#666]">Hum or speak to see live color changes</span>
			{/if}
		</div>

		<!-- Current Values Display -->
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<span class="text-sm text-secondary">Color:</span>
				<div class="flex items-center gap-2">
					<div
						class="w-8 h-8 rounded border border-[#4a4a4a] transition-colors duration-100"
						style="background-color: {previewColorHex}"
					></div>
					<span class="text-xs font-mono text-secondary">{previewColorHex.toUpperCase()}</span>
				</div>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-sm text-secondary">Roughness:</span>
				<span class="text-sm text-secondary">{roughness.toFixed(2)}</span>
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
			Hum or speak to mix your glaze in real-time. Pitch controls color (low=red, high=blue), 
			timbre controls texture (smooth=glossy, rough=matte). Click "Save Glaze" to capture the current color.
		</p>
	</div>
</div>

