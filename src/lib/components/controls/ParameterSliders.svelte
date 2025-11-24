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
	import type { SculptureDefinition, BaseShape } from '$lib/types';
	import { DEFAULT_MATERIAL_CERAMIC, DEFAULT_MATERIAL_PLASTIC } from '$lib/types';
	import { getConstraintDescription } from '$lib/engine/constraints';
	import type { ConstraintMode } from '$lib/engine/constraints';
	import { voiceLinksStore, toggleVoiceLink } from '$lib/stores/voiceLinksStore.svelte';
	import {
		Info,
		Cylinder,
		Circle,
		Box,
		FileText,
		Link,
		Mic,
		Lock,
		Sparkles,
		Wand,
		Printer,
		BarChart,
		Music
	} from 'lucide-svelte';

	let height = $state(150); // Height in mm (default 150mm)
	let twist = $state(0);
	let verticalStretch = $state(0); // Range: -0.5 (stretch) to 0.5 (squash) - RENAMED: was "compression" to avoid audio confusion
	let roughness = $state(0.5);
	let glaze = $state(0.3);
	let materialType = $state<'ceramic' | 'plastic'>('ceramic');
	let baseColor = $state(DEFAULT_MATERIAL_CERAMIC);
	let sculptMode = $state<'additive' | 'subtractive'>('additive');
	let constraintMode = $derived(uiStore.constraintMode); // DIRECTIVE: Constraints in Design tab
	let controlMode = $state(uiStore.controlMode);
	// DIRECTIVE 1: The "Twist" Ban
	// Twist is impossible in physical fabrication (Ceramic/3D Print) without complex supports or manual intervention
	let isTwistDisabled = $derived(constraintMode === 'ceramic' || constraintMode === '3d_print');
	let quantize = $derived(uiStore.modifiers.quantize);
	let symmetryCount = $state(uiStore.modifiers.symmetryCount);

	let isDragging = $state(false);
	let previewSculpture = $state<typeof sculptureStore.currentSculpture>(null);

	// Sync sliders with current sculpture or uiStore
	$effect(() => {
		// Force twist to 0 if disabled
		if (isTwistDisabled && twist !== 0) {
			twist = 0;
			// If we are dragging or have a sculpture, we might need to update it?
			// Actually, the effect below handles sync, but we should ensure local state is 0.
			// And if a sculpture exists, we should update it to remove twist?
			// Ideally, we just prevent user from changing it.
			// But if they switch modes, we should probably reset it.
			if (
				sculptureStore.currentSculpture &&
				sculptureStore.currentSculpture.deformation.twist !== 0
			) {
				// Auto-correct existing sculpture
				const updated = {
					...sculptureStore.currentSculpture,
					deformation: { ...sculptureStore.currentSculpture.deformation, twist: 0 }
				};
				setCurrentSculpture(updated);
			}
		}

		const sculpture = sculptureStore.currentSculpture;
		if (sculpture && !isDragging) {
			height = sculpture.physical.height;
			twist = uiStore.deformation.twist;
			verticalStretch = uiStore.deformation.compression;
			roughness = uiStore.activeGlaze.roughness;
			glaze = 0.3; // Default glaze transmission (removed from sculpture)
			materialType = 'ceramic'; // Default to ceramic
			baseColor = DEFAULT_MATERIAL_CERAMIC;
			sculptMode = sculpture.physical.sculptMode ?? uiStore.sculptMode;
		} else if (!sculpture && !isDragging) {
			// When no sculpture exists, sync from uiStore
			sculptMode = uiStore.sculptMode;
		}

		// Sync control mode from uiStore
		controlMode = uiStore.controlMode;
		symmetryCount = uiStore.modifiers.symmetryCount;
	});

	function handlePointerDown() {
		if (!sculptureStore.currentSculpture) return;
		isDragging = true;
		// Clone sculpture for preview - DIRECTIVE 4: Include physical height
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
				textureRoughness: roughness,
				glazeTransmission: glaze,
				materialType: materialType,
				baseColor: baseColor
			},
			deformation: {
				twist,
				compression: verticalStretch,
				taper: 0
			},
			physical: {
				...previewSculpture.physical,
				height: height, // DIRECTIVE 4: Update height from slider
				sculptMode: sculptMode
			}
		});
	}

	function handlePointerUp() {
		if (isDragging && previewSculpture) {
			// Commit changes - DIRECTIVE 1: Non-destructive! Never overwrite radiusCurve
			// FIX: Do NOT apply deformation to radiusCurve here.
			// The Sculpture component handles that visually based on the deformation params.
			setCurrentSculpture({
				...previewSculpture,
				// radiusCurve: previewSculpture.radiusCurve, // Keep original!
				surface: {
					...previewSculpture.surface,
					textureRoughness: roughness,
					glazeTransmission: glaze,
					materialType: materialType,
					baseColor: baseColor
				},
				deformation: {
					twist,
					compression: verticalStretch,
					taper: 0
				},
				physical: {
					...previewSculpture.physical,
					height: height, // DIRECTIVE 4: Include height in committed changes
					sculptMode: sculptMode
				}
			});
		}
		isDragging = false;
		clearGhostSculpture();
		previewSculpture = null;
	}

	// React to slider value changes in real-time when dragging
	// Track all slider values to create reactive dependencies
	$effect(() => {
		if (!isDragging || !previewSculpture) return;

		// Access slider values to create reactive dependencies
		const currentHeight = height;
		const currentTwist = twist;
		const currentVerticalStretch = verticalStretch;
		const currentRoughness = roughness;
		const currentGlaze = glaze;

		// Apply preview with current values - DIRECTIVE 4: Include height
		// FIX: For ghost, we DO want to see the deformation, so we apply it to the ghost's radiusCurve
		// BUT we must ensure we start from the ORIGINAL radiusCurve, not the already deformed one.
		// previewSculpture.radiusCurve is the clean copy we made in handlePointerDown.

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
				textureRoughness: currentRoughness,
				glazeTransmission: currentGlaze,
				materialType: materialType,
				baseColor: baseColor
			},
			deformation: {
				twist: currentTwist,
				compression: currentVerticalStretch,
				taper: 0
			},
			physical: {
				...previewSculpture.physical,
				height: currentHeight,
				sculptMode: sculptMode
			}
		});
	});

	function handleMaterialChange() {
		if (!sculptureStore.currentSculpture) return;
		const updated: SculptureDefinition = {
			...sculptureStore.currentSculpture,
			surface: {
				...sculptureStore.currentSculpture.surface,
				materialType: materialType
			}
		};
		setCurrentSculpture(updated);
	}

	// DIRECTIVE: Handle constraint mode changes in Design tab
	// Constraints apply immediately and persist through all subsequent deformations
	function handleConstraintModeChange(mode: ConstraintMode) {
		uiStore.constraintMode = mode;
		console.log(`🏺 [CONSTRAINT] Mode changed to "${mode}" - constraints now apply to all shapes!`);
	}

	function handleColorChange() {
		if (!sculptureStore.currentSculpture) return;
		const updated: SculptureDefinition = {
			...sculptureStore.currentSculpture,
			surface: {
				...sculptureStore.currentSculpture.surface,
				baseColor: baseColor
			}
		};
		setCurrentSculpture(updated);
	}

	// DIRECTIVE 3: Handle base shape change with confirmation
	function handleBaseShapeChange(newShape: BaseShape) {
		const currentShape = sculptureStore.currentSculpture?.baseShape || 'lathe';
		if (newShape === currentShape) return;

		// Warning: Changing base shape wipes the current sculpture
		if (sculptureStore.currentSculpture) {
			const confirmed = confirm(
				`Changing base shape from ${currentShape} to ${newShape} will reset the current sculpture. Continue?`
			);
			if (!confirmed) return;
		}

		// Create new sculpture with the selected base shape
		if (sculptureStore.currentSculpture) {
			const updated: SculptureDefinition = {
				...sculptureStore.currentSculpture,
				baseShape: newShape,
				// Reset radiusCurve if not lathe (per Directive 1)
				radiusCurve: newShape === 'lathe' ? sculptureStore.currentSculpture.radiusCurve : []
			};
			setCurrentSculpture(updated);
		} else {
			// If no sculpture exists, create a new one with the selected shape
			// This would typically be handled by NewProjectModal, but we can set a default
			console.warn('No sculpture exists - base shape change requires an existing sculpture');
		}
	}

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

