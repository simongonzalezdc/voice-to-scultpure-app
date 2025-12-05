import type {
	AnalysisFrame,
	LathePoint,
	SculptureDefinition,
	SculptureLayer,
	UserProfile,
	BaseShape
} from '$lib/types';
import { Color } from 'three';
import { pitchToColor, hexToRgb } from './colorMapping';
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
import { uiStore, type ProfileStyle } from '$lib/stores/uiStore.svelte';

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
	// FIX: Eliminate resampling limit by default to preserve preview details
	// Only downsample if explicitly requested or if exceeding the new high limit (2048)
	const effectiveMaxPoints = maxPoints !== undefined ? maxPoints : GEOMETRY_MAX_POINTS;
	const samplingRate = effectiveMaxPoints > 0 ? Math.ceil(frames.length / effectiveMaxPoints) : 1;
	const sampledFrames = samplingRate > 1 ? frames.filter((_, i) => i % samplingRate === 0) : frames;

	// Constants for radius calculation (using centralized constants)
	const BASE_RADIUS = SCULPTURE_BASE_RADIUS;
	const MAX_RADIUS = SCULPTURE_MAX_RADIUS;
	const SENSITIVITY = SCULPTURE_SENSITIVITY;
	const MIN_RADIUS = SCULPTURE_MIN_RADIUS;

	// Phrase detection state
	let lastFrameTime = sampledFrames[0]?.time ?? 0;
	const PHRASE_GAP_THRESHOLD = 300; // ms

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
			// PERCEPTUAL FIX: Use logarithmic (semitone) scaling
			// One octave up = same radius change, regardless of starting note

			const pitch = frame.pitch || 220; // Default to A3 (middle of range) if no pitch
			
			// Convert Hz to semitones (perceptually linear)
			// A4 (440 Hz) = 0 semitones
			const hzToSemitones = (hz: number) => 12 * Math.log2(hz / 440);
			const minSemitones = hzToSemitones(MIN_PITCH_HZ); // ~-29 for 80Hz
			const maxSemitones = hzToSemitones(MAX_PITCH_HZ); // ~+5 for 600Hz
			const semitones = hzToSemitones(pitch);
			const normalizedPitch = Math.max(0, Math.min(1, (semitones - minSemitones) / (maxSemitones - minSemitones)));

			// Exaggerated Range for drama
			// Low pitch (0) = MAX_RADIUS * 1.3 (Very wide base)
			// High pitch (1) = MIN_RADIUS * 0.5 (Very narrow neck)
			const exaggeratedMax = MAX_RADIUS * 1.3;
			const exaggeratedMin = MIN_RADIUS * 0.5;
			
			// Linear mapping in perceptual space (semitones are already linear in perception)
			const targetRadius = exaggeratedMax - normalizedPitch * (exaggeratedMax - exaggeratedMin);
			
			radius = Math.max(exaggeratedMin, targetRadius);
		} else {
			// Standard Mode (Volume -> Radius)
			// PERCEPTUAL FIX: Use power-law (Stevens' Law)
			// Perceived loudness ∝ amplitude^0.6
			const perceivedEnergy = Math.pow(Math.max(0, energy), 0.6);
			
			if (mode === 'subtractive') {
				// Subtractive: Carve into the block
				// High energy = more carving = smaller radius
				radius = MAX_RADIUS - perceivedEnergy * SENSITIVITY;
				// Ensure radius never goes below minimum
				radius = Math.max(MIN_RADIUS, radius);
			} else {
				// Additive: Build up from base
				// High energy = more material = larger radius
				// B1: Volume -> Ridge Depth (more sensitivity with power-law)
				radius = BASE_RADIUS + perceivedEnergy * (SENSITIVITY * 1.5);
			}
		}

		// Timbre Normalization
		let normalizedRoughness = 0;
		if (profile?.timbreRange && frame.timbre?.spectralCentroid) {
			const tMin = profile.timbreRange.min;
			const tMax = profile.timbreRange.max;
			const rawCentroid = frame.timbre.spectralCentroid;
			if (tMax > tMin) {
				normalizedRoughness = Math.max(0, Math.min(1, (rawCentroid - tMin) / (tMax - tMin)));
			}
		}
		
		// Deterministic hash function using voice features
		const voiceHash = (seed: number) => {
			const x = Math.sin(seed * 12.9898) * 43758.5453;
			return x - Math.floor(x); // Returns 0-1
		};
		
		const timbreSeed = (frame.timbre?.spectralCentroid ?? 1000) * 0.001;
		const pitchSeed = (frame.pitch ?? 220) * 0.01;
		const indexSeed = index * 0.1;
		
		// MUSICAL DETAIL INTENSITY: Amplifies texture features
		const musicalIntensityLocal = uiStore.musicalDetailIntensity ?? 0.5;
		const textureMultiplier = 0.25 + (musicalIntensityLocal * 1.75); // Range: 0.25x to 2x
		
		const timbreTexture = (voiceHash(timbreSeed + indexSeed) - 0.5) * normalizedRoughness * 0.3 * textureMultiplier;

		// Dynamic Attack Detection (B1: Attacks -> Notches)
		let attackJitter = 0;
		const previousFrame = index > 0 ? sampledFrames[index - 1] : null;
		if (previousFrame && profile?.attackThreshold) {
			const threshold = profile.attackThreshold || 0.15;
			const deltaEnergy = Math.abs(frame.energy - previousFrame.energy);
			const isAttack = deltaEnergy > threshold;

			if (isAttack) {
				// Create visible notch/indentation at attack
				// Scaled by musical detail intensity
				attackJitter = -0.05 * (deltaEnergy * 5.0) * textureMultiplier;
			}
		}

		// Pitch-driven modulation
		let pitchModulation = 0;
		if (frame.pitch > 0 && profile?.pitchRange) {
			const pitchMin = profile.pitchRange.min || 80;
			const pitchMax = profile.pitchRange.max || 400;
			const pitchRange = pitchMax - pitchMin;

			if (pitchRange > 0) {
				const normalizedPitch = Math.max(0, Math.min(1, (frame.pitch - pitchMin) / pitchRange));
				const pitchWave = Math.sin(normalizedPitch * Math.PI * 4); 
				pitchModulation = pitchWave * normalizedPitch * 0.15 * textureMultiplier;
			}
		}

		const totalJitter = timbreTexture + attackJitter + pitchModulation;

	// MUSICAL DETAIL INTENSITY: Amplifies how much musical features affect geometry
	// 0 = subtle (0.25x), 0.5 = balanced (1x), 1.0 = dramatic (2x)
	const musicalIntensity = uiStore.musicalDetailIntensity ?? 0.5;
	const intensityMultiplier = 0.25 + (musicalIntensity * 1.75); // Range: 0.25x to 2x

	// SILHOUETTE CORE (DEFAULT): Disable beat/phrase deformation for clean pitch-driven shapes
	// This is now the DEFAULT foundation for all sculptures.
	// Beat ridges and phrase markers create the "spark plug" appearance which we've removed.
	// The result: voice data flows directly as the silhouette without visual noise.
	let beatDeformation = 0;
	// Beat deformation is DISABLED (was: 0.25 * intensityMultiplier)
	
	// Phrase ring structure is DISABLED
	// This was creating horizontal rings that obscured the voice-to-form relationship
	let phraseRing = 0;
	// Phrase ring is DISABLED (was: 0.35 * intensityMultiplier)
	
	lastFrameTime = frame.time;

		// DIRECTIVE 4: Calculate Y based on index, respecting zone if provided
		let normalizedHeight: number;
		if (zone && (zone.min > 0 || zone.max < 1)) {
			const zoneHeight = zone.max - zone.min;
			const indexNormalized = index / (sampledFrames.length - 1 || 1);
			normalizedHeight = zone.min + indexNormalized * zoneHeight;
		} else {
			normalizedHeight = index / (sampledFrames.length - 1 || 1);
		}

		// Combine all deformations
		// B1: Volume -> Ridge Depth is handled by energy sensitivity in radius calc
		const rawRadius = Math.max(MIN_RADIUS, radius + totalJitter + beatDeformation + phraseRing);
		const safeRadius = Number.isNaN(rawRadius) ? 0.5 : Math.max(0.1, rawRadius);

		return {
			x: safeRadius,
			y: normalizedHeight
		};
	});

	// DIRECTIVE 1: Final sanitization pass
	const sanitizedCurve = rawCurve.filter((p) => {
		const safeX = Number.isFinite(p.x) && !Number.isNaN(p.x) && p.x > 0;
		const safeY = Number.isFinite(p.y) && !Number.isNaN(p.y) && p.y >= 0;
		return safeX && safeY;
	});

	if (sanitizedCurve.length === 0) {
		return createDefaultCylinder();
	}

	// DEBUG: Log Y range
	const now = Date.now();
	if (sanitizedCurve.length > 0 && now - lastLatheLogTime > LOG_INTERVAL_MS) {
		lastLatheLogTime = now;
		const minY = Math.min(...sanitizedCurve.map(p => p.y));
		const maxY = Math.max(...sanitizedCurve.map(p => p.y));
		const avgX = sanitizedCurve.reduce((sum, p) => sum + p.x, 0) / sanitizedCurve.length;
		console.log(`📏 [LATHE] RAW Profile: ${sanitizedCurve.length} points, Y=[${minY.toFixed(3)}-${maxY.toFixed(3)}], avgRadius=${avgX.toFixed(3)} (EXAGGERATED MODE)`);
	}

	return sanitizedCurve;
}

