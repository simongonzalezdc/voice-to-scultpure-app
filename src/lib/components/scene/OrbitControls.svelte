<script lang="ts">
	import { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
	import { onDestroy } from 'svelte';
	import { useTask, useThrelte } from '@threlte/core';

	let {
		enableDamping = true,
		dampingFactor = 0.1,
		target: targetProp = [0, 0, 0] as [number, number, number],
		minDistance,
		maxDistance,
		maxPolarAngle
	} = $props<{
		enableDamping?: boolean;
		dampingFactor?: number;
		target?: [number, number, number];
		minDistance?: number;
		maxDistance?: number;
		maxPolarAngle?: number;
	}>();

	const targetVector = $derived(targetProp);

	const { camera, renderer, invalidate } = useThrelte();
	let controls = $state<ThreeOrbitControls | null>(null);

	function applyConfig() {
		if (!controls) {
			return;
		}
		controls.enableDamping = enableDamping;
		controls.dampingFactor = dampingFactor;
		controls.target.set(targetVector[0], targetVector[1], targetVector[2]);
		if (typeof minDistance === 'number') {
			controls.minDistance = minDistance;
		}
		if (typeof maxDistance === 'number') {
			controls.maxDistance = maxDistance;
		}
		if (typeof maxPolarAngle === 'number') {
			controls.maxPolarAngle = maxPolarAngle;
		}
		controls.update();
	}

	function initControls() {
		if (!renderer || !camera?.current) {
			return;
		}
		const sameCamera = controls?.object === camera.current;
		if (controls && sameCamera) {
			return;
		}
		if (controls) {
			controls.removeEventListener('change', invalidate);
			controls.dispose();
		}
		controls = new ThreeOrbitControls(camera.current, renderer.domElement);
		controls.addEventListener('change', invalidate);
		applyConfig();
	}

	$effect(() => {
		initControls();
		applyConfig();
	});

	useTask(() => {
		if (!controls) {
			return;
		}
		const needsUpdate = controls.update();
		if (needsUpdate) {
			invalidate();
		}
	}, {
		autoInvalidate: false
	});

	onDestroy(() => {
		if (!controls) {
			return;
		}
		controls.removeEventListener('change', invalidate);
		controls.dispose();
		controls = null;
	});
</script>


