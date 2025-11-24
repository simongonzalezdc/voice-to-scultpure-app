import type { SculptureDefinition, SculptureLayer, LayerType, LathePoint, BlendMode } from '$lib/types';
import { Vector3, type Mesh } from 'three';

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

export function setCurrentSculpture(sculpture: SculptureDefinition | null): void {
	sculptureStore.currentSculpture = sculpture;
	sculptureStore.geometryDirty = true;
	if (sculpture && sculpture.layers.length > 0) {
		sculptureStore.activeLayerId = sculpture.layers[sculpture.layers.length - 1].id;
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

// ============================================================================
// PHASE 1: LAYER MANAGEMENT (Data Structures)
// ============================================================================

export function addLayer(type: LayerType): void {
	if (!sculptureStore.currentSculpture) {
		console.warn('⚠️ Cannot add layer: No active sculpture');
		return;
	}

	const resolution = 128; // Standard resolution for data buffers
	
	const newLayer: SculptureLayer = {
		id: crypto.randomUUID(),
		name: `${type} Layer ${sculptureStore.currentSculpture.layers.length + 1}`,
		type,
		visible: true,
		locked: false,
		blendMode: type === 'base' ? 'overwrite' : 'add',
		opacity: 1.0,
		data: new Float32Array(resolution).fill(type === 'base' ? 0.5 : 0.0),
		mask: new Float32Array(resolution).fill(1.0)
	};

	sculptureStore.currentSculpture.layers.push(newLayer);
	sculptureStore.activeLayerId = newLayer.id;
	sculptureStore.geometryDirty = true;
	
	console.log(`✨ [LAYER] Added ${type} layer: ${newLayer.name}`);
}

export function removeLayer(layerId: string): void {
	if (!sculptureStore.currentSculpture) return;

	const index = sculptureStore.currentSculpture.layers.findIndex(l => l.id === layerId);
	if (index > -1) {
		const removed = sculptureStore.currentSculpture.layers.splice(index, 1)[0];
		console.log(`🗑️ [LAYER] Removed layer: ${removed.name}`);
		
		// Update active layer
		if (sculptureStore.activeLayerId === layerId) {
			const count = sculptureStore.currentSculpture.layers.length;
			sculptureStore.activeLayerId = count > 0 ? sculptureStore.currentSculpture.layers[count - 1].id : null;
		}
		sculptureStore.geometryDirty = true;
	}
}

export function toggleLayerVisibility(layerId: string): void {
	if (!sculptureStore.currentSculpture) return;
	
	const layer = sculptureStore.currentSculpture.layers.find(l => l.id === layerId);
	if (layer) {
		layer.visible = !layer.visible;
		sculptureStore.geometryDirty = true;
	}
}

export function setLayerOpacity(layerId: string, opacity: number): void {
	if (!sculptureStore.currentSculpture) return;

	const layer = sculptureStore.currentSculpture.layers.find(l => l.id === layerId);
	if (layer) {
		layer.opacity = Math.max(0, Math.min(1, opacity));
		sculptureStore.geometryDirty = true;
	}
}

export function setActiveLayer(layerId: string): void {
	if (!sculptureStore.currentSculpture) return;
	
	const layer = sculptureStore.currentSculpture.layers.find(l => l.id === layerId);
	if (layer) {
		sculptureStore.activeLayerId = layer.id;
	}
}

/**
 * Placeholder for Phase 3 Compositor
 * This will eventually be replaced by the detailed compositing logic
 */
export function getCompositeGeometry(): LathePoint[] {
	// Placeholder: return a simple cylinder if logic not yet implemented
	// In Phase 3, this will call the Compositor engine
	if (sculptureStore.composedGeometry) {
		return sculptureStore.composedGeometry;
	}
	
	// Fallback
	return Array(128).fill(0).map((_, i) => ({ x: 0.5, y: i / 127 }));
}
