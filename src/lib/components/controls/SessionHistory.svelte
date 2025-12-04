<script lang="ts">
	/**
	 * Session History Panel
	 * P1: Visual history with undo/redo and entry management
	 */
	import {
		sessionHistoryStore,
		undo,
		redo,
		jumpToEntry,
		deleteEntry,
		formatTimestamp,
		getEntryIcon,
		type HistoryEntry
	} from '$lib/stores/sessionHistoryStore.svelte';
	import { sculptureStore, setCurrentSculpture } from '$lib/stores/sculptureStore.svelte';
	
	let { compact = false, onEntrySelect } = $props<{ 
		compact?: boolean; 
		onEntrySelect?: (entry: HistoryEntry) => void;
	}>();
	
	let showConfirmDelete = $state<string | null>(null);
	
	// Get entries in reverse order (newest first)
	let entries = $derived([...sessionHistoryStore.entries].reverse());
	let currentEntryId = $derived(
		sessionHistoryStore.entries[sessionHistoryStore.currentIndex]?.id ?? null
	);
	
	function handleUndo() {
		const entry = undo();
		if (entry) {
			applyEntry(entry);
		}
	}
	
	function handleRedo() {
		const entry = redo();
		if (entry) {
			applyEntry(entry);
		}
	}
	
	function handleEntryClick(entry: HistoryEntry) {
		const result = jumpToEntry(entry.id);
		if (result) {
			applyEntry(result);
			onEntrySelect?.(result);
		}
	}
	
	function handleDeleteClick(e: MouseEvent, entryId: string) {
		e.stopPropagation();
		if (showConfirmDelete === entryId) {
			deleteEntry(entryId);
			showConfirmDelete = null;
		} else {
			showConfirmDelete = entryId;
			// Auto-hide after 3 seconds
			setTimeout(() => {
				if (showConfirmDelete === entryId) {
					showConfirmDelete = null;
				}
			}, 3000);
		}
	}
	
	function applyEntry(entry: HistoryEntry) {
		// Apply the layer from history to the current sculpture
		const sculpture = sculptureStore.currentSculpture;
		if (!sculpture) return;
		
		// Find and replace the matching layer, or add if not found
		const layerIndex = sculpture.layers.findIndex(l => l.id === entry.layer.id);
		
		if (layerIndex >= 0) {
			sculpture.layers[layerIndex] = { ...entry.layer };
		} else {
			// Add as new layer
			sculpture.layers.push({ ...entry.layer });
		}
		
		// Trigger geometry update
		sculptureStore.geometryDirty = true;
		
		console.log(`✅ [HISTORY UI] Applied entry: ${entry.label}`);
	}
	
	function getEntryTypeColor(type: HistoryEntry['type']): string {
		switch (type) {
			case 'recording': return 'bg-red-500/20 border-red-500/30 text-red-300';
			case 'edit': return 'bg-blue-500/20 border-blue-500/30 text-blue-300';
			case 'glaze': return 'bg-amber-500/20 border-amber-500/30 text-amber-300';
			case 'deformation': return 'bg-purple-500/20 border-purple-500/30 text-purple-300';
			case 'import': return 'bg-green-500/20 border-green-500/30 text-green-300';
			default: return 'bg-white/10 border-white/20 text-white/60';
		}
	}
</script>

