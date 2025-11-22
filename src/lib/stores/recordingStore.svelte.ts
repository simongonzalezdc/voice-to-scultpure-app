export type RecordingState = 'idle' | 'recording' | 'processing' | 'complete';

export const recordingStore = $state<{
	state: RecordingState;
	startTime: number | null;
	duration: number;
}>({
	state: 'idle',
	startTime: null,
	duration: 0
});

export function startRecording(): void {
	recordingStore.state = 'recording';
	recordingStore.startTime = Date.now();
	recordingStore.duration = 0;
}

export function stopRecording(): void {
	if (recordingStore.state === 'recording' && recordingStore.startTime) {
		recordingStore.duration = Date.now() - recordingStore.startTime;
		recordingStore.state = 'processing';
	}
}

export function completeProcessing(): void {
	recordingStore.state = 'complete';
}

export function resetRecording(): void {
	recordingStore.state = 'idle';
	recordingStore.startTime = null;
	recordingStore.duration = 0;
}