// Rate-limit logging in hot paths
let lastModifierLogTime = 0;
let lastLatheLogTime = 0;
const LOG_INTERVAL_MS = 3000;

export function applyModifiers(
	curve: LathePoint[],
	heightScale: number,
	modifiers?: { quantize?: boolean }
): LathePoint[] {
	const safeHeightScale = Math.max(0.0001, heightScale || 1);
	
	// Rate-limited logging
	const now = Date.now();
	const shouldLog = modifiers?.quantize && now - lastModifierLogTime > LOG_INTERVAL_MS;
	
	if (shouldLog && curve.length > 0) {
		lastModifierLogTime = now;
		const beforeAvg = curve.reduce((sum, p) => sum + (p?.x ?? 0.5), 0) / curve.length;
		console.log(`🔢 [QUANTIZE] Applying to ${curve.length} points (beforeAvg=${beforeAvg.toFixed(3)})`);
	}
	
	const result = curve.map((point) => {
		if (!point) {
			return { x: 0.5, y: 0 }; // Fallback point
		}
		let radius = point.x ?? 0.5;
		if (modifiers?.quantize) {
			// Quantize to create faceted/stepped surfaces
			// Radius is in normalized units (typically 0-1.5 range)
			// Use a step size relative to the typical radius range, not millimeters
			const step = 0.15; // 15% increments (creates ~7 distinct radius levels - more visible)
			radius = Math.round(radius / step) * step;
		}

		// FIX: Actually apply heightScale to Y coordinate!
		// Without this, sculptures are always Y=0-1 regardless of heightScale
		const scaledY = (point.y ?? 0) * safeHeightScale;

		return {
			...point,
			x: radius,
			y: scaledY
		};
	});
	
	// DEBUG: Log after quantize (rate-limited)
	if (shouldLog && result.length > 0) {
		const afterAvg = result.reduce((sum, p) => sum + (p?.x ?? 0.5), 0) / result.length;
		console.log(`🔢 [QUANTIZE] After: avgRadius=${afterAvg.toFixed(3)}`);
	}
	
	return result;
}

