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

export function updateMicLevel(level: number): void {
	analysisStore.micLevel = Math.max(0, Math.min(1, level));
}

export function updateAnalysisFrame(frame: AnalysisFrame): void {
	analysisStore.latestFrame = frame;
	// Update mic level from frame energy
	analysisStore.micLevel = frame.energy;
}

export function resetAnalysis(): void {
	analysisStore.micLevel = 0;
	analysisStore.latestFrame = null;
}

