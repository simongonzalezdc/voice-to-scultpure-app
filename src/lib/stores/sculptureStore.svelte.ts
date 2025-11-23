import type { SculptureDefinition } from '$lib/types';
import { Vector3 } from 'three';

export const sculptureStore = $state<{
	currentSculpture: SculptureDefinition | null;
	ghostSculpture: SculptureDefinition | null;
	geometryDirty: boolean;
	interactionPoint: Vector3 | null;
	interactionNormal: Vector3 | null;
}>({
	currentSculpture: null,
	ghostSculpture: null,
	geometryDirty: false,
	interactionPoint: null,
	interactionNormal: null
});

export function setCurrentSculpture(sculpture: SculptureDefinition | null): void {
	sculptureStore.currentSculpture = sculpture;
	sculptureStore.geometryDirty = true;
}

export function setGhostSculpture(sculpture: SculptureDefinition | null): void {
	sculptureStore.ghostSculpture = sculpture;
	if (sculpture) {
		sculptureStore.geometryDirty = true;
	}
}

export function clearGhostSculpture(): void {
	sculptureStore.ghostSculpture = null;
	sculptureStore.geometryDirty = true;
}

export function markGeometryClean(): void {
	sculptureStore.geometryDirty = false;
}

export function setInteractionPoint(point: Vector3 | null, normal: Vector3 | null): void {
	sculptureStore.interactionPoint = point;
	sculptureStore.interactionNormal = normal;
}

/**
 * Update vertex colors on existing sculpture (non-destructive glazing)
 * @param colors - Float32Array of RGB values (3 values per vertex)
 */
export function updateSculptureColors(colors: Float32Array): void {
	if (!sculptureStore.currentSculpture) {
		console.warn('⚠️ [SCULPTURE] Cannot update colors: no current sculpture');
		return;
	}

	// Store colors in sculpture definition for persistence
	// Note: We'll need to add vertexColors to SculptureDefinition type
	const updated: SculptureDefinition = {
		...sculptureStore.currentSculpture,
		// Store colors as array for serialization
		vertexColors: Array.from(colors)
	};

	sculptureStore.currentSculpture = updated;
	sculptureStore.geometryDirty = true;
	console.log(`🎨 [SCULPTURE] Updated colors for ${colors.length / 3} vertices`);
}
