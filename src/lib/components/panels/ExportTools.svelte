<script lang="ts">
	import { sculptureStore, setCurrentSculpture } from '$lib/stores/sculptureStore.svelte';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { toastStore } from '$lib/stores/toastStore.svelte';
	import { pushHistory } from '$lib/stores/historyStore.svelte';
	import { exportProfileSVG, downloadBlueprint } from '$lib/export/blueprint';
	import { exportMeshToSTL, lathePointsToSTL, downloadSTL } from '$lib/export/stl';
	import { exportSculptureToGLB } from '$lib/export/gltf';
	import { exportSculptureToPLY, downloadPLY } from '$lib/export/ply';
	import type { ExportOptions } from '$lib/export/exportUtils';
	import type { SculptureDefinition } from '$lib/types';
	import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';

	// Loading states
	let isExporting = $state(false);
	let exportingFormat = $state<string | null>(null);

	// Slicer optimization state
	let slicerOptimizeEnabled = $state(true);
	let estimatedTriangleCount = $state(0);

	// Get current UI settings for exports
	function getExportOptions(): ExportOptions {
		return {
			autoFixGeometry: uiStore.autoFixGeometry,
			constraintMode: uiStore.constraintMode,
			modifiers: uiStore.modifiers,
			deformation: uiStore.deformation
		};
	}

	// Estimate triangle count based on current settings
	function estimateTriangleCount() {
		// Current settings: facetStyle x profile points
		const facetSegments = uiStore.facetStyle === 'smooth' ? 96 : 
		                       uiStore.facetStyle === 'crystalline' ? 32 :
		                       uiStore.facetStyle === 'angular' ? 16 : 8;
		
		const profilePoints = sculptureStore.currentSculpture?.layers?.[0]?.data?.length ?? 128;
		
		// Each quad (2 triangles) between points and segments
		let triangles = facetSegments * (profilePoints - 1) * 2;
		
		// Apply simplification reduction if in 3D print mode and optimization enabled
		if (uiStore.constraintMode === '3d_print' && slicerOptimizeEnabled) {
			// SimplifyModifier targets 50K triangles, typically achieves 50-75% reduction
			triangles = Math.ceil(triangles * 0.4); // Conservative estimate
		}
		
		estimatedTriangleCount = triangles;
	}

	// Update estimate when sculpture changes
	$effect(() => {
		estimateTriangleCount();
	});

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
		const sculpture = sculptureStore.currentSculpture;
		if (!sculpture) {
			toastStore.warning(
				'Export Failed',
				'No sculpture loaded. Generate a test mesh or record audio first.'
			);
			return;
		}

		try {
			toastStore.info('Exporting STL', 'Exporting rendered mesh...');
			
			// CRITICAL: Use direct mesh export to guarantee match with app view
			// This exports the ACTUAL Three.js geometry being displayed
			const stlContent = exportMeshToSTL(sculpture);
			
			const filename = `sculpture-${sculpture.name.replace(/\s+/g, '-')}-${Date.now()}.stl`;
			downloadSTL(stlContent, filename);
			toastStore.success('Export Complete', `${filename} saved to Downloads`);
		} catch (error) {
			console.error('Export failed:', error);
			// Fallback to legacy export if direct export fails
			console.log('⚠️ Falling back to legacy STL export...');
			try {
				const options = getExportOptions();
				const stlContent = lathePointsToSTL(sculpture, options);
				const filename = `sculpture-${sculpture.name.replace(/\s+/g, '-')}-${Date.now()}.stl`;
				downloadSTL(stlContent, filename);
				toastStore.success('Export Complete (Fallback)', `${filename} saved to Downloads`);
			} catch (fallbackError) {
				toastStore.error('Export Failed', fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
			}
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

				<!-- Slicer Optimization (3D Print Mode) -->
				{#if uiStore.constraintMode === '3d_print'}
					<div class="mb-4 p-3 surface-panel-alt rounded">
						<div class="flex items-center gap-2 mb-2">
							<input
								id="slicer-optimize"
								type="checkbox"
								bind:checked={slicerOptimizeEnabled}
								onchange={estimateTriangleCount}
								class="w-4 h-4 cursor-pointer"
							/>
							<label for="slicer-optimize" class="text-sm text-primary cursor-pointer font-semibold">
								Optimize for Slicer
							</label>
						</div>
						<p class="text-xs text-secondary leading-relaxed mb-2">
							Reduces mesh complexity for faster slicing. Maintains shape quality.
						</p>
						<div class="text-xs text-secondary">
							<div class="flex justify-between">
								<span>Estimated triangles:</span>
								<span class="font-mono">
									{#if estimatedTriangleCount > 100000}
										<span class="text-warning">{Math.round(estimatedTriangleCount / 1000)}K</span>
										<span class="text-warning ml-1">(⚠️ may be slow)</span>
									{:else if estimatedTriangleCount > 50000}
										<span class="text-accent">{Math.round(estimatedTriangleCount / 1000)}K</span>
										<span class="text-accent ml-1">(good)</span>
									{:else}
										<span class="text-success">{Math.round(estimatedTriangleCount / 1000)}K</span>
										<span class="text-success ml-1">(✓ optimal)</span>
									{/if}
								</span>
							</div>
						</div>
					</div>
				{/if}

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
