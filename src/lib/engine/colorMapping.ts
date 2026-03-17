/**
 * Color Mapping Engine
 * Maps audio features (particularly pitch) to perceptually uniform colors
 * Uses OKLCH color space for best perceptual uniformity
 *
 * ENHANCED: Now supports automatic color generation from audio frames
 * - Pitch → Hue (low=warm, high=cool)
 * - Volume → Saturation (quiet=muted, loud=vibrant)
 * - Brightness → Roughness (bright=glossy, dark=matte)
 */

import type { AnalysisFrame } from '$lib/types';
import { MIN_PITCH_HZ, MAX_PITCH_HZ } from '$lib/config/constants';

/**
 * Simple OKLCH to RGB conversion
 * OKLCH is perceptually uniform, making it ideal for pitch-to-color mapping
 *
 * @param L - Lightness (0-1)
 * @param C - Chroma (0-0.4)
 * @param H - Hue (0-360°)
 * @returns Hex color string
 */
export function oklchToHex(L: number, C: number, H: number): string {
	// Convert OKLCH to LMS
	const h_rad = (H * Math.PI) / 180;
	const l = L + C * Math.cos(h_rad);
	const m = L - C * 0.3 * Math.sin(h_rad);
	const s = L - C * 0.15 * Math.cos(h_rad) - C * 0.283 * Math.sin(h_rad);

	// Convert LMS to linear RGB (using simplified inverse matrix)
	const r = 4.0767416621 * l - 3.3077363322 * m + 0.2309101289 * s;
	const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193761 * s;
	const b = -0.004107344528 * l - 0.7034186147 * m + 1.7076147010 * s;

	// Apply gamma correction (sRGB)
	const toSrgb = (c: number) => {
		if (c <= 0.0031308) {
			return c * 12.92;
		}
		return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
	};

	const red = Math.round(Math.max(0, Math.min(1, toSrgb(r))) * 255);
	const green = Math.round(Math.max(0, Math.min(1, toSrgb(g))) * 255);
	const blue = Math.round(Math.max(0, Math.min(1, toSrgb(b))) * 255);

	return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
}

/**
 * Map normalized pitch (0-1) to a perceptually uniform color
 * Low pitch (0) = Warm colors (Red/Orange)
 * Mid pitch (0.5) = Neutral colors (Yellow/Green)
 * High pitch (1) = Cool colors (Blue/Purple)
 *
 * @param normalizedPitch - Normalized pitch value (0-1)
 * @param saturation - Optional saturation modifier (0-1, default 0.5)
 * @returns Hex color string
 */
export function pitchToColor(normalizedPitch: number, saturation: number = 0.5): string {
	// Clamp to 0-1 range
	const clamped = Math.max(0, Math.min(1, normalizedPitch));

	// OKLCH parameters
	// Lightness varies slightly with saturation for better contrast
	const L = 0.65 + (1 - saturation) * 0.15; // 0.65-0.80
	// Chroma (saturation) - map input to chroma range
	const C = 0.08 + saturation * 0.12; // 0.08-0.20

	// Hue mapping: Red (30°) → Blue (270°)
	// This gives us a warm → cool transition that's musically intuitive
	const H = 30 + clamped * 240; // Red=30°, Blue=270°

	return oklchToHex(L, C, H);
}

/**
 * Get RGB components from a hex color for use in Three.js materials
 *
 * @param hex - Hex color string (e.g., "#FF0000")
 * @returns Array of RGB values (0-1 each)
 */
export function hexToRgb(hex: string): [number, number, number] {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!result || !result[1] || !result[2] || !result[3]) {
		return [1, 1, 1]; // Default to white
	}
	return [
		parseInt(result[1], 16) / 255,
		parseInt(result[2], 16) / 255,
		parseInt(result[3], 16) / 255
	];
}

/**
 * AUTOMATIC COLOR GENERATION
 * Generate vertex colors from audio frames
 *
 * This replaces the separate "glaze mode" - color is now integral to recording.
 *
 * Mapping:
 * - Pitch → Hue (low=warm/red, high=cool/blue)
 * - Volume → Saturation (quiet=muted/pastel, loud=vibrant)
 * - Spectral brightness → Lightness (dark=matte, bright=glossy feel)
 *
 * @param frames - Audio analysis frames
 * @param vertexCount - Number of vertices to generate colors for
 * @returns Float32Array of RGB values (3 values per vertex)
 */
