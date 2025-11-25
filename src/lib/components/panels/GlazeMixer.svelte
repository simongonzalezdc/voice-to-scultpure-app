<script lang="ts">
	import { T, Canvas } from '@threlte/core';
	import { onMount } from 'svelte';
	import {
		setActiveGlaze,
		uiStore,
		setMaterialType,
		setEmissiveEnabled,
		setEmissiveBase,
		setEmissiveReactivity,
		setEmissiveColor
	} from '$lib/stores/uiStore.svelte';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { getAudioContext, startVisualizerBypass } from '$lib/audio/audioContext';
	import { Color } from 'three';
	import {
		NOISE_GATE_THRESHOLD,
		MIN_PITCH_HZ,
		MAX_PITCH_HZ,
		MIN_PITCH_HZ_THRESHOLD,
		MIN_ENERGY_FOR_PITCH
	} from '$lib/config/constants';
	import { Sparkles, Sun, Palette, Brain, Mic, Hand } from 'lucide-svelte';
	import { songModeStore } from '$lib/stores/songModeStore.svelte';

	// SYNERGY: Glaze source indicator
	// Shows where the current color is coming from: manual, voice, or AI sentiment
	let glazeSource = $derived.by(() => {
		// Check if AI sentiment is driving colors (Song Mode)
		if (songModeStore.enabled && songModeStore.layers.narrative && songModeStore.currentSentiment) {
			return 'ai-sentiment';
		}
		// Check if voice is actively being detected
		if (analysisStore.micLevel > 0.1) {
			return 'voice';
		}
		// Fallback: manual/saved
		return 'manual';
	});

	// Live monitoring: Reactive color based on voice input (no recording needed)
	let livePitch = $derived(analysisStore.latestFrame?.pitch || 0);

	// DIRECTIVE 2: Improved Noise Gate & Non-Linear Curve
	// Crush background noise (TV, fans, etc.) and make it usable
	// Uses centralized constants from config/constants.ts

	let rawEnergy = $derived(analysisStore.micLevel);
	let liveEnergy = $derived.by(() => {
		// 1. Noise Gate (Crush background noise)
		const gatedEnergy = Math.max(0, rawEnergy - NOISE_GATE_THRESHOLD);

		// 2. Non-Linear Curve (Make it usable)
		// Input 0.2 -> Output 0.05 (Faint)
		// Input 0.8 -> Output 1.0 (Vivid)
		return Math.min(1.0, Math.pow(gatedEnergy, 2) * 3.0);
	});

	let liveTimbre = $derived(analysisStore.latestFrame?.timbre?.spectralCentroid || 0);

	// DIRECTIVE 2: Pitch Safety - Persist hue state to lock last valid color
	// Prevents flashing Red when pitch detection fails
	// Uses centralized constants from config/constants.ts

	let hue = $state(0); // Persist state (not derived)

	// Update hue only when we have valid pitch + energy
	$effect(() => {
		const detectedPitch = analysisStore.latestFrame?.pitch || 0;
		const currentEnergy = liveEnergy;

		// Only update hue if we have sufficient energy AND valid pitch
		if (currentEnergy > MIN_ENERGY_FOR_PITCH && detectedPitch > MIN_PITCH_HZ_THRESHOLD) {
			// Map MIN_PITCH_HZ-MAX_PITCH_HZ to 0-360 Hue
			const normalizedPitch = Math.max(
				0,
				Math.min(1, (detectedPitch - MIN_PITCH_HZ) / (MAX_PITCH_HZ - MIN_PITCH_HZ))
			);
			hue = normalizedPitch * 360;
		}
		// Otherwise, keep the last valid hue (don't reset to 0)
	});

	// DIRECTIVE 2: Remap Volume to Saturation & Lightness (NOT Opacity)
	// Quiet = Greyish (low saturation), Loud = Vibrant (high saturation)
	let saturation = $derived(50 + liveEnergy * 50); // 50% to 100%
	let lightness = $derived(30 + liveEnergy * 40); // 30% (Dark) to 70% (Bright)

	// Map Timbre to Roughness
	// Smooth timbre = Gloss (low roughness), Rough timbre = Matte (high roughness)
	let roughness = $derived(
		liveTimbre === 0 ? 0.5 : 1 - Math.max(0, Math.min(1, (liveTimbre - 1000) / (5000 - 1000))) // Invert: bright = glossy, dark = matte
	);

	// Convert HSL to hex for preview
	function hslToHex(h: number, s: number, l: number): string {
		const c = new Color().setHSL(h / 360, s / 100, l / 100);
		return '#' + c.getHexString();
	}

	// Reactive preview color (HSL format for smooth transitions)
	// DIRECTIVE 2: Use dynamic saturation instead of fixed 100%
	let previewColorHex = $derived(hslToHex(hue, saturation, lightness));

	// Audio context state check
	let audioContextState = $state<'suspended' | 'running' | 'closed' | 'unknown'>('unknown');
	let needsInitialization = $state(true);
	let showActivateButton = $derived(
		audioContextState === 'suspended' || audioContextState === 'unknown'
	);

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
			console.warn(
				'[GLAZE MIXER] No audio context - user needs to record first to initialize audio pipeline'
			);
			alert(
				'Please click the Record button at least once to initialize the microphone, then return to the Glaze Mixer.'
			);
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

	// Dazzler Effect: Emissive state (reactive from store)
	let materialType = $derived(uiStore.activeGlaze.materialType);
	let emissiveEnabled = $derived(uiStore.activeGlaze.emissiveEnabled);
	let emissiveBase = $derived(uiStore.activeGlaze.emissiveBase);
	let emissiveReactivity = $derived(uiStore.activeGlaze.emissiveReactivity);
	let emissiveColor = $derived(uiStore.activeGlaze.emissiveColor);

	// Compute live emissive intensity based on voice energy
	let liveEmissiveIntensity = $derived.by(() => {
		if (!emissiveEnabled) return 0;
		const base = emissiveBase;
		const voiceContribution = liveEnergy * emissiveReactivity;
		return Math.min(2.0, base + voiceContribution * 1.5); // Cap at 2.0 for bloom
	});

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

