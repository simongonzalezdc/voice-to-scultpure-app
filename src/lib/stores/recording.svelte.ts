import {
	recordingStore,
	startRecording as startRecordingState,
	stopRecording as stopRecordingState,
	completeProcessing as completeProcessingState,
	resetRecording as resetRecordingState
} from './recordingStore.svelte';
import { setCurrentSculpture, sculptureStore } from './sculptureStore.svelte';
import { resetAnalysis } from './analysisStore.svelte';
import { createSculptureFromFrames } from '$lib/engine/physicsMapping';
import { appSettings } from './appSettingsStore.svelte';
import { uiStore } from './uiStore.svelte';

// Re-export recordingStore so it can be imported from here
export { recordingStore };

// Reactive state for live visualization
// eslint-disable-next-line svelte/valid-compile
let capturedFrames = $state<import('$lib/types').AnalysisFrame[]>([]);

export function getCapturedFrames() {
	return capturedFrames;
}

export function startRecording(): void {
	capturedFrames = [];
	console.log('🎙️ [RECORDING] Started - frames reset to 0');
	startRecordingState();
}

export function stopRecording(): void {
	stopRecordingState();
	console.log(`🛑 [RECORDING] Stopped - Total frames captured: ${capturedFrames.length}`);
	
	// Process frames immediately when stopping
	if (capturedFrames.length > 0) {
		console.log(`✨ [RECORDING] Processing ${capturedFrames.length} frames into sculpture...`);
		// Create a deep copy to avoid reactivity issues during processing
		const frames = JSON.parse(JSON.stringify(capturedFrames));
		// Use current sculpture's mode if it exists, otherwise use uiStore preference, then default to 'additive'
		const mode = sculptureStore.currentSculpture?.physical.sculptMode ?? uiStore.sculptMode ?? 'additive';
		const sculpture = createSculptureFromFrames(frames, appSettings.userProfile, undefined, mode);
		setCurrentSculpture(sculpture);
		console.log(`🗿 [RECORDING] Sculpture created with ${sculpture.radiusCurve.length} points in ${mode} mode`);
		completeProcessingState();
	} else {
		console.warn('⚠️ [RECORDING] No frames captured! Sculpture will be empty.');
		completeProcessingState();
	}
}

export function addAnalysisFrame(frame: import('$lib/types').AnalysisFrame): void {
	if (recordingStore.state === 'recording') {
		capturedFrames.push(frame);
		// Log every 60 frames (~1 second at 60fps)
		if (capturedFrames.length % 60 === 0) {
			console.log(`📊 [RECORDING] Captured ${capturedFrames.length} frames (${(capturedFrames.length / 60).toFixed(1)}s)`);
		}
	}
}

export function resetRecording(): void {
	capturedFrames = [];
	resetRecordingState();
	resetAnalysis();
	setCurrentSculpture(null);
}
