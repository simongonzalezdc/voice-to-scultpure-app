<script lang="ts">
	import { sculptureStore, setCurrentSculpture } from '$lib/stores/sculptureStore.svelte';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { toastStore } from '$lib/stores/toastStore.svelte';
	import { pushHistory } from '$lib/stores/historyStore.svelte';
	import { exportProfileSVG, downloadBlueprint } from '$lib/export/blueprint';
	import { lathePointsToSTL, ribbonToSTL, downloadSTL } from '$lib/export/stl';
	import { exportSculptureToGLB } from '$lib/export/gltf';
	import { exportSculptureToPLY, downloadPLY } from '$lib/export/ply';
	import type { ExportOptions } from '$lib/export/exportUtils';
	import type { SculptureDefinition } from '$lib/types';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';
	import { ribbonStore, getRibbonPointsForExport } from '$lib/stores/ribbonStore.svelte';
	
	// Check if we're in ribbon mode
	let isRibbonMode = $derived(uiStore.baseShape === 'ribbon');
	let hasRibbonData = $derived(ribbonStore.segmentCount > 0);

	// Loading states
	let isExporting = $state(false);
	let exportingFormat = $state<string | null>(null);

	// Get current UI settings for exports
	function getExportOptions(): ExportOptions {
		return {
			autoFixGeometry: uiStore.autoFixGeometry,
			constraintMode: uiStore.constraintMode,
			modifiers: uiStore.modifiers,
			deformation: uiStore.deformation
		};
	}

	// Local state for editing
	let editingWallThickness = $state(0);

	// Sync with sculpture changes
	$effect(() => {
		if (sculptureStore.currentSculpture) {
			editingWallThickness = sculptureStore.currentSculpture.physical.wallThickness ?? 0;
		}
	});

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
			toastStore.warning(
				'Export Failed',
				'No sculpture loaded. Generate a test mesh or record audio first.'
			);
			return;
		}

		try {
			toastStore.info('Exporting Blueprint', 'Generating SVG...');
			const svg = exportProfileSVG(sculpture, uiStore.deformation);
			const filename = `sculpture-blueprint-${sculpture.name.replace(/\s+/g, '-')}-${Date.now()}.svg`;
			downloadBlueprint(svg, filename);
			toastStore.success('Export Complete', `${filename} saved to Downloads`);
		} catch (error) {
			console.error('Blueprint export failed:', error);
			toastStore.error('Export Failed', error instanceof Error ? error.message : String(error));
		}
	}

	function handleExportSTL() {
		// Check for ribbon mode first
		if (isRibbonMode && hasRibbonData) {
			handleExportRibbonSTL();
			return;
		}

		const sculpture = sculptureStore.currentSculpture;
		if (!sculpture) {
			toastStore.warning(
				'Export Failed',
				'No sculpture loaded. Generate a test mesh or record audio first.'
			);
			return;
		}

		try {
			toastStore.info('Exporting STL', 'Generating geometry...');
			const options = getExportOptions();
			const stlContent = lathePointsToSTL(sculpture, options);
			const filename = `sculpture-${sculpture.name.replace(/\s+/g, '-')}-${Date.now()}.stl`;
			downloadSTL(stlContent, filename);
			toastStore.success('Export Complete', `${filename} saved to Downloads`);
		} catch (error) {
			console.error('Export failed:', error);
			toastStore.error('Export Failed', error instanceof Error ? error.message : String(error));
		}
	}

	function handleExportRibbonSTL() {
		const ribbonPoints = getRibbonPointsForExport();
		if (ribbonPoints.length < 2) {
			toastStore.warning(
				'Export Failed',
				'Not enough ribbon data. Record at least a few seconds of audio in Ribbon mode.'
			);
			return;
		}

		try {
			toastStore.info('Exporting Ribbon STL', `Processing ${ribbonPoints.length} segments with wall thickness...`);
			const wallThickness = editingWallThickness > 0 ? editingWallThickness : 2; // Default 2mm
			const stlContent = ribbonToSTL(ribbonPoints, wallThickness);
			const filename = `ribbon-sculpture-${Date.now()}.stl`;
			downloadSTL(stlContent, filename);
			toastStore.success('Export Complete', `${filename} saved to Downloads (${ribbonPoints.length} segments)`);
		} catch (error) {
			console.error('Ribbon export failed:', error);
			toastStore.error('Export Failed', error instanceof Error ? error.message : String(error));
		}
	}

	async function handleExportGLB() {
		const sculpture = sculptureStore.currentSculpture;
		if (!sculpture) {
			toastStore.warning(
				'Export Failed',
				'No sculpture loaded. Generate a test mesh or record audio first.'
			);
			return;
		}

		isExporting = true;
		exportingFormat = 'GLB';
		try {
			toastStore.info('Exporting GLB', 'Generating 3D model...');
			const filename = `sculpture-${sculpture.name.replace(/\s+/g, '-')}-${Date.now()}.glb`;
			const options = getExportOptions();
			await exportSculptureToGLB(sculpture, filename, options);
			toastStore.success('Export Complete', `${filename} saved to Downloads`);
		} catch (error) {
			console.error('GLB export failed:', error);
			toastStore.error('Export Failed', error instanceof Error ? error.message : String(error));
		} finally {
			isExporting = false;
			exportingFormat = null;
		}
	}

	function handleExportPLY() {
		const sculpture = sculptureStore.currentSculpture;
		if (!sculpture) {
			toastStore.warning(
				'Export Failed',
				'No sculpture loaded. Generate a test mesh or record audio first.'
			);
			return;
		}

		try {
			toastStore.info('Exporting PLY', 'Generating colored point cloud...');
			const options = getExportOptions();
			const plyContent = exportSculptureToPLY(sculpture, options);
			const filename = `sculpture-${sculpture.name.replace(/\s+/g, '-')}-${Date.now()}.ply`;
			downloadPLY(plyContent, filename);
			toastStore.success('Export Complete', `${filename} saved to Downloads`);
		} catch (error) {
			console.error('PLY export failed:', error);
			toastStore.error('Export Failed', error instanceof Error ? error.message : String(error));
		}
	}