<div class="w-full">
	<div class="space-y-4">
		<!-- Preview Sphere -->
		<div class="flex justify-center mb-4 relative">
			<div
				class="w-48 h-48 rounded-full border-2 border-[#4a4a4a] overflow-hidden bg-[#1a1a1a] relative"
			>
				<Canvas>
					<T.PerspectiveCamera makeDefault position={[0, 0, 3]} fov={50} />
					<T.AmbientLight intensity={emissiveEnabled ? 0.2 : 0.5} />
					<T.DirectionalLight position={[5, 5, 5]} intensity={emissiveEnabled ? 0.5 : 1} />
					<T.Mesh>
						<T.SphereGeometry args={[1, 32, 32]} />
						<T.MeshPhysicalMaterial
							color={materialType === 'energy' ? '#111111' : previewColorHex}
							roughness={materialType === 'energy' ? 0.8 : roughness}
							metalness={0.1}
							clearcoat={1 - roughness}
							clearcoatRoughness={roughness * 0.5}
							emissive={emissiveEnabled ? emissiveColor : '#000000'}
							emissiveIntensity={liveEmissiveIntensity}
						/>
					</T.Mesh>
				</Canvas>

				<!-- Tap to Activate Mic Overlay -->
				{#if showActivateButton}
					<div
						class="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-full z-10 p-4"
					>
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
					<div
						class="absolute inset-0 flex items-center justify-center bg-green-500/50 rounded-full z-10 pointer-events-none animate-pulse"
					>
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
						({livePitch < MIN_PITCH_HZ
							? 'Low'
							: livePitch > MAX_PITCH_HZ
								? 'High'
								: livePitch < 150
									? 'Red'
									: livePitch < 300
										? 'Yellow'
										: livePitch < 450
											? 'Green'
											: 'Purple'})
					</span>
				</div>
			{:else}
				<div class="text-[#ef4444]">
					🎵 Pitch: <span class="text-white font-bold">0Hz</span> (Not detected)
				</div>
			{/if}
			{#if liveEnergy > 0}
				<div class="text-[#60a5fa]">
					🔊 Vol: <span class="text-white font-bold">{Math.round(liveEnergy * 100)}%</span>
					<span class="text-[#888]">
						({liveEnergy < 0.3 ? 'Quiet' : liveEnergy < 0.6 ? 'Medium' : 'Loud - Vivid!'})
					</span>
					<span class="text-[#666] text-xs ml-1">
						(Raw: {Math.round(rawEnergy * 100)}%)
					</span>
				</div>
			{:else}
				<div class="text-[#ef4444]">
					🔊 Vol: <span class="text-white font-bold">0%</span> (Silent)
				</div>
			{/if}
			<div class="text-[#a78bfa]">
				🌬️ Timbre: <span class="text-white font-bold"
					>{liveTimbre > 0 ? liveTimbre.toFixed(0) : 'N/A'}</span
				>
				<span class="text-[#888]">→ Surface: {roughness.toFixed(2)}</span>
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

		<!-- SYNERGY: Glaze Source Indicator -->
		<div class="bg-[#1a1a1a] border border-[#333] rounded p-2 mb-3 flex items-center justify-between">
			<span class="text-xs text-[#888]">Color Source:</span>
			<div class="flex items-center gap-2">
				{#if glazeSource === 'ai-sentiment'}
					<div class="flex items-center gap-1 text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded-full">
						<Brain size={12} />
						<span class="text-xs font-bold">AI Sentiment</span>
					</div>
				{:else if glazeSource === 'voice'}
					<div class="flex items-center gap-1 text-green-400 bg-green-500/20 px-2 py-0.5 rounded-full animate-pulse">
						<Mic size={12} />
						<span class="text-xs font-bold">Voice Live</span>
					</div>
				{:else}
					<div class="flex items-center gap-1 text-[#888] bg-[#333] px-2 py-0.5 rounded-full">
						<Hand size={12} />
						<span class="text-xs">Manual</span>
					</div>
				{/if}
			</div>
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
				<span class="text-sm text-secondary">Surface:</span>
				<span class="text-sm text-secondary">{roughness.toFixed(2)}</span>
			</div>
		</div>

		<!-- DAZZLER EFFECT: Material Type & Emissive Controls -->
		<div class="border-t border-[#333] pt-4 mt-4">
			<div class="flex items-center gap-2 mb-3">
				<Sparkles size={16} class="text-yellow-400" />
				<span class="text-sm font-bold text-secondary">DAZZLER EFFECT</span>
			</div>

			<!-- Material Type Toggle -->
			<div class="space-y-2 mb-4">
				<span class="text-xs text-[#888]">Material Type</span>
				<div class="grid grid-cols-3 gap-1">
					<button
						class="p-2 rounded text-xs font-bold transition-colors {materialType === 'ceramic'
							? 'bg-amber-600 text-white'
							: 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a]'}"
						onclick={() => setMaterialType('ceramic')}
					>
						🏺 Ceramic
					</button>
					<button
						class="p-2 rounded text-xs font-bold transition-colors {materialType === 'plastic'
							? 'bg-blue-600 text-white'
							: 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a]'}"
						onclick={() => setMaterialType('plastic')}
					>
						🔮 Plastic
					</button>
					<button
						class="p-2 rounded text-xs font-bold transition-colors relative {materialType === 'energy'
							? 'bg-purple-600 text-white'
							: 'bg-[#1a1a1a] text-[#888] hover:bg-[#2a2a2a]'}"
						onclick={() => setMaterialType('energy')}
					>
						⚡ Energy
						<span class="absolute -top-1.5 -right-1.5 px-1 py-0.5 text-[8px] font-bold rounded bg-green-500 text-white">NEW</span>
					</button>
				</div>
			</div>

			{#if emissiveEnabled}
				<!-- Emissive Controls (only shown when Energy mode active) -->
				<div class="space-y-3 bg-[#1a1a1a] p-3 rounded border border-purple-500/30">
					<!-- Glow Color -->
					<div class="flex items-center justify-between">
						<span class="text-xs text-[#888] flex items-center gap-1">
							<Palette size={12} /> Glow Color
						</span>
						<div class="flex items-center gap-2">
							<input
								type="color"
								value={emissiveColor}
								oninput={(e) => setEmissiveColor(e.currentTarget.value)}
								class="w-8 h-6 rounded cursor-pointer border border-[#333]"
							/>
							<span class="text-xs font-mono text-[#888]">{emissiveColor.toUpperCase()}</span>
						</div>
					</div>

					<!-- Base Glow (Always-On) -->
					<div class="space-y-1">
						<div class="flex items-center justify-between">
							<span class="text-xs text-[#888] flex items-center gap-1">
								<Sun size={12} /> Base Glow
							</span>
							<span class="text-xs font-mono text-[#888]">{(emissiveBase * 100).toFixed(0)}%</span>
						</div>
						<input
							type="range"
							min="0"
							max="1"
							step="0.01"
							value={emissiveBase}
							oninput={(e) => setEmissiveBase(parseFloat(e.currentTarget.value))}
							class="w-full h-1 rounded accent-purple-500"
						/>
						<div class="flex justify-between text-[10px] text-[#666]">
							<span>Off</span>
							<span>Always On</span>
						</div>
					</div>

					<!-- Voice Reactivity -->
					<div class="space-y-1">
						<div class="flex items-center justify-between">
							<span class="text-xs text-[#888] flex items-center gap-1">
								🎤 Voice Reactivity
							</span>
							<span class="text-xs font-mono text-[#888]">{(emissiveReactivity * 100).toFixed(0)}%</span>
						</div>
						<input
							type="range"
							min="0"
							max="1"
							step="0.01"
							value={emissiveReactivity}
							oninput={(e) => setEmissiveReactivity(parseFloat(e.currentTarget.value))}
							class="w-full h-1 rounded accent-purple-500"
						/>
						<div class="flex justify-between text-[10px] text-[#666]">
							<span>Static</span>
							<span>Full Dazzler</span>
						</div>
					</div>

					<!-- Live Intensity Display -->
					<div class="bg-black/50 p-2 rounded flex items-center justify-between">
						<span class="text-xs text-purple-300">Live Glow Intensity:</span>
						<span class="text-sm font-bold text-white">{(liveEmissiveIntensity * 100).toFixed(0)}%</span>
					</div>
				</div>
			{:else}
				<p class="text-xs text-[#666] italic">
					Select "Energy" material to enable reactive glow effects.
				</p>
			{/if}
		</div>

		<!-- Save Button -->
		<button class="button-primary px-4 py-2 w-full text-sm" type="button" onclick={handleSaveGlaze}>
			Save Glaze
		</button>

		<p class="text-xs text-[#888] mt-2">
			<strong>How it works:</strong> Pitch (80-600Hz) controls hue (red→purple), volume controls saturation
			& brightness (quiet=grey, loud=vivid), timbre controls texture (smooth=glossy, rough=matte). Click
			"Save Glaze" to lock the current color.
		</p>

		<div class="mt-3 p-2 bg-[#1a1a1a] border border-[#333] rounded text-xs text-[#aaa]">
			💡 <strong class="text-[#888]">Tip:</strong> Your microphone stays active for continuous live monitoring.
			The colors update in real-time as you hum or speak! Once you record at least once, this mixer will
			work even when not actively recording.
		</div>
	</div>
</div>
