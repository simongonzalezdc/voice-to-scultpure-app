<script lang="ts">
	import {
		recordingStore,
		startRecording,
		stopRecording,
		resetRecording
	} from '$lib/stores/recording.svelte';
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
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';

	let ringBuffer = $state<ReturnType<typeof createAudioRingBuffer> | null>(null);
	let workerClient = $state<ReturnType<typeof createAnalysisWorkerClient> | null>(null);
	let isInitialized = $state(false);

	async function handleRecordClick() {
		const isGlazeMode = uiStore.toolMode === 'glaze-mix' || uiStore.toolMode === 'glaze-paint';

		if (recordingStore.state === 'idle') {
			// Glaze mode: Require existing sculpture
			if (isGlazeMode && !sculptureStore.currentSculpture) {
				alert('Please create a sculpture first before painting.');
				return;
			}
			await startRecordingFlow();
		} else if (recordingStore.state === 'recording') {
			await stopRecordingFlow();
		} else {
			// Complete state: Reset behavior
			// In glaze mode, we don't want to destroy the sculpture, just reset recording state
			if (isGlazeMode) {
				// Non-destructive reset: Only reset recording state, keep sculpture
				recordingStore.state = 'idle';
				recordingStore.startTime = null;
				recordingStore.duration = 0;
			} else {
				// Sculpt mode: Full reset (clears sculpture)
				resetRecording();
			}
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
					const audioContext = await import('$lib/audio/audioContext').then((m) =>
						m.getAudioContext()
					);
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
						// DIRECTIVE 2: Always update analysis store for live monitoring (GlazeMixer)
						updateAnalysisFrame(frame);
						// Only add to recording store when actually recording
						if (recordingStore.state === 'recording') {
							addAnalysisFrame(frame);
						}
					});

					isInitialized = true;

					// DIRECTIVE 2: Start worker immediately for continuous monitoring
					// This ensures GlazeMixer gets pitch/timbre data even when not recording
					workerClient?.start();
					console.log('🎧 [TRANSPORT] Analysis worker started in monitor mode');
				}

				// Only start recording if not already running
				if (recordingStore.state !== 'recording') {
					startRecording();
				}
				return; // Success, exit retry loop
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				console.error(`Recording initialization attempt ${attempt} failed:`, error);

				// Reset state for retry
				resetRecording();
				isInitialized = false;

				if (attempt < maxRetries) {
					// Wait before retry
					await new Promise((resolve) => setTimeout(resolve, 1000));
				}
			}
		}

		// All retries failed
		alert(`Failed to start recording after ${maxRetries} attempts: ${lastError?.message}`);
	}

	async function stopRecordingFlow() {
		// DIRECTIVE 2: Don't stop the worker - keep it running for continuous monitoring
		// The analysis worker should stay active for GlazeMixer to receive pitch/timbre data
		// workerClient?.stop(); // REMOVED - keep worker running

		// CRITICAL FIX: Don't stop microphone capture here!
		// Keep the mic open for live monitoring (GlazeMixer, visualizers, etc.)
		// The visualizer bypass needs continuous audio input for real-time feedback.
		// Only truly close the mic on explicit user action or page unload.
		// stopMicrophoneCapture(); // REMOVED - mic stays open
		stopRecording();
		console.log('🎧 [TRANSPORT] Recording stopped, but analysis worker continues for monitoring');
	}

	function getButtonText(): string {
		const isGlazeMode = uiStore.toolMode === 'glaze-mix' || uiStore.toolMode === 'glaze-paint';

		// Glaze Mode ALWAYS takes priority. It implies "Recording on top".
		if (isGlazeMode) {
			// Safety check: Can't paint without a sculpture
			if (!sculptureStore.currentSculpture && recordingStore.state === 'idle') {
				return 'Paint (Disabled)';
			}

			switch (recordingStore.state) {
				case 'idle':
					return 'Paint';
				case 'recording':
					return 'Stop Painting';
				case 'processing':
					return 'Processing...';
				case 'complete':
					return 'Paint Again'; // Non-destructive: allows painting again
				default:
					return 'Paint';
			}
		} else {
			// Sculpt Mode behaves normally
			switch (recordingStore.state) {
				case 'idle':
					return sculptureStore.currentSculpture ? 'Record' : 'Record';
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
	}

	function getButtonColor(): string {
		const isGlazeMode = uiStore.toolMode === 'glaze-mix' || uiStore.toolMode === 'glaze-paint';
		if (isGlazeMode) {
			// Purple/Indigo for glaze mode
			return recordingStore.state === 'recording'
				? 'bg-[#6b46c1] hover:bg-[#7c3aed] border-[#8b5cf6]'
				: 'bg-[#7c3aed] hover:bg-[#8b5cf6] border-[#a78bfa]';
		} else {
			// Red for sculpt mode
			return recordingStore.state === 'recording'
				? 'bg-[#dc2626] hover:bg-[#ef4444] border-[#f87171]'
				: 'bg-[#ef4444] hover:bg-[#f87171] border-[#fca5a5]';
		}
	}

	function getMicLevel(): number {
		return analysis.micLevel;
	}
</script>

<div class="flex items-center gap-4">
	<button
		data-record-button
		class="px-6 py-3 {getButtonColor()} border text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2"
		type="button"
		onclick={handleRecordClick}
		disabled={recordingStore.state === 'processing' ||
			((uiStore.toolMode === 'glaze-mix' || uiStore.toolMode === 'glaze-paint') &&
				!sculptureStore.currentSculpture &&
				recordingStore.state === 'idle')}
	>
		{#if (uiStore.toolMode === 'glaze-mix' || uiStore.toolMode === 'glaze-paint') && recordingStore.state === 'idle'}
			<span>🎨</span>
		{:else if recordingStore.state === 'idle'}
			<span>🔴</span>
		{/if}
		{getButtonText()}
	</button>
	<div class="flex-1">
		<div class="text-xs text-[#888] mb-1">Mic Level</div>
		<div class="h-2 bg-[#2a2a2a] rounded-full overflow-hidden border border-[#4a4a4a]">
			<div
				class="h-full bg-[#4a9eff] transition-all duration-100"
				style="width: {getMicLevel() * 100}%"
			></div>
		</div>
	</div>
	{#if recordingStore.state === 'recording'}
		<div class="px-2 py-1 text-xs bg-[#ff4444] text-white rounded">Recording</div>
	{/if}
</div>
