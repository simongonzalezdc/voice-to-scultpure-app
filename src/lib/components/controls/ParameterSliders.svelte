<script lang="ts">
	import { sculptureStore, setGhostSculpture, clearGhostSculpture, setCurrentSculpture } from '$lib/stores/sculptureStore';
	import { applyDeformation } from '$lib/engine/physicsMapping';

	let height = $state(1);
	let twist = $state(0);
	let compression = $state(0);
	let roughness = $state(0.5);
	let glaze = $state(0.3);

	let isDragging = $state(false);
	let previewSculpture = $state<typeof sculptureStore.currentSculpture>(null);

	function handlePointerDown() {
		if (!sculptureStore.currentSculpture) return;
		isDragging = true;
		// Clone sculpture for preview
		previewSculpture = {
			...sculptureStore.currentSculpture,
			radiusCurve: sculptureStore.currentSculpture.radiusCurve.map((p) => ({ ...p })),
			surface: { ...sculptureStore.currentSculpture.surface },
			deformation: { ...sculptureStore.currentSculpture.deformation }
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
			}
		});
	}

	function handlePointerUp() {
		if (isDragging && previewSculpture) {
			// Commit changes
			const deformed = applyDeformation(previewSculpture.radiusCurve, {
				twist,
				compression,
				taper: 0
			});
			setCurrentSculpture({
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
				}
			});
		}
		isDragging = false;
		clearGhostSculpture();
		previewSculpture = null;
	}

	$effect(() => {
		if (isDragging) {
			applyPreview();
		}
	});
</script>

<div class="surface-panel p-4 rounded-lg">
	<h2 class="text-lg font-semibold mb-4">Parameters</h2>
	<div class="space-y-4">
		<div>
			<label for="height-slider" class="text-sm text-secondary block mb-1"
				>Height: {height.toFixed(2)}</label
			>
			<input
				id="height-slider"
				type="range"
				min="0.5"
				max="2"
				step="0.01"
				bind:value={height}
				class="w-full"
				onpointerdown={handlePointerDown}
				onpointerup={handlePointerUp}
			/>
		</div>
		<div>
			<label for="twist-slider" class="text-sm text-secondary block mb-1"
				>Twist: {twist.toFixed(2)}</label
			>
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
			<label for="compression-slider" class="text-sm text-secondary block mb-1"
				>Compression: {compression.toFixed(2)}</label
			>
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
			<label for="roughness-slider" class="text-sm text-secondary block mb-1"
				>Roughness: {roughness.toFixed(2)}</label
			>
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
			<label for="glaze-slider" class="text-sm text-secondary block mb-1"
				>Glaze: {glaze.toFixed(2)}</label
			>
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
