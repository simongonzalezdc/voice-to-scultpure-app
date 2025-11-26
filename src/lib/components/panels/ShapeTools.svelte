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
		setSymmetryCount,
		setRecordingMode
	} from '$lib/stores/uiStore.svelte';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { applyDeformation } from '$lib/engine/physicsMapping';
	import { voiceLinksStore, toggleVoiceLink } from '$lib/stores/voiceLinksStore.svelte';
	import { songModeStore, enableSongMode, disableSongMode } from '$lib/stores/songModeStore.svelte';
	import { Info, Link, Mic, Sparkles, BarChart, Music, Clock, Disc3, Layers, Zap } from 'lucide-svelte';

	// Local state for sliders (deformation only - no duplicates!)
	let twist = $state(0);
	let verticalStretch = $state(0); // Renamed from "compression"
	let smoothness = $state(0.5); // Renamed from "roughness"
	let sculptMode = $state<'additive' | 'subtractive'>('additive');
	let controlMode = $state(uiStore.controlMode);
	let recordingMode = $state(uiStore.recordingMode);
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
			verticalStretch = uiStore.deformation.compression;
			smoothness = uiStore.activeGlaze.roughness;
			sculptMode = sculpture.physical.sculptMode ?? uiStore.sculptMode;
		} else if (!sculpture && !isDragging) {
			sculptMode = uiStore.sculptMode;
		}

		controlMode = uiStore.controlMode;
		recordingMode = uiStore.recordingMode;
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
			compression: verticalStretch,
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
		const currentVerticalStretch = verticalStretch;
		const currentSmoothness = smoothness;

		const radiusCurve = previewSculpture.radiusCurve || [];
		if (radiusCurve.length === 0) return;

		const deformed = applyDeformation(radiusCurve, {
			twist: currentTwist,
			compression: currentVerticalStretch,
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
	<div class="p-4 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
		<!-- Control Mode: Virtuoso is Default -->
		<div class="rounded border border-brand-primary/30 bg-brand-primary/5 p-3">
			<p class="text-sm text-secondary mb-2 flex items-center gap-2">
				<Music size={14} class="text-brand-primary" />
				<span class="text-brand-primary font-medium">Virtuoso Mode</span>
				<span class="text-xs bg-brand-primary text-white px-1.5 py-0.5 rounded">ACTIVE</span>
			</p>
			<p class="text-xs text-secondary">
				🎵 <strong>Pitch controls Radius</strong> — Higher notes make wider shapes, lower notes make narrower shapes.
			</p>
			<p class="text-xs text-secondary mt-1">
				🔊 <strong>Volume controls Twist</strong> — Louder = more twist deformation.
			</p>
			
			<!-- Advanced toggle for Standard mode -->
			<details class="mt-3">
				<summary class="text-xs text-subtle cursor-pointer hover:text-secondary">
					Advanced: Switch to Standard Mode
				</summary>
				<div class="mt-2 flex gap-2">
					<button
						class="flex-1 py-1.5 px-2 text-xs rounded border transition-colors {controlMode ===
						'standard'
							? 'bg-surface-panel-alt border-brand-primary text-primary'
							: 'bg-surface-panel border-subtle text-secondary hover:border-brand-primary/50'}"
						onclick={() => {
							controlMode = 'standard';
							setControlMode('standard');
						}}
						title="Standard Mode: Volume controls Radius"
					>
						<span class="flex items-center justify-center gap-1"><BarChart size={12} /> Standard</span>
					</button>
					<button
						class="flex-1 py-1.5 px-2 text-xs rounded border transition-colors {controlMode ===
						'melodic'
							? 'bg-brand-primary border-brand-primary text-white'
							: 'bg-surface-panel border-subtle text-secondary hover:border-brand-primary/50'}"
						onclick={() => {
							controlMode = 'melodic';
							setControlMode('melodic');
						}}
						title="Virtuoso Mode: Pitch controls Radius, Volume controls Twist"
					>
						<span class="flex items-center justify-center gap-1"><Music size={12} /> Virtuoso</span>
					</button>
				</div>
			</details>
		</div>

		<!-- Recording Duration Mode -->
		<div class="rounded border border-subtle p-3">
			<p class="text-sm text-secondary mb-2 flex items-center gap-2">
				<Clock size={14} />
				Recording Duration
			</p>
			<div class="flex flex-col gap-2">
				<button
					class="w-full py-2 px-3 text-sm rounded border transition-colors text-left relative {recordingMode ===
					'song'
						? 'bg-brand-primary border-brand-primary text-white'
						: 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
					onclick={() => {
						recordingMode = 'song';
						setRecordingMode('song');
						// Auto-enable Song Mode AI features
						if (!songModeStore.enabled) {
							enableSongMode();
						}
					}}
					title="Song Mode: 1-5 minute recordings with 4x detail + AI features"
				>
					<span class="flex items-center gap-2">
						<Music size={14} />
						<span class="flex-1">Song Mode</span>
						<span class="text-xs opacity-70">1-5 min</span>
					</span>
					{#if recordingMode === 'song'}
						<span class="absolute -top-1.5 -right-1.5 px-1 py-0.5 text-[8px] font-bold rounded bg-green-500 text-white">DEFAULT</span>
					{/if}
				</button>
				<button
					class="w-full py-2 px-3 text-sm rounded border transition-colors text-left {recordingMode ===
					'coil'
						? 'bg-brand-primary border-brand-primary text-white'
						: 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
					onclick={() => {
						recordingMode = 'coil';
						setRecordingMode('coil');
						// Disable Song Mode for Coil (different workflow)
						if (songModeStore.enabled) {
							disableSongMode();
						}
					}}
					title="Coil Mode: Build up layers like coil handbuilding in pottery"
				>
					<span class="flex items-center gap-2">
						<Layers size={14} />
						<span class="flex-1">Coil Build</span>
						<span class="text-xs opacity-70">∞ layers</span>
					</span>
				</button>
				
				<!-- Quick capture mode (hidden under details) -->
				<details>
					<summary class="text-xs text-subtle cursor-pointer hover:text-secondary py-1">
						Quick Capture (10-30s)
					</summary>
					<button
						class="w-full mt-1 py-1.5 px-2 text-xs rounded border transition-colors text-left {recordingMode ===
						'standard'
							? 'bg-surface-panel-alt border-brand-primary text-primary'
							: 'bg-surface-panel border-subtle text-secondary hover:border-brand-primary/50'}"
						onclick={() => {
							recordingMode = 'standard';
							setRecordingMode('standard');
							if (songModeStore.enabled) {
								disableSongMode();
							}
						}}
						title="Standard Mode: 10-30 second recordings"
					>
						<span class="flex items-center gap-2">
							<Zap size={12} />
							<span class="flex-1">Quick Capture</span>
							<span class="text-xs opacity-70">10-30s</span>
						</span>
					</button>
				</details>
			</div>
			<p class="text-xs text-secondary mt-2">
				{#if recordingMode === 'standard'}
					Quick captures with 128-point resolution. Best for 10-30 second vocal phrases.
				{:else if recordingMode === 'song'}
					Full songs with 512-point resolution (4× detail). Sing for 1-5 minutes without losing detail.
				{:else}
					<strong class="text-brand-primary">Coil Handbuilding:</strong> Like traditional pottery coiling or FDM 3D printing. Each recording adds a new coil ring that stacks on top of the previous one.
				{/if}
			</p>
			{#if recordingMode === 'coil'}
				<div class="mt-2 p-2 bg-surface-panel-alt rounded text-xs">
					<p class="text-secondary mb-1">🏺 <strong>Pottery Metaphor:</strong></p>
					<ul class="text-secondary list-disc list-inside space-y-0.5">
						<li>Each recording = one clay coil</li>
						<li>Coils stack from bottom to top</li>
						<li>Voice shapes the coil's thickness</li>
						<li>Like FDM 3D printing layer lines</li>
					</ul>
				</div>
			{/if}
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
