import type { AnalysisFrame } from '$lib/types';

export const analysisStore = $state<{
	micLevel: number; // 0-1
	latestFrame: AnalysisFrame | null;
	hasSharedArrayBuffer: boolean;
}>({
	micLevel: 0,
	latestFrame: null,
	hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined'
});

// CRITICAL FIX: Pitch smoothing to prevent sudden jumps
let smoothedPitch = 0;
const PITCH_SMOOTHING = 0.3; // Higher = more responsive, lower = smoother (0.2-0.4 is good)

export function updateMicLevel(level: number): void {
	analysisStore.micLevel = Math.max(0, Math.min(1, level));
}

export function updateAnalysisFrame(frame: AnalysisFrame): void {
	// CRITICAL FIX: Smooth pitch values to prevent jitter
	// Only smooth when we have valid pitch (> 0)
	if (frame.pitch > 0) {
		if (smoothedPitch === 0) {
			// First pitch detected - jump to it immediately
			smoothedPitch = frame.pitch;
		} else {
			// Smooth subsequent pitches
			smoothedPitch = smoothedPitch + PITCH_SMOOTHING * (frame.pitch - smoothedPitch);
		}

		// Create new frame with smoothed pitch
		analysisStore.latestFrame = {
			...frame,
			pitch: smoothedPitch
		};
	} else {
		// No pitch detected - reset smoothing and use original frame
		smoothedPitch = 0;
		analysisStore.latestFrame = frame;
	}

	// Update mic level from frame energy
	analysisStore.micLevel = frame.energy;
}

export function resetAnalysis(): void {
	analysisStore.micLevel = 0;
	analysisStore.latestFrame = null;
	smoothedPitch = 0; // Reset pitch smoothing
}
