/**
 * Session History Store
 * P1: Layer-based undo with visual session history
 * Removes fear of mistakes by allowing undo/redo of recording sessions
 */

import type { SculptureLayer, SculptureDefinition } from '$lib/types';

// ============================================================================
// TYPES
// ============================================================================

export interface HistoryEntry {
	id: string;
	timestamp: number;
	type: 'recording' | 'edit' | 'glaze' | 'deformation' | 'import';
	
	// Human-readable description
	label: string;
	
	// Preview data
	duration?: number;     // For recordings: duration in seconds
	frameCount?: number;   // For recordings: number of frames
	thumbnail?: string;    // Base64 data URL of preview
	
	// The actual data (layer snapshot)
	layer: SculptureLayer;
	
	// Parent sculpture ID
	sculptureId: string;
	
	// Can this be undone?
	canUndo: boolean;
}

interface SessionHistoryState {
	// All history entries for current session
	entries: HistoryEntry[];
	
	// Current position in history (for undo/redo)
	currentIndex: number;
	
	// Maximum entries to keep
	maxEntries: number;
	
	// Is undo available?
	canUndo: boolean;
	canRedo: boolean;
	
	// Active sculpture ID
	activeSculptureId: string | null;
}

// ============================================================================
// STORE
// ============================================================================

export const sessionHistoryStore = $state<SessionHistoryState>({
	entries: [],
	currentIndex: -1,
	maxEntries: 50,
	canUndo: false,
	canRedo: false,
	activeSculptureId: null
});

// Track entry IDs
let entryIdCounter = 0;

// ============================================================================
// HISTORY MANAGEMENT
// ============================================================================

/**
 * Add a new entry to history (after a recording or edit)
 */
export function addHistoryEntry(
	type: HistoryEntry['type'],
	label: string,
	layer: SculptureLayer,
	sculptureId: string,
	metadata?: {
		duration?: number;
		frameCount?: number;
		thumbnail?: string;
	}
): HistoryEntry {
	// Create the entry
	const entry: HistoryEntry = {
		id: `history_${entryIdCounter++}_${Date.now()}`,
		timestamp: Date.now(),
		type,
		label,
		duration: metadata?.duration,
		frameCount: metadata?.frameCount,
		thumbnail: metadata?.thumbnail,
		layer: cloneLayer(layer),
		sculptureId,
		canUndo: true
	};
	
	// If we're not at the end of history, truncate forward history
	if (sessionHistoryStore.currentIndex < sessionHistoryStore.entries.length - 1) {
		sessionHistoryStore.entries = sessionHistoryStore.entries.slice(0, sessionHistoryStore.currentIndex + 1);
	}
	
	// Add the entry
	sessionHistoryStore.entries.push(entry);
	sessionHistoryStore.currentIndex = sessionHistoryStore.entries.length - 1;
	
	// Trim if we exceed max entries
	if (sessionHistoryStore.entries.length > sessionHistoryStore.maxEntries) {
		const trimCount = sessionHistoryStore.entries.length - sessionHistoryStore.maxEntries;
		sessionHistoryStore.entries = sessionHistoryStore.entries.slice(trimCount);
		sessionHistoryStore.currentIndex -= trimCount;
	}
	
	// Update can undo/redo
	updateUndoRedoState();
	
	console.log(`📜 [HISTORY] Added: "${label}" (${type}), total entries: ${sessionHistoryStore.entries.length}`);
	
	return entry;
}

/**
 * Undo the last action
 * Returns the layer to restore, or null if can't undo
 */
export function undo(): HistoryEntry | null {
	if (!sessionHistoryStore.canUndo || sessionHistoryStore.currentIndex <= 0) {
		return null;
	}
	
	sessionHistoryStore.currentIndex--;
	updateUndoRedoState();
	
	const entry = sessionHistoryStore.entries[sessionHistoryStore.currentIndex];
	console.log(`↩️ [HISTORY] Undo to: "${entry?.label}"`);
	
	return entry ?? null;
}

/**
 * Redo the last undone action
 * Returns the layer to restore, or null if can't redo
 */
export function redo(): HistoryEntry | null {
	if (!sessionHistoryStore.canRedo || sessionHistoryStore.currentIndex >= sessionHistoryStore.entries.length - 1) {
		return null;
	}
	
	sessionHistoryStore.currentIndex++;
	updateUndoRedoState();
	
	const entry = sessionHistoryStore.entries[sessionHistoryStore.currentIndex];
	console.log(`↪️ [HISTORY] Redo to: "${entry?.label}"`);
	
	return entry ?? null;
}

