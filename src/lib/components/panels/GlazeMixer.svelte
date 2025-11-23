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

	// DIRECTIVE 1: Retune Pitch-to-Hue for Human Vocal Range
	// 80Hz (Low Male) = Red (0°), 600Hz (High Soprano) = Purple (280°)
	const MIN_HZ = 80;
	const MAX_HZ = 600;
	
	let hue = $derived.by(() => {
		if (livePitch <= 0) return 0; // No pitch detected
		
		// Normalize to 0-1 range
		const t = Math.max(0, Math.min(1, (livePitch - MIN_HZ) / (MAX_HZ - MIN_HZ)));
		
		// Map to Hue (0 = Red, 280 = Purple)
		return t * 280;
	});

	// DIRECTIVE 2: Remap Volume to Saturation & Lightness (NOT Opacity)
	// Quiet = Greyish (low saturation), Loud = Vibrant (high saturation)
	let saturation = $derived(50 + (liveEnergy * 50)); // 50% to 100%
	let lightness = $derived(30 + (liveEnergy * 40));  // 30% (Dark) to 70% (Bright)

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
	// DIRECTIVE 2: Use dynamic saturation instead of fixed 100%
	let previewColorHSL = $derived(`hsl(${Math.round(hue)}, ${Math.round(saturation)}%, ${Math.round(lightness)}%)`);
	let previewColorHex = $derived(hslToHex(hue, saturation, lightness));

	// Audio context state check
	let audioContextState = $state<'suspended' | 'running' | 'closed' | 'unknown'>('unknown');
	let needsInitialization = $state(true);
	let showActivateButton = $derived(audioContextState === 'suspended' || audioContextState === 'unknown');

	onMount(() => {
		console.log('[GLAZE MIXER] Mounted - initializing audio monitoring');
		
		// Check audio context state on mount
		const checkAudioContext = async () => {
			const ctx = getAudioContext();
			
			if (!ctx) {
				// No audio context yet - user needs to record first OR we need to initialize
				audioContextState = 'unknown';
				return;
			}
			
			const previousState = audioContextState;
			audioContextState = ctx.state as 'suspended' | 'running' | 'closed';
			
			// If state changed, log it
			if (previousState !== audioContextState) {
				console.log(`[GLAZE MIXER] Audio context state: ${previousState} → ${audioContextState}`);
			}
			
			// If suspended, try to resume
			if (ctx.state === 'suspended') {
				try {
					await ctx.resume();
					audioContextState = 'running';
					console.log('[GLAZE MIXER] Audio context resumed');
				} catch (err) {
					console.warn('[GLAZE MIXER] Failed to resume audio context:', err);
				}
			}
			
			// CRITICAL FIX: Always try to start visualizer bypass if context is running
			if (ctx.state === 'running') {
				try {
					await startVisualizerBypass();
					if (needsInitialization) {
						console.log('[GLAZE MIXER] Visualizer bypass started');
						needsInitialization = false;
					}
				} catch (err) {
					// This is expected if already running - not an error
					if (needsInitialization) {
						console.log('[GLAZE MIXER] Visualizer bypass already active');
						needsInitialization = false;
					}
				}
			}
		};

		checkAudioContext();
		// Poll more frequently for responsive UI
		const interval = setInterval(checkAudioContext, 250);
		return () => {
			console.log('[GLAZE MIXER] Unmounting - cleaning up');
			clearInterval(interval);
		};
	});

	async function handleActivateMic() {
		console.log('[GLAZE MIXER] User clicked activate mic button');
		const ctx = getAudioContext();
		
		if (!ctx) {
			console.warn('[GLAZE MIXER] No audio context - user needs to record first to initialize audio pipeline');
			alert('Please click the Record button at least once to initialize the microphone, then return to the Glaze Mixer.');
			return;
		}
		
		if (ctx.state === 'suspended') {
			try {
				await ctx.resume();
				audioContextState = 'running';
				console.log('[GLAZE MIXER] Audio context resumed by user action');
				
				// Start visualizer bypass
				await startVisualizerBypass();
				console.log('[GLAZE MIXER] Visualizer bypass started by user action');
			} catch (err) {
				console.error('[GLAZE MIXER] Failed to activate audio:', err);
			}
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
					<div class="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-full z-10 p-4">
						<button
							class="px-4 py-2 bg-[#7c3aed] hover:bg-[#8b5cf6] text-white rounded text-sm font-medium mb-2"
							type="button"
							onclick={handleActivateMic}
						>
							🎤 Activate Microphone
						</button>
						<p class="text-xs text-[#aaa] text-center">
							{#if audioContextState === 'unknown'}
								Record once first to initialize audio
							{:else}
								Click to resume audio context
							{/if}
						</p>
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

		<!-- DIRECTIVE 3: Debug Readout -->
		<div class="bg-[#1a1a1a] border border-[#333] rounded p-3 mb-3 font-mono text-xs">
			<div class="text-[#888] mb-1 font-semibold">Live Audio Debug:</div>
			{#if livePitch > 0}
				<div class="text-[#4ade80]">
					🎵 Pitch: <span class="text-white font-bold">{livePitch.toFixed(0)}Hz</span>
					<span class="text-[#888]">
						({livePitch < MIN_HZ ? 'Low' : livePitch > MAX_HZ ? 'High' : 
							livePitch < 150 ? 'Red' : livePitch < 300 ? 'Yellow' : livePitch < 450 ? 'Green' : 'Purple'})
					</span>
				</div>
			{:else}
				<div class="text-[#ef4444]">🎵 Pitch: <span class="text-white font-bold">0Hz</span> (Not detected)</div>
			{/if}
			{#if liveEnergy > 0}
				<div class="text-[#60a5fa]">
					🔊 Vol: <span class="text-white font-bold">{Math.round(liveEnergy * 100)}%</span>
					<span class="text-[#888]">
						({liveEnergy < 0.3 ? 'Quiet' : liveEnergy < 0.6 ? 'Medium' : 'Loud - Vivid!'})
					</span>
				</div>
			{:else}
				<div class="text-[#ef4444]">🔊 Vol: <span class="text-white font-bold">0%</span> (Silent)</div>
			{/if}
			<div class="text-[#a78bfa]">
				🌬️ Timbre: <span class="text-white font-bold">{liveTimbre > 0 ? liveTimbre.toFixed(0) : 'N/A'}</span>
				<span class="text-[#888]">→ Roughness: {roughness.toFixed(2)}</span>
			</div>
		</div>

		<!-- Live Voice Input Status (Simplified) -->
		<div class="text-sm text-[#888] mb-2 text-center">
			{#if livePitch > 0 && liveEnergy > 0}
				<span class="text-[#4ade80]">✓ Voice detected - Colors mixing!</span>
			{:else if liveEnergy > 0}
				<span class="text-[#fbbf24]">⚠️ Mic active - Try humming for pitch</span>
			{:else}
				<span class="text-[#666]">💤 Hum or speak to see live color changes</span>
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
			<strong>How it works:</strong> Pitch (80-600Hz) controls hue (red→purple), volume controls saturation & brightness 
			(quiet=grey, loud=vivid), timbre controls texture (smooth=glossy, rough=matte). 
			Click "Save Glaze" to lock the current color.
		</p>
		
		<div class="mt-3 p-2 bg-[#1a1a1a] border border-[#333] rounded text-xs text-[#aaa]">
			💡 <strong class="text-[#888]">Tip:</strong> Your microphone stays active for continuous live monitoring. 
			The colors update in real-time as you hum or speak! Once you record at least once, 
			this mixer will work even when not actively recording.
		</div>
	</div>
</div>

