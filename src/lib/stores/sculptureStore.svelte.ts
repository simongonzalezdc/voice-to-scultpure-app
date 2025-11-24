import type { SculptureDefinition, SculptureLayer, LayerType, LathePoint } from '$lib/types';
import { Vector3, type Mesh } from 'three';

export const sculptureStore = $state<{
	currentSculpture: SculptureDefinition | null;
	ghostSculpture: SculptureDefinition | null;
	geometryDirty: boolean;
	interactionPoint: Vector3 | null;
	interactionNormal: Vector3 | null;
	meshReference: Mesh | null;
	// GENERATIVE PERFORMANCE: Layer Stack
	layers: SculptureLayer[];
	activeLayerId: string | null;
	composedGeometry: LathePoint[] | null;
}>({
	currentSculpture: null,
	ghostSculpture: null,
	geometryDirty: false,
	interactionPoint: null,
	interactionNormal: null,
	meshReference: null,
	layers: [],
	activeLayerId: null,
	composedGeometry: null
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

// ============================================================================
// GENERATIVE PERFORMANCE: LAYER STACK MANAGEMENT
// ============================================================================

/**
 * Compose all visible layers into final geometry
 * This is the CPU-based blending logic that produces the final radiusCurve
 */
export function composeGeometry(): LathePoint[] {
	const visibleLayers = sculptureStore.layers.filter((l) => l.visible && l.type !== 'color');

	if (visibleLayers.length === 0) {
		// Return default cylinder if no layers
		return Array(10)
			.fill(0)
			.map((_, i) => ({ x: 0.5, y: i / 9 }));
	}

	// Find the base layer (required)
	const baseLayer = visibleLayers.find((l) => l.type === 'base');
	if (!baseLayer) {
		console.warn('⚠️ No base layer found, returning default');
		return Array(10)
			.fill(0)
			.map((_, i) => ({ x: 0.5, y: i / 9 }));
	}

	// Start with base layer data
	const pointCount = baseLayer.data.length / 2; // x,y pairs
	const composed: LathePoint[] = [];

	for (let i = 0; i < pointCount; i++) {
		let x = baseLayer.data[i * 2];
		let y = baseLayer.data[i * 2 + 1];

		// Apply other layers additively
		for (const layer of visibleLayers) {
			if (layer.id === baseLayer.id) continue; // Skip base

			// Ensure layer has same resolution
			if (layer.data.length !== baseLayer.data.length) {
				console.warn(`⚠️ Layer ${layer.name} has mismatched resolution, skipping`);
				continue;
			}

			const layerX = layer.data[i * 2];
			const blendAmount = layer.opacity;

			if (layer.type === 'distortion') {
				// Distortion: Modulate radius
				x += (layerX - 0.5) * blendAmount * 0.5; // Scale distortion
			} else if (layer.type === 'texture') {
				// Texture: Add noise/roughness
				x += (layerX - 0.5) * blendAmount * 0.2; // Smaller scale for texture
			}
		}

		// Clamp radius to prevent negative/invalid values
		x = Math.max(0.1, Math.min(2.0, x));

		composed.push({ x, y });
	}

	return composed;
}

/**
 * Add a new layer to the stack
 */
export function addLayer(layer: SculptureLayer): void {
	sculptureStore.layers.push(layer);
	sculptureStore.activeLayerId = layer.id;
	sculptureStore.composedGeometry = composeGeometry();
	sculptureStore.geometryDirty = true;
	console.log(`✨ [LAYER] Added ${layer.type} layer: ${layer.name}`);
}

/**
 * Remove a layer from the stack (UNDO functionality)
 */
export function removeLayer(layerId: string): void {
	const index = sculptureStore.layers.findIndex((l) => l.id === layerId);
	if (index === -1) {
		console.warn(`⚠️ Layer ${layerId} not found`);
		return;
	}

	const removed = sculptureStore.layers.splice(index, 1)[0];
	console.log(`🗑️ [LAYER] Removed ${removed.type} layer: ${removed.name}`);

	// Update active layer if we removed it
	if (sculptureStore.activeLayerId === layerId) {
		sculptureStore.activeLayerId =
			sculptureStore.layers.length > 0 ? sculptureStore.layers[sculptureStore.layers.length - 1].id : null;
	}

	sculptureStore.composedGeometry = composeGeometry();
	sculptureStore.geometryDirty = true;
}

/**
 * Toggle layer visibility
 */
export function toggleLayerVisibility(layerId: string): void {
	const layer = sculptureStore.layers.find((l) => l.id === layerId);
	if (!layer) {
		console.warn(`⚠️ Layer ${layerId} not found`);
		return;
	}

	layer.visible = !layer.visible;
	sculptureStore.composedGeometry = composeGeometry();
	sculptureStore.geometryDirty = true;
	console.log(`👁️ [LAYER] Toggled ${layer.name}: ${layer.visible ? 'visible' : 'hidden'}`);
}

/**
 * Update layer opacity
 */
export function setLayerOpacity(layerId: string, opacity: number): void {
	const layer = sculptureStore.layers.find((l) => l.id === layerId);
	if (!layer) {
		console.warn(`⚠️ Layer ${layerId} not found`);
		return;
	}

	layer.opacity = Math.max(0, Math.min(1, opacity));
	sculptureStore.composedGeometry = composeGeometry();
	sculptureStore.geometryDirty = true;
}

/**
 * Create a layer from audio frames (used by Performance Wizard)
 */
export function createLayerFromFrames(
	type: LayerType,
	name: string,
	radiusData: Float32Array
): SculptureLayer {
	return {
		id: crypto.randomUUID(),
		type,
		name,
		data: radiusData,
		opacity: 1.0,
		visible: true,
		createdAt: Date.now()
	};
}

/**
 * Clear all layers and reset
 */
export function clearLayers(): void {
	sculptureStore.layers = [];
	sculptureStore.activeLayerId = null;
	sculptureStore.composedGeometry = null;
	sculptureStore.geometryDirty = true;
	console.log('🧹 [LAYER] Cleared all layers');
}
