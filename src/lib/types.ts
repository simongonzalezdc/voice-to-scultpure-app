// Domain Types - Strict TypeScript interfaces

// ============================================================================
// PHASE 3.1: MATERIAL DEFAULTS (Centralized Constants)
// ============================================================================
export const DEFAULT_MATERIAL_CERAMIC = '#E0C9A6'; // Warm beige/clay tone
export const DEFAULT_MATERIAL_PLASTIC = '#3080ff'; // Deep blue

export interface LathePoint {
	x: number;
	y: number;
}

export interface SculpturePhysical {
	height: number; // Physical height in millimeters (default 150mm for mug/small vase)
	units: 'mm' | 'inch'; // Measurement units (default 'mm')
	wallThickness?: number; // Wall thickness in mm (for 3D printing vs solid ceramic)
	orientation: 'vertical' | 'horizontal'; // Axis orientation: vertical (pottery wheel) or horizontal (lathe)
	sculptMode?: 'additive' | 'subtractive'; // Sculpting mode: additive (build up) or subtractive (carve in), default 'additive'
}

// ============================================================================
// PHASE 1: DATA STRUCTURES (The Backbone)
// ============================================================================

export type LayerType = 'base' | 'deformation' | 'texture' | 'glaze';
export type BlendMode = 'add' | 'subtract' | 'multiply' | 'overwrite';

export interface SculptureLayer {
	id: string;
	name: string;
	visible: boolean;
	locked: boolean;
	type: LayerType;
	blendMode: BlendMode;
	opacity: number; // Global strength of this layer (0.0 - 1.0)

	// DATA BUFFERS (Float32Array for performance)
	// 1. The Shape Data (Radius offsets for deformation, RGB for glaze)
	data: Float32Array; 
	// 2. The Smart Mask (Records Volume/Intensity during singing)
	mask: Float32Array; 
}

export interface SculptureDefinition {
	id: string;
	name: string;
	createdAt: number;
	
	// NEW LAYER SYSTEM
	layers: SculptureLayer[]; // Ordered bottom-to-top
	
	physical: SculpturePhysical; // Keeps existing physical props
	
	// DEPRECATED PROPERTIES (Maintained temporarily for types but unused)
	// radiusCurve (Calculated dynamically from layers)
	// surface (Moved to Glaze Layers)
	// deformation (Moved to Deformation Layers)
	
	// Metadata
	audioBlobId?: string;
	instructions?: string[];
}

export interface UserProfile {
	id: string;
	calibrated: boolean;
	pitchRange: {
		min: number;
		max: number;
		p25: number;
		p50: number;
		p75: number;
	};
	energyRange: {
		min: number;
		max: number;
		p25: number;
		p50: number;
		p75: number;
	};
	timbreRange: {
		min: number;
		max: number; // Timbre ceiling (max grit/harsh sounds)
		p25: number;
		p50: number;
		p75: number;
	};
	attackThreshold: number; // Dynamic threshold for detecting sharp attacks (chisel effect)
}

export type AIProvider = 'cloud' | 'local';

export interface AIProviderConfig {
	provider: AIProvider;
	apiKey?: string;
	apiEndpoint?: string;
	model?: string;
}

export interface AppSettings {
	aiProvider: AIProvider;
	apiKey?: string;
	apiEndpoint?: string;
	graphicsQuality: 'low' | 'high';
	defaultMicrophone?: string;
	userProfile?: UserProfile;
	viewMode?: {
		potteryMode: boolean; // Lock camera to central axis
	};
}

export interface AudioRingBuffer {
	buffer: SharedArrayBuffer;
	capacity: number;
	sampleRate: number;
}

export interface AnalysisFrame {
	time: number;
	pitch: number; // Hz, 0 if not detected
	energy: number; // RMS, 0-1
	timbre: {
		spectralCentroid: number;
		zcr: number; // Zero crossing rate
		spectralFlux: number;
	};
	beat?: boolean; // Beat detection flag (Generative Performance)
}

export interface ProjectMetadata {
	id: string;
	name: string;
	createdAt: number;
	thumbnail?: string;
	sculptureId: string;
}
