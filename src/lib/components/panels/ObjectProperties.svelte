<script lang="ts">
	import { sculptureStore, setCurrentSculpture } from '$lib/stores/sculptureStore.svelte';
	import { uiStore, setConstraintMode } from '$lib/stores/uiStore.svelte';
	import { DEFAULT_MATERIAL_CERAMIC, DEFAULT_MATERIAL_PLASTIC } from '$lib/types';
	import type { ConstraintMode, BaseShape } from '$lib/types';
	import { getConstraintDescription, getConstraintIcon } from '$lib/engine/constraints';
	import { Cylinder, Circle, Box, FileText, Info } from 'lucide-svelte';

	// Reactive state from current sculpture
	const currentSculpture = $derived(sculptureStore.currentSculpture);
	
	// Local editing state
	let height = $state(150);
	let materialType = $state<'ceramic' | 'plastic'>('ceramic');
	let baseColor = $state(DEFAULT_MATERIAL_CERAMIC);
	let baseShape = $state<BaseShape>('lathe');
	
	// Reactive constraint mode from uiStore
	const constraintMode = $derived(uiStore.constraintMode);
	const autoFixGeometry = $derived(uiStore.autoFixGeometry ?? true);

	// Sync with sculpture changes
	$effect(() => {
		if (currentSculpture) {
			height = currentSculpture.physical.height;
			materialType = currentSculpture.surface.materialType ?? 'ceramic';
			baseColor = currentSculpture.surface.baseColor ?? DEFAULT_MATERIAL_CERAMIC;
			baseShape = currentSculpture.baseShape || 'lathe';
		}
	});

	// Update sculpture when values change
	function updateHeight() {
		if (!currentSculpture) return;
		setCurrentSculpture({
			...currentSculpture,
			physical: { ...currentSculpture.physical, height }
		});
	}

	function updateMaterial() {
		if (!currentSculpture) return;
		setCurrentSculpture({
			...currentSculpture,
			surface: {
				...currentSculpture.surface,
				materialType,
				baseColor: materialType === 'ceramic' ? DEFAULT_MATERIAL_CERAMIC : DEFAULT_MATERIAL_PLASTIC
			}
		});
		baseColor = materialType === 'ceramic' ? DEFAULT_MATERIAL_CERAMIC : DEFAULT_MATERIAL_PLASTIC;
	}

	function updateColor() {
		if (!currentSculpture) return;
		setCurrentSculpture({
			...currentSculpture,
			surface: { ...currentSculpture.surface, baseColor }
		});
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

	function handleConstraintChange(mode: ConstraintMode) {
		setConstraintMode(mode);
	}

	function toggleAutoFix() {
		uiStore.autoFixGeometry = !autoFixGeometry;
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
		<div>
			<label class="text-sm font-semibold text-secondary block mb-2">Base Shape</label>
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

		<!-- Physical Dimensions -->
		<div class="border-t border-subtle pt-4">
			<h3 class="text-sm font-semibold text-secondary mb-3">Physical Dimensions</h3>
			<div>
				<label
					for="obj-height"
					class="text-sm text-secondary block mb-1 flex items-center gap-2"
					title="Physical height of the sculpture"
				>
					Height: {height.toFixed(0)}mm
					<span class="text-subtle opacity-50"><Info size={12} /></span>
				</label>
				<input
					id="obj-height"
					type="range"
					min="10"
					max="1000"
					step="5"
					bind:value={height}
					onchange={updateHeight}
					class="w-full accent-brand-primary"
				/>
				<div class="flex justify-between text-xs text-secondary mt-1">
					<span>1cm</span>
					<span>1 meter</span>
				</div>
			</div>
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

			<div class="flex gap-2 mb-3">
				<button
					class="flex-1 py-2 px-3 text-xs rounded border transition-colors {constraintMode ===
					'digital'
						? 'bg-brand-primary border-brand-primary text-white'
						: 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
					onclick={() => handleConstraintChange('digital')}
					title={getConstraintDescription('digital')}
				>
					<span class="flex items-center justify-center gap-1">
						{getConstraintIcon('digital')}
						Digital
					</span>
				</button>
				<button
					class="flex-1 py-2 px-3 text-xs rounded border transition-colors {constraintMode ===
					'ceramic'
						? 'bg-brand-primary border-brand-primary text-white'
						: 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
					onclick={() => handleConstraintChange('ceramic')}
					title={getConstraintDescription('ceramic')}
				>
					<span class="flex items-center justify-center gap-1">
						{getConstraintIcon('ceramic')}
						Ceramic
					</span>
				</button>
				<button
					class="flex-1 py-2 px-3 text-xs rounded border transition-colors {constraintMode ===
					'3d_print'
						? 'bg-brand-primary border-brand-primary text-white'
						: 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
					onclick={() => handleConstraintChange('3d_print')}
					title={getConstraintDescription('3d_print')}
				>
					<span class="flex items-center justify-center gap-1">
						{getConstraintIcon('3d_print')}
						3D Print
					</span>
				</button>
			</div>

			<!-- Auto-Fix Toggle -->
			<label class="flex items-center gap-2 cursor-pointer bg-surface-panel-alt p-2 rounded">
				<input
					type="checkbox"
					checked={autoFixGeometry}
					onchange={toggleAutoFix}
					class="w-4 h-4 accent-brand-primary"
				/>
				<div class="flex flex-col flex-1">
					<span class="text-sm text-primary font-medium">Auto-Fix Geometry</span>
					<span class="text-[10px] text-secondary">
						{autoFixGeometry
							? 'Automatically adjust shape to meet physical limits'
							: 'Show warnings where physics are violated'}
					</span>
				</div>
			</label>

			<!-- Constraint Description -->
			<div class="surface-panel-alt p-2 rounded mt-2">
				<p class="text-xs text-secondary leading-relaxed">
					{getConstraintDescription(constraintMode)}
				</p>
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

