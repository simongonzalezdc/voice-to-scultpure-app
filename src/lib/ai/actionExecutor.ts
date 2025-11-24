/**
 * Action Executor
 * Executes AI-generated actions on the sculpture
 * 
 * This is the bridge between AI responses and actual sculpture modifications.
 */

import type { SculptorAction, ActionContext } from './sculptorActions';
import { 
	uiStore,
	setWorkspace,
	setSculptMode,
	setControlMode,
	setConstraintMode,
	setActiveGlaze,
	setViewMode,
	setEnvironment,
	setZoom,
	setOrientation,
	setQuantizeEnabled,
	setSymmetryCount,
	setSculptZone,
	openPerformanceWizard
} from '$lib/stores/uiStore.svelte';
import {
	sculptureStore,
	setCurrentSculpture,
	addLayer,
	removeLayer,
	setLayerOpacity,
	toggleLayerVisibility,
	setActiveLayer,
	clearLayers
} from '$lib/stores/sculptureStore.svelte';
import {
	startRecording,
	stopRecording
} from '$lib/stores/recording.svelte';
import type { SculptureDefinition, LayerType, BlendMode } from '$lib/types';

export interface ExecutionResult {
	success: boolean;
	message: string;
	actionType: string;
}

/**
 * Execute a single action
 */
