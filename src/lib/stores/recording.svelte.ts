import {
	recordingStore,
	startRecording as startRecordingState,
	stopRecording as stopRecordingState,
	completeProcessing as completeProcessingState,
	resetRecording as resetRecordingState
} from './recordingStore.svelte';
import { setCurrentSculpture } from './sculptureStore.svelte';
import { resetAnalysis } from './analysisStore.svelte';
import { createSculptureFromFrames } from '$lib/engine/physicsMapping';
import { appSettings } from './appSettingsStore.svelte';

let capturedFrames: Array<import('$lib/types').AnalysisFrame> = [];

export function startRecording(): void {
	capturedFrames = [];
	startRecordingState();
}

export function stopRecording(): void {
	stopRecordingState();
	// Process frames immediately when stopping
	if (capturedFrames.length > 0) {
		const frames = [...capturedFrames];
		const sculpture = createSculptureFromFrames(frames, appSettings.userProfile);
		setCurrentSculpture(sculpture);
		completeProcessingState();
	} else {
		completeProcessingState();
	}
}

export function addAnalysisFrame(frame: import('$lib/types').AnalysisFrame): void {
	if (recordingStore.state === 'recording') {
		capturedFrames.push(frame);
	}
}

export function resetRecording(): void {
	capturedFrames = [];
	resetRecordingState();
	resetAnalysis();
	setCurrentSculpture(null);
}
