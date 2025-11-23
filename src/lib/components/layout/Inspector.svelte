<script lang="ts">
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import ParameterSliders from '$lib/components/controls/ParameterSliders.svelte';
	import ForceParameters from '$lib/components/controls/ForceParameters.svelte';
	import GlazeMixer from '$lib/components/panels/GlazeMixer.svelte';
	import FabricationPanel from '$lib/components/panels/FabricationPanel.svelte';

	// Inspector displays context-aware panels based on the current workspace
	// - Sculpt: Physical parameters (Twist, Taper, Zone)
	// - Glaze: Color mixer and material properties
	// - Export: Fabrication constraints and file export
</script>

<div class="h-full flex flex-col bg-panel border-l border-subtle">
	<!-- Header -->
	<div class="p-4 border-b border-subtle flex items-center justify-between">
		<h2 class="text-sm font-semibold text-white uppercase tracking-wider">
			{#if uiStore.workspace === 'sculpt'}
				SHAPE PROPERTIES
			{:else if uiStore.workspace === 'force'}
				FORCE DYNAMICS
			{:else if uiStore.workspace === 'glaze'}
				MATERIAL & COLOR
			{:else if uiStore.workspace === 'export'}
				FABRICATION
			{/if}
		</h2>
	</div>

	<!-- Content Area -->
	<div class="flex-1 overflow-y-auto custom-scrollbar">
		{#if uiStore.workspace === 'sculpt'}
			<div class="p-4">
				<ParameterSliders />
			</div>
		{:else if uiStore.workspace === 'force'}
			<div class="p-4">
				<ForceParameters />
			</div>
		{:else if uiStore.workspace === 'glaze'}
			<div class="p-4">
				<GlazeMixer />
			</div>
		{:else if uiStore.workspace === 'export'}
			<div class="p-4">
				<FabricationPanel />
			</div>
		{/if}
	</div>
</div>

<style>
	.bg-panel {
		background-color: var(--bg-panel);
	}
	.border-subtle {
		border-color: var(--border-subtle);
	}

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
