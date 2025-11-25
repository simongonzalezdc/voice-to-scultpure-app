<script lang="ts">
	import { useThrelte, useTask } from '@threlte/core';
	import { onMount } from 'svelte';
	import {
		EffectComposer,
		EffectPass,
		RenderPass,
		BloomEffect,
		KernelSize,
		VignetteEffect
	} from 'postprocessing';
	import { appSettings } from '$lib/stores/appSettingsStore.svelte';
	import type { Camera } from 'three';

	const { scene, renderer, camera, size } = useThrelte();

	// Create effect composer
	const composer = new EffectComposer(renderer);

	// Quality-based settings
	const qualitySettings = {
		low: { bloomWidth: 256, bloomHeight: 256, bloomIntensity: 0.3 },
		medium: { bloomWidth: 512, bloomHeight: 512, bloomIntensity: 0.5 },
		high: { bloomWidth: 1024, bloomHeight: 1024, bloomIntensity: 0.7 }
	};

	function setupEffectComposer(cam: Camera) {
		const quality = appSettings.graphicsQuality || 'medium';
		const settings = qualitySettings[quality] || qualitySettings.medium;

		composer.removeAllPasses();

		// Base render pass
		composer.addPass(new RenderPass(scene, cam));

		// Bloom effect - subtle glow for emissive materials
		const bloomEffect = new BloomEffect({
			intensity: settings.bloomIntensity,
			luminanceThreshold: 0.6,
			luminanceSmoothing: 0.1,
			height: settings.bloomHeight,
			width: settings.bloomWidth,
			mipmapBlur: true,
			kernelSize: KernelSize.MEDIUM
		});
		composer.addPass(new EffectPass(cam, bloomEffect));

		// Vignette effect - subtle darkening at edges for focus
		if (quality !== 'low') {
			const vignetteEffect = new VignetteEffect({
				darkness: 0.3,
				offset: 0.3
			});
			composer.addPass(new EffectPass(cam, vignetteEffect));
		}

		console.log(`🎨 [POST-PROCESSING] Initialized with ${quality} quality settings`);
	}

	// Setup on camera change
	$effect(() => {
		if ($camera) {
			setupEffectComposer($camera);
		}
	});

	// Resize composer when viewport changes
	$effect(() => {
		composer.setSize($size.width, $size.height);
	});

	// Disable auto rendering when mounted
	const { renderStage, autoRender } = useThrelte();

	onMount(() => {
		const before = autoRender.current;
		autoRender.set(false);
		return () => autoRender.set(before);
	});

	// Custom render loop with post-processing
	useTask(
		(delta) => {
			composer.render(delta);
		},
		{ stage: renderStage, autoInvalidate: false }
	);
</script>
