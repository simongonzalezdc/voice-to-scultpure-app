import type {
	SculptureDefinition,
	SculptureLayer,
	LayerType,
	LathePoint,
	BlendMode
} from '$lib/types';
import { Vector3, type Mesh } from 'three';
import { DEFAULT_HEIGHT_MM } from '$lib/config/constants';

export const sculptureStore = $state<{
	currentSculpture: SculptureDefinition | null;
	ghostSculpture: SculptureDefinition | null;
	geometryDirty: boolean;
	interactionPoint: Vector3 | null;
	interactionNormal: Vector3 | null;
	meshReference: Mesh | null;
	// GENERATIVE PERFORMANCE: Layer Stack
	activeLayerId: string | null;
	composedGeometry: LathePoint[] | null;
}>({
	currentSculpture: null,
	ghostSculpture: null,
	geometryDirty: false,
	interactionPoint: null,
	interactionNormal: null,
	meshReference: null,
	activeLayerId: null,
	composedGeometry: null
});

function ensureCurrentSculpture(): SculptureDefinition {
	if (!sculptureStore.currentSculpture) {
		sculptureStore.currentSculpture = {
			id: crypto.randomUUID(),
			name: 'Auto Sculpture',
			createdAt: Date.now(),
			layers: [],
			physical: {
				height: DEFAULT_HEIGHT_MM,
				units: 'mm',
				orientation: 'vertical',
				sculptMode: 'additive'
			}
		} as SculptureDefinition;
		sculptureStore.activeLayerId = null;
	}
	// Keep legacy accessor for tests
	(sculptureStore as any).layers = sculptureStore.currentSculpture.layers;
	return sculptureStore.currentSculpture as SculptureDefinition;
}

