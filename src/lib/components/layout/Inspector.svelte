<script lang="ts">
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import ObjectProperties from '$lib/components/panels/ObjectProperties.svelte';
	import ShapeTools from '$lib/components/panels/ShapeTools.svelte';
	import ForceControls from '$lib/components/controls/ForceControls.svelte';
	import GlazeMixer from '$lib/components/panels/GlazeMixer.svelte';
	import ExportTools from '$lib/components/panels/ExportTools.svelte';
	import SongModePanel from '$lib/components/panels/SongModePanel.svelte';
	import Gallery from '$lib/components/panels/Gallery.svelte';
	import PlaybackController from '$lib/components/ui/PlaybackController.svelte';
	import { songModeStore, enableSongMode, disableSongMode } from '$lib/stores/songModeStore.svelte';
	import { galleryStore } from '$lib/stores/galleryStore.svelte';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { Music, Image, ChevronDown, ChevronRight, History, Play } from 'lucide-svelte';
	
	// P0/P1: Human Compatibility Components
	import LivePreview from '$lib/components/controls/LivePreview.svelte';
	import SessionHistory from '$lib/components/controls/SessionHistory.svelte';
	import { sessionHistoryStore } from '$lib/stores/sessionHistoryStore.svelte';
	import { recordingStore } from '$lib/stores/recording.svelte';

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

	// Gallery state
	let isGalleryExpanded = $state(true); // Default expanded so users see their sculptures
	
	// P1: Session History state
	let isHistoryExpanded = $state(false);
	
	// Playback panel state
	let isPlaybackExpanded = $state(true); // Default expanded when audio available
	let hasAudioForPlayback = $derived(!!sculptureStore.currentSculpture?.audioBlob);
	
	// Show live preview when recording
	let isRecording = $derived(recordingStore.state === 'recording');

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

	function toggleGalleryPanel() {
		isGalleryExpanded = !isGalleryExpanded;
	}
	
	function toggleHistoryPanel() {
		isHistoryExpanded = !isHistoryExpanded;
	}
	
	function togglePlaybackPanel() {
		isPlaybackExpanded = !isPlaybackExpanded;
	}
</script>

<!-- FIXED: Entire sidebar scrolls as one unit -->
<!-- ENHANCED: Added glassmorphism and slide-in animation -->
<div class="inspector-container h-full overflow-y-auto custom-scrollbar slide-in-right">
	<!-- P0: Live Preview - Shows when recording or has audio input -->
	{#if isRecording || uiStore.workspace === 'sculpt' || uiStore.workspace === 'glaze'}
		<div class="p-3 border-b border-subtle">
			<LivePreview compact={false} />
		</div>
	{/if}

	<!-- Contextual Guidance -->
	{#if !isRecording && recordingStore.state === 'idle' && uiStore.workspace === 'sculpt'}
		<div class="p-3 border-b border-brand-primary/20 bg-brand-primary/5">
			<p class="text-xs text-brand-primary font-medium mb-1">💡 Getting Started</p>
			<p class="text-xs text-secondary leading-relaxed">
				Press the record button and sing. Your voice will sculpt the form in real-time.
			</p>
		</div>
	{/if}

	{#if recordingStore.currentSculpture && !isRecording && recordingStore.state !== 'recording'}
		<div class="p-3 border-b border-amber-500/20 bg-amber-500/5">
			<p class="text-xs text-amber-400 font-medium mb-1">✨ Next Steps</p>
			<p class="text-xs text-secondary leading-relaxed">
				Try adding another layer, applying colors, or adjusting fabrication constraints.
			</p>
		</div>
	{/if}

	<!-- ObjectProperties: Always Visible (Single Source of Truth) -->
	<div class="border-b border-subtle">
		<ObjectProperties />
	</div>

	<!-- Playback Controller Panel (Only shows when audio is available) -->
	{#if hasAudioForPlayback}
		<div class="border-b border-subtle">
			<button
				class="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
				onclick={togglePlaybackPanel}
			>
				<div class="flex items-center gap-2">
					<Play size={16} class="text-brand-primary" />
					<span class="text-sm font-medium text-brand-primary">Playback</span>
					<span class="px-1.5 py-0.5 text-[10px] rounded-full bg-brand-primary/20 text-brand-primary">
						🎵
					</span>
				</div>
				{#if isPlaybackExpanded}
					<ChevronDown size={16} class="text-secondary" />
				{:else}
					<ChevronRight size={16} class="text-secondary" />
				{/if}
			</button>

			{#if isPlaybackExpanded}
				<div class="playback-content border-t border-subtle/50 p-3">
					<PlaybackController />
				</div>
			{/if}
		</div>
	{/if}

	<!-- Gallery Collapsible Panel -->
	<div class="border-b border-subtle">
		<button
			class="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
			onclick={toggleGalleryPanel}
		>
			<div class="flex items-center gap-2">
				<Image size={16} class="text-secondary" />
				<span class="text-sm font-medium text-secondary">Gallery</span>
				{#if galleryStore.count > 0}
					<span class="px-1.5 py-0.5 text-[10px] rounded-full bg-white/10 text-secondary">
						{galleryStore.count}
					</span>
				{/if}
			</div>
			{#if isGalleryExpanded}
				<ChevronDown size={16} class="text-secondary" />
			{:else}
				<ChevronRight size={16} class="text-secondary" />
			{/if}
		</button>

		{#if isGalleryExpanded}
			<div class="gallery-content border-t border-subtle/50">
				<Gallery />
			</div>
		{/if}
	</div>
	
	<!-- P1: Session History Collapsible Panel -->
	<div class="border-b border-subtle">
		<button
			class="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
			onclick={toggleHistoryPanel}
		>
			<div class="flex items-center gap-2">
				<History size={16} class="text-amber-400" />
				<span class="text-sm font-medium text-secondary">Session History</span>
				{#if sessionHistoryStore.entries.length > 0}
					<span class="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-400">
						{sessionHistoryStore.entries.length}
					</span>
				{/if}
			</div>
			{#if isHistoryExpanded}
				<ChevronDown size={16} class="text-secondary" />
			{:else}
				<ChevronRight size={16} class="text-secondary" />
			{/if}
		</button>

		{#if isHistoryExpanded}
			<div class="history-content border-t border-subtle/50">
				<SessionHistory compact={true} />
			</div>
		{/if}
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

	/* Collapsible panels */
	.song-mode-content,
	.gallery-content,
	.history-content,
	.playback-content,
	.feedback-content {
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
