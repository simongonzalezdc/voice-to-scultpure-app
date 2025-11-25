/**
 * History Store - Undo/Redo System for Sculpture Modifications
 * Uses a snapshot-based approach for reliable state restoration
 */

import { sculptureStore, setCurrentSculpture } from './sculptureStore.svelte';
import type { SculptureDefinition } from '$lib/types';

// Maximum number of history states to keep
const MAX_HISTORY_SIZE = 50;

// Deep clone a sculpture definition
function cloneSculpture(sculpture: SculptureDefinition | null): SculptureDefinition | null {
	if (!sculpture) return null;

	return {
		...sculpture,
		radiusCurve: sculpture.radiusCurve
			? [...sculpture.radiusCurve.map((p) => ({ ...p }))]
			: undefined,
		layers: sculpture.layers.map((layer) => ({
			...layer,
			data: new Float32Array(layer.data),
			mask: new Float32Array(layer.mask)
		})),
		physical: { ...sculpture.physical },
		vertexColors: sculpture.vertexColors ? [...sculpture.vertexColors] : undefined
	};
}

// History state
let undoStack = $state<SculptureDefinition[]>([]);
let redoStack = $state<SculptureDefinition[]>([]);
let isPerformingUndoRedo = $state(false);

// Derived states for UI
export const canUndo = $derived(undoStack.length > 0);
export const canRedo = $derived(redoStack.length > 0);
export const historyLength = $derived(undoStack.length);

/**
 * Push current state to history (call before making changes)
 */
export function pushHistory(description?: string): void {
	if (isPerformingUndoRedo) return;

	const current = sculptureStore.currentSculpture;
	if (!current) return;

	const snapshot = cloneSculpture(current);
	if (!snapshot) return;

	undoStack = [...undoStack, snapshot].slice(-MAX_HISTORY_SIZE);
	redoStack = []; // Clear redo stack on new action

	console.log(
		`📝 [HISTORY] Saved state (${undoStack.length} in stack)${description ? `: ${description}` : ''}`
	);
}

/**
 * Undo the last action
 */
export function undo(): boolean {
	if (undoStack.length === 0) {
		console.log('⚠️ [HISTORY] Nothing to undo');
		return false;
	}

	isPerformingUndoRedo = true;

	try {
		// Save current state to redo stack
		const current = sculptureStore.currentSculpture;
		if (current) {
			const currentSnapshot = cloneSculpture(current);
			if (currentSnapshot) {
				redoStack = [...redoStack, currentSnapshot];
			}
		}

		// Pop from undo stack and restore
		const previousState = undoStack[undoStack.length - 1];
		undoStack = undoStack.slice(0, -1);

		if (previousState) {
			setCurrentSculpture(cloneSculpture(previousState));
			sculptureStore.geometryDirty = true;
			console.log(`↩️ [HISTORY] Undo (${undoStack.length} remaining)`);
		}

		return true;
	} finally {
		isPerformingUndoRedo = false;
	}
}

/**
 * Redo the last undone action
 */
export function redo(): boolean {
	if (redoStack.length === 0) {
		console.log('⚠️ [HISTORY] Nothing to redo');
		return false;
	}

	isPerformingUndoRedo = true;

	try {
		// Save current state to undo stack
		const current = sculptureStore.currentSculpture;
		if (current) {
			const currentSnapshot = cloneSculpture(current);
			if (currentSnapshot) {
				undoStack = [...undoStack, currentSnapshot];
			}
		}

		// Pop from redo stack and restore
		const nextState = redoStack[redoStack.length - 1];
		redoStack = redoStack.slice(0, -1);

		if (nextState) {
			setCurrentSculpture(cloneSculpture(nextState));
			sculptureStore.geometryDirty = true;
			console.log(`↪️ [HISTORY] Redo (${redoStack.length} remaining)`);
		}

		return true;
	} finally {
		isPerformingUndoRedo = false;
	}
}

/**
 * Clear all history
 */
export function clearHistory(): void {
	undoStack = [];
	redoStack = [];
	console.log('🗑️ [HISTORY] Cleared all history');
}

/**
 * Get history info for debugging
 */
export function getHistoryInfo(): { undoCount: number; redoCount: number; maxSize: number } {
	return {
		undoCount: undoStack.length,
		redoCount: redoStack.length,
		maxSize: MAX_HISTORY_SIZE
	};
}

// Export the store for reactive access
export const historyStore = {
	get canUndo() {
		return undoStack.length > 0;
	},
	get canRedo() {
		return redoStack.length > 0;
	},
	get historyLength() {
		return undoStack.length;
	}
};
