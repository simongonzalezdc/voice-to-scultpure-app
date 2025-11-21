<script lang="ts">
	import { uiStore, openPanel } from '$lib/stores/uiStore.svelte';

	let { title = 'Voice-to-Sculpture Studio' } = $props<{ title?: string }>();
</script>

<header class="surface-panel border-b border-subtle px-4 py-3 flex items-center justify-between">
	<h1 class="text-xl font-semibold text-primary">{title}</h1>
	<button
		class="button-primary px-4 py-2 text-sm"
		onclick={() => openPanel('settings')}
		type="button"
	>
		Settings
	</button>
</header>

