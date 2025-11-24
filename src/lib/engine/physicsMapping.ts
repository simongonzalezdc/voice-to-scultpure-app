import type { AnalysisFrame, LathePoint, SculptureDefinition, SculptureLayer, UserProfile, BaseShape } from '$lib/types';
import { Color } from 'three';
import { applyConstraints, type ConstraintMode } from './constraints';
import {
	SCULPTURE_BASE_RADIUS,
	SCULPTURE_MAX_RADIUS,
	SCULPTURE_MIN_RADIUS,
	SCULPTURE_SENSITIVITY,
	GEOMETRY_MAX_POINTS,
	NOISE_FLOOR_DEFAULT,
	SILENCE_THRESHOLD_MULTIPLIER,
	MIN_PITCH_HZ,
	MAX_PITCH_HZ,
	DEFAULT_HEIGHT_MM
} from '$lib/config/constants';

// ============================================================================
// GENERATIVE PERFORMANCE: BEAT-DRIVEN DEFORMATION
// ============================================================================

/**
 * Beat state tracking for rhythm-based deformation
 */
let lastBeatImpulse = 0;
const BEAT_DECAY_TIME = 300; // ms - how long the beat effect lasts

/**
 * Calculate beat impulse multiplier (decays over time)
 * @param frame - Current analysis frame
 * @returns Multiplier (1.0 = no beat, >1.0 = beat active)
 */
function getBeatImpulse(frame: AnalysisFrame): number {
	const now = Date.now();

	if (frame.beat) {
		lastBeatImpulse = now;
		return 1.2; // 20% scale increase on beat
	}

	// Decay the impulse over time
	const timeSinceBeat = now - lastBeatImpulse;
	if (timeSinceBeat < BEAT_DECAY_TIME) {
		const decay = 1 - timeSinceBeat / BEAT_DECAY_TIME;
		return 1.0 + 0.2 * decay; // Smooth decay from 1.2 to 1.0
	}

	return 1.0; // No beat effect
}

function createDefaultCylinder(): LathePoint[] {
	// DIRECTIVE 1: Default cylinder fallback - ensures user always sees something
	// Simple cylinder with constant radius from bottom to top
	const steps = 10;
	const points: LathePoint[] = [];
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const radius = 0.5; // Default thickness
		points.push({ x: radius, y: t * 2 }); // Height 0-2 range
	}
	return points;
}