/**
 * Jump to a specific history entry
 */
export function jumpToEntry(entryId: string): HistoryEntry | null {
	const index = sessionHistoryStore.entries.findIndex(e => e.id === entryId);
	if (index === -1) return null;
	
	sessionHistoryStore.currentIndex = index;
	updateUndoRedoState();
	
	const entry = sessionHistoryStore.entries[index];
	console.log(`⏩ [HISTORY] Jump to: "${entry?.label}"`);
	
	return entry ?? null;
}

/**
 * Delete a specific entry from history
 */
export function deleteEntry(entryId: string): void {
	const index = sessionHistoryStore.entries.findIndex(e => e.id === entryId);
	if (index === -1) return;
	
	sessionHistoryStore.entries = sessionHistoryStore.entries.filter(e => e.id !== entryId);
	
	// Adjust current index if needed
	if (sessionHistoryStore.currentIndex >= index) {
		sessionHistoryStore.currentIndex = Math.max(0, sessionHistoryStore.currentIndex - 1);
	}
	
	updateUndoRedoState();
	
	console.log(`🗑️ [HISTORY] Deleted entry: ${entryId}`);
}

/**
 * Clear all history
 */
export function clearHistory(): void {
	sessionHistoryStore.entries = [];
	sessionHistoryStore.currentIndex = -1;
	sessionHistoryStore.canUndo = false;
	sessionHistoryStore.canRedo = false;
	
	console.log('🧹 [HISTORY] Cleared all history');
}

/**
 * Set the active sculpture ID
 */
export function setActiveSculpture(sculptureId: string | null): void {
	sessionHistoryStore.activeSculptureId = sculptureId;
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get history entries for a specific sculpture
 */
export function getEntriesForSculpture(sculptureId: string): HistoryEntry[] {
	return sessionHistoryStore.entries.filter(e => e.sculptureId === sculptureId);
}

/**
 * Get the current entry
 */
export function getCurrentEntry(): HistoryEntry | null {
	if (sessionHistoryStore.currentIndex < 0) return null;
	return sessionHistoryStore.entries[sessionHistoryStore.currentIndex] ?? null;
}

/**
 * Get recent entries (for UI display)
 */
export function getRecentEntries(count: number = 10): HistoryEntry[] {
	return sessionHistoryStore.entries.slice(-count).reverse();
}

/**
 * Get entries grouped by type
 */
export function getEntriesGroupedByType(): Record<HistoryEntry['type'], HistoryEntry[]> {
	const grouped: Record<HistoryEntry['type'], HistoryEntry[]> = {
		recording: [],
		edit: [],
		glaze: [],
		deformation: [],
		import: []
	};
	
	for (const entry of sessionHistoryStore.entries) {
		grouped[entry.type].push(entry);
	}
	
	return grouped;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function updateUndoRedoState(): void {
	sessionHistoryStore.canUndo = sessionHistoryStore.currentIndex > 0;
	sessionHistoryStore.canRedo = sessionHistoryStore.currentIndex < sessionHistoryStore.entries.length - 1;
}

/**
 * Deep clone a layer (to preserve immutability)
 */
function cloneLayer(layer: SculptureLayer): SculptureLayer {
	return {
		...layer,
		data: new Float32Array(layer.data),
		mask: new Float32Array(layer.mask)
	};
}

/**
 * Generate a human-readable timestamp
 */
export function formatTimestamp(timestamp: number): string {
	const date = new Date(timestamp);
	const now = new Date();
	
	// If today, show time only
	if (date.toDateString() === now.toDateString()) {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
	
	// If this week, show day and time
	const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
	if (daysDiff < 7) {
		return date.toLocaleDateString([], { weekday: 'short' }) + ' ' + 
			date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
	
	// Otherwise show date
	return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Get icon for entry type
 */
export function getEntryIcon(type: HistoryEntry['type']): string {
	switch (type) {
		case 'recording': return '🎤';
		case 'edit': return '✏️';
		case 'glaze': return '🎨';
		case 'deformation': return '🌀';
		case 'import': return '📁';
		default: return '📝';
	}
}