<div class="session-history rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm overflow-hidden"
	class:compact>
	
	<!-- Header with undo/redo buttons -->
	<div class="flex items-center justify-between px-3 py-2 bg-black/40 border-b border-white/5">
		<div class="flex items-center gap-2">
			<span class="text-xs text-white/50 font-medium">Session History</span>
			<span class="text-xs text-white/30">({entries.length})</span>
		</div>
		
		<div class="flex items-center gap-1">
			<button
				onclick={handleUndo}
				disabled={!sessionHistoryStore.canUndo}
				class="p-1.5 rounded-lg transition-all duration-150 
					{sessionHistoryStore.canUndo 
						? 'text-white/70 hover:text-white hover:bg-white/10' 
						: 'text-white/20 cursor-not-allowed'}"
				title="Undo (Ctrl+Z)"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M3 10h10a5 5 0 0 1 5 5v2" />
					<path d="M3 10l4 4M3 10l4-4" />
				</svg>
			</button>
			
			<button
				onclick={handleRedo}
				disabled={!sessionHistoryStore.canRedo}
				class="p-1.5 rounded-lg transition-all duration-150
					{sessionHistoryStore.canRedo 
						? 'text-white/70 hover:text-white hover:bg-white/10' 
						: 'text-white/20 cursor-not-allowed'}"
				title="Redo (Ctrl+Shift+Z)"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M21 10H11a5 5 0 0 0-5 5v2" />
					<path d="M21 10l-4 4M21 10l-4-4" />
				</svg>
			</button>
		</div>
	</div>
	
	<!-- Entries list -->
	<div class="max-h-64 overflow-y-auto custom-scrollbar">
		{#if entries.length === 0}
			<div class="p-4 text-center text-white/30 text-sm">
				No history yet. Start recording to build your sculpture.
			</div>
		{:else}
			{#each entries as entry (entry.id)}
				<div
					class="w-full flex items-start gap-3 p-3 border-b border-white/5 transition-all duration-150 text-left cursor-pointer
						{entry.id === currentEntryId 
							? 'bg-indigo-500/20 border-l-2 border-l-indigo-500' 
							: 'hover:bg-white/5 border-l-2 border-l-transparent'}"
					onclick={() => handleEntryClick(entry)}
					onkeydown={(e) => e.key === 'Enter' && handleEntryClick(entry)}
					role="button"
					tabindex="0"
				>
					<!-- Icon -->
					<div class="text-xl flex-shrink-0 mt-0.5">
						{getEntryIcon(entry.type)}
					</div>
					
					<!-- Content -->
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 mb-1">
							<span class="text-sm text-white/90 font-medium truncate">
								{entry.label}
							</span>
							{#if entry.id === currentEntryId}
								<span class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-300">
									Current
								</span>
							{/if}
						</div>
						
						<div class="flex items-center gap-2 text-xs text-white/40">
							<span class="px-1.5 py-0.5 rounded border {getEntryTypeColor(entry.type)}">
								{entry.type}
							</span>
							{#if entry.duration}
								<span>{entry.duration.toFixed(1)}s</span>
							{/if}
							<span>{formatTimestamp(entry.timestamp)}</span>
						</div>
					</div>
					
					<!-- Delete button -->
					<button
						onclick={(e) => handleDeleteClick(e, entry.id)}
						class="flex-shrink-0 p-1.5 rounded-lg transition-all duration-150
							{showConfirmDelete === entry.id 
								? 'bg-red-500/30 text-red-300' 
								: 'text-white/30 hover:text-white/60 hover:bg-white/10'}"
						title={showConfirmDelete === entry.id ? 'Click again to confirm delete' : 'Delete'}
						aria-label={showConfirmDelete === entry.id ? 'Confirm delete' : 'Delete entry'}
					>
						{#if showConfirmDelete === entry.id}
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M5 13l4 4L19 7" />
							</svg>
						{:else}
							<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M6 18L18 6M6 6l12 12" />
							</svg>
						{/if}
					</button>
				</div>
			{/each}
		{/if}
	</div>
	
	<!-- Keyboard shortcuts hint -->
	{#if !compact}
		<div class="px-3 py-2 bg-black/20 border-t border-white/5 text-xs text-white/30 flex justify-center gap-4">
			<span><kbd class="px-1 py-0.5 bg-white/10 rounded text-[10px]">⌘Z</kbd> Undo</span>
			<span><kbd class="px-1 py-0.5 bg-white/10 rounded text-[10px]">⌘⇧Z</kbd> Redo</span>
		</div>
	{/if}
</div>

<style>
	.session-history {
		min-width: 260px;
	}
	
	.session-history.compact {
		min-width: 200px;
	}
	
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
	}
	
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.2);
	}
</style>

