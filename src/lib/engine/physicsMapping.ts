import type { AnalysisFrame, LathePoint, SculptureDefinition, UserProfile } from '$lib/types';
import { Color } from 'three';
import { applyConstraints, type ConstraintMode } from './constraints';

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
	mode: 'additive' | 'subtractive' = 'additive',
	zone?: { min: number; max: number }, // DIRECTIVE 4: Zone Sculpting
	constraintMode: ConstraintMode = 'digital' // Fabrication constraints
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
	// DIRECTIVE 3: AMPLIFIED for visibility
	const BASE_RADIUS = 0.2;
	const MAX_RADIUS = 1.5; // Standard block size for subtractive mode
	const SENSITIVITY = 3.5; // AMPLIFIED: was 2.0, now 3.5 (75% increase)
	const MIN_RADIUS = 0.05; // AMPLIFIED: Allow deeper cuts (was 0.1)

	// Track previous frame for attack detection
	let previousFrame: AnalysisFrame | null = null;

	// 3. Map Frames to Points (Raw curve from audio)
	const rawCurve = sampledFrames.map((frame, index) => {
		// AGGRESSIVE MAPPING
		let energy = frame.energy || 0;

		// Apply Noise Gate
		if (energy < silenceThreshold) {
			energy = 0;
		}

		// Calculate radius based on mode
		let radius: number;
		if (mode === 'subtractive') {
			// Subtractive: Carve into the block
			// High energy = more carving = smaller radius
			radius = MAX_RADIUS - energy * SENSITIVITY;
			// Ensure radius never goes below minimum
			radius = Math.max(MIN_RADIUS, radius);
		} else {
			// Additive: Build up from base
			// High energy = more material = larger radius
			radius = BASE_RADIUS + energy * SENSITIVITY;
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
		// DIRECTIVE 3: AMPLIFIED timbre noise (was 0.15, now 0.3)
		const noiseMod = (Math.random() - 0.5) * normalizedRoughness * 0.3;

		// Dynamic Attack Detection: Detect sharp energy spikes (chisel effect)
		let attackJitter = 0;
		if (previousFrame && profile?.attackThreshold) {
			const threshold = profile.attackThreshold || 0.15; // Fallback if missing
			const deltaEnergy = Math.abs(frame.energy - previousFrame.energy);
			const isAttack = deltaEnergy > threshold;

			if (isAttack) {
				// Sharp attack creates jagged edges (chisel effect)
				// DIRECTIVE 3: AMPLIFIED attack cut (was 0.2, now 0.5 for 50% deeper indentation)
				attackJitter = (Math.random() - 0.5) * 0.5;
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
				const pitchMultiplier = 0.3 + normalizedPitch * 0.7; // 0.3 to 1.0 range
				// DIRECTIVE 3: AMPLIFIED pitch ripple (was 0.1, now 0.25)
				pitchJitter = (Math.random() - 0.5) * pitchMultiplier * 0.25;
			}
		} else if (frame.pitch > 400) {
			// Fallback: If no profile, use simple threshold
			// DIRECTIVE 3: AMPLIFIED (was 0.1, now 0.25)
			pitchJitter = (Math.random() - 0.5) * 0.25;
		}

		// Combine all jitter sources
		const totalJitter = noiseMod + attackJitter + pitchJitter;

		// DIRECTIVE 4: Calculate Y based on index, respecting zone if provided
		// If zone is specified, map frames to that height range instead of full 0-1
		let normalizedHeight: number;
		if (zone && (zone.min > 0 || zone.max < 1)) {
			// Map index to zone range: min to max instead of 0 to 1
			const zoneHeight = zone.max - zone.min;
			const indexNormalized = index / (sampledFrames.length - 1 || 1);
			normalizedHeight = zone.min + indexNormalized * zoneHeight;
		} else {
			// Full height (default behavior)
			normalizedHeight = index / (sampledFrames.length - 1 || 1);
		}

		// Update previous frame for next iteration
		previousFrame = frame;

		return { x: Math.max(MIN_RADIUS, radius + totalJitter), y: normalizedHeight };
	});

	// 4. DIRECTIVE 3: Apply Fabrication Constraints
	// This ensures the geometry is physically manufacturable
	// Non-destructive: Original recording is preserved, but output geometry is sanitized
	const constrainedCurve = applyConstraints(rawCurve, constraintMode);

	return constrainedCurve;
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
 * DIRECTIVE 4: Generate glaze colors from audio frames
 * Uses SAME mapping as GlazeMixer for consistency
 * Maps pitch to hue (80-600Hz → 0-280°) and energy to saturation/lightness
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

	// DIRECTIVE 4: Human vocal range constants (match GlazeMixer)
	const MIN_HZ = 80; // Low male voice
	const MAX_HZ = 600; // High soprano

	// Calculate colors for each frame
	const colors: number[] = [];

	for (const frame of sampledFrames) {
		// DIRECTIVE 4: Map pitch to hue using human vocal range
		// 80Hz = Red (0°), 600Hz = Purple (280°)
		const pitch = frame.pitch || 0;
		const t = Math.max(0, Math.min(1, (pitch - MIN_HZ) / (MAX_HZ - MIN_HZ)));
		const hue = t * 280; // 0° (red) to 280° (purple)

		// DIRECTIVE 4: Map energy to saturation & lightness (NOT opacity)
		const energy = frame.energy || 0;
		const saturation = 0.5 + energy * 0.5; // 50% to 100% (0.5 to 1.0)
		const lightness = 0.3 + energy * 0.4; // 30% to 70% (0.3 to 0.7)

		// Create color from HSL
		// If no pitch detected, use base glaze color
		let finalColor: Color;
		if (pitch > 0) {
			// Voice-driven color
			finalColor = new Color().setHSL(hue / 360, saturation, lightness);
		} else {
			// No pitch: use base glaze color with energy-driven brightness
			const baseColor = new Color(activeGlaze.color);
			const hsl = { h: 0, s: 0, l: 0 };
			baseColor.getHSL(hsl);
			// Keep base hue/saturation, but modulate lightness with energy
			finalColor = new Color().setHSL(hsl.h, hsl.s, 0.3 + energy * 0.4);
		}

		colors.push(finalColor.r, finalColor.g, finalColor.b);
	}

	return new Float32Array(colors);
}

export function createSculptureFromFrames(
	frames: AnalysisFrame[],
	profile?: UserProfile,
	name?: string,
	mode: 'additive' | 'subtractive' = 'additive',
	zone?: { min: number; max: number }, // DIRECTIVE 4: Zone parameter
	constraintMode: ConstraintMode = 'digital' // Fabrication constraints
): SculptureDefinition {
	const radiusCurve = generateLathe(frames, profile, mode, zone, constraintMode);
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
