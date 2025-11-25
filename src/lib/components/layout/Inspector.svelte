<script lang="ts">
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import ObjectProperties from '$lib/components/panels/ObjectProperties.svelte';
	import ShapeTools from '$lib/components/panels/ShapeTools.svelte';
	import ForceControls from '$lib/components/controls/ForceControls.svelte';
	import GlazeMixer from '$lib/components/panels/GlazeMixer.svelte';
	import ExportTools from '$lib/components/panels/ExportTools.svelte';
	import SongModePanel from '$lib/components/panels/SongModePanel.svelte';
	import { songModeStore, enableSongMode, disableSongMode } from '$lib/stores/songModeStore.svelte';
	import { Music, ChevronDown, ChevronRight } from 'lucide-svelte';

	// NEW ARCHITECTURE:
	// - ObjectProperties: Always visible (single source of truth)
	// - Song Mode: Collapsible panel (auto-expands when recording mode is 'song')
	// - Context panel: Changes based on workspace

	// Workspace icons and labels
	const workspaceConfig = {
		sculpt: { icon: '🏺', label: 'SHAPE TOOLS' },
		force: { icon: '⚡', label: 'FORCE DYNAMICS' },
		glaze: { icon: '🎨', label: 'PAINT & COLOR' },
		export: { icon: '📦', label: 'EXPORT & FABRICATION' }
	} as const;

	let currentConfig = $derived(workspaceConfig[uiStore.workspace] || workspaceConfig.sculpt);

	// Song Mode state
	let isSongModeExpanded = $state(false);
	let isSongRecordingMode = $derived(uiStore.recordingMode === 'song');
	let isSongModeEnabled = $derived(songModeStore.enabled);

	// Auto-expand Song Mode panel when recording mode is 'song'
	$effect(() => {
		if (isSongRecordingMode && !isSongModeExpanded) {
			isSongModeExpanded = true;
			if (!isSongModeEnabled) {
				enableSongMode();
			}
		}
	});

	function toggleSongModePanel() {
		isSongModeExpanded = !isSongModeExpanded;
	}
</script>

<!-- FIXED: Entire sidebar scrolls as one unit -->
<!-- ENHANCED: Added glassmorphism and slide-in animation -->
<div class="inspector-container h-full overflow-y-auto custom-scrollbar slide-in-right">
	<!-- ObjectProperties: Always Visible (Single Source of Truth) -->
	<div class="border-b border-subtle">
		<ObjectProperties />
	</div>

	<!-- Song Mode Collapsible Panel -->
	{#if uiStore.workspace === 'sculpt' || uiStore.workspace === 'glaze'}
		<div class="border-b border-subtle">
			<!-- Song Mode Header (Clickable) -->
			<button
				class="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
				onclick={toggleSongModePanel}
			>
				<div class="flex items-center gap-2">
					<Music
						size={16}
						class={isSongModeEnabled ? 'text-brand-primary' : 'text-secondary'}
					/>
					<span
						class="text-sm font-medium {isSongModeEnabled ? 'text-brand-primary' : 'text-secondary'}"
					>
						Song Mode
					</span>
					{#if isSongModeEnabled}
						<span class="px-1.5 py-0.5 text-[10px] rounded-full bg-brand-primary/20 text-brand-primary">
							ON
						</span>
					{/if}
					{#if isSongRecordingMode}
						<span class="px-1.5 py-0.5 text-[10px] rounded-full bg-green-500/20 text-green-400">
							🎵 ACTIVE
						</span>
					{/if}
				</div>
				{#if isSongModeExpanded}
					<ChevronDown size={16} class="text-secondary" />
				{:else}
					<ChevronRight size={16} class="text-secondary" />
				{/if}
			</button>

			<!-- Song Mode Content (Collapsible) -->
			{#if isSongModeExpanded}
				<div class="song-mode-content border-t border-subtle/50">
					<SongModePanel />
				</div>
			{/if}
		</div>
	{/if}

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

	/* Song Mode collapsible panel */
	.song-mode-content {
		max-height: 400px;
		overflow-y: auto;
		animation: slide-down 0.2s ease-out;
	}

	@keyframes slide-down {
		from {
			opacity: 0;
			max-height: 0;
		}
		to {
			opacity: 1;
			max-height: 400px;
		}
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
