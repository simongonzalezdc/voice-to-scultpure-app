<script lang="ts">
	import { openPanel, toggleOrientation, uiStore } from '$lib/stores/uiStore.svelte';

	let { title = 'Voice-to-Sculpture Studio' } = $props<{ title?: string }>();
</script>

<header class="surface-panel border-b border-subtle px-4 py-3 flex items-center justify-between">
	<h1 class="text-xl font-semibold text-primary">{title}</h1>
	<div class="flex gap-2">
		<!-- DIRECTIVE 3: Axis Toggle (Pottery vs. Lathe) -->
		<button
			class="button-secondary px-4 py-2 text-sm"
			onclick={toggleOrientation}
			type="button"
			title={`Current: ${uiStore.orientation === 'vertical' ? 'Pottery Wheel (Vertical)' : 'Lathe (Horizontal)'}`}
		>
			{uiStore.orientation === 'vertical' ? '⊶ Pottery' : '↺ Lathe'}
		</button>
		<button
			class="button-secondary px-4 py-2 text-sm"
			onclick={() => openPanel('fabricationPanel')}
			type="button"
		>
			Fabrication
		</button>
		<button
			class="button-primary px-4 py-2 text-sm"
			onclick={() => openPanel('settings')}
			type="button"
		>
			Settings
		</button>
	</div>
</header>