<div class="surface-panel p-4 rounded-lg">
	<h2 class="text-lg font-semibold mb-4">Sculpture Parameters</h2>
	<div class="space-y-4">
		<!-- Control Mode Selector (DIRECTIVE 3) -->
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
					<span class="flex items-center justify-center gap-2"><BarChart size={16} /> Standard</span
					>
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

		<!-- Base Shape Selector (DIRECTIVE 3: Sonic Force Mode) -->
		<div>
			<p class="text-sm text-secondary block mb-2">Base Shape</p>
			<div class="grid grid-cols-4 gap-2">
				<button
					type="button"
					class="px-3 py-2 text-sm rounded transition-colors {!sculptureStore.currentSculpture
						?.baseShape || sculptureStore.currentSculpture?.baseShape === 'lathe'
						? 'bg-brand-primary text-white'
						: 'bg-surface-alt text-secondary hover:text-primary hover:bg-surface-panel-alt'}"
					onclick={() => handleBaseShapeChange('lathe')}
					title="Vase (Lathe)"
				>
					<span class="flex items-center gap-2"><Cylinder size={16} /> Vase</span>
				</button>
				<button
					type="button"
					class="px-3 py-2 text-sm rounded transition-colors {sculptureStore.currentSculpture
						?.baseShape === 'sphere'
						? 'bg-brand-primary text-white'
						: 'bg-surface-alt text-secondary hover:text-primary hover:bg-surface-panel-alt'}"
					onclick={() => handleBaseShapeChange('sphere')}
					title="Sphere"
				>
					<span class="flex items-center gap-2"><Circle size={16} /> Sphere</span>
				</button>
				<button
					type="button"
					class="px-3 py-2 text-sm rounded transition-colors {sculptureStore.currentSculpture
						?.baseShape === 'cube'
						? 'bg-brand-primary text-white'
						: 'bg-surface-alt text-secondary hover:text-primary hover:bg-surface-panel-alt'}"
					onclick={() => handleBaseShapeChange('cube')}
					title="Block (Cube)"
				>
					<span class="flex items-center gap-2"><Box size={16} /> Block</span>
				</button>
				<button
					type="button"
					class="px-3 py-2 text-sm rounded transition-colors {sculptureStore.currentSculpture
						?.baseShape === 'plane'
						? 'bg-brand-primary text-white'
						: 'bg-surface-alt text-secondary hover:text-primary hover:bg-surface-panel-alt'}"
					onclick={() => handleBaseShapeChange('plane')}
					title="Plane"
				>
					<span class="flex items-center gap-2"><FileText size={16} /> Plane</span>
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
					class="w-full"
					oninput={(e) => handleSymmetryInput(parseInt((e.target as HTMLInputElement).value, 10))}
				/>
				<div class="flex justify-between text-xs text-secondary mt-1">
					<span>Off</span>
					<span>{symmetryCount} lobes</span>
				</div>
			</div>
		</div>

		<!-- Height Slider -->
		<div>
			<label
				for="height-slider"
				class="text-sm text-secondary block mb-1 flex items-center gap-2"
				title="Adjusts the physical height of the sculpture (10mm to 1000mm = 1 meter)"
			>
				Height: {height.toFixed(0)}mm
				<span class="text-subtle opacity-50"><Info size={12} /></span>
			</label>
			<input
				id="height-slider"
				type="range"
				min="10"
				max="1000"
				step="5"
				bind:value={height}
				class="w-full"
				onpointerdown={handlePointerDown}
				onpointerup={handlePointerUp}
			/>
			<div class="flex justify-between text-xs text-secondary mt-1">
				<span>1cm</span>
				<span>1 meter</span>
			</div>
		</div>

		<!-- Twist Slider - DIRECTIVE 1: With Voice Link -->
		<div
			class={isTwistDisabled ? 'opacity-50 cursor-not-allowed' : ''}
			title={isTwistDisabled
				? 'Twisting is impossible in physical fabrication. Switch to Digital Mode to unlock.'
				: ''}
		>
			<label for="twist-slider" class="text-sm text-secondary block mb-1 flex items-center gap-2">
				Twist: {twist.toFixed(2)} ({(twist * (180 / Math.PI)).toFixed(0)}°)
				<!-- DIRECTIVE 1: Voice Link Button for Twist -->
				<button
					class="ml-auto p-1 rounded transition-colors {voiceLinksStore.twist === 'pitch'
						? 'bg-brand-primary text-white shadow-sm shadow-brand-primary/50'
						: 'text-subtle hover:text-secondary hover:bg-surface-alt'}"
					onclick={() => {
						if (isTwistDisabled) return;
						// DIRECTIVE 3: Improved Toggle Logic
						if (voiceLinksStore.twist === 'pitch') {
							toggleVoiceLink('twist'); // Will set to none
						} else {
							toggleVoiceLink('twist'); // Will set to pitch
						}
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
				class="w-full disabled:opacity-60 disabled:cursor-not-allowed {voiceLinksStore.twist ===
				'pitch'
					? analysisStore.micLevel < 0.001
						? 'accent-red-500'
						: 'accent-brand-primary'
					: ''}"
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

		<!-- Compression Slider -->
		<div>
			<label
				for="compression-slider"
				class="text-sm text-secondary block mb-1 flex items-center gap-2"
				title="Squash or stretch the sculpture vertically. -0.5 = Super Stretch | 0 = Normal | 0.5 = Pancake"
			>
				Vertical Stretch: {verticalStretch.toFixed(2)}
				<span class="text-subtle opacity-50"><Info size={12} /></span>
			</label>
			<input
				id="compression-slider"
				type="range"
				min="-2.0"
				max="0.95"
				step="0.01"
				bind:value={verticalStretch}
				class="w-full"
				onpointerdown={handlePointerDown}
				onpointerup={handlePointerUp}
			/>
			<div class="flex justify-between text-xs text-secondary mt-1">
				<span>Super Stretch</span>
				<span>Pancake</span>
			</div>
		</div>

		<!-- Resolution Slider (Formerly Roughness) - DIRECTIVE 1: With Voice Link -->
		<div>
			<label
				for="roughness-slider"
				class="text-sm text-secondary block mb-1 flex items-center gap-2"
				title="Controls geometry resolution. Left = Low Poly/Blocky, Right = Smooth/Round"
			>
				Resolution: {roughness.toFixed(2)}
				<!-- DIRECTIVE 1: Voice Link Button for Roughness/Timbre -->
				<button
					class="ml-auto p-1 rounded transition-colors {voiceLinksStore.roughness === 'timbre'
						? 'bg-brand-primary text-white shadow-sm shadow-brand-primary/50'
						: 'text-subtle hover:text-secondary hover:bg-surface-alt'}"
					onclick={() => {
						// DIRECTIVE 3: Improved Toggle Logic
						if (voiceLinksStore.roughness === 'timbre') {
							toggleVoiceLink('roughness'); // Will set to none
						} else {
							toggleVoiceLink('roughness'); // Will set to timbre
						}
					}}
					title={voiceLinksStore.roughness === 'timbre'
						? '🎤 Roughness linked to TIMBRE (click to unlink)'
						: '🔗 Link Roughness to TIMBRE (hands-free control)'}
				>
					<Link
						size={14}
						class={voiceLinksStore.roughness === 'timbre' ? 'opacity-100 stroke-2' : 'opacity-50'}
					/>
				</button>
				<span class="text-subtle opacity-50"><Info size={12} /></span>
			</label>
			<input
				id="roughness-slider"
				type="range"
				min="0"
				max="1"
				step="0.01"
				bind:value={roughness}
				disabled={voiceLinksStore.roughness === 'timbre'}
				class="w-full disabled:opacity-60 disabled:cursor-not-allowed {voiceLinksStore.roughness ===
				'timbre'
					? 'accent-brand-primary'
					: ''}"
				onpointerdown={handlePointerDown}
				onpointerup={handlePointerUp}
			/>
			<div class="flex justify-between text-xs text-secondary mt-1">
				<span>Low Poly</span>
				<span>Smooth</span>
				{#if voiceLinksStore.roughness === 'timbre'}
					<span class="text-brand-primary font-semibold flex items-center gap-1 animate-pulse"
						><Mic size={12} /> Timbre Control Active</span
					>
				{/if}
			</div>
		</div>

		<!-- Glaze Slider -->
		<div>
			<label
				for="glaze-slider"
				class="text-sm text-secondary block mb-1 flex items-center gap-2"
				title="Controls how glass-like or clay-like the surface appears"
			>
				Glaze: {glaze.toFixed(2)}
				<span class="text-subtle opacity-50"><Info size={12} /></span>
			</label>
			<input
				id="glaze-slider"
				type="range"
				min="0"
				max="1"
				step="0.01"
				bind:value={glaze}
				class="w-full"
				onpointerdown={handlePointerDown}
				onpointerup={handlePointerUp}
			/>
		</div>

		<!-- DIRECTIVE: Fabrication Constraints (Persistent) -->
		<!-- These constraints apply immediately and persist through ALL deformations -->
		<div class="border-t border-subtle pt-4">
			<h3 class="text-sm font-semibold mb-2 text-secondary">Fabrication Constraints</h3>
			<p class="text-xs text-secondary opacity-75 mb-3">
				Physical constraints that persist through all slider adjustments. Ensures manufacturable
				shapes.
			</p>

			<div class="flex gap-2 mb-4">
				<button
					class="flex-1 py-2 px-3 text-sm rounded border transition-colors {constraintMode ===
					'digital'
						? 'bg-brand-primary border-brand-primary text-white'
						: 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
					onclick={() => handleConstraintModeChange('digital')}
					title="Full creative freedom - may produce impossible shapes"
				>
					<span class="flex items-center justify-center gap-2"><Wand size={16} /> Digital</span>
				</button>
				<button
					class="flex-1 py-2 px-3 text-sm rounded border transition-colors {constraintMode ===
					'ceramic'
						? 'bg-brand-primary border-brand-primary text-white'
						: 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
					onclick={() => handleConstraintModeChange('ceramic')}
					title="Pottery wheel physics: hand access, smooth clay, stable base"
				>
					<span class="flex items-center justify-center gap-2"><Cylinder size={16} /> Ceramic</span>
				</button>
				<button
					class="flex-1 py-2 px-3 text-sm rounded border transition-colors {constraintMode ===
					'3d_print'
						? 'bg-brand-primary border-brand-primary text-white'
						: 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
					onclick={() => handleConstraintModeChange('3d_print')}
					title="FDM printer constraints: 60° overhangs, solid contiguous geometry"
				>
					<span class="flex items-center justify-center gap-2"><Printer size={16} /> 3D Print</span>
				</button>
			</div>

			<!-- Constraint Info -->
			<div class="surface-panel-alt p-2 rounded text-xs text-secondary mb-3">
				{getConstraintDescription(constraintMode)}
			</div>

			<!-- Ceramic-specific info -->
			{#if constraintMode === 'ceramic'}
				<div class="p-2 rounded bg-[#2a1a1a] border border-[#8f3e48] text-xs">
					<p class="text-[#e0a090] font-medium mb-1 flex items-center gap-1">
						<Cylinder size={12} /> Persistent Constraints:
					</p>
					<ul class="text-[#d0908a] space-y-0.5 list-disc list-inside text-xs">
						<li>Min Width: 70mm (hand access)</li>
						<li>Clay Smoothing: Audio jitter → smooth flow</li>
						<li>Apply on EVERY slide change - guaranteed viable vessels!</li>
					</ul>
				</div>
			{/if}
		</div>

		<!-- Sculpt Mode Selection -->
		<div class="border-t border-subtle pt-4">
			<h3 class="text-sm font-semibold mb-2 text-secondary">Sculpt Mode</h3>
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
						setSculptMode('additive'); // Always update uiStore to persist selection
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
						setSculptMode('subtractive'); // Always update uiStore to persist selection
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

		<!-- Material Type Selection -->
		<div class="border-t border-subtle pt-4">
			<h3 class="text-sm font-semibold mb-2 text-secondary">Material</h3>
			<div class="flex gap-2 mb-3">
				<button
					class="flex-1 py-2 px-3 text-sm rounded border transition-colors {materialType ===
					'ceramic'
						? 'bg-brand-primary border-brand-primary text-white'
						: 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
					onclick={() => {
						materialType = 'ceramic';
						handleMaterialChange();
					}}
				>
					Ceramic
				</button>
				<button
					class="flex-1 py-2 px-3 text-sm rounded border transition-colors {materialType ===
					'plastic'
						? 'bg-brand-primary border-brand-primary text-white'
						: 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
					onclick={() => {
						materialType = 'plastic';
						handleMaterialChange();
					}}
				>
					Plastic
				</button>
			</div>

			<!-- Base Color Picker -->
			<label for="base-color" class="text-sm text-secondary block mb-1"> Base Color </label>
			<div class="flex gap-2 items-center">
				<input
					id="base-color"
					type="color"
					bind:value={baseColor}
					onchange={handleColorChange}
					class="w-8 h-8 rounded cursor-pointer border-none p-0 bg-transparent"
				/>
				<span class="text-xs text-secondary font-mono uppercase">{baseColor}</span>
			</div>
		</div>
	</div>
</div>
