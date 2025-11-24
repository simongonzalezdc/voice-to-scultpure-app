<script lang="ts">
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import ObjectProperties from '$lib/components/panels/ObjectProperties.svelte';
	import ShapeTools from '$lib/components/panels/ShapeTools.svelte';
	import ForceControls from '$lib/components/controls/ForceControls.svelte';
	import GlazeMixer from '$lib/components/panels/GlazeMixer.svelte';
	import ExportTools from '$lib/components/panels/ExportTools.svelte';

	// NEW ARCHITECTURE:
	// - ObjectProperties: Always visible (single source of truth)
	// - Context panel: Changes based on workspace
</script>

<!-- FIXED: Entire sidebar scrolls as one unit -->
<div class="h-full overflow-y-auto bg-panel border-l border-subtle custom-scrollbar">
	<!-- ObjectProperties: Always Visible (Single Source of Truth) -->
	<div class="border-b border-subtle">
		<ObjectProperties />
	</div>

	<!-- Context-Aware Panel Header -->
	<div class="p-4 border-b border-subtle flex items-center justify-between sticky top-0 bg-panel z-10">
		<h2 class="text-sm font-semibold text-white uppercase tracking-wider">
			{#if uiStore.workspace === 'sculpt'}
				SHAPE TOOLS
			{:else if uiStore.workspace === 'force'}
				FORCE DYNAMICS
			{:else if uiStore.workspace === 'glaze'}
				PAINT & COLOR
			{:else if uiStore.workspace === 'export'}
				EXPORT & FABRICATION
			{/if}
		</h2>
	</div>

	<!-- Context-Aware Content Area -->
	<div class="pb-4">
		{#if uiStore.workspace === 'sculpt'}
			<ShapeTools />
		{:else if uiStore.workspace === 'force'}
			<div class="p-4">
				<ForceControls />
			</div>
		{:else if uiStore.workspace === 'glaze'}
			<div class="p-4">
				<GlazeMixer />
			</div>
		{:else if uiStore.workspace === 'export'}
			<ExportTools />
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
