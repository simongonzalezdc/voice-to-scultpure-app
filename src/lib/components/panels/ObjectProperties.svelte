<script lang="ts">
import { sculptureStore, setCurrentSculpture } from '$lib/stores/sculptureStore.svelte';
import { uiStore, setFacetStyle, setProfileStyle, setMusicalDetailIntensity, type FacetStyle, type ProfileStyle } from '$lib/stores/uiStore.svelte';
	import { DEFAULT_MATERIAL_CERAMIC, DEFAULT_MATERIAL_PLASTIC } from '$lib/types';
	import type { BaseShape } from '$lib/types';
	import { getConstraintDescription, getConstraintIcon } from '$lib/engine/constraints';
	import { Cylinder, Circle, Box, FileText, Ruler, AlertTriangle, Check, Diamond, Gem, Hexagon, Octagon, Layers, Waves, Music, Shell } from 'lucide-svelte';
	import { DEFAULT_HEIGHT_MM } from '$lib/config/constants';

	// Reactive state from current sculpture
	const currentSculpture = $derived(sculptureStore.currentSculpture);

	// Local editing state (height removed - set at export time only)
	let materialType = $state<'ceramic' | 'plastic'>('ceramic');
	let baseColor = $state(DEFAULT_MATERIAL_CERAMIC);
	let baseShape = $state<BaseShape>('lathe');

	// Reactive constraint mode from uiStore
	const constraintMode = $derived(uiStore.constraintMode);
	const autoFixGeometry = $derived(uiStore.autoFixGeometry ?? true);

	// Sync with sculpture changes
	$effect(() => {
		if (currentSculpture) {
			materialType = 'ceramic'; // Default - material type is now in uiStore
			baseColor = uiStore.activeGlaze.color || DEFAULT_MATERIAL_CERAMIC;
			baseShape = currentSculpture.baseShape || 'lathe';
		}
	});

	function updateMaterial() {
		// Material type is now handled via uiStore, not sculpture
		const newColor =
			materialType === 'ceramic' ? DEFAULT_MATERIAL_CERAMIC : DEFAULT_MATERIAL_PLASTIC;
		uiStore.activeGlaze.color = newColor;
		baseColor = newColor;
	}

	function updateColor() {
		// Base color is now handled via uiStore.activeGlaze.color, not sculpture
		uiStore.activeGlaze.color = baseColor;
	}

	function updateBaseShape(newShape: BaseShape) {
		if (!currentSculpture) return;

		const currentShape = currentSculpture.baseShape || 'lathe';
		if (newShape === currentShape) return;

		// Warning: Changing base shape resets sculpture
		const confirmed = confirm(
			`Changing base shape from ${currentShape} to ${newShape} will reset the current sculpture. Continue?`
		);
		if (!confirmed) {
			baseShape = currentShape; // Revert
			return;
		}

		setCurrentSculpture({
			...currentSculpture,
			baseShape: newShape,
			radiusCurve: newShape === 'lathe' ? currentSculpture.radiusCurve : []
		});
	}

	// Calculate real-world dimensions in mm
	const sculptureHeightMm = $derived(() => {
		if (!currentSculpture) return DEFAULT_HEIGHT_MM;
		return currentSculpture.physical?.height ?? DEFAULT_HEIGHT_MM;
	});

	const sculptureMaxWidthMm = $derived(() => {
		if (!currentSculpture || !currentSculpture.radiusCurve?.length) return 0;
		const maxRadius = Math.max(...currentSculpture.radiusCurve.map(p => p.x));
		// Width = diameter = 2 * radius * height ratio
		return Math.round(maxRadius * 2 * sculptureHeightMm());
	});

	const sculptureBaseWidthMm = $derived(() => {
		if (!currentSculpture || !currentSculpture.radiusCurve?.length) return 0;
		const baseRadius = currentSculpture.radiusCurve[0]?.x ?? 0;
		return Math.round(baseRadius * 2 * sculptureHeightMm());
	});

	// Check if sculpture fits in print volume
	const fitsInPrintVolume = $derived(() => {
		const volume = uiStore.printVolumeMm;
		const height = sculptureHeightMm();
		const width = sculptureMaxWidthMm();
		return height <= volume && width <= volume;
	});

	// Facet style - current value from uiStore
	const facetStyle = $derived(uiStore.facetStyle);

	// Facet style descriptions
	function getFacetStyleDescription(style: FacetStyle): string {
		switch (style) {
			case 'smooth':
				return 'Traditional ceramic curves, organic and fluid. Best for classic pottery aesthetics.';
			case 'crystalline':
				return 'Gem-like facets that catch light beautifully. Creates striking angular fins.';
			case 'angular':
				return 'Bold architectural cuts with dramatic edges. Modern and sculptural.';
			case 'minimal':
				return 'Dramatic octagonal cross-section. Maximum geometric impact.';
		}
	}

	function getFacetStyleSegments(style: FacetStyle): number {
		switch (style) {
			case 'smooth': return 96;
			case 'crystalline': return 32;
			case 'angular': return 16;
			case 'minimal': return 8;
		}
	}

	// Profile style - current value from uiStore
	const profileStyle = $derived(uiStore.profileStyle ?? 'natural');

	// Profile style descriptions
	function getProfileStyleDescription(style: ProfileStyle): string {
		switch (style) {
			case 'natural':
				return 'Direct voice-to-form mapping. Your singing shapes the silhouette naturally.';
			case 'terraced':
				return 'Stepped shelves like a ziggurat. Each terrace represents a pitch band.';
			case 'spiral':
				return 'Nautilus-like twist. Creates a dynamic helical bulge pattern.';
			case 'rippled':
				return 'Organic water-like ripples. Multiple overlapping wave frequencies.';
		}
	}

	// Musical detail intensity - current value from uiStore
	const musicalDetail = $derived(uiStore.musicalDetailIntensity ?? 0.5);
	let localMusicalDetail = $state(0.5);
	
	// Sync local state with store
	$effect(() => {
		localMusicalDetail = uiStore.musicalDetailIntensity ?? 0.5;
	});

	function handleMusicalDetailChange(e: Event) {
		const value = parseFloat((e.target as HTMLInputElement).value);
		setMusicalDetailIntensity(value);
	}

	function getMusicalDetailLabel(value: number): string {
		if (value < 0.25) return 'Subtle';
		if (value < 0.5) return 'Gentle';
		if (value < 0.75) return 'Expressive';
		return 'Dramatic';
	}
