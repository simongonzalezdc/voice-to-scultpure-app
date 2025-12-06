<script lang="ts">
	import { useThrelte, useTask } from '@threlte/core';
	import { onMount } from 'svelte';
	import {
		BlendFunction,
		BloomEffect,
		EffectComposer,
		EffectPass,
		KernelSize,
		NormalPass,
		RenderPass,
		SSAOEffect,
		VignetteEffect
	} from 'postprocessing';
	import { appSettings } from '$lib/stores/appSettingsStore.svelte';
	import type { Camera } from 'three';

	const { scene, renderer, camera, size } = useThrelte();

	// Create effect composer
	const composer = new EffectComposer(renderer);
	let normalPass: NormalPass | null = null;

	// Quality-based settings
	const qualitySettings = {
		low: { bloomWidth: 256, bloomHeight: 256, bloomIntensity: 0.3, ssao: null },
		medium: {
			bloomWidth: 512,
			bloomHeight: 512,
			bloomIntensity: 0.5,
			ssao: { samples: 12, radius: 0.35, intensity: 0.9, bias: 0.025 }
		},
		high: {
			bloomWidth: 1024,
			bloomHeight: 1024,
			bloomIntensity: 0.7,
			ssao: { samples: 20, radius: 0.25, intensity: 1.2, bias: 0.02 }
		}
	};

	function setupEffectComposer(cam: Camera) {
		const quality = appSettings.graphicsQuality || 'medium';
		const settings = qualitySettings[quality] || qualitySettings.medium;

		composer.removeAllPasses();
		normalPass = null;

		// Base render pass
		composer.addPass(new RenderPass(scene, cam));

		// SSAO (ambient occlusion) for depth grounding
		let ssaoEffect: SSAOEffect | null = null;
		if (settings.ssao) {
			normalPass = new NormalPass(scene, cam);
			composer.addPass(normalPass);
			ssaoEffect = new SSAOEffect(cam, normalPass.renderTarget.texture, {
				blendFunction: BlendFunction.MULTIPLY,
				samples: settings.ssao.samples,
				radius: settings.ssao.radius,
				intensity: settings.ssao.intensity,
				bias: settings.ssao.bias
			});
		}

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

		// Combine effects into a single pass for efficiency
		const effects = ssaoEffect ? [ssaoEffect, bloomEffect] : [bloomEffect];

		// Vignette effect - subtle darkening at edges for focus
		if (quality !== 'low') {
			const vignetteEffect = new VignetteEffect({
				darkness: 0.3,
				offset: 0.3
			});
			effects.push(vignetteEffect);
		}

		composer.addPass(new EffectPass(cam, ...effects));

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
		if (normalPass) {
			normalPass.setSize($size.width, $size.height);
		}
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
