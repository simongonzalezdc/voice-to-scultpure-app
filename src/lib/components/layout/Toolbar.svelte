<script lang="ts">
	import { uiStore, togglePanel } from '$lib/stores/uiStore.svelte';
	import { Settings, HelpCircle, Gem } from 'lucide-svelte';

	// Simplified toolbar - only essential controls
	// Library removed: broken (no modal wrapper), projects auto-saved
	// AI removed: requires API setup, confusing for core workflow
	const tools = $derived([
		{
			id: 'settings',
			label: 'Settings',
			icon: Settings,
			action: () => togglePanel('settings'),
			active: uiStore.panels.settings
		}
	]);
</script>

<div class="flex flex-col items-center w-16 bg-panel border-r border-subtle py-4 gap-4 z-toolbar">
	<!-- Logo / Home -->
	<div class="w-10 h-10 flex items-center justify-center text-brand-primary mb-4">
		<Gem size={28} />
	</div>

	<!-- Tools -->
	<div class="flex flex-col gap-2 w-full px-2">
		{#each tools as tool}
			<button
				class="w-full aspect-square flex flex-col items-center justify-center rounded transition-all duration-200 {tool.active
					? 'bg-brand-primary text-white'
					: 'text-secondary hover:text-white hover:bg-panel'}"
				onclick={tool.action}
				title={tool.label}
				aria-label={tool.label}
			>
				<tool.icon size={20} />
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
		<HelpCircle size={20} />
	</button>
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
	.z-toolbar {
		z-index: var(--z-toolbar);
	}
</style>