export function setCurrentSculpture(sculpture: SculptureDefinition | null): void {
	console.log('🔴🔴🔴 [SCULPTURE STORE] setCurrentSculpture() called with:', sculpture ? `${sculpture.name}, ${sculpture.layers?.length || 0} layers` : 'null');
	console.trace('🔴🔴🔴 [SCULPTURE STORE] Call stack:');
	sculptureStore.currentSculpture = sculpture;
	if (sculpture) {
		(sculptureStore as any).layers = sculpture.layers;
	}
	sculptureStore.geometryDirty = true;
	// Safety check: layers might be undefined for legacy sculptures
	if (sculpture?.layers && sculpture.layers.length > 0) {
		const lastLayer = sculpture.layers[sculpture.layers.length - 1];
		sculptureStore.activeLayerId = lastLayer?.id ?? null;
	} else {
		sculptureStore.activeLayerId = null;
	}
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
 * Set the mesh reference for color capture
 * @param mesh - The Mesh instance to reference
 */
export function setMeshReference(mesh: Mesh | null): void {
	sculptureStore.meshReference = mesh;
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

	const vertexCount =
		sculptureStore.meshReference?.geometry?.getAttribute('position')?.count ?? colors.length / 3;
	const expectedColorCount = vertexCount ? vertexCount * 3 : null;

	if (expectedColorCount && colors.length !== expectedColorCount) {
		console.assert(
			false,
			`Color/Vertex Mismatch (expected ${expectedColorCount}, received ${colors.length})`
		);
		window.alert?.('Data Corruption Detected: vertex color array length mismatch.');
		// Clear legacy vertexColors if mismatch
		const updated: SculptureDefinition = {
			...sculptureStore.currentSculpture,
			vertexColors: []
		};
		sculptureStore.currentSculpture = updated;
		return;
	}

	// Store colors in sculpture definition for persistence
	// NOTE: Legacy vertexColors property maintained for backward compatibility
	// New sculptures should use glaze layers instead (see addLayer with type='glaze')
	const updated: SculptureDefinition = {
		...sculptureStore.currentSculpture,
		vertexColors: Array.from(colors)
	};

	sculptureStore.currentSculpture = updated;
	sculptureStore.geometryDirty = true;
	console.log(`🎨 [SCULPTURE] Updated colors for ${colors.length / 3} vertices`);
}

// ============================================================================
// PHASE 1: LAYER MANAGEMENT (Data Structures)
// ============================================================================

export function addLayer(layerOrType: LayerType | SculptureLayer): void {
	const sculpture = ensureCurrentSculpture();

	let newLayer: SculptureLayer;

	// Handle both LayerType (string) and SculptureLayer (object)
	if (typeof layerOrType === 'string') {
		// Create new layer from type
		const type = layerOrType;
		const resolution = 128; // Standard resolution for data buffers

		newLayer = {
			id: crypto.randomUUID(),
			name: `${type} Layer ${sculpture.layers.length + 1}`,
			type,
			visible: true,
			locked: false,
			blendMode: type === 'base' ? 'overwrite' : 'add',
			opacity: 1.0,
			data: new Float32Array(resolution).fill(type === 'base' ? 0.5 : 0.0),
			mask: new Float32Array(resolution).fill(1.0)
		};
	} else {
		// Use provided layer object (ensure it has an ID)
		newLayer = {
			...layerOrType,
			id: layerOrType.id || crypto.randomUUID()
		};
	}

	sculpture.layers.push(newLayer);
	sculptureStore.activeLayerId = newLayer.id;
	sculptureStore.geometryDirty = true;
	(sculptureStore as any).layers = sculpture.layers;

	console.log(`✨ [LAYER] Added ${newLayer.type} layer: ${newLayer.name}`);
}

export function removeLayer(layerId: string): void {
	if (!sculptureStore.currentSculpture) return;

	const index = sculptureStore.currentSculpture.layers.findIndex((l) => l.id === layerId);
	if (index > -1) {
		const removed = sculptureStore.currentSculpture.layers.splice(index, 1)[0];
		if (removed) {
			console.log(`🗑️ [LAYER] Removed layer: ${removed.name}`);
		}

		// Update active layer
		if (sculptureStore.activeLayerId === layerId) {
			const count = sculptureStore.currentSculpture?.layers.length ?? 0;
			if (count > 0 && sculptureStore.currentSculpture) {
				const lastLayer = sculptureStore.currentSculpture.layers[count - 1];
				sculptureStore.activeLayerId = lastLayer?.id ?? null;
			} else {
				sculptureStore.activeLayerId = null;
			}
		}
		sculptureStore.geometryDirty = true;
	}
}

export function toggleLayerVisibility(layerId: string): void {
	if (!sculptureStore.currentSculpture) return;

	const layer = sculptureStore.currentSculpture.layers.find((l) => l.id === layerId);
	if (layer) {
		layer.visible = !layer.visible;
		sculptureStore.geometryDirty = true;
	}
}

export function setLayerOpacity(layerId: string, opacity: number): void {
	if (!sculptureStore.currentSculpture) return;

	const layer = sculptureStore.currentSculpture.layers.find((l) => l.id === layerId);
	if (layer) {
		layer.opacity = Math.max(0, Math.min(1, opacity));
		sculptureStore.geometryDirty = true;
	}
}

export function setActiveLayer(layerId: string): void {
	if (!sculptureStore.currentSculpture) return;

	const layer = sculptureStore.currentSculpture.layers.find((l) => l.id === layerId);
	if (layer) {
		sculptureStore.activeLayerId = layer.id;
	}
}

/**
 * Clear all layers from the current sculpture
 * Used for resetting/testing
 */
export function clearLayers(): void {
	const sculpture = ensureCurrentSculpture();
	sculpture.layers = [];
	sculptureStore.activeLayerId = null;
	sculptureStore.geometryDirty = true;
	(sculptureStore as any).layers = sculpture.layers;
	console.log('🗑️ [LAYER] Cleared all layers');
}

/**
 * Create a layer from audio frame data
 * @param type - Layer type (base, deformation, texture, glaze)
 * @param name - Layer name
 * @param data - Float32Array of data (radius values for base/deformation, RGB for glaze)
 * @returns Created SculptureLayer
 */
export function createLayerFromFrames(
	type: LayerType,
	name: string,
	data: Float32Array
): SculptureLayer {
	const resolution = data.length / 2; // Assuming data is [x, y, x, y, ...] pairs

	return {
		id: crypto.randomUUID(),
		name,
		type,
		visible: true,
		locked: false,
		blendMode: type === 'base' ? 'overwrite' : 'add',
		opacity: 1.0,
		data: new Float32Array(data), // Copy the data
		mask: new Float32Array(resolution).fill(1.0) // Default mask (fully visible)
	};
}

/**
 * Compose geometry from all visible layers
 * Combines layers according to their blend modes
 * @returns Composed LathePoint[] geometry
 */
export function composeGeometry(): LathePoint[] {
	if (!sculptureStore.currentSculpture) {
		return Array(128)
			.fill(0)
			.map((_, i) => ({ x: 0.5, y: i / 127 }));
	}

	const layers = sculptureStore.currentSculpture.layers.filter((l) => l.visible);
	if (layers.length === 0) {
		return Array(128)
			.fill(0)
			.map((_, i) => ({ x: 0.5, y: i / 127 }));
	}

	// Find the base layer (or use first layer as base)
	const baseLayer = layers.find((l) => l.type === 'base') || layers[0];
	if (!baseLayer) {
		return Array(128)
			.fill(0)
			.map((_, i) => ({ x: 0.5, y: i / 127 }));
	}

	// Extract points from base layer data (assuming data is [x, y, x, y, ...] pairs)
	const pointCount = baseLayer.data.length / 2;
	const points: LathePoint[] = [];

	for (let i = 0; i < pointCount; i++) {
		const baseX = baseLayer.data[i * 2];
		const baseY = baseLayer.data[i * 2 + 1];
		if (baseX === undefined || baseY === undefined) continue;

		let x = baseX;
		let y = baseY;

		// Apply other layers on top
		for (const layer of layers) {
			if (layer === baseLayer || layer.type === 'base') continue;
			if (!layer.visible || layer.locked) continue;

			const layerPointCount = layer.data.length / 2;
			if (i < layerPointCount) {
				const layerX = layer.data[i * 2];
				const layerY = layer.data[i * 2 + 1];
				if (layerX === undefined || layerY === undefined) continue;

				// Apply blend mode
				if (layer.blendMode === 'add') {
					const deltaX = layerX - x;
					const deltaY = layerY - y;
					x += deltaX * layer.opacity;
					y += deltaY * layer.opacity;
				} else if (layer.blendMode === 'subtract') {
					x -= layerX * layer.opacity;
					y -= layerY * layer.opacity;
				} else if (layer.blendMode === 'multiply') {
					x *= 1 + (layerX - 1) * layer.opacity;
					y *= 1 + (layerY - 1) * layer.opacity;
				}
				// 'overwrite' is handled by base layer only
			}
		}

		points.push({ x: Math.max(0.05, x), y: Math.max(0, Math.min(2, y)) });
	}

	// Store composed geometry for caching
	sculptureStore.composedGeometry = points;
	return points;
}

/**
 * Placeholder for Phase 3 Compositor
 * This will eventually be replaced by the detailed compositing logic
 */
export function getCompositeGeometry(): LathePoint[] {
	// Use composeGeometry if available
	return composeGeometry();
}
