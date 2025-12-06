<script lang="ts">
	import {
		sculptureStore,
		setGhostSculpture,
		clearGhostSculpture,
		setCurrentSculpture
	} from '$lib/stores/sculptureStore.svelte';
	import {
		uiStore,
		setSculptMode,
		setQuantizeEnabled,
		setSymmetryCount
	} from '$lib/stores/uiStore.svelte';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { applyDeformation } from '$lib/engine/physicsMapping';
	import { voiceLinksStore, toggleVoiceLink } from '$lib/stores/voiceLinksStore.svelte';
	import { songModeStore, enableSongMode } from '$lib/stores/songModeStore.svelte';
	import { Info, Link, Mic, Music, Sparkles, ChevronDown } from 'lucide-svelte';

	// Local state for sliders
	let twist = $state(0);
	let smoothness = $state(0.5);
	let sculptMode = $state<'additive' | 'subtractive'>('additive');
	let quantize = $derived(uiStore.modifiers.quantize);
	let symmetryCount = $state(uiStore.modifiers.symmetryCount);

	// Constraint mode for twist disabling
	let constraintMode = $derived(uiStore.constraintMode);
	let isTwistDisabled = $derived(constraintMode === 'ceramic' || constraintMode === '3d_print');

	let isDragging = $state(false);
	let previewSculpture = $state<typeof sculptureStore.currentSculpture>(null);

	// Auto-enable Song Mode on load if in song recording mode
	$effect(() => {
		if (uiStore.recordingMode === 'song' && !songModeStore.enabled) {
			enableSongMode();
		}
	});

	// Sync sliders with current sculpture
	$effect(() => {
		// Force twist to 0 if disabled
		if (isTwistDisabled && twist !== 0) {
			twist = 0;
			// Twist is now in uiStore, not sculpture
			if (uiStore.deformation.twist !== 0) {
				uiStore.deformation.twist = 0;
			}
		}

		const sculpture = sculptureStore.currentSculpture;
		if (sculpture && !isDragging) {
			twist = uiStore.deformation.twist;
			// REMOVED: verticalStretch sync
			smoothness = uiStore.activeGlaze.roughness;
			sculptMode = sculpture.physical.sculptMode ?? uiStore.sculptMode;
		} else if (!sculpture && !isDragging) {
			sculptMode = uiStore.sculptMode;
		}

		symmetryCount = uiStore.modifiers.symmetryCount;
	});

	function handlePointerDown() {
		if (!sculptureStore.currentSculpture) return;
		isDragging = true;
		const current = sculptureStore.currentSculpture;
		previewSculpture = {
			...current,
			radiusCurve: current.radiusCurve ? current.radiusCurve.map((p) => ({ ...p })) : undefined,
			physical: { ...current.physical }
		};
		applyPreview();
	}

	function applyPreview() {
		if (!previewSculpture) return;
		const radiusCurve = previewSculpture.radiusCurve || [];
		if (radiusCurve.length === 0) return;
		const deformed = applyDeformation(radiusCurve, {
			twist: twist,
			verticalStretch: 0, // REMOVED: verticalStretch feature
			taper: 0
		});
		setGhostSculpture({
			...previewSculpture,
			radiusCurve: deformed
		});
	}

	function handlePointerUp() {
		if (isDragging && previewSculpture) {
			setCurrentSculpture({
				...previewSculpture
			});
		}
		isDragging = false;
		clearGhostSculpture();
		previewSculpture = null;
	}

	// Real-time preview effect
	$effect(() => {
		if (!isDragging || !previewSculpture) return;

		const currentTwist = twist;
		// REMOVED: currentVerticalStretch
		const currentSmoothness = smoothness;

		const radiusCurve = previewSculpture.radiusCurve || [];
		if (radiusCurve.length === 0) return;

		const deformed = applyDeformation(radiusCurve, {
			twist: currentTwist,
			verticalStretch: 0, // REMOVED: verticalStretch feature
			taper: 0
		});

		setGhostSculpture({
			...previewSculpture,
			radiusCurve: deformed
		});
	});

	function toggleQuantizeFilter() {
		setQuantizeEnabled(!uiStore.modifiers.quantize);
		sculptureStore.geometryDirty = true;
	}

	function handleSymmetryInput(value: number) {
		const clamped = Math.max(0, Math.floor(value));
		symmetryCount = clamped;
		setSymmetryCount(clamped);
		sculptureStore.geometryDirty = true;
	}
</script>

