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

	// Workspace icons and labels
	const workspaceConfig = {
		sculpt: { icon: '🏺', label: 'SHAPE TOOLS' },
		force: { icon: '⚡', label: 'FORCE DYNAMICS' },
		glaze: { icon: '🎨', label: 'PAINT & COLOR' },
		export: { icon: '📦', label: 'EXPORT & FABRICATION' }
	} as const;

	let currentConfig = $derived(workspaceConfig[uiStore.workspace] || workspaceConfig.sculpt);
</script>

<!-- FIXED: Entire sidebar scrolls as one unit -->
<!-- ENHANCED: Added glassmorphism and slide-in animation -->
<div class="inspector-container h-full overflow-y-auto custom-scrollbar slide-in-right">
	<!-- ObjectProperties: Always Visible (Single Source of Truth) -->
	<div class="border-b border-subtle">
		<ObjectProperties />
	</div>

	<!-- Context-Aware Panel Header -->
	<div
		class="panel-header p-4 border-b border-subtle flex items-center justify-between sticky top-0 z-10"
	>
		<h2 class="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
			<span class="text-lg">{currentConfig.icon}</span>
			{currentConfig.label}
		</h2>
	</div>

	<!-- Context-Aware Content Area -->
	<div class="pb-4 fade-in">
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
	.inspector-container {
		background: var(--glass-bg, rgba(33, 31, 38, 0.85));
		backdrop-filter: blur(var(--glass-blur, 12px));
		-webkit-backdrop-filter: blur(var(--glass-blur, 12px));
		border-left: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
	}

	.panel-header {
		background: var(--glass-bg, rgba(33, 31, 38, 0.9));
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}

	.border-subtle {
		border-color: var(--border-subtle);
	}

	/* Smooth workspace transitions */
	.fade-in {
		animation: fade-in 0.2s ease-out;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Custom scrollbar */
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: var(--border-strong, #4a424f);
		border-radius: 3px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: var(--text-muted, #8b8491);
	}
</style>
