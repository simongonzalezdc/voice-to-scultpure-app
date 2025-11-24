<script lang="ts">
	import { sculptureStore, setCurrentSculpture } from '$lib/stores/sculptureStore.svelte';
	import {
		uiStore,
		setConstraintMode,
		setAutoFixGeometry,
		setViewMode,
		setEnvironment,
		setBlueprint,
		toggleBlueprintVisibility
	} from '$lib/stores/uiStore.svelte';
	import { appSettings, updateSettings } from '$lib/stores/appSettingsStore.svelte';
	import { exportProfileSVG, downloadBlueprint } from '$lib/export/blueprint';
	import { lathePointsToSTL, downloadSTL } from '$lib/export/stl';
	import { exportSculptureToGLB } from '$lib/export/gltf';
	import { exportSculptureToPLY, downloadPLY } from '$lib/export/ply';
	import { getConstraintDescription, getConstraintIcon, type ConstraintMode } from '$lib/engine/constraints';
	import type { ExportOptions } from '$lib/export/exportUtils';
	import type { SculptureDefinition } from '$lib/types';

	let showScaleReference = $state(false);

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
			const svg = exportProfileSVG(sculpture, uiStore.deformation);
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
			const options = getExportOptions();
			const stlContent = lathePointsToSTL(sculpture, options);
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
			const options = getExportOptions();
			await exportSculptureToGLB(sculpture, filename, options);
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
			const options = getExportOptions();
			const plyContent = exportSculptureToPLY(sculpture, options);
			const filename = `sculpture-${sculpture.name.replace(/\s+/g, '-')}-${Date.now()}.ply`;
			downloadPLY(plyContent, filename);
		} catch (error) {
			console.error('PLY export failed:', error);
			alert(`PLY export failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}


	// Get Pottery Mode
	let potteryMode = $derived(appSettings.viewMode?.potteryMode ?? false);
	let viewMode = $derived(uiStore.view.mode);
	let environment = $derived(uiStore.view.environment);
	let blueprintId = $derived(uiStore.view.blueprintId);
	let showBlueprint = $derived(uiStore.view.showBlueprint);

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
	let autoFixGeometry = $derived(uiStore.autoFixGeometry ?? true); // Default true
	let constraintDescription = $derived(getConstraintDescription(constraintMode));

	function handleConstraintModeChange(mode: ConstraintMode) {
		setConstraintMode(mode);
	}

	function handleAutoFixChange() {
		setAutoFixGeometry(!autoFixGeometry);
	}

	function handleViewModeChange(mode: 'standard' | 'xray' | 'wireframe' | 'heatmap') {
		setViewMode(mode);
		// Force a redraw for heatmap/wireframe transitions
		sculptureStore.geometryDirty = true;
	}

	function handleEnvironmentChange(env: 'studio' | 'neon' | 'darkroom') {
		setEnvironment(env);
	}

	function handleBlueprintChange(id: string) {
		setBlueprint(id);
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

					<!-- DIRECTIVE 2: Auto-Fix Geometry Checkbox -->
					<label class="flex items-center gap-2 cursor-pointer bg-surface-panel-alt p-2 rounded">
						<input
							type="checkbox"
							checked={autoFixGeometry}
							onchange={handleAutoFixChange}
							class="w-4 h-4 accent-brand-primary"
						/>
						<div class="flex flex-col">
							<span class="text-sm text-primary font-medium">Auto-Fix Geometry</span>
							<span class="text-[10px] text-secondary">
								{autoFixGeometry
									? 'Automatically adjust shape to meet physical limits.'
									: 'Show warnings (Red) where physics are violated.'}
							</span>
						</div>
					</label>

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

				<div class="grid grid-cols-2 gap-2 mt-4">
					<button
						type="button"
						class="px-3 py-2 text-sm rounded transition-colors {viewMode === 'standard'
							? 'bg-brand-primary text-white'
							: 'surface-panel-alt text-secondary hover:text-primary'}"
						onclick={() => handleViewModeChange('standard')}
					>
						Standard
					</button>
					<button
						type="button"
						class="px-3 py-2 text-sm rounded transition-colors {viewMode === 'xray'
							? 'bg-brand-primary text-white'
							: 'surface-panel-alt text-secondary hover:text-primary'}"
						onclick={() => handleViewModeChange('xray')}
					>
						X-Ray
					</button>
					<button
						type="button"
						class="px-3 py-2 text-sm rounded transition-colors {viewMode === 'wireframe'
							? 'bg-brand-primary text-white'
							: 'surface-panel-alt text-secondary hover:text-primary'}"
						onclick={() => handleViewModeChange('wireframe')}
					>
						Wireframe
					</button>
					<button
						type="button"
						class="px-3 py-2 text-sm rounded transition-colors {viewMode === 'heatmap'
							? 'bg-brand-primary text-white'
							: 'surface-panel-alt text-secondary hover:text-primary'}"
						onclick={() => handleViewModeChange('heatmap')}
					>
						Heatmap
					</button>
				</div>

				<div class="mt-3">
					<label class="text-sm text-secondary block mb-1" for="studio-lighting">
						Studio Lighting
					</label>
					<select
						id="studio-lighting"
						value={environment}
						onchange={(e) => handleEnvironmentChange((e.target as HTMLSelectElement).value as any)}
						class="surface-panel-alt px-3 py-2 rounded w-full text-sm"
					>
						<option value="studio">Studio</option>
						<option value="neon">Neon</option>
						<option value="darkroom">Darkroom</option>
					</select>
				</div>
			</div>

			<!-- Guidance -->
			<div class="pb-4 border-b border-subtle">
				<h3 class="text-sm font-semibold mb-2 text-secondary">Guides</h3>
				<label class="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						checked={showBlueprint}
						onchange={toggleBlueprintVisibility}
						class="w-4 h-4 accent-brand-primary"
					/>
					<span class="text-sm text-primary">Phantom Blueprint</span>
				</label>
				{#if showBlueprint}
					<select
						class="surface-panel-alt px-3 py-2 rounded w-full mt-2 text-sm"
						value={blueprintId ?? 'amphora'}
						onchange={(e) => handleBlueprintChange((e.target as HTMLSelectElement).value)}
					>
						<option value="amphora">Amphora</option>
						<option value="chalice">Chalice</option>
					</select>
					<p class="text-xs text-secondary mt-1">
						Dashed overlay shows target profile; match % updates live.
					</p>
				{/if}
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
