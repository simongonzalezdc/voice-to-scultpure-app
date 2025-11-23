import type { SculptureDefinition } from '$lib/types';
import { Vector3, type Mesh } from 'three';

export const sculptureStore = $state<{
	currentSculpture: SculptureDefinition | null;
	ghostSculpture: SculptureDefinition | null;
	geometryDirty: boolean;
	interactionPoint: Vector3 | null;
	interactionNormal: Vector3 | null;
	meshReference: Mesh | null;
}>({
	currentSculpture: null,
	ghostSculpture: null,
	geometryDirty: false,
	interactionPoint: null,
	interactionNormal: null,
	meshReference: null
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

	// Directive 5: Storage Integrity Check
	// Validate that we aren't storing corrupt data
	// Note: colors is Float32Array (3 values per vertex), so we divide by 3
	// We check against the mesh if available, otherwise just sanity check
	if (sculptureStore.meshReference && sculptureStore.meshReference.geometry) {
		const vertexCount = sculptureStore.meshReference.geometry.attributes.position.count;
		const colorCount = colors.length / 3;

		// console.assert doesn't stop execution, but logs to console
		console.assert(
			colorCount === vertexCount,
			`⚠️ [SCULPTURE] Color/Vertex Mismatch! Colors: ${colorCount}, Vertices: ${vertexCount}`
		);

		if (colorCount !== vertexCount) {
			alert('⚠️ Data Corruption Detected - Resetting Mesh Colors');
			// Reset colors to empty to prevent rendering errors
			updated.vertexColors = [];
		}
	} else if (colors.length === 0) {
		// Warning for empty update?
		console.warn('⚠️ [SCULPTURE] Updating with empty color array');
	}

	sculptureStore.currentSculpture = updated;
	sculptureStore.geometryDirty = true;
	console.log(`🎨 [SCULPTURE] Updated colors for ${colors.length / 3} vertices`);
}

/**
 * Set the mesh reference for color capture
 * @param mesh - The Mesh instance to reference
 */
export function setMeshReference(mesh: Mesh | null): void {
	sculptureStore.meshReference = mesh;
}
