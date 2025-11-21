<script lang="ts">
	import { onMount } from 'svelte';

	let { children } = $props<{ children: any }>();
	let error = $state<Error | null>(null);

	onMount(() => {
		window.addEventListener('error', (e) => {
			error = e.error;
		});
		window.addEventListener('unhandledrejection', (e) => {
			error = new Error(e.reason);
		});
	});
</script>

{#if error}
	<div class="surface-panel p-6 rounded-lg border border-danger">
		<h2 class="text-lg font-semibold text-danger mb-2">Error</h2>
		<p class="text-secondary mb-4">{error.message}</p>
		<button
			class="button-primary px-4 py-2"
			type="button"
			onclick={() => {
				error = null;
				window.location.reload();
			}}
		>
			Reload Page
		</button>
	</div>
{:else}
	{@render children()}
{/if}

