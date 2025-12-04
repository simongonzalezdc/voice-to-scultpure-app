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

export type LayerType = 'base' | 'deformation' | 'texture' | 'glaze' | 'distortion';
export type BlendMode = 'add' | 'subtract' | 'multiply' | 'overwrite';
export type BaseShape = 'lathe' | 'sphere' | 'cube' | 'plane' | 'coil'; // Shape types (coil = pottery coil building)

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

	// Optional metadata
	sourceFrameCount?: number; // Number of audio frames used to generate this layer
	
	// STORE RAW FRAMES (Best Quality)
	// Allows re-generating geometry with different settings without data loss
	sourceFrames?: AnalysisFrame[]; 
}

export interface SculptureDefinition {
	id: string;
	name: string;
	createdAt: number;

	// NEW LAYER SYSTEM
	layers: SculptureLayer[]; // Ordered bottom-to-top

	physical: SculpturePhysical; // Physical dimensions and manufacturing settings

	// LEGACY PROPERTIES (Maintained for backward compatibility with old saved files)
	// These are populated when loading old sculptures but not used in new code
	radiusCurve?: LathePoint[]; // Deprecated: Use layers instead
	baseShape?: BaseShape; // Deprecated: Use layers instead
	vertexColors?: number[]; // Deprecated: Legacy vertex colors (now in glaze layers)

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

export type CloudProvider = 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter' | 'ollama' | 'together' | 'deepseek' | 'zhipu';
export type AIProviderType = CloudProvider | 'local';

// Legacy alias for backward compatibility
export type AIProvider = AIProviderType;

export interface AIProviderConfig {
	provider: AIProviderType;
	cloudProvider?: CloudProvider;
	apiKey?: string;
	apiEndpoint?: string;
	model?: string;
}

export interface MultiProviderAPIKeys {
	openai?: string;
	anthropic?: string;
	google?: string;
	groq?: string;
	openrouter?: string;
	ollama?: string; // Not typically needed (local), but here for consistency
	together?: string;
	deepseek?: string;
}

export interface AppSettings {
	aiProvider: AIProviderType;
	cloudProvider?: CloudProvider;
	apiKey?: string; // Legacy single key
	apiKeys?: MultiProviderAPIKeys; // Multi-provider keys
	apiEndpoint?: string;
	selectedModel?: string;
	graphicsQuality: 'low' | 'high';
	defaultMicrophone?: string;
	userProfile?: UserProfile;
	viewMode?: {
		potteryMode: boolean; // Lock camera to central axis
	};
	speechToTextEnabled?: boolean;
	preferWhisperAPI?: boolean; // Use OpenAI Whisper instead of browser STT
	// Accessibility settings
	reduceMotion?: boolean; // Disable wave animations, use static indicators
	flashIntensity?: number; // 0-1, control Dazzler/beat flash brightness
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
	// Song Mode: Formant data for Phonetic Geometry (#3)
	formant?: {
		f1: number; // First formant (vowel openness) - 300-800 Hz
		f2: number; // Second formant (vowel frontness) - 800-2500 Hz
		openness: number; // Normalized 0-1 (closed → open)
		frontness: number; // Normalized 0-1 (back → front)
	};
}

export interface ProjectMetadata {
	id: string;
	name: string;
	createdAt: number;
	thumbnail?: string;
	sculptureId: string;
}