</script>

<div class="h-full flex flex-col bg-surface-panel">
	<!-- Header -->
	<div class="p-4 border-b border-subtle">
		<h2 class="text-sm font-bold text-white uppercase tracking-wider">Object Properties</h2>
		<p class="text-xs text-secondary mt-1">Single source of truth</p>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
		<!-- Base Shape -->
		<div role="group" aria-labelledby="base-shape-label">
			<span id="base-shape-label" class="text-sm font-semibold text-secondary block mb-2"
				>Base Shape</span
			>
			<div class="grid grid-cols-2 gap-2">
				<button
					type="button"
					class="px-3 py-2 text-sm rounded transition-colors flex items-center justify-center gap-2 {baseShape ===
					'lathe'
						? 'bg-brand-primary text-white'
						: 'bg-surface-alt text-secondary hover:text-primary hover:bg-surface-panel-alt'}"
					onclick={() => updateBaseShape('lathe')}
					title="Vase (Lathe)"
				>
					<Cylinder size={16} />
					<span>Vase</span>
				</button>
				<button
					type="button"
					class="px-3 py-2 text-sm rounded transition-colors flex items-center justify-center gap-2 {baseShape ===
					'sphere'
						? 'bg-brand-primary text-white'
						: 'bg-surface-alt text-secondary hover:text-primary hover:bg-surface-panel-alt'}"
					onclick={() => updateBaseShape('sphere')}
					title="Sphere"
				>
					<Circle size={16} />
					<span>Sphere</span>
				</button>
				<button
					type="button"
					class="px-3 py-2 text-sm rounded transition-colors flex items-center justify-center gap-2 {baseShape ===
					'cube'
						? 'bg-brand-primary text-white'
						: 'bg-surface-alt text-secondary hover:text-primary hover:bg-surface-panel-alt'}"
					onclick={() => updateBaseShape('cube')}
					title="Block (Cube)"
				>
					<Box size={16} />
					<span>Block</span>
				</button>
				<button
					type="button"
					class="px-3 py-2 text-sm rounded transition-colors flex items-center justify-center gap-2 {baseShape ===
					'plane'
						? 'bg-brand-primary text-white'
						: 'bg-surface-alt text-secondary hover:text-primary hover:bg-surface-panel-alt'}"
					onclick={() => updateBaseShape('plane')}
					title="Plane"
				>
					<FileText size={16} />
					<span>Plane</span>
				</button>
			</div>
		</div>

		<!-- Facet Style (Aesthetic) -->
		<div class="border-t border-subtle pt-4">
			<h3 class="text-sm font-semibold text-secondary mb-2 flex items-center gap-2">
				<Gem size={14} />
				Facet Style
			</h3>
			<p class="text-xs text-secondary opacity-75 mb-3">
				Controls angular vs. smooth aesthetic
			</p>
			
			<div class="grid grid-cols-2 gap-2 mb-2">
				<button
					type="button"
					class="px-3 py-2 text-sm rounded transition-colors flex items-center justify-center gap-2 {facetStyle === 'smooth'
						? 'bg-brand-primary text-white'
						: 'bg-surface-alt text-secondary hover:text-primary hover:bg-surface-panel-alt'}"
					onclick={() => setFacetStyle('smooth')}
					title={getFacetStyleDescription('smooth')}
				>
					<Circle size={14} />
					<span>Smooth</span>
				</button>
				<button
					type="button"
					class="px-3 py-2 text-sm rounded transition-colors flex items-center justify-center gap-2 {facetStyle === 'crystalline'
						? 'bg-brand-primary text-white'
						: 'bg-surface-alt text-secondary hover:text-primary hover:bg-surface-panel-alt'}"
					onclick={() => setFacetStyle('crystalline')}
					title={getFacetStyleDescription('crystalline')}
				>
					<Gem size={14} />
					<span>Crystalline</span>
				</button>
				<button
					type="button"
					class="px-3 py-2 text-sm rounded transition-colors flex items-center justify-center gap-2 {facetStyle === 'angular'
						? 'bg-brand-primary text-white'
						: 'bg-surface-alt text-secondary hover:text-primary hover:bg-surface-panel-alt'}"
					onclick={() => setFacetStyle('angular')}
					title={getFacetStyleDescription('angular')}
				>
					<Hexagon size={14} />
					<span>Angular</span>
				</button>
				<button
					type="button"
					class="px-3 py-2 text-sm rounded transition-colors flex items-center justify-center gap-2 {facetStyle === 'minimal'
						? 'bg-brand-primary text-white'
						: 'bg-surface-alt text-secondary hover:text-primary hover:bg-surface-panel-alt'}"
					onclick={() => setFacetStyle('minimal')}
					title={getFacetStyleDescription('minimal')}
				>
					<Octagon size={14} />
					<span>Minimal</span>
				</button>
			</div>
			
			<div class="bg-surface-alt p-2 rounded text-xs text-secondary">
				<span class="font-mono text-primary">{getFacetStyleSegments(facetStyle)}</span> facets · {getFacetStyleDescription(facetStyle)}
			</div>
		</div>

		<!-- Musical Detail Intensity -->
		<div class="border-t border-subtle pt-4">
			<h3 class="text-sm font-semibold text-secondary mb-2 flex items-center gap-2">
				<Music size={14} />
				Musical Detail
			</h3>
			<p class="text-xs text-secondary opacity-75 mb-3">
				How much musical features affect the shape
			</p>
			
			<div class="space-y-2">
				<div class="flex justify-between text-xs">
					<span class="text-secondary">Subtle</span>
					<span class="text-primary font-semibold">{getMusicalDetailLabel(localMusicalDetail)}</span>
					<span class="text-secondary">Dramatic</span>
				</div>
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					bind:value={localMusicalDetail}
					oninput={handleMusicalDetailChange}
					class="w-full h-2 bg-surface-alt rounded-lg appearance-none cursor-pointer accent-brand-primary"
				/>
				<div class="text-center text-xs text-secondary">
					<span class="font-mono text-primary">{(localMusicalDetail * 100).toFixed(0)}%</span> intensity
				</div>
			</div>
			
			<div class="bg-surface-alt p-2 rounded text-xs text-secondary mt-2">
				Beat ridges, phrase markers, and pitch contours scale with this setting.
			</div>
		</div>

		<!-- Profile Style (Silhouette) -->
		<div class="border-t border-subtle pt-4">
			<h3 class="text-sm font-semibold text-secondary mb-2 flex items-center gap-2">
				<Waves size={14} />
				Profile Style
			</h3>
			<p class="text-xs text-secondary opacity-75 mb-3">
				Silhouette shape transformation
			</p>
			
			<div class="grid grid-cols-2 gap-2 mb-2">
				<button
					type="button"
					class="px-3 py-2 text-sm rounded transition-colors flex items-center justify-center gap-2 {profileStyle === 'natural'
						? 'bg-brand-primary text-white'
						: 'bg-surface-alt text-secondary hover:text-primary hover:bg-surface-panel-alt'}"
					onclick={() => setProfileStyle('natural')}
					title={getProfileStyleDescription('natural')}
				>
					<Circle size={14} />
					<span>Natural</span>
				</button>
				<button
					type="button"
					class="px-3 py-2 text-sm rounded transition-colors flex items-center justify-center gap-2 {profileStyle === 'terraced'
						? 'bg-brand-primary text-white'
						: 'bg-surface-alt text-secondary hover:text-primary hover:bg-surface-panel-alt'}"
					onclick={() => setProfileStyle('terraced')}
					title={getProfileStyleDescription('terraced')}
				>
					<Layers size={14} />
					<span>Terraced</span>
				</button>
				<button
					type="button"
					class="px-3 py-2 text-sm rounded transition-colors flex items-center justify-center gap-2 {profileStyle === 'spiral'
						? 'bg-brand-primary text-white'
						: 'bg-surface-alt text-secondary hover:text-primary hover:bg-surface-panel-alt'}"
					onclick={() => setProfileStyle('spiral')}
					title={getProfileStyleDescription('spiral')}
				>
					<Shell size={14} />
					<span>Spiral</span>
				</button>
				<button
					type="button"
					class="px-3 py-2 text-sm rounded transition-colors flex items-center justify-center gap-2 {profileStyle === 'rippled'
						? 'bg-brand-primary text-white'
						: 'bg-surface-alt text-secondary hover:text-primary hover:bg-surface-panel-alt'}"
					onclick={() => setProfileStyle('rippled')}
					title={getProfileStyleDescription('rippled')}
				>
					<Waves size={14} />
					<span>Rippled</span>
				</button>
			</div>
			
			<div class="bg-surface-alt p-2 rounded text-xs text-secondary">
				{getProfileStyleDescription(profileStyle)}
			</div>
		</div>

		<!-- Real-World Dimensions -->
		<div class="border-t border-subtle pt-4">
			<h3 class="text-sm font-semibold text-secondary mb-2 flex items-center gap-2">
				<Ruler size={14} />
				Dimensions (mm)
			</h3>
			<div class="grid grid-cols-2 gap-3 text-sm">
				<div class="bg-surface-alt rounded p-2">
					<span class="text-xs text-secondary block">Height</span>
					<span class="text-white font-mono">{sculptureHeightMm().toFixed(0)} mm</span>
				</div>
				<div class="bg-surface-alt rounded p-2">
					<span class="text-xs text-secondary block">Max Width</span>
					<span class="text-white font-mono">{sculptureMaxWidthMm()} mm</span>
				</div>
				<div class="bg-surface-alt rounded p-2">
					<span class="text-xs text-secondary block">Base Width</span>
					<span class="text-white font-mono">{sculptureBaseWidthMm()} mm</span>
				</div>
				<div class="bg-surface-alt rounded p-2">
					<span class="text-xs text-secondary block">Print Volume</span>
					<span class="text-white font-mono">{uiStore.printVolumeMm} mm³</span>
				</div>
			</div>
			
			{#if uiStore.constraintMode === '3d_print'}
				<div class="mt-2 p-2 rounded text-xs flex items-center gap-2 {fitsInPrintVolume() ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}">
					{#if fitsInPrintVolume()}
						<Check size={14} />
						<span>Fits in print volume</span>
					{:else}
						<AlertTriangle size={14} />
						<span>Exceeds print volume - scale down in slicer</span>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Material -->
		<div class="border-t border-subtle pt-4">
			<h3 class="text-sm font-semibold text-secondary mb-3">Material</h3>
			<div class="flex gap-2 mb-3">
				<button
					class="flex-1 py-2 px-3 text-sm rounded border transition-colors {materialType ===
					'ceramic'
						? 'bg-brand-primary border-brand-primary text-white'
						: 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
					onclick={() => {
						materialType = 'ceramic';
						updateMaterial();
					}}
				>
					🏺 Ceramic
				</button>
				<button
					class="flex-1 py-2 px-3 text-sm rounded border transition-colors {materialType ===
					'plastic'
						? 'bg-brand-primary border-brand-primary text-white'
						: 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
					onclick={() => {
						materialType = 'plastic';
						updateMaterial();
					}}
				>
					💠 Plastic
				</button>
			</div>

			<!-- Base Color -->
			<label for="obj-base-color" class="text-sm text-secondary block mb-1">Base Color</label>
			<div class="flex gap-2 items-center">
				<input
					id="obj-base-color"
					type="color"
					bind:value={baseColor}
					onchange={updateColor}
					class="w-10 h-10 rounded cursor-pointer border border-subtle"
				/>
				<span class="text-xs text-secondary font-mono uppercase flex-1">{baseColor}</span>
				<button
					class="px-3 py-2 text-xs rounded border border-subtle text-secondary hover:bg-subtle transition"
					onclick={() => {
						baseColor =
							materialType === 'ceramic' ? DEFAULT_MATERIAL_CERAMIC : DEFAULT_MATERIAL_PLASTIC;
						updateColor();
					}}
				>
					Reset
				</button>
			</div>
		</div>

		<!-- Fabrication Constraints -->
		<div class="border-t border-subtle pt-4">
			<h3 class="text-sm font-semibold text-secondary mb-2">Fabrication</h3>
			<p class="text-xs text-secondary opacity-75 mb-3">
				Physical constraints applied to all geometry
			</p>

			<div class="surface-panel-alt p-3 rounded flex items-center justify-between">
				<div class="flex items-center gap-2 text-sm text-primary">
					{getConstraintIcon(constraintMode)}
					<span class="font-semibold uppercase">{constraintMode}</span>
				</div>
				<div class="text-[11px] text-secondary text-right">
					Auto-Fix: {autoFixGeometry ? 'On' : 'Off'}<br />
					<span class="text-[10px] text-subtle">Adjust in Fabrication panel</span>
				</div>
			</div>

			<!-- Constraint Description -->
			<div class="surface-panel-alt p-2 rounded mt-2">
				<p class="text-xs text-secondary leading-relaxed">
					{getConstraintDescription(constraintMode)}
				</p>
			</div>
		</div>

		<!-- Form Fidelity Modes -->
		<div class="border-t border-subtle pt-4">
			<h3 class="text-sm font-semibold text-secondary mb-2 flex items-center gap-2">
				<Music size={14} />
				Form Enhancement
			</h3>
			<p class="text-xs text-secondary opacity-75 mb-3">
				Optional effects on the default voice-sculpture mapping
			</p>

			<!-- Profile-Following Fins -->
			<label class="flex items-center gap-2 cursor-pointer bg-surface-panel-alt p-2 rounded mb-2">
				<input
					type="checkbox"
					checked={uiStore.formModes.profileFinsEnabled}
					onchange={(e) => {
						uiStore.formModes.profileFinsEnabled = e.currentTarget.checked;
						sculptureStore.geometryDirty = true;
					}}
					class="w-4 h-4 accent-brand-primary"
				/>
				<div class="flex flex-col flex-1">
					<span class="text-sm text-primary font-medium">Profile-Following Fins</span>
					<span class="text-[10px] text-secondary">
						Fin length maps to voice intensity
					</span>
				</div>
			</label>

			{#if uiStore.formModes.profileFinsEnabled}
				<div class="bg-surface-alt p-2 rounded mb-2 text-xs">
					<label class="flex items-center justify-between gap-2">
						<span class="text-secondary">Base Radius:</span>
						<div class="flex items-center gap-2 flex-1">
							<input
								type="range"
								min="0.1"
								max="0.6"
								step="0.05"
								value={uiStore.formModes.profileFinsBaseRadius}
								onchange={(e) => {
									uiStore.formModes.profileFinsBaseRadius = parseFloat(e.currentTarget.value);
									sculptureStore.geometryDirty = true;
								}}
								class="flex-1 accent-brand-primary"
							/>
							<span class="text-white font-mono w-8">{uiStore.formModes.profileFinsBaseRadius.toFixed(2)}</span>
						</div>
					</label>
				</div>
			{/if}

			<!-- Envelope Smoothing -->
			<label class="flex items-center gap-2 cursor-pointer bg-surface-panel-alt p-2 rounded mb-2">
				<input
					type="checkbox"
					checked={uiStore.formModes.envelopeSmoothEnabled}
					onchange={(e) => {
						uiStore.formModes.envelopeSmoothEnabled = e.currentTarget.checked;
						sculptureStore.geometryDirty = true;
					}}
					class="w-4 h-4 accent-brand-primary"
				/>
				<div class="flex flex-col flex-1">
					<span class="text-sm text-primary font-medium">Envelope Smoothing</span>
					<span class="text-[10px] text-secondary">
						Smooth out jagged rings while preserving shape
					</span>
				</div>
			</label>

			{#if uiStore.formModes.envelopeSmoothEnabled}
				<div class="bg-surface-alt p-2 rounded text-xs">
					<label class="flex items-center justify-between gap-2">
						<span class="text-secondary">Amount:</span>
						<div class="flex items-center gap-2 flex-1">
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={uiStore.formModes.envelopeSmoothAmount}
								onchange={(e) => {
									uiStore.formModes.envelopeSmoothAmount = parseFloat(e.currentTarget.value);
									sculptureStore.geometryDirty = true;
								}}
								class="flex-1 accent-brand-primary"
							/>
							<span class="text-white font-mono w-8">{Math.round(uiStore.formModes.envelopeSmoothAmount * 100)}%</span>
						</div>
					</label>
				</div>
			{/if}

			<div class="bg-surface-alt p-2 rounded mt-2 text-xs text-secondary leading-relaxed">
				<p><strong>Foundation:</strong> All sculptures use clean pitch-to-width mapping (no beat rings or phrase markers). These options add optional visual enhancements on top.</p>
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
