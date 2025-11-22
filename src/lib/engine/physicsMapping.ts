import type { AnalysisFrame, LathePoint, SculptureDefinition, UserProfile } from '$lib/types';

// Geometric design constants
const BASE_RADIUS = 0.5; 

function createHourglass(): LathePoint[] {
	// Simple hourglass shape
	const steps = 20;
	const points: LathePoint[] = [];
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		// Radius varies from 1.0 at ends to 0.2 at center
		const radius = 0.2 + 0.8 * Math.pow(2 * t - 1, 2);
		points.push({ x: radius, y: t });
	}
	return points;
}

export function generateLathe(frames: AnalysisFrame[], profile?: UserProfile): LathePoint[] {
	// 1. Safety: If empty, return hourglass (so we know it failed)
	if (!frames.length) return createHourglass(); 

	// NOISE GATE LOGIC
	// Get noise floor from profile, default to 0.05 if not set
	// RMS values below this are considered silence/background noise
	const noiseFloor = profile?.energyRange?.min || 0.02; 
	const silenceThreshold = noiseFloor * 1.5; // Add 50% safety margin

	// 2. Resample: Limit to 200 points max (High Res)
	const maxPoints = 200;
	const samplingRate = Math.ceil(frames.length / maxPoints);
	const sampledFrames = frames.filter((_, i) => i % samplingRate === 0);

	// 3. Map Frames to Points
	return sampledFrames.map((frame, index) => {
		// AGGRESSIVE MAPPING
		let energy = frame.energy || 0;
		
		// Apply Noise Gate
		if (energy < silenceThreshold) {
			energy = 0;
		} else {
			// Normalize energy relative to the gate
			// energy = Math.max(0, energy - noiseFloor); 
            // Let's keep it simple to avoid clipping legitimate low volume
		}

		if (energy > 0.1) console.log("I HEAR YOU:", energy);

		const radius = 0.2 + (energy * 2.0); 
		
		// Spikiness (Frequency)
		// If Pitch > 400Hz, add random jaggedness
		const jitter = frame.pitch > 400 ? (Math.random() * 0.1) : 0;
		
		// Calculate Y based on index
		const normalizedHeight = index / (sampledFrames.length - 1 || 1);

		return { x: radius + jitter, y: normalizedHeight };
	});
}

export function applyDeformation(
	curve: LathePoint[],
	deformation: { twist: number; compression: number; taper: number }
): LathePoint[] {
	// ISSUE 3 FIX: Non-destructive compression formula
	// compression range: -0.5 (stretch) to 0.5 (squash)
	// Formula: Apply more effect at the top, less at the bottom (normalized by height)
	return curve.map((point, i) => {
		const normalizedHeight = i / curve.length;
		const angle = deformation.twist * normalizedHeight * Math.PI * 2;
		
		// Compression formula: Linear scaling based on normalized height
		// Negative compression stretches (factor > 1), positive compresses (factor < 1)
		const compressionFactor = 1 - deformation.compression * normalizedHeight;
		const compressedY = point.y * compressionFactor;
		
		const taperedX = point.x * (1 - deformation.taper * normalizedHeight);

		// Apply twist (rotate around Y axis)
		const rotatedX = taperedX * Math.cos(angle);

		return {
			x: rotatedX,
			y: compressedY
		};
	});
}

export function deriveSurfaceParameters(frames: AnalysisFrame[]): {
	textureRoughness: number;
	glazeTransmission: number;
} {
	if (frames.length === 0) {
		return { textureRoughness: 0.5, glazeTransmission: 0.3 };
	}

	// Average timbre (spectral centroid) influences roughness
	const avgTimbre =
		frames.reduce((sum, f) => sum + (f.timbre?.spectralCentroid || 0), 0) / frames.length;
	const normalizedTimbre = Math.min(1, Math.max(0, avgTimbre / 5000)); // Normalize to 0-1

	// Energy variance influences glaze
	const energies = frames.map((f) => f.energy);
	const avgEnergy = energies.reduce((a, b) => a + b, 0) / energies.length;
	const variance = energies.reduce((sum, e) => sum + (e - avgEnergy) ** 2, 0) / energies.length;
	const normalizedVariance = Math.min(1, variance * 10);

	return {
		textureRoughness: normalizedTimbre,
		glazeTransmission: 0.3 + normalizedVariance * 0.4
	};
}

export function createSculptureFromFrames(
	frames: AnalysisFrame[],
	profile?: UserProfile,
	name?: string
): SculptureDefinition {
	const radiusCurve = generateLathe(frames, profile);
	const surface = deriveSurfaceParameters(frames);

	return {
		id: crypto.randomUUID(),
		name: name || `Sculpture ${new Date().toLocaleString()}`,
		createdAt: Date.now(),
		radiusCurve,
		surface: {
			...surface,
			displacementStrength: 0,
			// Default to ceramic/beige if not specified
			materialType: 'ceramic',
			baseColor: '#E0C9A6'
		},
		deformation: {
			twist: 0,
			compression: 0,
			taper: 0
		},
	physical: {
		height: 150, // Default 150mm for mug/small vase
		units: 'mm',
		wallThickness: undefined, // Optional, for 3D printing
		orientation: 'vertical' // Default: vertical (pottery wheel)
	}
	};
}
