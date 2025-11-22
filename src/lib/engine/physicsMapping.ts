import type { AnalysisFrame, LathePoint, SculptureDefinition, UserProfile } from '$lib/types';
import { Color } from 'three';

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

export function generateLathe(
	frames: AnalysisFrame[], 
	profile?: UserProfile,
	mode: 'additive' | 'subtractive' = 'additive'
): LathePoint[] {
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

	// Constants for radius calculation
	const BASE_RADIUS = 0.2;
	const MAX_RADIUS = 1.5; // Standard block size for subtractive mode
	const SENSITIVITY = 2.0;
	const MIN_RADIUS = 0.1; // Constraint: never go below this

	// Track previous frame for attack detection
	let previousFrame: AnalysisFrame | null = null;

	// 3. Map Frames to Points
	return sampledFrames.map((frame, index) => {
		// AGGRESSIVE MAPPING
		let energy = frame.energy || 0;
		
		// Apply Noise Gate
		if (energy < silenceThreshold) {
			energy = 0;
		}

		if (energy > 0.1) console.log("I HEAR YOU:", energy);

		// Calculate radius based on mode
		let radius: number;
		if (mode === 'subtractive') {
			// Subtractive: Carve into the block
			// High energy = more carving = smaller radius
			radius = MAX_RADIUS - (energy * SENSITIVITY);
			// Ensure radius never goes below minimum
			radius = Math.max(MIN_RADIUS, radius);
		} else {
			// Additive: Build up from base
			// High energy = more material = larger radius
			radius = BASE_RADIUS + (energy * SENSITIVITY);
		}
		
		// Timbre Normalization: Use calibrated range to normalize spectral centroid
		// Clamp noise floor so background hiss = 0 roughness
		let normalizedRoughness = 0;
		if (profile?.timbreRange && frame.timbre?.spectralCentroid) {
			const tMin = profile.timbreRange.min;
			const tMax = profile.timbreRange.max;
			const rawCentroid = frame.timbre.spectralCentroid;
			
			// Normalize 0 to 1, clamping to prevent negative values
			if (tMax > tMin) {
				normalizedRoughness = Math.max(0, Math.min(1, (rawCentroid - tMin) / (tMax - tMin)));
			}
		}
		
		// Use normalized roughness for noise modifier (jitter)
		const noiseMod = (Math.random() - 0.5) * normalizedRoughness * 0.15;
		
		// Dynamic Attack Detection: Detect sharp energy spikes (chisel effect)
		let attackJitter = 0;
		if (previousFrame && profile?.attackThreshold) {
			const threshold = profile.attackThreshold || 0.15; // Fallback if missing
			const deltaEnergy = Math.abs(frame.energy - previousFrame.energy);
			const isAttack = deltaEnergy > threshold;
			
			if (isAttack) {
				// Sharp attack creates jagged edges (chisel effect)
				attackJitter = (Math.random() - 0.5) * 0.2;
			}
		}
		
		// Pitch Scaling: Normalize pitch to user's range for consistent visibility
		let pitchJitter = 0;
		if (frame.pitch > 0 && profile?.pitchRange) {
			const pitchMin = profile.pitchRange.min || 80;
			const pitchMax = profile.pitchRange.max || 400;
			const pitchRange = pitchMax - pitchMin;
			
			if (pitchRange > 0) {
				// Normalize pitch to 0-1, then scale jitter
				const normalizedPitch = Math.max(0, Math.min(1, (frame.pitch - pitchMin) / pitchRange));
				// Higher pitches get more jitter, but scale so low notes are still visible
				const pitchMultiplier = 0.3 + (normalizedPitch * 0.7); // 0.3 to 1.0 range
				pitchJitter = (Math.random() - 0.5) * pitchMultiplier * 0.1;
			}
		} else if (frame.pitch > 400) {
			// Fallback: If no profile, use simple threshold
			pitchJitter = (Math.random() - 0.5) * 0.1;
		}
		
		// Combine all jitter sources
		const totalJitter = noiseMod + attackJitter + pitchJitter;
		
		// Calculate Y based on index
		const normalizedHeight = index / (sampledFrames.length - 1 || 1);

		// Update previous frame for next iteration
		previousFrame = frame;

		return { x: Math.max(MIN_RADIUS, radius + totalJitter), y: normalizedHeight };
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

export function deriveSurfaceParameters(
	frames: AnalysisFrame[],
	profile?: UserProfile
): {
	textureRoughness: number;
	glazeTransmission: number;
} {
	if (frames.length === 0) {
		return { textureRoughness: 0.5, glazeTransmission: 0.3 };
	}

	// Average timbre (spectral centroid) influences roughness
	// Use calibrated range if available, otherwise fallback to raw normalization
	let normalizedTimbre = 0.5; // Default
	if (profile?.timbreRange) {
		const avgTimbre =
			frames.reduce((sum, f) => sum + (f.timbre?.spectralCentroid || 0), 0) / frames.length;
		const tMin = profile.timbreRange.min;
		const tMax = profile.timbreRange.max;
		
		if (tMax > tMin) {
			// Normalize using calibrated range
			normalizedTimbre = Math.max(0, Math.min(1, (avgTimbre - tMin) / (tMax - tMin)));
		}
	} else {
		// Fallback: Raw normalization
		const avgTimbre =
			frames.reduce((sum, f) => sum + (f.timbre?.spectralCentroid || 0), 0) / frames.length;
		normalizedTimbre = Math.min(1, Math.max(0, avgTimbre / 5000));
	}

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

/**
 * Generate glaze colors from audio frames
 * Maps pitch to hue and energy to intensity/alpha
 * @param frames - Audio analysis frames
 * @param activeGlaze - Active glaze color and roughness from uiStore
 * @returns Float32Array of RGB values (3 values per vertex: R, G, B)
 */
export function generateGlaze(
	frames: AnalysisFrame[],
	activeGlaze: { color: string; roughness: number }
): Float32Array {
	if (!frames.length) {
		// Return default color (white) if no frames
		return new Float32Array([1, 1, 1]);
	}

	// Resample frames to match geometry resolution (same as generateLathe)
	const maxPoints = 200;
	const samplingRate = Math.ceil(frames.length / maxPoints);
	const sampledFrames = frames.filter((_, i) => i % samplingRate === 0);

	// Base color from activeGlaze
	const baseColor = new Color(activeGlaze.color);
	const baseR = baseColor.r;
	const baseG = baseColor.g;
	const baseB = baseColor.b;

	// Calculate colors for each frame
	const colors: number[] = [];

	for (const frame of sampledFrames) {
		// Map pitch to hue (100-800 Hz typical range)
		const pitch = frame.pitch || 0;
		const normalizedPitch = Math.max(0, Math.min(1, (pitch - 100) / (800 - 100)));
		
		// Convert pitch to HSL hue (0-360 degrees)
		// Low pitch = Red (0°), High pitch = Blue (240°)
		const hue = normalizedPitch * 240; // 0° (red) to 240° (blue)
		
		// Map energy to intensity/alpha (blending power)
		const energy = frame.energy || 0;
		const intensity = Math.min(1, energy * 2); // Scale energy to 0-1
		
		// Create color from hue
		const pitchColor = new Color().setHSL(hue / 360, 0.8, 0.6); // Saturated, medium lightness
		
		// Blend base glaze color with pitch-based hue
		// Intensity controls how much the pitch color affects the base
		const r = baseR + (pitchColor.r - baseR) * intensity;
		const g = baseG + (pitchColor.g - baseG) * intensity;
		const b = baseB + (pitchColor.b - baseB) * intensity;
		
		colors.push(r, g, b);
	}

	return new Float32Array(colors);
}

export function createSculptureFromFrames(
	frames: AnalysisFrame[],
	profile?: UserProfile,
	name?: string,
	mode: 'additive' | 'subtractive' = 'additive'
): SculptureDefinition {
	const radiusCurve = generateLathe(frames, profile, mode);
	const surface = deriveSurfaceParameters(frames, profile);

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
		orientation: 'vertical', // Default: vertical (pottery wheel)
		sculptMode: mode // Default: 'additive'
	}
	};
}
