/**
 * Color Mapping Engine
 * Maps audio features (particularly pitch) to perceptually uniform colors
 * Uses OKLCH color space for best perceptual uniformity
 */

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
 * @returns Hex color string
 */
export function pitchToColor(normalizedPitch: number): string {
	// Clamp to 0-1 range
	const clamped = Math.max(0, Math.min(1, normalizedPitch));

	// OKLCH parameters
	const L = 0.70; // Lightness (constant for consistency)
	const C = 0.15; // Chroma (constant for consistency)

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
	if (!result) {
		return [1, 1, 1]; // Default to white
	}
	return [
		parseInt(result[1], 16) / 255,
		parseInt(result[2], 16) / 255,
		parseInt(result[3], 16) / 255
	];
}

