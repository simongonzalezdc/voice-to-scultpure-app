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

export interface SculptureSurface {
	textureRoughness: number; // 0-1
	glazeTransmission: number; // 0-1
	displacementStrength: number; // 0-1
	materialType?: 'ceramic' | 'plastic'; // Default: 'ceramic'
	baseColor?: string; // Hex code, default depends on material
}

export interface SculptureDeformation {
	twist: number; // radians
	compression: number; // 0-1
	taper: number; // 0-1
}

export interface SculpturePhysical {
	height: number; // Physical height in millimeters (default 150mm for mug/small vase)
	units: 'mm' | 'inch'; // Measurement units (default 'mm')
	wallThickness?: number; // Wall thickness in mm (for 3D printing vs solid ceramic)
	orientation: 'vertical' | 'horizontal'; // Axis orientation: vertical (pottery wheel) or horizontal (lathe)
	sculptMode?: 'additive' | 'subtractive'; // Sculpting mode: additive (build up) or subtractive (carve in), default 'additive'
}

export type BaseShape = 'lathe' | 'sphere' | 'cube' | 'plane';

export interface SculptureDefinition {
	id: string;
	name: string;
	createdAt: number;
	baseShape?: BaseShape; // Default: 'lathe' - if not 'lathe', ignore radiusCurve
	radiusCurve: LathePoint[]; // Only used when baseShape === 'lathe'
	surface: SculptureSurface;
	deformation: SculptureDeformation;
	physical: SculpturePhysical;
	vertexColors?: number[]; // RGB values as array (3 values per vertex) for glazing
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
		min: number; // Timbre floor (noise/silence baseline)
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
}

export interface ProjectMetadata {
	id: string;
	name: string;
	createdAt: number;
	thumbnail?: string;
	sculptureId: string;
}
