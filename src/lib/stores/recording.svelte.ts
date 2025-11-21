// $effect is available globally in Svelte 5
import {
	recordingStore,
	startRecording as startRecordingState,
	stopRecording as stopRecordingState,
	completeProcessing as completeProcessingState,
	resetRecording as resetRecordingState
} from './recordingStore';
import { sculptureStore, setCurrentSculpture } from './sculptureStore';
import { analysisStore, resetAnalysis } from './analysisStore';
import { createSculptureFromFrames } from '$lib/engine/physicsMapping';
import { appSettings } from './appSettingsStore';

let capturedFrames: Array<import('$lib/types').AnalysisFrame> = [];

$effect(() => {
	if (recordingStore.state === 'processing') {
		// Snapshot frames and generate sculpture
		const frames = [...capturedFrames];
		const sculpture = createSculptureFromFrames(frames, appSettings.userProfile);
		setCurrentSculpture(sculpture);
		completeProcessingState();
	}
});

export function startRecording(): void {
	capturedFrames = [];
	startRecordingState();
}

export function stopRecording(): void {
	stopRecordingState();
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

