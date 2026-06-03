/**
 * Phase 2: The Aesthetic Engine (The Brain)
 * Maps raw frequency to musical notes to ensure pleasing shapes.
 */

export function quantizePitch(hz: number): number {
	if (hz <= 0) return 0;

	// 1. Convert Hz to MIDI Note Number
	// MIDI 69 = A4 = 440Hz
	const midiNum = 69 + 12 * Math.log2(hz / 440);

	// 2. Round to nearest integer (Snap to note)
	const rounded = Math.round(midiNum);

	// 3. Convert back to Hz (Stepped frequency)
	return 440 * Math.pow(2, (rounded - 69) / 12);
}

export function getHarmonicColor(hz: number): string {
	if (hz <= 0) return '#ffffff';

	// Map Pitch Class (C, D, E) to Color Wheel (Red, Orange, Yellow)
	// This ensures musical harmony = color harmony
	const midiNum = 69 + 12 * Math.log2(hz / 440);
	const noteIndex = Math.round(midiNum) % 12;

	// Simple HSL mapping: 0 (C) -> 0deg (Red), 12 -> 360deg
	const hue = (noteIndex / 12) * 360;
	return `hsl(${hue}, 70%, 60%)`;
}