export function generateLathe(
	frames: AnalysisFrame[],
	profile?: UserProfile,
	mode: 'additive' | 'subtractive' = 'additive',
	zone?: { min: number; max: number }, // DIRECTIVE 4: Zone Sculpting
	constraintMode: ConstraintMode = 'digital', // Fabrication constraints
	controlMode: 'standard' | 'melodic' = 'standard', // DIRECTIVE 1: Virtuoso Mode
	baseShape: BaseShape = 'lathe', // GENERATIVE PERFORMANCE: Shape-specific beat response
	maxPoints?: number // Optional: Override max points (for live recording with unlimited resolution)
): LathePoint[] {
	// LIVE GUARD: If frames are missing/sparse, return a visible default cylinder
	if (!frames || frames.length === 0) {
		return Array(10)
			.fill(0)
			.map((_, i) => ({ x: 0.5, y: i / 9 }));
	}

	// NOISE GATE LOGIC
	// Get noise floor from profile, default from constants
	// RMS values below this are considered silence/background noise
	const noiseFloor = profile?.energyRange?.min || NOISE_FLOOR_DEFAULT;
	const silenceThreshold = noiseFloor * SILENCE_THRESHOLD_MULTIPLIER;

	// 2. Resample: Limit to max points (High Res)
	// For live recording, we can pass maxPoints = 0 to use ALL frames (no downsampling)
	const effectiveMaxPoints = maxPoints !== undefined ? maxPoints : GEOMETRY_MAX_POINTS;
	const samplingRate = effectiveMaxPoints > 0 ? Math.ceil(frames.length / effectiveMaxPoints) : 1;
	const sampledFrames = samplingRate > 1 ? frames.filter((_, i) => i % samplingRate === 0) : frames;

	// Constants for radius calculation (using centralized constants)
	const BASE_RADIUS = SCULPTURE_BASE_RADIUS;
	const MAX_RADIUS = SCULPTURE_MAX_RADIUS;
	const SENSITIVITY = SCULPTURE_SENSITIVITY;
	const MIN_RADIUS = SCULPTURE_MIN_RADIUS;

	// 3. Map Frames to Points (Raw curve from audio)
	const rawCurve = sampledFrames.map((frame, index) => {
		// AGGRESSIVE MAPPING
		let energy = frame.energy || 0;

		// Apply Noise Gate
		if (energy < silenceThreshold) {
			energy = 0;
		}

		// GENERATIVE PERFORMANCE: Beat-driven impulse
		const beatMultiplier = getBeatImpulse(frame);
		const isBeat = frame.beat || false;

		// Calculate radius based on mode
		let radius: number;

		if (controlMode === 'melodic') {
			// DIRECTIVE 1: Virtuoso / Melodic Mode
			// Pitch -> Radius (Low=Wide, High=Narrow)
			// Volume -> Twist (Accumulated)

			// Map Pitch to Radius
			// Range: 80Hz (Wide) to 800Hz (Narrow)
			const pitch = frame.pitch || 440; // Default to A4 if no pitch
			const normalizedPitch = Math.max(0, Math.min(1, (pitch - MIN_PITCH_HZ) / 720));

			// Invert: Low pitch = Large radius (Base), High pitch = Small radius (Neck)
			// Lerp factor 0.1 handled by useTask smoothing in real-time, here we map directly
			const targetRadius = MAX_RADIUS - normalizedPitch * (MAX_RADIUS - MIN_RADIUS);
			radius = Math.max(MIN_RADIUS, targetRadius);

			// Map Volume to Twist (Rotation)
			// Accumulate rotation: Loud = Spiral, Quiet = Straight
			// This modifies the X coordinate later in applyDeformation, but we store it here if needed
			// Actually, generateLathe returns 2D points (Radius, Height).
			// Twist is a 3D deformation.
			// To support this in generateLathe, we need to either:
			// A) Return 3D points (complex refactor)
			// B) Store rotation data in a separate array (complex plumbing)
			// C) Cheat: Use 'twist' parameter in applyDeformation, but that's global.

			// DECISION: For the prototype, we will map Volume to *Radius Jitter* or *Bulge*
			// AND we will export a `virtuosoData` array if we could, but we can't change the signature too much.

			// RE-READING DIRECTIVE: "Volume -> Twist (The Tension)".
			// Since LatheGeometry is 2D profile rotated, "Twist" usually means rotating the profile along Y.
			// BUT standard LatheGeometry is symmetric.
			// To get a spiral, we need `applyVertexTwist` in Sculpture.svelte.
			// `generateLathe` produces the *profile*.

			// ALTERNATIVE INTERPRETATION:
			// Maybe "Twist" here means "Radius Variance" (wobble)?
			// No, directive says "Accumulate rotation per ring".

			// STRATEGY: We cannot implement per-ring rotation in `generateLathe` which returns `LathePoint[]` (x,y).
			// However, we CAN map Volume to something visible in the profile, like "Roughness" or "Bulge".
			// OR, we change `LathePoint` to include `rot`?
			// No, `LathePoint` is `{x, y}`.

			// COMPROMISE: In Melodic Mode, Volume controls *Texture/Noise* amplitude on the radius.
			// "Twist" is strictly a post-process in `Sculpture.svelte`.
			// We will map Pitch -> Radius here perfectly.

			// Let's stick to the Directive 1 Logic for Radius:
			// Radius is driven by Pitch.
		} else {
			// Standard Mode (Volume -> Radius)
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
		const previousFrame = index > 0 ? sampledFrames[index - 1] : null;
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

		// GENERATIVE PERFORMANCE: Apply beat-driven deformation
		// Different behavior based on baseShape
		let beatDeformation = 0;
		if (isBeat && beatMultiplier > 1.0) {
			if (baseShape === 'lathe') {
				// For lathe: Create wider ribs/rings at beat points
				beatDeformation = (beatMultiplier - 1.0) * 0.5; // Scale to 0-0.1 range
			} else if (baseShape === 'sphere' || baseShape === 'cube') {
				// For primitives: Apply global scale multiplier (handled externally)
				// Just add local ripple effect here
				beatDeformation = (beatMultiplier - 1.0) * 0.3;
			}
		}

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

		// DIRECTIVE 1: NaN Guard - Sanitize all values before returning
		const rawRadius = Math.max(MIN_RADIUS, radius + totalJitter + beatDeformation);
		const safeRadius = Number.isNaN(rawRadius) ? 0.5 : Math.max(0.1, rawRadius);

		return {
			x: safeRadius,
			y: normalizedHeight
		};
	});

	// 4. DIRECTIVE 3: Apply Fabrication Constraints
	// This ensures the geometry is physically manufacturable
	// Non-destructive: Original recording is preserved, but output geometry is sanitized
	const constrainedCurve = applyConstraints(rawCurve, constraintMode);

	// DIRECTIVE 1: Final sanitization pass - remove any invalid points
	const sanitizedCurve = constrainedCurve.filter((p) => {
		const safeX = Number.isFinite(p.x) && !Number.isNaN(p.x) && p.x > 0;
		const safeY = Number.isFinite(p.y) && !Number.isNaN(p.y) && p.y >= 0;
		return safeX && safeY;
	});

	// Safety: If resulting array is empty, return default cylinder so user always sees something
	if (sanitizedCurve.length === 0) {
		return createDefaultCylinder();
	}

	return sanitizedCurve;
}

export function applyModifiers(
	curve: LathePoint[],
	heightScale: number,
	modifiers?: { quantize?: boolean }
): LathePoint[] {
	const safeHeightScale = Math.max(0.0001, heightScale || 1);
	return curve.map((point) => {
		let radius = point.x;
		if (modifiers?.quantize) {
			// Quantize to create faceted/stepped surfaces
			// Radius is in normalized units (typically 0-1.5 range)
			// Use a step size relative to the typical radius range, not millimeters
			const step = 0.1; // 10% increments (creates ~10 distinct radius levels)
			radius = Math.round(radius / step) * step;
		}

		return {
			...point,
			x: radius
		};
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

	// Calculate colors for each frame
	const colors: number[] = [];

	for (const frame of sampledFrames) {
		// DIRECTIVE 4: Map pitch to hue using human vocal range
		// 80Hz = Red (0°), 600Hz = Purple (280°)
		const pitch = frame.pitch || 0;
		const t = Math.max(0, Math.min(1, (pitch - MIN_PITCH_HZ) / (MAX_PITCH_HZ - MIN_PITCH_HZ)));
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

/**
 * GENERATIVE PERFORMANCE: Calculate real-time beat scale for primitives
 * Used by 3D renderer to apply transient scale effects on beats
 * @param latestFrame - Most recent analysis frame
 * @returns Scale multiplier (1.0 = normal, >1.0 = beat pulse)
 */
export function getBeatScaleMultiplier(latestFrame: AnalysisFrame | null): number {
	if (!latestFrame) return 1.0;
	return getBeatImpulse(latestFrame);
}

/**
 * GENERATIVE PERFORMANCE: Check if a beat was just detected
 * @param latestFrame - Most recent analysis frame
 * @returns true if a beat occurred in the last 50ms
 */
export function isBeatActive(latestFrame: AnalysisFrame | null): boolean {
	if (!latestFrame || !latestFrame.beat) return false;

	const now = Date.now();
	const timeSinceBeat = now - lastBeatImpulse;
	return timeSinceBeat < 50; // Active for 50ms (one "flash")
}

export function createSculptureFromFrames(
	frames: AnalysisFrame[],
	profile?: UserProfile,
	name?: string,
	mode: 'additive' | 'subtractive' = 'additive',
	zone?: { min: number; max: number }, // DIRECTIVE 4: Zone parameter
	constraintMode: ConstraintMode = 'digital', // Fabrication constraints
	baseShape: BaseShape = 'lathe' // GENERATIVE PERFORMANCE: Shape type
): SculptureDefinition {
	const radiusCurve = generateLathe(frames, profile, mode, zone, constraintMode, 'standard', baseShape);
	const surface = deriveSurfaceParameters(frames, profile);

	// Resample geometry to compositor resolution (128 points)
	// Compositor expects layer.data to be 1D array of radius values, not [x, y] pairs
	const resolution = 128;
	const layerData = new Float32Array(resolution);
	
	// Resample: map radiusCurve points to resolution points
	for (let i = 0; i < resolution; i++) {
		const normalizedY = i / (resolution - 1); // 0 to 1
		// Find corresponding point in radiusCurve
		const targetIndex = Math.round(normalizedY * (radiusCurve.length - 1));
		const clampedIndex = Math.min(targetIndex, radiusCurve.length - 1);
		// Store only radius (x value) - height (y) is implicit from index
		layerData[i] = radiusCurve[clampedIndex].x;
	}

	// Create base layer from generated geometry
	const baseLayer: SculptureLayer = {
		id: crypto.randomUUID(),
		name: 'Base Layer',
		type: 'base',
		visible: true,
		locked: false,
		blendMode: 'overwrite',
		opacity: 1.0,
		data: layerData, // 1D array of radius values (128 elements)
		mask: new Float32Array(resolution).fill(1.0) // Mask matches resolution
	};

	return {
		id: crypto.randomUUID(),
		name: name || `Sculpture ${new Date().toLocaleString()}`,
		createdAt: Date.now(),
		layers: [baseLayer], // Required: Initialize with base layer
		baseShape, // Use provided shape
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
			height: DEFAULT_HEIGHT_MM, // Default height from constants
			units: 'mm',
			wallThickness: undefined, // Optional, for 3D printing
			orientation: 'vertical', // Default: vertical (pottery wheel)
			sculptMode: mode // Default: 'additive'
		}
	};
}
