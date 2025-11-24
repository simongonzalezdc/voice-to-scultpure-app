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
		setControlMode,
		setQuantizeEnabled,
		setSymmetryCount
	} from '$lib/stores/uiStore.svelte';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { applyDeformation } from '$lib/engine/physicsMapping';
	import { voiceLinksStore, toggleVoiceLink } from '$lib/stores/voiceLinksStore.svelte';
	import {
		Info,
		Link,
		Mic,
		Sparkles,
		BarChart,
		Music
	} from 'lucide-svelte';

	// Local state for sliders (deformation only - no duplicates!)
	let twist = $state(0);
	let verticalStretch = $state(0); // Renamed from "compression"
	let smoothness = $state(0.5); // Renamed from "roughness"
	let sculptMode = $state<'additive' | 'subtractive'>('additive');
	let controlMode = $state(uiStore.controlMode);
	let quantize = $derived(uiStore.modifiers.quantize);
	let symmetryCount = $state(uiStore.modifiers.symmetryCount);

	// Constraint mode for twist disabling
	let constraintMode = $derived(uiStore.constraintMode);
	let isTwistDisabled = $derived(constraintMode === 'ceramic' || constraintMode === '3d_print');

	let isDragging = $state(false);
	let previewSculpture = $state<typeof sculptureStore.currentSculpture>(null);

	// Sync sliders with current sculpture
	$effect(() => {
		// Force twist to 0 if disabled
		if (isTwistDisabled && twist !== 0) {
			twist = 0;
			if (
				sculptureStore.currentSculpture &&
				sculptureStore.currentSculpture.deformation.twist !== 0
			) {
				const updated = {
					...sculptureStore.currentSculpture,
					deformation: { ...sculptureStore.currentSculpture.deformation, twist: 0 }
				};
				setCurrentSculpture(updated);
			}
		}

		const sculpture = sculptureStore.currentSculpture;
		if (sculpture && !isDragging) {
			twist = sculpture.deformation.twist;
			verticalStretch = sculpture.deformation.compression;
			smoothness = sculpture.surface.textureRoughness;
			sculptMode = sculpture.physical.sculptMode ?? uiStore.sculptMode;
		} else if (!sculpture && !isDragging) {
			sculptMode = uiStore.sculptMode;
		}

		controlMode = uiStore.controlMode;
		symmetryCount = uiStore.modifiers.symmetryCount;
	});

	function handlePointerDown() {
		if (!sculptureStore.currentSculpture) return;
		isDragging = true;
		previewSculpture = {
			...sculptureStore.currentSculpture,
			radiusCurve: sculptureStore.currentSculpture.radiusCurve.map((p) => ({ ...p })),
			surface: { ...sculptureStore.currentSculpture.surface },
			deformation: { ...sculptureStore.currentSculpture.deformation },
			physical: { ...sculptureStore.currentSculpture.physical }
		};
		applyPreview();
	}

	function applyPreview() {
		if (!previewSculpture) return;
		const deformed = applyDeformation(previewSculpture.radiusCurve, {
			twist: twist,
			compression: verticalStretch,
			taper: 0
		});
		setGhostSculpture({
			...previewSculpture,
			radiusCurve: deformed,
			surface: {
				...previewSculpture.surface,
				textureRoughness: smoothness
			},
			deformation: {
				twist,
				compression: verticalStretch,
				taper: 0
			}
		});
	}

	function handlePointerUp() {
		if (isDragging && previewSculpture) {
			setCurrentSculpture({
				...previewSculpture,
				surface: {
					...previewSculpture.surface,
					textureRoughness: smoothness
				},
				deformation: {
					twist,
					compression: verticalStretch,
					taper: 0
				}
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
		const currentVerticalStretch = verticalStretch;
		const currentSmoothness = smoothness;

		const deformed = applyDeformation(previewSculpture.radiusCurve, {
			twist: currentTwist,
			compression: currentVerticalStretch,
			taper: 0
		});

		setGhostSculpture({
			...previewSculpture,
			radiusCurve: deformed,
			surface: {
				...previewSculpture.surface,
				textureRoughness: currentSmoothness
			},
			deformation: {
				twist: currentTwist,
				compression: currentVerticalStretch,
				taper: 0
			}
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
	<div class="p-4 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
		<!-- Control Mode Selector -->
		<div>
			<p class="text-sm text-secondary block mb-2">Control Mode</p>
			<div class="flex gap-2 mb-4">
				<button
					class="flex-1 py-2 px-3 text-sm rounded border transition-colors {controlMode ===
					'standard'
						? 'bg-brand-primary border-brand-primary text-white'
						: 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
					onclick={() => {
						controlMode = 'standard';
						setControlMode('standard');
					}}
					title="Standard Mode: Volume controls Radius"
				>
					<span class="flex items-center justify-center gap-2"><BarChart size={16} /> Standard</span>
				</button>
				<button
					class="flex-1 py-2 px-3 text-sm rounded border transition-colors {controlMode ===
					'melodic'
						? 'bg-brand-primary border-brand-primary text-white'
						: 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
					onclick={() => {
						controlMode = 'melodic';
						setControlMode('melodic');
					}}
					title="Virtuoso Mode: Pitch controls Radius, Volume controls Twist"
				>
					<span class="flex items-center justify-center gap-2"><Music size={16} /> Virtuoso</span>
				</button>
			</div>
		</div>

		<!-- Math Modifiers -->
		<div class="rounded border border-subtle p-3">
			<p class="text-sm text-secondary mb-2">Math Modifiers</p>
			<div class="flex items-center justify-between gap-2 mb-3">
				<div>
					<p class="text-sm text-primary">Lego Filter</p>
					<p class="text-xs text-secondary">Snap radius to a 10mm block grid.</p>
				</div>
				<label class="inline-flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						checked={quantize}
						onchange={toggleQuantizeFilter}
						class="w-4 h-4 accent-brand-primary"
					/>
					<span class="text-xs text-secondary">Quantize</span>
				</label>
			</div>
			<div>
				<label for="symmetry-count" class="text-sm text-secondary block mb-1 flex items-center gap-2">
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
				<div class="flex justify-between text-xs text-secondary mt-1">
					<span>Off</span>
					<span>{symmetryCount} lobes</span>
				</div>
			</div>
		</div>

		<!-- Deformation Sliders -->
		<div class="border-t border-subtle pt-4 space-y-4">
			<h3 class="text-sm font-semibold text-secondary">Deformation</h3>

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
					<span class="text-subtle opacity-50"><Info size={12} /></span>
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
				<div class="flex justify-between text-xs text-secondary mt-1">
					<span>-5 turns</span>
					<span>+5 turns</span>
					{#if voiceLinksStore.twist === 'pitch'}
						{#if analysisStore.micLevel < 0.001}
							<span class="text-red-500 font-semibold flex items-center gap-1 animate-pulse"
								><Mic size={12} /> No Signal</span
							>
						{:else}
							<span class="text-brand-primary font-semibold flex items-center gap-1 animate-pulse"
								><Mic size={12} /> Pitch Control Active</span
							>
						{/if}
					{/if}
				</div>
			</div>

			<!-- Vertical Stretch Slider -->
			<div>
				<label
					for="vertical-stretch-slider"
					class="text-sm text-secondary block mb-1 flex items-center gap-2"
					title="Squash or stretch the sculpture vertically"
				>
					Vertical Stretch: {verticalStretch.toFixed(2)}
					<span class="text-subtle opacity-50"><Info size={12} /></span>
				</label>
				<input
					id="vertical-stretch-slider"
					type="range"
					min="-2.0"
					max="0.95"
					step="0.01"
					bind:value={verticalStretch}
					class="w-full accent-brand-primary"
					onpointerdown={handlePointerDown}
					onpointerup={handlePointerUp}
				/>
				<div class="flex justify-between text-xs text-secondary mt-1">
					<span>Super Stretch</span>
					<span>Pancake</span>
				</div>
			</div>

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
					<span class="text-subtle opacity-50"><Info size={12} /></span>
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
				<div class="flex justify-between text-xs text-secondary mt-1">
					<span>Blocky</span>
					<span>Smooth</span>
					{#if voiceLinksStore.roughness === 'timbre'}
						<span class="text-brand-primary font-semibold flex items-center gap-1 animate-pulse"
							><Mic size={12} /> Timbre Control Active</span
						>
					{/if}
				</div>
			</div>
		</div>

		<!-- Sculpt Mode Selection -->
		<div class="border-t border-subtle pt-4">
			<h3 class="text-sm font-semibold mb-2 text-secondary">Recording Mode</h3>
			{#if sculptureStore.currentSculpture}
				<div class="mb-3 surface-panel-alt p-2 rounded">
					<p class="text-xs text-brand-primary font-medium flex items-center gap-1">
						<Sparkles size={12} /> Live Preview: Toggle between Add/Subtract to see instant shape changes!
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

