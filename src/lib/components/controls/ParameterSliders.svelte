<script lang="ts">
	import {
		sculptureStore,
		setGhostSculpture,
		clearGhostSculpture,
		setCurrentSculpture
	} from '$lib/stores/sculptureStore.svelte';
	import { applyDeformation } from '$lib/engine/physicsMapping';

	let height = $state(150); // Height in mm (default 150mm)
	let twist = $state(0);
	let compression = $state(0);
	let roughness = $state(0.5);
	let glaze = $state(0.3);

	let isDragging = $state(false);
	let previewSculpture = $state<typeof sculptureStore.currentSculpture>(null);

	// Sync sliders with current sculpture
	$effect(() => {
		const sculpture = sculptureStore.currentSculpture;
		if (sculpture && !isDragging) {
			height = sculpture.physical.height;
			twist = sculpture.deformation.twist;
			compression = sculpture.deformation.compression;
			roughness = sculpture.surface.textureRoughness;
			glaze = sculpture.surface.glazeTransmission;
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
				glazeTransmission: glaze
			},
			deformation: {
				twist,
				compression,
				taper: 0
			},
			physical: {
				...previewSculpture.physical,
				height: height // DIRECTIVE 4: Update height from slider
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
					glazeTransmission: glaze
				},
				deformation: {
					twist,
					compression,
					taper: 0
				},
				physical: {
					...previewSculpture.physical,
					height: height // DIRECTIVE 4: Include height in committed changes
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
				glazeTransmission: currentGlaze
			},
			deformation: {
				twist: currentTwist,
				compression: currentCompression,
				taper: 0
			},
			physical: {
				...previewSculpture.physical,
				height: currentHeight
			}
		});
	});
</script>

<div class="surface-panel p-4 rounded-lg">
	<h2 class="text-lg font-semibold mb-4">Parameters</h2>
	<div class="space-y-4">
		<div>
			<!-- DIRECTIVE 4: Height slider controls vertical scale (in mm, not count) -->
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
		<div>
			<label for="compression-slider" class="text-sm text-secondary block mb-1 flex items-center gap-2" title="Squashes the form vertically, widening the bottom">
				Compression: {compression.toFixed(2)}
				<span class="text-xs text-subtle opacity-50">ⓘ</span>
			</label>
			<input
				id="compression-slider"
				type="range"
				min="0"
				max="1"
				step="0.01"
				bind:value={compression}
				class="w-full"
				onpointerdown={handlePointerDown}
				onpointerup={handlePointerUp}
			/>
		</div>
		<div>
			<label for="roughness-slider" class="text-sm text-secondary block mb-1 flex items-center gap-2" title="Adds surface texture and geometric noise">
				Roughness: {roughness.toFixed(2)}
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
		</div>
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
	</div>
</div>
