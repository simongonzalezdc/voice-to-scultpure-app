<script lang="ts">
	import {
		sculptureStore,
		setGhostSculpture,
		clearGhostSculpture,
		setCurrentSculpture
	} from '$lib/stores/sculptureStore.svelte';
	import { uiStore, setSculptMode } from '$lib/stores/uiStore.svelte';
	import { applyDeformation } from '$lib/engine/physicsMapping';
	import type { SculptureDefinition } from '$lib/types';

	let height = $state(150); // Height in mm (default 150mm)
	let twist = $state(0);
	let compression = $state(0); // Range: -0.5 (stretch) to 0.5 (squash)
	let roughness = $state(0.5);
	let glaze = $state(0.3);
	let materialType = $state<'ceramic' | 'plastic'>('ceramic');
	let baseColor = $state('#E0C9A6');
	let sculptMode = $state<'additive' | 'subtractive'>('additive');

	let isDragging = $state(false);
	let previewSculpture = $state<typeof sculptureStore.currentSculpture>(null);

	// Sync sliders with current sculpture or uiStore
	$effect(() => {
		const sculpture = sculptureStore.currentSculpture;
		if (sculpture && !isDragging) {
			height = sculpture.physical.height;
			twist = sculpture.deformation.twist;
			compression = sculpture.deformation.compression;
			roughness = sculpture.surface.textureRoughness;
			glaze = sculpture.surface.glazeTransmission;
			materialType = sculpture.surface.materialType ?? 'ceramic';
			baseColor = sculpture.surface.baseColor ?? '#E0C9A6';
			sculptMode = sculpture.physical.sculptMode ?? uiStore.sculptMode;
		} else if (!sculpture && !isDragging) {
			// When no sculpture exists, sync from uiStore
			sculptMode = uiStore.sculptMode;
		}
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
			compression: compression,
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
				compression,
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
					compression,
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
		const currentCompression = compression;
		const currentRoughness = roughness;
		const currentGlaze = glaze;
		
		// Apply preview with current values - DIRECTIVE 4: Include height
		// FIX: For ghost, we DO want to see the deformation, so we apply it to the ghost's radiusCurve
		// BUT we must ensure we start from the ORIGINAL radiusCurve, not the already deformed one.
		// previewSculpture.radiusCurve is the clean copy we made in handlePointerDown.
		
		const deformed = applyDeformation(previewSculpture.radiusCurve, {
			twist: currentTwist,
			compression: currentCompression,
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
				compression: currentCompression,
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
</script>

<div class="surface-panel p-4 rounded-lg">
	<h2 class="text-lg font-semibold mb-4">Sculpture Parameters</h2>
	<div class="space-y-4">
		<!-- Height Slider -->
		<div>
			<label for="height-slider" class="text-sm text-secondary block mb-1 flex items-center gap-2" title="Adjusts the physical height of the sculpture in millimeters">
				Height: {height.toFixed(0)}mm
				<span class="text-xs text-subtle opacity-50">ⓘ</span>
			</label>
			<input
				id="height-slider"
				type="range"
				min="50"
				max="300"
				step="5"
				bind:value={height}
				class="w-full"
				onpointerdown={handlePointerDown}
				onpointerup={handlePointerUp}
			/>
		</div>

		<!-- Twist Slider -->
		<div>
			<label for="twist-slider" class="text-sm text-secondary block mb-1 flex items-center gap-2" title="Twists the form around its vertical axis">
				Twist: {twist.toFixed(2)}
				<span class="text-xs text-subtle opacity-50">ⓘ</span>
			</label>
			<input
				id="twist-slider"
				type="range"
				min="-1"
				max="1"
				step="0.01"
				bind:value={twist}
				class="w-full"
				onpointerdown={handlePointerDown}
				onpointerup={handlePointerUp}
			/>
		</div>

		<!-- Compression Slider -->
		<div>
			<label for="compression-slider" class="text-sm text-secondary block mb-1 flex items-center gap-2" title="Negative = Stretch, Positive = Squash">
				Compression: {compression.toFixed(2)}
				<span class="text-xs text-subtle opacity-50">ⓘ</span>
			</label>
			<input
				id="compression-slider"
				type="range"
				min="-0.5"
				max="0.5"
				step="0.01"
				bind:value={compression}
				class="w-full"
				onpointerdown={handlePointerDown}
				onpointerup={handlePointerUp}
			/>
		</div>

		<!-- Resolution Slider (Formerly Roughness) -->
		<div>
			<label for="roughness-slider" class="text-sm text-secondary block mb-1 flex items-center gap-2" title="Controls geometry resolution. Left = Low Poly/Blocky, Right = Smooth/Round">
				Resolution: {roughness.toFixed(2)}
				<span class="text-xs text-subtle opacity-50">ⓘ</span>
			</label>
			<input
				id="roughness-slider"
				type="range"
				min="0"
				max="1"
				step="0.01"
				bind:value={roughness}
				class="w-full"
				onpointerdown={handlePointerDown}
				onpointerup={handlePointerUp}
			/>
			<div class="flex justify-between text-xs text-secondary mt-1">
				<span>Low Poly</span>
				<span>Smooth</span>
			</div>
		</div>

		<!-- Glaze Slider -->
		<div>
			<label for="glaze-slider" class="text-sm text-secondary block mb-1 flex items-center gap-2" title="Controls how glass-like or clay-like the surface appears">
				Glaze: {glaze.toFixed(2)}
				<span class="text-xs text-subtle opacity-50">ⓘ</span>
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

		<!-- Sculpt Mode Selection -->
		<div class="border-t border-subtle pt-4">
			<h3 class="text-sm font-semibold mb-2 text-secondary">Sculpt Mode</h3>
			<div class="flex gap-2 mb-4">
				<button 
					class="flex-1 py-2 px-3 text-sm rounded border transition-colors {sculptMode === 'additive' ? 'bg-brand-primary border-brand-primary text-white' : 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
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
					class="flex-1 py-2 px-3 text-sm rounded border transition-colors {sculptMode === 'subtractive' ? 'bg-brand-primary border-brand-primary text-white' : 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
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
					class="flex-1 py-2 px-3 text-sm rounded border transition-colors {materialType === 'ceramic' ? 'bg-brand-primary border-brand-primary text-white' : 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
					onclick={() => { materialType = 'ceramic'; handleMaterialChange(); }}
				>
					Ceramic
				</button>
				<button 
					class="flex-1 py-2 px-3 text-sm rounded border transition-colors {materialType === 'plastic' ? 'bg-brand-primary border-brand-primary text-white' : 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
					onclick={() => { materialType = 'plastic'; handleMaterialChange(); }}
				>
					Plastic
				</button>
			</div>

			<!-- Base Color Picker -->
			<label for="base-color" class="text-sm text-secondary block mb-1">
				Base Color
			</label>
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