export function generateAutoColors(
	frames: AnalysisFrame[],
	vertexCount: number
): Float32Array {
	if (!frames.length) {
		// Return white if no frames
		console.warn('🎨 [COLORS] No frames - returning white');
		return new Float32Array(vertexCount * 3).fill(1);
	}

	console.log(`🎨 [COLORS] Generating ${vertexCount} colors from ${frames.length} frames`);
	const colors = new Float32Array(vertexCount * 3);

	// For each vertex, map to corresponding frame and generate color
	for (let i = 0; i < vertexCount; i++) {
		// Map vertex index to frame index
		const t = vertexCount > 1 ? i / (vertexCount - 1) : 0;
		// Guard against single-frame array (frames.length - 1 would be 0)
		const frameIdx = frames.length > 1 ? Math.floor(t * (frames.length - 1)) : 0;
		const frame = frames[frameIdx] ?? frames[0];

		if (!frame) {
			colors[i * 3] = 1;
			colors[i * 3 + 1] = 1;
			colors[i * 3 + 2] = 1;
			continue;
		}

		// Extract audio features
		const pitch = frame.pitch || 0;
		const energy = frame.energy || 0;
		const spectralCentroid = frame.timbre?.spectralCentroid || 2500;

		// Normalize pitch to 0-1 using semitone mapping
		let normalizedPitch = 0.5;
		if (pitch > 0) {
			const hzToSemitones = (hz: number) => 12 * Math.log2(hz / 440);
			const minSemitones = hzToSemitones(MIN_PITCH_HZ);
			const maxSemitones = hzToSemitones(MAX_PITCH_HZ);
			const semitones = hzToSemitones(pitch);
			normalizedPitch = Math.max(0, Math.min(1, (semitones - minSemitones) / (maxSemitones - minSemitones)));
		}

		// Energy maps to saturation (quiet=muted, loud=vibrant)
		// Use power-law for perceptual mapping
		// Guard against NaN/Infinity from bad audio data
		const safeEnergy = Number.isFinite(energy) ? Math.max(0, energy) : 0;
		const saturation = Math.pow(Math.min(1, safeEnergy * 2), 0.6);

		// Spectral centroid affects lightness subtly (brighter sound = slightly lighter color)
		// Range: 1000-5000 Hz → 0-1
		const brightness = Math.max(0, Math.min(1, (spectralCentroid - 1000) / 4000));

		// Generate color using OKLCH
		const hexColor = pitchToColor(normalizedPitch, saturation);
		const [r, g, b] = hexToRgb(hexColor);

		// Apply brightness modulation (subtle)
		const brightnessMod = 0.9 + brightness * 0.1;

		colors[i * 3] = Math.min(1, r * brightnessMod);
		colors[i * 3 + 1] = Math.min(1, g * brightnessMod);
		colors[i * 3 + 2] = Math.min(1, b * brightnessMod);
	}

	// DEBUG: Log sample colors (use Math.round, not bitwise OR which truncates to 0)
	const midIdx = Math.floor(vertexCount / 2) * 3;
	// Bounds check to avoid undefined access
	if (midIdx + 2 < colors.length && colors[0] !== undefined && colors[1] !== undefined && colors[2] !== undefined) {
		const midR = colors[midIdx] ?? 0;
		const midG = colors[midIdx + 1] ?? 0;
		const midB = colors[midIdx + 2] ?? 0;
		console.log(`🎨 [COLORS] Sample colors: [0]=(${(colors[0]*255).toFixed(0)},${(colors[1]*255).toFixed(0)},${(colors[2]*255).toFixed(0)}) [mid]=(${(midR*255).toFixed(0)},${(midG*255).toFixed(0)},${(midB*255).toFixed(0)})`);
	}

	return colors;
}

/**
 * Generate material roughness from audio frames
 * Brighter sounds (high spectral centroid) = glossier surface
 * Darker sounds (low spectral centroid) = rougher surface
 *
 * @param frames - Audio analysis frames
 * @returns Roughness value (0-1, where 0=glossy, 1=matte)
 */
export function generateAutoRoughness(frames: AnalysisFrame[]): number {
	if (!frames.length) return 0.5;

	// Average spectral centroid
	const avgCentroid = frames.reduce((sum, f) => {
		return sum + (f.timbre?.spectralCentroid || 2500);
	}, 0) / frames.length;

	// Normalize: 1000 Hz = rough (1.0), 5000 Hz = glossy (0.2)
	const normalized = (avgCentroid - 1000) / 4000;
	const roughness = 1.0 - (normalized * 0.8);

	return Math.max(0.2, Math.min(1.0, roughness));
}