export function executeAction(action: SculptorAction): ExecutionResult {
	try {
		const { type, params } = action;

		switch (type) {
			// ============================================
			// WORKSPACE & MODE
			// ============================================
			case 'setWorkspace': {
				const p = params as { workspace: 'sculpt' | 'glaze' | 'force' | 'export' };
				setWorkspace(p.workspace);
				return { success: true, message: `Switched to ${p.workspace} workspace`, actionType: type };
			}

			case 'setSculptMode': {
				const p = params as { mode: 'additive' | 'subtractive' };
				setSculptMode(p.mode);
				return { success: true, message: `Set sculpt mode to ${p.mode}`, actionType: type };
			}

			case 'setControlMode': {
				const p = params as { controlMode: 'standard' | 'melodic' };
				setControlMode(p.controlMode);
				return { success: true, message: `Set control mode to ${p.controlMode}`, actionType: type };
			}

			case 'setConstraintMode': {
				const p = params as { constraintMode: 'digital' | 'ceramic' | '3d_print' };
				setConstraintMode(p.constraintMode);
				return { success: true, message: `Set constraint mode to ${p.constraintMode}`, actionType: type };
			}

			// ============================================
			// DEFORMATION
			// ============================================
			case 'setDeformation': {
				const p = params as { twist: number; compression: number; taper: number };
				uiStore.deformation.twist = clamp(p.twist, -360, 360);
				uiStore.deformation.compression = clamp(p.compression, -1, 1);
				uiStore.deformation.taper = clamp(p.taper, -1, 1);
				sculptureStore.geometryDirty = true;
				return { success: true, message: `Set deformation: twist=${p.twist}°, compression=${p.compression}, taper=${p.taper}`, actionType: type };
			}

			case 'setTwist': {
				const p = params as { twist: number };
				uiStore.deformation.twist = clamp(p.twist, -360, 360);
				sculptureStore.geometryDirty = true;
				return { success: true, message: `Set twist to ${p.twist}°`, actionType: type };
			}

			case 'setCompression': {
				const p = params as { compression: number };
				uiStore.deformation.compression = clamp(p.compression, -1, 1);
				sculptureStore.geometryDirty = true;
				return { success: true, message: `Set compression to ${p.compression}`, actionType: type };
			}

			case 'setTaper': {
				const p = params as { taper: number };
				uiStore.deformation.taper = clamp(p.taper, -1, 1);
				sculptureStore.geometryDirty = true;
				return { success: true, message: `Set taper to ${p.taper}`, actionType: type };
			}

			// ============================================
			// SURFACE & MATERIAL
			// ============================================
			case 'setGlaze': {
				const p = params as { color: string; roughness: number };
				setActiveGlaze(p.color, clamp(p.roughness, 0, 1));
				return { success: true, message: `Set glaze: ${p.color}, roughness=${p.roughness}`, actionType: type };
			}

			case 'setColor': {
				const p = params as { color: string };
				setActiveGlaze(p.color, uiStore.activeGlaze.roughness);
				return { success: true, message: `Set color to ${p.color}`, actionType: type };
			}

			case 'setRoughness': {
				const p = params as { roughness: number };
				setActiveGlaze(uiStore.activeGlaze.color, clamp(p.roughness, 0, 1));
				return { success: true, message: `Set roughness to ${p.roughness}`, actionType: type };
			}

			case 'setMaterial': {
				const p = params as { material: 'ceramic' | 'plastic' | 'metal' | 'glass' };
				// Map material to roughness preset
				const materialRoughness: Record<string, number> = {
					ceramic: 0.6,
					plastic: 0.3,
					metal: 0.1,
					glass: 0.05
				};
				const roughness = materialRoughness[p.material] ?? 0.5;
				setActiveGlaze(uiStore.activeGlaze.color, roughness);
				return { success: true, message: `Set material to ${p.material}`, actionType: type };
			}

			// ============================================
			// LAYERS
			// ============================================
			case 'addLayer': {
				const p = params as { layerType: LayerType; name?: string };
				addLayer(p.layerType);
				return { success: true, message: `Added ${p.layerType} layer`, actionType: type };
			}

			case 'removeLayer': {
				const p = params as { layerId: string };
				removeLayer(p.layerId);
				return { success: true, message: `Removed layer ${p.layerId}`, actionType: type };
			}

			case 'setLayerOpacity': {
				const p = params as { layerId: string; opacity: number };
				setLayerOpacity(p.layerId, clamp(p.opacity, 0, 1));
				return { success: true, message: `Set layer opacity to ${p.opacity}`, actionType: type };
			}

			case 'setLayerBlendMode': {
				const p = params as { layerId: string; blendMode: BlendMode };
				if (sculptureStore.currentSculpture) {
					const layer = sculptureStore.currentSculpture.layers.find(l => l.id === p.layerId);
					if (layer) {
						layer.blendMode = p.blendMode;
						sculptureStore.geometryDirty = true;
					}
				}
				return { success: true, message: `Set layer blend mode to ${p.blendMode}`, actionType: type };
			}

			case 'toggleLayerVisibility': {
				const p = params as { layerId: string };
				toggleLayerVisibility(p.layerId);
				return { success: true, message: `Toggled layer visibility`, actionType: type };
			}

			case 'setActiveLayer': {
				const p = params as { layerId: string };
				setActiveLayer(p.layerId);
				return { success: true, message: `Set active layer`, actionType: type };
			}

			case 'clearLayers': {
				clearLayers();
				return { success: true, message: `Cleared all layers`, actionType: type };
			}

			// ============================================
			// VIEW & DISPLAY
			// ============================================
			case 'setViewMode': {
				const p = params as { viewMode: 'standard' | 'xray' | 'wireframe' | 'heatmap' };
				setViewMode(p.viewMode);
				return { success: true, message: `Set view mode to ${p.viewMode}`, actionType: type };
			}

			case 'setEnvironment': {
				const p = params as { environment: 'studio' | 'neon' | 'darkroom' };
				setEnvironment(p.environment);
				return { success: true, message: `Set environment to ${p.environment}`, actionType: type };
			}

			case 'setZoom': {
				const p = params as { zoom: number };
				setZoom(clamp(p.zoom, 0.5, 3.0));
				return { success: true, message: `Set zoom to ${p.zoom}`, actionType: type };
			}

			case 'setOrientation': {
				const p = params as { orientation: 'vertical' | 'horizontal' };
				setOrientation(p.orientation);
				return { success: true, message: `Set orientation to ${p.orientation}`, actionType: type };
			}

			case 'toggleGhost': {
				const p = params as { showGhost: boolean };
				uiStore.showGhost = p.showGhost;
				return { success: true, message: `${p.showGhost ? 'Showing' : 'Hiding'} ghost overlay`, actionType: type };
			}

			// ============================================
			// MODIFIERS
			// ============================================
			case 'setQuantize': {
				const p = params as { quantize: boolean };
				setQuantizeEnabled(p.quantize);
				return { success: true, message: `Quantize ${p.quantize ? 'enabled' : 'disabled'}`, actionType: type };
			}

			case 'setSymmetry': {
				const p = params as { symmetryCount: number };
				setSymmetryCount(clamp(Math.floor(p.symmetryCount), 0, 12));
				return { success: true, message: `Set symmetry to ${p.symmetryCount} lobes`, actionType: type };
			}

			case 'setSculptZone': {
				const p = params as { zoneMin: number; zoneMax: number };
				setSculptZone(clamp(p.zoneMin, 0, 1), clamp(p.zoneMax, 0, 1));
				return { success: true, message: `Set sculpt zone: ${p.zoneMin} to ${p.zoneMax}`, actionType: type };
			}

			// ============================================
			// FORCE MODE
			// ============================================
			case 'setForceParams': {
				const p = params as { damping: number; hardness: number; radius: number; strength: number };
				uiStore.forceParams.damping = clamp(p.damping, 0, 1);
				uiStore.forceParams.hardness = clamp(p.hardness, 0, 1);
				uiStore.forceParams.radius = clamp(p.radius, 0, 1);
				uiStore.forceParams.strength = clamp(p.strength, 0, 1);
				return { success: true, message: `Set force params`, actionType: type };
			}

			// ============================================
			// PHYSICAL PROPERTIES
			// ============================================
			case 'setHeight': {
				const p = params as { height: number };
				if (sculptureStore.currentSculpture) {
					sculptureStore.currentSculpture.physical.height = clamp(p.height, 10, 1000);
					sculptureStore.geometryDirty = true;
				}
				return { success: true, message: `Set height to ${p.height}mm`, actionType: type };
			}

			case 'setWallThickness': {
				const p = params as { wallThickness: number };
				if (sculptureStore.currentSculpture) {
					sculptureStore.currentSculpture.physical.wallThickness = clamp(p.wallThickness, 1, 50);
				}
				return { success: true, message: `Set wall thickness to ${p.wallThickness}mm`, actionType: type };
			}

			// ============================================
			// SHAPE EDITING
			// ============================================
			case 'setRadiusCurve': {
				const p = params as { points: Array<{ x: number; y: number }> };
				if (sculptureStore.currentSculpture && p.points.length >= 2) {
					// Validate and sanitize points
					const validPoints = p.points
						.filter(pt => Number.isFinite(pt.x) && Number.isFinite(pt.y))
						.map(pt => ({
							x: clamp(pt.x, 0.01, 2),
							y: clamp(pt.y, 0, 2)
						}));
					
					if (validPoints.length >= 2) {
						sculptureStore.currentSculpture.radiusCurve = validPoints;
						sculptureStore.geometryDirty = true;
					}
				}
				return { success: true, message: `Set radius curve with ${p.points.length} points`, actionType: type };
			}

			case 'modifyRadiusAtHeight': {
				const p = params as { heightPercent: number; radiusMultiplier: number };
				if (sculptureStore.currentSculpture?.radiusCurve) {
					const curve = sculptureStore.currentSculpture.radiusCurve;
					const targetIndex = Math.floor(clamp(p.heightPercent, 0, 1) * (curve.length - 1));
					const point = curve[targetIndex];
					if (point) {
						point.x = clamp(point.x * p.radiusMultiplier, 0.01, 2);
						sculptureStore.geometryDirty = true;
					}
				}
				return { success: true, message: `Modified radius at ${p.heightPercent * 100}% height`, actionType: type };
			}

			// ============================================
			// RECORDING & PERFORMANCE
			// ============================================
			case 'startRecording': {
				startRecording();
				return { success: true, message: 'Started recording', actionType: type };
			}

			case 'stopRecording': {
				stopRecording();
				return { success: true, message: 'Stopped recording', actionType: type };
			}

			case 'openPerformanceWizard': {
				openPerformanceWizard();
				return { success: true, message: 'Opened Performance Wizard', actionType: type };
			}

			default:
				return { success: false, message: `Unknown action type: ${type}`, actionType: type };
		}
	} catch (error) {
		return {
			success: false,
			message: `Error executing ${action.type}: ${error instanceof Error ? error.message : String(error)}`,
			actionType: action.type
		};
	}
}

/**
 * Execute multiple actions in sequence
 */
export function executeActions(actions: SculptorAction[]): ExecutionResult[] {
	return actions.map(action => executeAction(action));
}

/**
 * Build current context for AI
 */
export function buildContext(): ActionContext {
	return {
		currentWorkspace: uiStore.workspace,
		hasActiveSculpture: sculptureStore.currentSculpture !== null,
		layerCount: sculptureStore.currentSculpture?.layers.length ?? 0,
		currentDeformation: {
			twist: uiStore.deformation.twist,
			compression: uiStore.deformation.compression,
			taper: uiStore.deformation.taper
		},
		currentGlaze: {
			color: uiStore.activeGlaze.color,
			roughness: uiStore.activeGlaze.roughness
		},
		physicalHeight: sculptureStore.currentSculpture?.physical.height ?? 150,
		constraintMode: uiStore.constraintMode
	};
}

/**
 * Utility: Clamp a number to a range
 */
function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