// ============================================================================
// PROFILE STYLE TRANSFORMATIONS
// Applies aesthetic transformations to the profile shape
// ============================================================================

/**
 * Apply profile style transformation to a curve
 * @param curve - Input LathePoint array
 * @param style - Profile style to apply
 * @returns Transformed curve
 */
export function applyProfileStyle(
	curve: LathePoint[],
	style?: ProfileStyle
): LathePoint[] {
	const effectiveStyle = style ?? uiStore.profileStyle ?? 'natural';
	
	// Guard: No transformation needed for empty, single-point, or natural curves
	// Single-point would cause division by zero: index / (curve.length - 1)
	if (effectiveStyle === 'natural' || curve.length <= 1) {
		return curve;
	}
	
	switch (effectiveStyle) {
		case 'terraced':
			return applyTerracedStyle(curve);
		case 'spiral':
			return applySpiralStyle(curve);
		case 'rippled':
			return applyRippledStyle(curve);
		default:
			return curve;
	}
}

/**
 * TERRACED: Quantize radius to create stepped shelves like a ziggurat
 * Each "terrace" represents a note/pitch band
 */
function applyTerracedStyle(curve: LathePoint[]): LathePoint[] {
	if (curve.length <= 1) return curve; // Guard: nothing to terrace
	
	// Determine number of terraces based on curve length
	const numTerraces = Math.min(12, Math.max(4, Math.floor(curve.length / 20)));
	
	// Find radius range
	const radii = curve.map(p => p.x);
	const minRadius = Math.min(...radii);
	const maxRadius = Math.max(...radii);
	const radiusRange = maxRadius - minRadius;
	
	if (radiusRange < 0.01) return curve; // No variation to terrace
	
	const terraceHeight = radiusRange / numTerraces;
	
	return curve.map(point => {
		// Quantize radius to nearest terrace level
		const normalizedRadius = (point.x - minRadius) / radiusRange;
		const terraceLevel = Math.round(normalizedRadius * numTerraces);
		const terracedRadius = minRadius + (terraceLevel / numTerraces) * radiusRange;
		
		return {
			x: terracedRadius,
			y: point.y
		};
	});
}

