<script lang="ts">
	import { uiStore, togglePanel, toggleOrientation, openPanel } from '$lib/stores/uiStore.svelte';

	// Tool definitions
	const tools = $derived([
		{
			id: 'projectList',
			label: 'Library',
			icon: '📁',
			action: () => togglePanel('projectList'),
			active: uiStore.panels.projectList
		},
		{
			id: 'aiPanel',
			label: 'AI Assistant',
			icon: '🤖',
			action: () => togglePanel('aiPanel'),
			active: uiStore.panels.aiPanel
		},
		{
			id: 'orientation',
			label: uiStore.orientation === 'vertical' ? 'Pottery' : 'Lathe',
			icon: uiStore.orientation === 'vertical' ? '⊶' : '↺',
			action: () => toggleOrientation(),
			active: false // Toggle state, not a panel
		},
		{
			id: 'settings',
			label: 'Settings',
			icon: '⚙️',
			action: () => togglePanel('settings'),
			active: uiStore.panels.settings
		}
	]);
</script>

<div
	class="flex flex-col items-center w-16 bg-panel border-r border-subtle py-4 gap-4 z-toolbar"
>
	<!-- Logo / Home -->
	<div class="w-10 h-10 flex items-center justify-center text-2xl mb-4">🏺</div>

	<!-- Tools -->
	<div class="flex flex-col gap-2 w-full px-2">
		{#each tools as tool}
			<button
				class="w-full aspect-square flex flex-col items-center justify-center rounded transition-all duration-200 {tool.active
					? 'bg-brand-primary text-white'
					: 'text-secondary hover:text-white hover:bg-panel-alt'}"
				onclick={tool.action}
				title={tool.label}
				aria-label={tool.label}
			>
				<span class="text-xl">{tool.icon}</span>
			</button>
		{/each}
	</div>

	<div class="flex-1"></div>

	<!-- Help / Info -->
	<button
		class="w-10 h-10 flex items-center justify-center text-secondary hover:text-white transition-colors"
		title="Keyboard Shortcuts (Shift+?)"
		aria-label="Keyboard Shortcuts (Shift+?)"
		onclick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true }))}
	>
		?
	</button>
</div>

<style>
	.bg-panel {
		background-color: var(--bg-panel);
	}
	.bg-panel-alt {
		background-color: var(--bg-panel-alt);
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
	.hover\:bg-panel-alt:hover {
		background-color: var(--bg-panel-alt);
	}
	.z-toolbar {
		z-index: var(--z-toolbar);
	}
</style>

