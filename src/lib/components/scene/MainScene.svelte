<script lang="ts">
	import { onMount } from 'svelte';
	import Sculpture from './Sculpture.svelte';
	import AnalysisVisualizer from './AnalysisVisualizer.svelte';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';

	let mounted = $state(false);

	onMount(() => {
		mounted = true;
	});
</script>

<div class="w-full h-full bg-bg-elevated relative">
	{#if mounted}
		<Sculpture sculpture={sculptureStore.currentSculpture || sculptureStore.ghostSculpture} />
		<AnalysisVisualizer />
	{:else}
		<div class="flex items-center justify-center h-full text-secondary">Loading scene...</div>
	{/if}
</div>

