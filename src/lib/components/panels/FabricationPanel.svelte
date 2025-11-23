<script lang="ts">
	import { sculptureStore, setCurrentSculpture } from '$lib/stores/sculptureStore.svelte';
	import { exportProfileSVG, downloadBlueprint } from '$lib/export/blueprint';
	import { lathePointsToSTL, downloadSTL } from '$lib/export/stl';
	import { exportSculptureToGLB } from '$lib/export/gltf';
	import { exportSculptureToPLY, downloadPLY } from '$lib/export/ply';
	import { applyDeformation } from '$lib/engine/physicsMapping';
	import type { SculptureDefinition } from '$lib/types';

	let showScaleReference = $state(false);

	// Local state for editing
	let editingHeight = $state(0);
	let editingUnits = $state<'mm' | 'inch'>('mm');
	let editingWallThickness = $state(0);

	// Sync with sculpture changes
	$effect(() => {
		if (sculptureStore.currentSculpture) {
			editingHeight = sculptureStore.currentSculpture.physical.height;
			editingUnits = sculptureStore.currentSculpture.physical.units;
			editingWallThickness = sculptureStore.currentSculpture.physical.wallThickness ?? 0;
		}
	});

	function handleHeightChange() {
		if (!sculptureStore.currentSculpture) return;
		const updated: SculptureDefinition = {
			...sculptureStore.currentSculpture,
			physical: { ...sculptureStore.currentSculpture.physical, height: editingHeight }
		};
		setCurrentSculpture(updated);
	}

	function handleUnitsChange() {
		if (!sculptureStore.currentSculpture) return;
		const updated: SculptureDefinition = {
			...sculptureStore.currentSculpture,
			physical: { ...sculptureStore.currentSculpture.physical, units: editingUnits }
		};
		setCurrentSculpture(updated);
	}

	function handleWallThicknessChange() {
		if (!sculptureStore.currentSculpture) return;
		const updated: SculptureDefinition = {
			...sculptureStore.currentSculpture,
			physical: {
				...sculptureStore.currentSculpture.physical,
				wallThickness: editingWallThickness > 0 ? editingWallThickness : undefined
			}
		};
		setCurrentSculpture(updated);
	}

	function handleExportBlueprint() {
		const sculpture = sculptureStore.currentSculpture;
		if (!sculpture) {
			alert('No sculpture to export. Please generate a test mesh or record audio first.');
			return;
		}

		try {
			const svg = exportProfileSVG(sculpture);
			const filename = `sculpture-blueprint-${sculpture.name.replace(/\s+/g, '-')}-${Date.now()}.svg`;
			downloadBlueprint(svg, filename);
		} catch (error) {
			console.error('Blueprint export failed:', error);
			alert(`Blueprint export failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	function handleExportSTL() {
		const sculpture = sculptureStore.currentSculpture;
		if (!sculpture) {
			alert('No sculpture to export. Please generate a test mesh or record audio first.');
			return;
		}

		try {
			// Apply current deformation parameters before export
			const deformedCurve = applyDeformation(sculpture.radiusCurve, sculpture.deformation);

			// Create a temporary sculpture with deformed curve for export
			const exportSculpture: SculptureDefinition = {
				...sculpture,
				radiusCurve: deformedCurve
			};

			const stlContent = lathePointsToSTL(exportSculpture);
			const filename = `sculpture-${sculpture.name.replace(/\s+/g, '-')}-${Date.now()}.stl`;
			downloadSTL(stlContent, filename);
		} catch (error) {
			console.error('Export failed:', error);
			alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	async function handleExportGLB() {
		const sculpture = sculptureStore.currentSculpture;
		if (!sculpture) {
			alert('No sculpture to export. Please generate a test mesh or record audio first.');
			return;
		}

		try {
			const filename = `sculpture-${sculpture.name.replace(/\s+/g, '-')}-${Date.now()}.glb`;
			await exportSculptureToGLB(sculpture, filename);
		} catch (error) {
			console.error('GLB export failed:', error);
			alert(`GLB export failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	function handleExportPLY() {
		const sculpture = sculptureStore.currentSculpture;
		if (!sculpture) {
			alert('No sculpture to export. Please generate a test mesh or record audio first.');
			return;
		}

		try {
			const plyContent = exportSculptureToPLY(sculpture);
			const filename = `sculpture-${sculpture.name.replace(/\s+/g, '-')}-${Date.now()}.ply`;
			downloadPLY(plyContent, filename);
		} catch (error) {
			console.error('PLY export failed:', error);
			alert(`PLY export failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	import { appSettings, updateSettings } from '$lib/stores/appSettingsStore.svelte';
	import { uiStore, setConstraintMode } from '$lib/stores/uiStore.svelte';
	import { getConstraintDescription, getConstraintIcon } from '$lib/engine/constraints';
	import type { ConstraintMode } from '$lib/engine/constraints';

	// Get Pottery Mode
	let potteryMode = $derived(appSettings.viewMode?.potteryMode ?? false);

	function togglePotteryMode() {
		updateSettings({
			viewMode: {
				...appSettings.viewMode,
				potteryMode: !potteryMode
			}
		});
	}

	// Get Constraint Mode
	let constraintMode = $derived(uiStore.constraintMode);
	let constraintDescription = $derived(getConstraintDescription(constraintMode));

	function handleConstraintModeChange(mode: ConstraintMode) {
		setConstraintMode(mode);
	}
</script>

<div class="w-full">
	{#if !sculptureStore.currentSculpture}
		<p class="text-secondary mb-4">
			No sculpture loaded. Generate a test mesh or record audio first.
		</p>
	{:else}
		<div class="space-y-4">
			<!-- Physics Constraints -->
			<div class="pb-4 border-b border-subtle">
				<h3 class="text-sm font-semibold mb-2 text-secondary">Physics Constraints</h3>
				<div class="space-y-2">
					<!-- Constraint Mode Selector -->
					<div class="grid grid-cols-3 gap-2">
						<button
							type="button"
							class="px-3 py-2 text-sm rounded transition-colors {constraintMode === 'digital'
								? 'bg-brand-primary text-white'
								: 'surface-panel-alt text-secondary hover:text-primary'}"
							onclick={() => handleConstraintModeChange('digital')}
							title={getConstraintDescription('digital')}
						>
							{getConstraintIcon('digital')} Digital
						</button>
						<button
							type="button"
							class="px-3 py-2 text-sm rounded transition-colors {constraintMode === 'ceramic'
								? 'bg-brand-primary text-white'
								: 'surface-panel-alt text-secondary hover:text-primary'}"
							onclick={() => handleConstraintModeChange('ceramic')}
							title={getConstraintDescription('ceramic')}
						>
							{getConstraintIcon('ceramic')} Ceramic
						</button>
						<button
							type="button"
							class="px-3 py-2 text-sm rounded transition-colors {constraintMode === '3d_print'
								? 'bg-brand-primary text-white'
								: 'surface-panel-alt text-secondary hover:text-primary'}"
							onclick={() => handleConstraintModeChange('3d_print')}
							title={getConstraintDescription('3d_print')}
						>
							{getConstraintIcon('3d_print')} 3D Print
						</button>
					</div>
					<!-- Constraint Description -->
					<div class="surface-panel-alt p-3 rounded">
						<p class="text-xs text-secondary leading-relaxed">
							{constraintDescription}
						</p>
					</div>

					<!-- DIRECTIVE 3: Ceramic Constraints Info -->
					{#if constraintMode === 'ceramic'}
						<div class="mt-3 p-2 rounded bg-[#2a1a1a] border border-[#8f3e48]">
							<p class="text-xs text-[#e0a090] font-medium mb-1">🏺 Active Constraints:</p>
							<ul class="text-xs text-[#d0908a] space-y-0.5 list-disc list-inside">
								<li>Min Width: 70mm (hand access)</li>
								<li>Clay Smoothing: Jitter → Flow</li>
								<li>Max Overhang: 45°</li>
								<li>Stable Base: 1.5x wider</li>
							</ul>
						</div>
					{/if}
				</div>

				<!-- Live Preview Hint -->
				{#if sculptureStore.currentSculpture}
					<div class="mt-2 surface-panel-alt p-2 rounded">
						<p class="text-xs text-brand-primary font-medium">
							💡 Switch modes above to see your sculpture adapt in real-time!
						</p>
					</div>
				{/if}
			</div>

			<!-- View Settings (Pottery Mode) -->
			<div class="pb-4 border-b border-subtle">
				<h3 class="text-sm font-semibold mb-2 text-secondary">View Mode</h3>
				<label class="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						checked={potteryMode}
						onchange={togglePotteryMode}
						class="w-4 h-4 accent-brand-primary"
					/>
					<span class="text-sm text-primary">Pottery Wheel Mode (Lock Rotation)</span>
				</label>
				<p class="text-xs text-secondary mt-1 ml-6">
					Locks the camera to the horizontal axis, preventing tumbling.
				</p>
			</div>

			<!-- Physical Dimensions -->
			<div>
				<label for="target-height" class="text-sm text-secondary block mb-1">
					Target Height ({editingUnits})
				</label>
				<div class="flex gap-2">
					<input
						id="target-height"
						type="number"
						min="10"
						max="1000"
						step="1"
						bind:value={editingHeight}
						onchange={handleHeightChange}
						class="surface-panel-alt px-3 py-2 rounded flex-1"
					/>
					<select
						value={editingUnits}
						onchange={(e) => {
							editingUnits = (e.target as HTMLSelectElement).value as 'mm' | 'inch';
							handleUnitsChange();
						}}
						class="surface-panel-alt px-3 py-2 rounded"
					>
						<option value="mm">mm</option>
						<option value="inch">inch</option>
					</select>
				</div>
				<p class="text-xs text-secondary mt-1">Default: 150mm (mug/small vase size)</p>
			</div>

			<!-- Wall Thickness -->
			<div>
				<label for="wall-thickness" class="text-sm text-secondary block mb-1">
					Wall Thickness ({editingUnits})
				</label>
				<input
					id="wall-thickness"
					type="number"
					min="0"
					max="50"
					step="0.5"
					bind:value={editingWallThickness}
					onchange={handleWallThicknessChange}
					class="surface-panel-alt px-3 py-2 rounded w-full"
					placeholder="0 = solid"
				/>
				<p class="text-xs text-secondary mt-1">
					For 3D printing: 2-5mm typical. Leave 0 for solid ceramic.
				</p>
			</div>

			<!-- Scale Reference Toggle -->
			<div>
				<label class="flex items-center gap-2 cursor-pointer">
					<input type="checkbox" bind:checked={showScaleReference} class="w-4 h-4" />
					<span class="text-sm text-secondary">Show Scale Reference (Soda Can/Ruler)</span>
				</label>
				<p class="text-xs text-secondary mt-1 ml-6">
					Display reference object in 3D scene for size comparison
				</p>
			</div>

			<div class="border-t border-subtle pt-4">
				<h3 class="text-sm font-semibold mb-3">Export</h3>

				<div class="space-y-2">
					<!-- GLB Export (Universal 3D Format with Colors) -->
					<button
						class="button-primary px-4 py-2 w-full text-sm"
						type="button"
						onclick={handleExportGLB}
					>
						Export GLB (Universal 3D + Colors)
					</button>

					<!-- PLY Export (3D Printing with Colors) -->
					<button
						class="button-primary px-4 py-2 w-full text-sm"
						type="button"
						onclick={handleExportPLY}
					>
						Export PLY (3D Print + Colors)
					</button>

					<!-- STL Export (3D Printing, No Colors) -->
					<button
						class="button-secondary px-4 py-2 w-full text-sm"
						type="button"
						onclick={handleExportSTL}
					>
						Export STL (3D Print, No Colors)
					</button>

					<!-- Blueprint Export (Ceramic) -->
					<button
						class="button-secondary px-4 py-2 w-full text-sm"
						type="button"
						onclick={handleExportBlueprint}
					>
						Export Blueprint SVG (Ceramic Template)
					</button>
				</div>

				<p class="text-xs text-secondary mt-3">
					<strong>GLB:</strong> Universal 3D format with vertex colors. Works in Blender, Unity, web
					viewers.<br />
					<strong>PLY:</strong> For colored 3D printing. Includes vertex colors from glaze painting.<br
					/>
					<strong>STL:</strong> Standard 3D printing format (no colors). Includes wall thickness if
					specified.<br />
					<strong>Blueprint:</strong> Print at 1:1 scale, cut out, use as pottery wheel profile rib.
				</p>
			</div>
		</div>
	{/if}
</div>
