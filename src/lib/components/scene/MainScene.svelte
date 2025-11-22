<script lang="ts">
	import { onMount } from 'svelte';
	import { Canvas, T } from '@threlte/core';
	import Sculpture from './Sculpture.svelte';
	import AnalysisVisualizer from './AnalysisVisualizer.svelte';
	import OrbitControls from './OrbitControls.svelte';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { appSettings } from '$lib/stores/appSettingsStore.svelte';

	let mounted = $state(false);

	onMount(() => {
		mounted = true;
	});
</script>

<div class="w-full h-full bg-bg-elevated relative">
	{#if mounted}
		<Canvas>
			<T.PerspectiveCamera makeDefault position={[0, 2, 5]} fov={50} />
			<T.DirectionalLight
				position={[5, 10, 5]}
				intensity={1}
				castShadow
				shadow-mapSize-width={appSettings.graphicsQuality === 'high' ? 2048 : 1024}
				shadow-mapSize-height={appSettings.graphicsQuality === 'high' ? 2048 : 1024}
			/>
			<T.AmbientLight intensity={0.3} />
			<OrbitControls enableDamping dampingFactor={0.05} />

			<Sculpture sculpture={sculptureStore.currentSculpture || sculptureStore.ghostSculpture} />
			<AnalysisVisualizer />
		</Canvas>
	{:else}
		<div class="flex items-center justify-center h-full text-secondary">Loading scene...</div>
	{/if}
</div>
