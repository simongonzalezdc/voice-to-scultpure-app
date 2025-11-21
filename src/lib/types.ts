// Domain Types - Strict TypeScript interfaces

export interface LathePoint {
	x: number;
	y: number;
}

export interface SculptureSurface {
	textureRoughness: number; // 0-1
	glazeTransmission: number; // 0-1
	displacementStrength: number; // 0-1
}

export interface SculptureDeformation {
	twist: number; // radians
	compression: number; // 0-1
	taper: number; // 0-1
}

export interface SculptureDefinition {
	id: string;
	name: string;
	createdAt: number;
	radiusCurve: LathePoint[];
	surface: SculptureSurface;
	deformation: SculptureDeformation;
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
		max: number;
		p25: number;
		p50: number;
		p75: number;
	};
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

