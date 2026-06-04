/**
 * Gallery Store - Persistent storage for saved sculptures
 * Uses localStorage to persist sculptures across sessions
 */

import type { SculptureDefinition } from '$lib/types';

const STORAGE_KEY = 'voice-sculpture-gallery';
const MAX_GALLERY_SIZE = 50;

export interface GallerySculpture {
	id: string;
	name: string;
	sculpture: SculptureDefinition;
	createdAt: number;
	duration: number; // Recording duration in seconds
	thumbnail?: string; // Base64 thumbnail (future feature)
}

// Gallery state
let sculptures = $state<GallerySculpture[]>([]);
let isLoaded = $state(false);

/**
 * Load gallery from localStorage
 */
export function loadGallery(): void {
	if (typeof window === 'undefined') return;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored) as GallerySculpture[];
			// Restore Float32Arrays from regular arrays
			sculptures = parsed.map((item) => ({
				...item,
				sculpture: restoreSculpture(item.sculpture)
			}));
			console.log(`🖼️ [GALLERY] Loaded ${sculptures.length} sculptures from storage`);
		}
	} catch (err) {
		console.error('❌ [GALLERY] Failed to load:', err);
		sculptures = [];
	}
	isLoaded = true;
}

/**
 * Save gallery to localStorage
 */
function saveGallery(): void {
	if (typeof window === 'undefined') return;

	try {
		// Convert Float32Arrays to regular arrays for JSON serialization
		const serializable = sculptures.map((item) => ({
			...item,
			sculpture: serializeSculpture(item.sculpture)
		}));
		localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
	} catch (err) {
		console.error('❌ [GALLERY] Failed to save:', err);
	}
}

/**
 * Convert Float32Arrays to regular arrays for JSON
 */
function serializeSculpture(sculpture: SculptureDefinition): SculptureDefinition {
	return {
		...sculpture,
		layers: sculpture.layers.map((layer) => ({
			...layer,
			data: Array.from(layer.data) as unknown as Float32Array,
			mask: Array.from(layer.mask) as unknown as Float32Array
		})),
		radiusCurve: sculpture.radiusCurve ? [...sculpture.radiusCurve] : undefined,
		vertexColors: sculpture.vertexColors ? [...sculpture.vertexColors] : undefined
	};
}

/**
 * Restore Float32Arrays from regular arrays
 */
function restoreSculpture(sculpture: SculptureDefinition): SculptureDefinition {
	return {
		...sculpture,
		layers: sculpture.layers.map((layer) => ({
			...layer,
			data: new Float32Array(layer.data as unknown as number[]),
			mask: new Float32Array(layer.mask as unknown as number[])
		}))
	};
}

/**
 * Add a sculpture to the gallery
 */
export function addToGallery(
	sculpture: SculptureDefinition,
	name?: string,
	duration?: number
): GallerySculpture {
	const entry: GallerySculpture = {
		id: crypto.randomUUID(),
		name: name || `Sculpture ${new Date().toLocaleString()}`,
		sculpture: JSON.parse(JSON.stringify(serializeSculpture(sculpture))),
		createdAt: Date.now(),
		duration: duration || 0
	};

	// Restore Float32Arrays after deep clone
	entry.sculpture = restoreSculpture(entry.sculpture);

	// Add to front, limit size
	sculptures = [entry, ...sculptures].slice(0, MAX_GALLERY_SIZE);
	saveGallery();

	console.log(`🖼️ [GALLERY] Added "${entry.name}" (${sculptures.length} total)`);
	return entry;
}

/**
 * Remove a sculpture from the gallery
 */
export function removeFromGallery(id: string): boolean {
	const index = sculptures.findIndex((s) => s.id === id);
	if (index === -1) return false;

	const removed = sculptures[index];
	sculptures = sculptures.filter((s) => s.id !== id);
	saveGallery();

	console.log(`🗑️ [GALLERY] Removed "${removed?.name}"`);
	return true;
}

/**
 * Rename a sculpture in the gallery
 */
export function renameSculpture(id: string, newName: string): boolean {
	const item = sculptures.find((s) => s.id === id);
	if (!item) return false;

	item.name = newName;
	sculptures = [...sculptures]; // Trigger reactivity
	saveGallery();
	return true;
}

/**
 * Get a sculpture by ID
 */
export function getSculptureById(id: string): GallerySculpture | undefined {
	return sculptures.find((s) => s.id === id);
}

/**
 * Clear entire gallery
 */
export function clearGallery(): void {
	sculptures = [];
	saveGallery();
	console.log('🗑️ [GALLERY] Cleared all sculptures');
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
	if (seconds < 60) return `${Math.round(seconds)}s`;
	const mins = Math.floor(seconds / 60);
	const secs = Math.round(seconds % 60);
	return `${mins}m ${secs}s`;
}

// Export reactive store
export const galleryStore = {
	get sculptures() {
		return sculptures;
	},
	get count() {
		return sculptures.length;
	},
	get isLoaded() {
		return isLoaded;
	}
};