</script>

<div class="h-full flex flex-col">
	{#if !sculptureStore.currentSculpture}
		<div class="p-4">
			<p class="text-secondary mb-4">
				No sculpture loaded. Generate a test mesh or record audio first.
			</p>
		</div>
	{:else}
		<div class="p-4 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
			<!-- Export Options -->
			<div>
				<h3 class="text-sm font-semibold text-secondary mb-3">Export Options</h3>

				<!-- Wall Thickness -->
				<div>
					<label for="wall-thickness" class="text-sm text-secondary block mb-1">
						Wall Thickness (mm)
					</label>
					<input
						id="wall-thickness"
						type="number"
						min="0"
						max="50"
						step="0.5"
						bind:value={editingWallThickness}
						onchange={handleWallThicknessChange}
						class="surface-panel-alt px-3 py-2 rounded w-full text-sm"
						placeholder="0 = solid"
					/>
					<p class="text-xs text-secondary mt-1">
						For 3D printing: 2-5mm typical. Leave 0 for solid ceramic.
					</p>
				</div>
			</div>

			<!-- Export Formats -->
			<div class="border-t border-subtle pt-4">
				<h3 class="text-sm font-semibold mb-3 text-secondary">Export Formats</h3>

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
						{#if isRibbonMode && hasRibbonData}
							Export Ribbon STL ({ribbonStore.segmentCount} segments)
						{:else}
							Export STL (3D Print, No Colors)
						{/if}
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

				<div class="mt-4 surface-panel-alt p-3 rounded">
					<p class="text-xs text-secondary leading-relaxed">
						<strong class="text-primary">GLB:</strong> Universal 3D format with vertex colors. Works
						in Blender, Unity, web viewers.<br />
						<strong class="text-primary">PLY:</strong> For colored 3D printing. Includes vertex
						colors from glaze painting.<br />
						<strong class="text-primary">STL:</strong> Standard 3D printing format (no colors).
						Includes wall thickness if specified.<br />
						<strong class="text-primary">Blueprint:</strong> Print at 1:1 scale, cut out, use as pottery
						wheel profile rib.
					</p>
				</div>
			</div>
		</div>
	{/if}
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