<div class="h-full flex flex-col">
	<div class="p-4 space-y-2 flex-1 overflow-y-auto custom-scrollbar">
		
		<!-- QUICK START -->
		<details open class="group bg-surface-panel-alt rounded-lg overflow-hidden border border-subtle">
			<summary class="px-3 py-2 font-bold text-sm text-white cursor-pointer list-none flex items-center justify-between hover:bg-surface-alt select-none">
				<span class="flex items-center gap-2">🎯 Quick Start</span>
				<ChevronDown size={16} class="text-subtle transition-transform group-open:rotate-180" />
			</summary>
			<div class="p-3 space-y-4 border-t border-subtle bg-surface-panel/50">
				
				<!-- Recording Mode: Song Mode is the standard -->
				<div class="rounded border border-brand-primary/30 bg-brand-primary/5 p-3">
					<div class="flex items-center gap-2">
						<Music size={14} class="text-brand-primary" />
						<span class="text-sm font-medium text-brand-primary">Song Mode</span>
						<span class="text-xs opacity-70 text-secondary">1-5 min</span>
					</div>
					<p class="text-xs text-subtle mt-1">
						Sing for minutes. Your voice shapes the sculpture in real-time.
					</p>
				</div>

				<!-- How It Works -->
				<div class="text-xs text-secondary pt-2 border-t border-subtle/50">
					<p class="font-semibold mb-1">🎵 How Voice Sculpting Works:</p>
					<p class="text-subtle">Low pitch = Wide base, High pitch = Narrow top</p>
				</div>
			</div>
		</details>

		<!-- DEFORMATION -->
		<details class="group bg-surface-panel-alt rounded-lg overflow-hidden border border-subtle">
			<summary class="px-3 py-2 font-bold text-sm text-secondary cursor-pointer list-none flex items-center justify-between hover:bg-surface-alt select-none">
				<span class="flex items-center gap-2">🌪️ Deformation</span>
				<ChevronDown size={16} class="text-subtle transition-transform group-open:rotate-180" />
			</summary>
			<div class="p-3 space-y-4 border-t border-subtle bg-surface-panel/50">
				<!-- Twist Slider -->
				<div
					class={isTwistDisabled ? 'opacity-50 cursor-not-allowed' : ''}
					title={isTwistDisabled
						? 'Twisting is impossible in physical fabrication. Switch to Digital Mode to unlock.'
						: ''}
				>
					<label for="twist-slider" class="text-sm text-secondary block mb-1 flex items-center gap-2">
						Twist: {twist.toFixed(2)} ({(twist * (180 / Math.PI)).toFixed(0)}°)
						<button
							class="ml-auto p-1 rounded transition-colors {voiceLinksStore.twist === 'pitch'
								? 'bg-brand-primary text-white shadow-sm shadow-brand-primary/50'
								: 'text-subtle hover:text-secondary hover:bg-surface-alt'}"
							onclick={() => {
								if (isTwistDisabled) return;
								toggleVoiceLink('twist');
							}}
							title={isTwistDisabled
								? 'Disabled in Physical Mode'
								: voiceLinksStore.twist === 'pitch'
									? '🎤 Twist linked to PITCH (click to unlink)'
									: '🔗 Link Twist to PITCH (hands-free control)'}
							disabled={isTwistDisabled}
						>
							<Link
								size={14}
								class={voiceLinksStore.twist === 'pitch' ? 'opacity-100 stroke-2' : 'opacity-50'}
							/>
						</button>
					</label>
					<input
						id="twist-slider"
						type="range"
						min="-5"
						max="5"
						step="0.01"
						bind:value={twist}
						disabled={isTwistDisabled || voiceLinksStore.twist === 'pitch'}
						class="w-full disabled:opacity-60 disabled:cursor-not-allowed accent-brand-primary"
						onpointerdown={handlePointerDown}
						onpointerup={handlePointerUp}
					/>
					<div class="flex justify-between text-xs text-subtle mt-1">
						<span>-5 turns</span>
						<span>+5 turns</span>
					</div>
				</div>

				<!-- REMOVED: Vertical Stretch Slider - confusing during singing -->

				<!-- Smoothness Slider -->
				<div>
					<label
						for="smoothness-slider"
						class="text-sm text-secondary block mb-1 flex items-center gap-2"
						title="Controls geometry detail. Left = Blocky, Right = Smooth"
					>
						Smoothness: {smoothness.toFixed(2)}
						<button
							class="ml-auto p-1 rounded transition-colors {voiceLinksStore.roughness === 'timbre'
								? 'bg-brand-primary text-white shadow-sm shadow-brand-primary/50'
								: 'text-subtle hover:text-secondary hover:bg-surface-alt'}"
							onclick={() => toggleVoiceLink('roughness')}
							title={voiceLinksStore.roughness === 'timbre'
								? '🎤 Smoothness linked to TIMBRE (click to unlink)'
								: '🔗 Link Smoothness to TIMBRE (hands-free control)'}
						>
							<Link
								size={14}
								class={voiceLinksStore.roughness === 'timbre' ? 'opacity-100 stroke-2' : 'opacity-50'}
							/>
						</button>
					</label>
					<input
						id="smoothness-slider"
						type="range"
						min="0"
						max="1"
						step="0.01"
						bind:value={smoothness}
						disabled={voiceLinksStore.roughness === 'timbre'}
						class="w-full disabled:opacity-60 disabled:cursor-not-allowed accent-brand-primary"
						onpointerdown={handlePointerDown}
						onpointerup={handlePointerUp}
					/>
					<div class="flex justify-between text-xs text-subtle mt-1">
						<span>Blocky</span>
						<span>Smooth</span>
					</div>
				</div>
			</div>
		</details>

		<!-- MODIFIERS -->
		<details class="group bg-surface-panel-alt rounded-lg overflow-hidden border border-subtle">
			<summary class="px-3 py-2 font-bold text-sm text-secondary cursor-pointer list-none flex items-center justify-between hover:bg-surface-alt select-none">
				<span class="flex items-center gap-2">✨ Modifiers</span>
				<ChevronDown size={16} class="text-subtle transition-transform group-open:rotate-180" />
			</summary>
			<div class="p-3 space-y-4 border-t border-subtle bg-surface-panel/50">
				<div class="flex items-center justify-between gap-2 mb-3">
					<div>
						<p class="text-sm text-primary">Lego Filter (Quantize)</p>
						<p class="text-xs text-subtle">Snap radius to a grid.</p>
					</div>
					<label class="inline-flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={quantize}
							onchange={toggleQuantizeFilter}
							class="w-4 h-4 accent-brand-primary"
						/>
					</label>
				</div>
				<div>
					<label
						for="symmetry-count"
						class="text-sm text-secondary block mb-1 flex items-center gap-2"
					>
						Symmetry Lobes
						<span class="text-subtle opacity-60"><Sparkles size={12} /></span>
					</label>
					<input
						id="symmetry-count"
						type="range"
						min="0"
						max="12"
						step="1"
						bind:value={symmetryCount}
						class="w-full accent-brand-primary"
						oninput={(e) => handleSymmetryInput(parseInt((e.target as HTMLInputElement).value, 10))}
					/>
					<div class="flex justify-between text-xs text-subtle mt-1">
						<span>Off</span>
						<span>{symmetryCount} lobes</span>
					</div>
				</div>
			</div>
		</details>

		<!-- ADVANCED -->
		<details class="group bg-surface-panel-alt rounded-lg overflow-hidden border border-subtle">
			<summary class="px-3 py-2 font-bold text-sm text-secondary cursor-pointer list-none flex items-center justify-between hover:bg-surface-alt select-none">
				<span class="flex items-center gap-2">⚙️ Advanced</span>
				<ChevronDown size={16} class="text-subtle transition-transform group-open:rotate-180" />
			</summary>
			<div class="p-3 space-y-4 border-t border-subtle bg-surface-panel/50">
				<h3 class="text-sm font-semibold mb-2 text-secondary">Sculpt Mode</h3>
				{#if sculptureStore.currentSculpture}
					<div class="mb-3 bg-brand-primary/10 p-2 rounded border border-brand-primary/20">
						<p class="text-xs text-brand-primary font-medium flex items-center gap-1">
							<Sparkles size={12} /> Live Preview: Toggle Add/Subtract
						</p>
					</div>
				{/if}
				<div class="flex gap-2 mb-4">
					<button
						class="flex-1 py-2 px-3 text-sm rounded border transition-colors {sculptMode ===
						'additive'
							? 'bg-brand-primary border-brand-primary text-white'
							: 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
						onclick={() => {
							sculptMode = 'additive';
							setSculptMode('additive');
							if (sculptureStore.currentSculpture) {
								setCurrentSculpture({
									...sculptureStore.currentSculpture,
									physical: { ...sculptureStore.currentSculpture.physical, sculptMode: 'additive' }
								});
							}
						}}
					>
						Add (+)
					</button>
					<button
						class="flex-1 py-2 px-3 text-sm rounded border transition-colors {sculptMode ===
						'subtractive'
							? 'bg-brand-primary border-brand-primary text-white'
							: 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
						onclick={() => {
							sculptMode = 'subtractive';
							setSculptMode('subtractive');
							if (sculptureStore.currentSculpture) {
								setCurrentSculpture({
									...sculptureStore.currentSculpture,
									physical: { ...sculptureStore.currentSculpture.physical, sculptMode: 'subtractive' }
								});
							}
						}}
					>
						Subtract (-)
					</button>
				</div>
			</div>
		</details>
	</div>
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #444;
		border-radius: 3px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: #555;
	}
</style>
