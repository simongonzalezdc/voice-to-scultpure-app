<script lang="ts">
	import { recordingStore } from '$lib/stores/recordingStore.svelte';
	import { startRecording, stopRecording, resetRecording } from '$lib/stores/recording.svelte';
	import { createAudioRingBuffer } from '$lib/audio/ringBuffer';
	import {
		initializeAudioContext,
		startMicrophoneCapture,
		connectMicrophoneToWorklet,
		stopMicrophoneCapture
	} from '$lib/audio/audioContext';
	import { createAnalysisWorkerClient } from '$lib/audio/analysisWorkerClient';
	import { addAnalysisFrame } from '$lib/stores/recording.svelte';
	import { updateAnalysisFrame } from '$lib/stores/analysisStore.svelte';
	import { analysisStore as analysis } from '$lib/stores/analysisStore.svelte';

	let ringBuffer = $state<ReturnType<typeof createAudioRingBuffer> | null>(null);
	let workerClient = $state<ReturnType<typeof createAnalysisWorkerClient> | null>(null);
	let isInitialized = $state(false);

	async function handleRecordClick() {
		if (recordingStore.state === 'idle') {
			await startRecordingFlow();
		} else if (recordingStore.state === 'recording') {
			await stopRecordingFlow();
		} else {
			resetRecording();
		}
	}

	async function startRecordingFlow() {
		const maxRetries = 3;
		let lastError: Error | null = null;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				if (!isInitialized) {
					// Initialize ring buffer
					if (typeof SharedArrayBuffer === 'undefined') {
						alert('SharedArrayBuffer not available. Please ensure COOP/COEP headers are set.');
						return;
					}

					ringBuffer = createAudioRingBuffer(44100 * 10, 44100); // 10 seconds capacity
					if (!ringBuffer) {
						throw new Error('Failed to create ring buffer');
					}

					// Initialize audio context and worklet
					await initializeAudioContext(ringBuffer.buffer, 44100);

					// Resume audio context (required for browser autoplay policy)
					const audioContext = await import('$lib/audio/audioContext').then(m => m.getAudioContext());
					if (audioContext && audioContext.state === 'suspended') {
						await audioContext.resume();
					}

					const stream = await startMicrophoneCapture();
					connectMicrophoneToWorklet(stream);

					// Create analysis worker
					let frameCallbackCount = 0;
					workerClient = createAnalysisWorkerClient(ringBuffer, (frame) => {
						frameCallbackCount++;
						if (frameCallbackCount === 1) {
							console.log('🎯 [TRANSPORT] First frame received in callback');
						}
						updateAnalysisFrame(frame);
						addAnalysisFrame(frame);
					});

					isInitialized = true;
				}

				workerClient?.start();
				startRecording();
				return; // Success, exit retry loop
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				console.error(`Recording initialization attempt ${attempt} failed:`, error);

				// Reset state for retry
				resetRecording();
				isInitialized = false;

				if (attempt < maxRetries) {
					// Wait before retry
					await new Promise(resolve => setTimeout(resolve, 1000));
				}
			}
		}

		// All retries failed
		alert(`Failed to start recording after ${maxRetries} attempts: ${lastError?.message}`);
	}

	async function stopRecordingFlow() {
		workerClient?.stop();
		stopMicrophoneCapture();
		stopRecording();
	}

	function getButtonText(): string {
		switch (recordingStore.state) {
			case 'idle':
				return 'Record';
			case 'recording':
				return 'Stop';
			case 'processing':
				return 'Processing...';
			case 'complete':
				return 'Reset';
			default:
				return 'Record';
		}
	}

	function getMicLevel(): number {
		return analysis.micLevel;
	}
</script>

<div class="surface-panel p-4 rounded-lg flex items-center gap-4">
	<button
		class="button-primary px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
		type="button"
		onclick={handleRecordClick}
		disabled={recordingStore.state === 'processing'}
	>
		{getButtonText()}
	</button>
	<div class="flex-1">
		<div class="text-sm text-secondary mb-1">Mic Level</div>
		<div class="h-2 bg-bg-panel-alt rounded-full overflow-hidden">
			<div
				class="h-full bg-brand-primary transition-all duration-100"
				style="width: {getMicLevel() * 100}%"
			></div>
		</div>
	</div>
	{#if recordingStore.state === 'recording'}
		<div class="badge badge-danger">Recording</div>
	{/if}
</div>