/**
 * SPIRAL: Apply helical twist that increases with height
 * Creates a nautilus/shell-like aesthetic
 */
function applySpiralStyle(curve: LathePoint[]): LathePoint[] {
	if (curve.length <= 1) return curve; // Guard: prevent division by zero
	
	// Find center radius for reference
	const avgRadius = curve.reduce((sum, p) => sum + p.x, 0) / curve.length;
	const lengthMinusOne = curve.length - 1; // Cache to avoid repeated calculation
	
	return curve.map((point, index) => {
		const normalizedHeight = index / lengthMinusOne;
		
		// Spiral wave: oscillates more at top than bottom
		// This creates a subtle spiral bulge pattern
		const spiralFrequency = 3; // Number of spiral turns
		const spiralAmplitude = 0.15 * normalizedHeight; // Stronger at top
		const spiralPhase = normalizedHeight * spiralFrequency * Math.PI * 2;
		const spiralOffset = Math.sin(spiralPhase) * spiralAmplitude * avgRadius;
		
		return {
			x: Math.max(0.05, point.x + spiralOffset),
			y: point.y
		};
	});
}

/**
 * RIPPLED: Add sinusoidal waves to the surface
 * Creates organic, water-like ripple patterns
 */
function applyRippledStyle(curve: LathePoint[]): LathePoint[] {
	if (curve.length <= 1) return curve; // Guard: prevent division by zero
	
	const avgRadius = curve.reduce((sum, p) => sum + p.x, 0) / curve.length;
	const lengthMinusOne = curve.length - 1; // Cache to avoid repeated calculation
	
	// Musical detail intensity affects ripple prominence
	const intensity = uiStore.musicalDetailIntensity ?? 0.5;
	const rippleAmplitude = 0.08 * (0.5 + intensity); // 0.04 to 0.12 range
	
	return curve.map((point, index) => {
		const normalizedHeight = index / lengthMinusOne;
		
		// Multiple overlapping ripple frequencies for organic feel
		const ripple1 = Math.sin(normalizedHeight * Math.PI * 16) * rippleAmplitude;
		const ripple2 = Math.sin(normalizedHeight * Math.PI * 7) * (rippleAmplitude * 0.5);
		const ripple3 = Math.sin(normalizedHeight * Math.PI * 23) * (rippleAmplitude * 0.25);
		
		const totalRipple = (ripple1 + ripple2 + ripple3) * avgRadius;
		
		return {
			x: Math.max(0.05, point.x + totalRipple),
			y: point.y
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
		if (!point) {
			return { x: 0.5, y: i / curve.length }; // Fallback point
		}

		const normalizedHeight = i / curve.length;
		const angle = deformation.twist * normalizedHeight * Math.PI * 2;

		// Compression formula: Linear scaling based on normalized height
		// Negative compression stretches (factor > 1), positive compresses (factor < 1)
		const compressionFactor = 1 - deformation.compression * normalizedHeight;
		const compressedY = (point.y ?? 0) * compressionFactor;

		const taperedX = (point.x ?? 0.5) * (1 - deformation.taper * normalizedHeight);

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
		const normalizedRoughness = Math.min(1, Math.max(0, avgTimbre / 5000));
		normalizedTimbre = normalizedRoughness;
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
	activeGlaze: {
		color: string;
		roughness: number;
		transmission?: number;
		materialType?: string;
		baseColor?: string;
	}
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
		// PERCEPTUAL FIX: Use OKLCH color space for perceptually uniform pitch-to-color mapping
		// OKLCH is better because colors appear equally spaced across the spectrum
		// Convert pitch to normalized value (0-1) using semitones
		const pitch = frame.pitch || 0;
		
		let normalizedPitch = 0;
		if (pitch > 0) {
			// Use logarithmic pitch mapping for perceptual linearity
			const hzToSemitones = (hz: number) => 12 * Math.log2(hz / 440);
			const minSemitones = hzToSemitones(MIN_PITCH_HZ);
			const maxSemitones = hzToSemitones(MAX_PITCH_HZ);
			const semitones = hzToSemitones(pitch);
			normalizedPitch = Math.max(0, Math.min(1, (semitones - minSemitones) / (maxSemitones - minSemitones)));
		}

		// Get OKLCH-based color (Red for low → Blue for high)
		const hexColor = pitchToColor(normalizedPitch);
		const [r, g, b] = hexToRgb(hexColor);

		colors.push(r, g, b);
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
	baseShape: BaseShape = 'lathe', // GENERATIVE PERFORMANCE: Shape type
	resolution: number = 128, // Option B: Song Mode uses higher resolution
	controlMode: 'standard' | 'melodic' = 'melodic' // FIX: Default to melodic (pitch->radius)
): SculptureDefinition {
	// A2: Eliminate All Resampling
	// If resolution is set to 0 (or implied high), use 0 to tell generateLathe "no limit"
	// However, we also want to store the FULL resolution data.
	// Since we updated constants, 'resolution' passed here might be 2048.
	
	// Calculate effective resolution for storage
	// If frames length is small (short recording), use frames length.
	// If frames length is large, clamp to max resolution.
	const effectiveResolution = Math.min(frames.length, Math.max(resolution, GEOMETRY_MAX_POINTS));

	const radiusCurve = generateLathe(
		frames,
		profile,
		mode,
		zone,
		constraintMode,
		controlMode, 
		baseShape,
		effectiveResolution // Pass through the desired resolution limit (or 2048)
	);

	// Resample geometry to compositor resolution
	// Compositor expects layer.data to be 1D array of radius values
	// NOTE: If radiusCurve.length === effectiveResolution, this loop is effectively a copy, which is good.
	// We prefer NOT to interpolate if we can help it.
	
	const layerData = new Float32Array(effectiveResolution);

	// Resample: map radiusCurve points to resolution points
	for (let i = 0; i < effectiveResolution; i++) {
		const normalizedY = i / (effectiveResolution - 1); // 0 to 1
		// Find corresponding point in radiusCurve
		const targetIndex = Math.round(normalizedY * (radiusCurve.length - 1));
		const clampedIndex = Math.min(targetIndex, radiusCurve.length - 1);
		// Store only radius (x value) - height (y) is implicit from index
		const point = radiusCurve[clampedIndex];
		layerData[i] = point?.x ?? 0.5; // Default radius if point is undefined
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
		data: layerData, // 1D array of radius values
		mask: new Float32Array(effectiveResolution).fill(1.0), // Mask matches resolution
		sourceFrames: frames, // Store raw frames for lossless quality
		sourceFrameCount: frames.length
	};

	return {
		id: crypto.randomUUID(),
		name: name || `Sculpture ${new Date().toLocaleString()}`,
		createdAt: Date.now(),
		layers: [baseLayer], // Required: Initialize with base layer
		baseShape, // Use provided shape
		radiusCurve,
		physical: {
			height: DEFAULT_HEIGHT_MM, // Default height from constants
			units: 'mm',
			wallThickness: undefined, // Optional, for 3D printing
			orientation: 'vertical', // Default: vertical (pottery wheel)
			sculptMode: mode // Default: 'additive'
		}
	};
}
