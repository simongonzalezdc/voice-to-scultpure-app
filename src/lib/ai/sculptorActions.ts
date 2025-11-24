/**
 * Sculptor AI Actions Schema
 * Defines ALL actions the AI can perform on sculptures
 * 
 * The AI can do EVERYTHING the user can do through the UI.
 */

import type { BlendMode, LayerType } from '$lib/types';

// ============================================================================
// ACTION TYPES - Everything the AI can control
// ============================================================================

export interface SculptorAction {
	type: ActionType;
	params: ActionParams;
}

export type ActionType =
	// Workspace & Mode
	| 'setWorkspace'
	| 'setSculptMode'
	| 'setControlMode'
	| 'setConstraintMode'
	
	// Deformation (Shape Manipulation)
	| 'setDeformation'
	| 'setTwist'
	| 'setCompression'
	| 'setTaper'
	
	// Surface & Material
	| 'setGlaze'
	| 'setRoughness'
	| 'setColor'
	| 'setMaterial'
	
	// Layers
	| 'addLayer'
	| 'removeLayer'
	| 'setLayerOpacity'
	| 'setLayerBlendMode'
	| 'toggleLayerVisibility'
	| 'setActiveLayer'
	| 'clearLayers'
	
	// View & Display
	| 'setViewMode'
	| 'setEnvironment'
	| 'setZoom'
	| 'setOrientation'
	| 'toggleGhost'
	
	// Modifiers
	| 'setQuantize'
	| 'setSymmetry'
	| 'setSculptZone'
	
	// Force Mode
	| 'setForceParams'
	
	// Physical Properties
	| 'setHeight'
	| 'setWallThickness'
	
	// Radius Curve (Direct Shape Editing)
	| 'setRadiusCurve'
	| 'modifyRadiusAtHeight'
	
	// Performance & Recording
	| 'startRecording'
	| 'stopRecording'
	| 'openPerformanceWizard';

export type ActionParams = 
	// Workspace
	| { workspace: 'sculpt' | 'glaze' | 'force' | 'export' }
	| { mode: 'additive' | 'subtractive' }
	| { controlMode: 'standard' | 'melodic' }
	| { constraintMode: 'digital' | 'ceramic' | '3d_print' }
	
	// Deformation
	| { twist: number; compression: number; taper: number }
	| { twist: number }
	| { compression: number }
	| { taper: number }
	
	// Surface
	| { color: string; roughness: number }
	| { roughness: number }
	| { color: string }
	| { material: 'ceramic' | 'plastic' | 'metal' | 'glass' }
	
	// Layers
	| { layerType: LayerType; name?: string }
	| { layerId: string }
	| { layerId: string; opacity: number }
	| { layerId: string; blendMode: BlendMode }
	
	// View
	| { viewMode: 'standard' | 'xray' | 'wireframe' | 'heatmap' }
	| { environment: 'studio' | 'neon' | 'darkroom' }
	| { zoom: number }
	| { orientation: 'vertical' | 'horizontal' }
	| { showGhost: boolean }
	
	// Modifiers
	| { quantize: boolean }
	| { symmetryCount: number }
	| { zoneMin: number; zoneMax: number }
	
	// Force
	| { damping: number; hardness: number; radius: number; strength: number }
	
	// Physical
	| { height: number }
	| { wallThickness: number }
	
	// Radius Curve
	| { points: Array<{ x: number; y: number }> }
	| { heightPercent: number; radiusMultiplier: number }
	
	// Recording
	| Record<string, never>; // Empty params for start/stop

// ============================================================================
// AI RESPONSE FORMAT
// ============================================================================

export interface SculptorResponse {
	/** Natural language explanation of what the AI is doing */
	explanation: string;
	
	/** Array of actions to execute (in order) */
	actions: SculptorAction[];
	
	/** Optional: Suggestions for the user */
	suggestions?: string[];
}

// ============================================================================
// ACTION EXECUTION CONTEXT
// ============================================================================

export interface ActionContext {
	currentWorkspace: string;
	hasActiveSculpture: boolean;
	layerCount: number;
	currentDeformation: {
		twist: number;
		compression: number;
		taper: number;
	};
	currentGlaze: {
		color: string;
		roughness: number;
	};
	physicalHeight: number;
	constraintMode: string;
}

// ============================================================================
// HELPER: Build context summary for AI
// ============================================================================

export function buildContextSummary(context: ActionContext): string {
	return `
CURRENT STATE:
- Workspace: ${context.currentWorkspace}
- Has Sculpture: ${context.hasActiveSculpture}
- Layer Count: ${context.layerCount}
- Height: ${context.physicalHeight}mm
- Constraint Mode: ${context.constraintMode}
- Deformation: twist=${context.currentDeformation.twist}°, compression=${context.currentDeformation.compression}, taper=${context.currentDeformation.taper}
- Glaze: color=${context.currentGlaze.color}, roughness=${context.currentGlaze.roughness}
`.trim();
}

