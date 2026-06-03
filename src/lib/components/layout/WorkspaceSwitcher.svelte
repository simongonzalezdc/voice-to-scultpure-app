<script lang="ts">
	import { uiStore, setWorkspace, type Workspace } from '$lib/stores/uiStore.svelte';
	import type { ComponentType } from 'svelte';
	import { Hammer, Palette, Download } from 'lucide-svelte';

	const workspaces: { id: Workspace; label: string; icon: ComponentType }[] = [
		{ id: 'sculpt', label: 'Sculpt', icon: Hammer },
		// { id: 'force', label: 'Force', icon: Hand }, // Disabled - Future feature
		{ id: 'glaze', label: 'Glaze', icon: Palette },
		{ id: 'export', label: 'Export', icon: Download }
	];
</script>

<div class="flex items-center bg-panel border border-subtle rounded-lg p-1 gap-1">
	{#each workspaces as ws}
		<button
			class="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-all duration-200 {uiStore.workspace ===
			ws.id
				? 'bg-brand-primary text-white shadow-sm'
				: 'text-secondary hover:text-white hover:bg-panel'}"
			onclick={() => setWorkspace(ws.id)}
			aria-selected={uiStore.workspace === ws.id}
			role="tab"
		>
			<ws.icon size={16} />
			<span>{ws.label}</span>
		</button>
	{/each}
</div>

<style>
	.bg-panel {
		background-color: var(--bg-panel);
	}
	.border-subtle {
		border-color: var(--border-subtle);
	}
	.text-secondary {
		color: var(--text-secondary);
	}
	.bg-brand-primary {
		background-color: var(--brand-primary);
	}
</style>
