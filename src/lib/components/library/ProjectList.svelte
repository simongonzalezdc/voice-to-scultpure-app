<script lang="ts">
	import { onMount } from 'svelte';
	import { listProjects, loadProject, deleteProject } from '$lib/storage/opfs';
	import { setCurrentSculpture } from '$lib/stores/sculptureStore.svelte';
	import type { ProjectMetadata } from '$lib/types';
	import { renderHighRes } from '$lib/export/renderHighRes';

	let projects = $state<ProjectMetadata[]>([]);
	let searchQuery = $state('');
	let loading = $state(false);

	onMount(() => {
		loadProjects();
	});

	async function loadProjects() {
		loading = true;
		try {
			projects = await listProjects();
		} catch (error) {
			console.error('Failed to load projects:', error);
		} finally {
			loading = false;
		}
	}

	async function handleLoad(id: string) {
		try {
			const { sculpture } = await loadProject(id);
			setCurrentSculpture(sculpture);
		} catch (error) {
			console.error('Failed to load project:', error);
			alert(`Failed to load project: ${error}`);
		}
	}

	async function handleDelete(id: string) {
		if (!confirm('Delete this project?')) {
			return;
		}
		try {
			await deleteProject(id);
			await loadProjects();
		} catch (error) {
			console.error('Failed to delete project:', error);
			alert(`Failed to delete project: ${error}`);
		}
	}

	async function generateThumbnail(sculptureId: string): Promise<string> {
		// In a real implementation, you'd load the sculpture and render a thumbnail
		// For now, return a placeholder
		return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzIxMUYyNiIvPjwvc3ZnPg==';
	}

	const filteredProjects = $derived(
		projects.filter((p) =>
			p.name.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);
</script>

<div class="surface-panel p-4 rounded-lg flex flex-col h-full max-h-96">
	<h2 class="text-lg font-semibold mb-4">Projects</h2>

	<input
		type="text"
		class="surface-panel-alt px-3 py-2 rounded mb-4"
		placeholder="Search projects..."
		bind:value={searchQuery}
	/>

	<div class="flex-1 overflow-y-auto space-y-2">
		{#if loading}
			<div class="text-sm text-secondary">Loading...</div>
		{:else if filteredProjects.length === 0}
			<div class="text-sm text-secondary">No projects found</div>
		{:else}
			{#each filteredProjects as project}
				<div class="surface-panel-alt p-3 rounded flex items-center gap-3">
					<div class="flex-1">
						<div class="text-sm font-semibold text-primary">{project.name}</div>
						<div class="text-xs text-muted">
							{new Date(project.createdAt).toLocaleString()}
						</div>
					</div>
					<button
						class="button-primary px-3 py-1 text-xs"
						type="button"
						onclick={() => handleLoad(project.id)}
					>
						Load
					</button>
					<button
						class="button-secondary px-3 py-1 text-xs"
						type="button"
						onclick={() => handleDelete(project.id)}
					>
						Delete
					</button>
				</div>
			{/each}
		{/if}
	</div>
</div>
