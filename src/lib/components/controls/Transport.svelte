<script lang="ts">
	import { onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import {
		recordingStore,
		startRecording,
		stopRecording,
		resetRecording,
		setHistoryPosition,
		hasCapturedFrames
	} from '$lib/stores/recording.svelte';
	import { createAudioRingBuffer } from '$lib/audio/ringBuffer';
	import {
		initializeAudioContext,
		startMicrophoneCapture,
		connectMicrophoneToWorklet
	} from '$lib/audio/audioContext';
	import { createAnalysisWorkerClient } from '$lib/audio/analysisWorkerClient';
	import { addAnalysisFrame, isCapturing } from '$lib/stores/recording.svelte';
	import { updateAnalysisFrame } from '$lib/stores/analysisStore.svelte';
	import { analysisStore as analysis } from '$lib/stores/analysisStore.svelte';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { songModeStore } from '$lib/stores/songModeStore.svelte';
	import {
		startSongMode,
		stopSongMode,
		isSongModeRunning
	} from '$lib/controllers/songModeController';
	import { Circle, Palette, Hand } from 'lucide-svelte';
	import RecordingTips from '$lib/components/ui/RecordingTips.svelte';
	import RecordingSummary from '$lib/components/ui/RecordingSummary.svelte';

	let ringBuffer = $state<ReturnType<typeof createAudioRingBuffer> | null>(null);
	let workerClient = $state<ReturnType<typeof createAnalysisWorkerClient> | null>(null);

	// Pipeline metrics for debugging
	let pipelineMetrics = {
		initAttempts: 0,
		initSuccesses: 0,
		initFailures: 0,
		initStartTime: 0,
		firstFrameTime: 0,
		frameCount: 0
	};

	// Helper to check if pipeline is initialized
	function isPipelineReady(): boolean {
		return ringBuffer !== null && workerClient !== null;
	}

	// Format duration as MM:SS
	function formatDuration(ms: number): string {
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	async function handleRecordClick() {
		const isGlazeMode = uiStore.workspace === 'glaze';
		const isForceMode = uiStore.workspace === 'force';
		console.log(`🔘 [TRANSPORT] Button clicked, current state: ${recordingStore.state}`);

		if (recordingStore.state === 'idle') {
			// Glaze/Force mode: Require existing sculpture
			if ((isGlazeMode || isForceMode) && !sculptureStore.currentSculpture) {
				alert(`Please create a sculpture first before ${isGlazeMode ? 'painting' : 'sculpting'}.`);
				return;
			}
			await startRecordingFlow();
		} else if (recordingStore.state === 'recording') {
			await stopRecordingFlow();
		} else {
			// Complete or processing state: Reset behavior
			// Reset recording state but keep sculpture (resetRecording doesn't destroy the sculpture)
			console.log('🔘 [TRANSPORT] Button in complete/processing state, calling resetRecording()');
			resetRecording();
			console.log(`🔘 [TRANSPORT] After reset, state is now: ${recordingStore.state}`);
		}
	}

	async function startRecordingFlow() {
		const pipelineReady = isPipelineReady();
		console.log(
			`🎬 [TRANSPORT] startRecordingFlow called (pipelineReady: ${pipelineReady}, ringBuffer: ${ringBuffer !== null}, workerClient: ${workerClient !== null})`
		);

		pipelineMetrics.initAttempts++;
		const maxRetries = 3;
		let lastError: Error | null = null;
		let justInitialized = false; // Track if we just created the pipeline in this call

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			console.log(`🔄 [TRANSPORT] Initialization attempt ${attempt}/${maxRetries}`);
			try {
				// Initialize if any pipeline component is missing
				if (!ringBuffer || !workerClient) {
					justInitialized = true; // Mark that we're creating a new pipeline
					console.log(
						`🛠️ [TRANSPORT] Starting initialization... (ringBuffer: ${ringBuffer !== null}, workerClient: ${workerClient !== null})`
					);
					pipelineMetrics.initStartTime = Date.now();
					// Initialize ring buffer
					if (typeof SharedArrayBuffer === 'undefined') {
						console.error('❌ [TRANSPORT] SharedArrayBuffer not available');
						alert('SharedArrayBuffer not available. Please ensure COOP/COEP headers are set.');
						return;
					}

					ringBuffer = createAudioRingBuffer(44100 * 10, 44100); // 10 seconds capacity
					if (!ringBuffer) {
						console.error('❌ [TRANSPORT] Failed to create ring buffer');
						throw new Error('Failed to create ring buffer');
					}
					console.log('✅ [TRANSPORT] Ring buffer created');

					// Initialize audio context and worklet
					console.log('🎛️ [TRANSPORT] Initializing audio context...');
					await initializeAudioContext(ringBuffer.buffer, 44100);
					console.log('✅ [TRANSPORT] Audio context initialized');

					// Resume audio context (required for browser autoplay policy)
					console.log('🔊 [TRANSPORT] Resuming audio context...');
					const audioContext = await import('$lib/audio/audioContext').then((m) =>
						m.getAudioContext()
					);
					if (audioContext && audioContext.state === 'suspended') {
						console.log('⏸️ [TRANSPORT] Audio context was suspended, resuming...');
						await audioContext.resume();
					}
					console.log(`✅ [TRANSPORT] Audio context state: ${audioContext?.state}`);

					console.log('🎤 [TRANSPORT] Starting microphone capture...');
					const stream = await startMicrophoneCapture();
					console.log('✅ [TRANSPORT] Microphone stream acquired');

					connectMicrophoneToWorklet(stream);
					console.log('✅ [TRANSPORT] Microphone connected to worklet');

					// Create analysis worker
					let frameCallbackCount = 0;
					workerClient = createAnalysisWorkerClient(ringBuffer, (frame) => {
						frameCallbackCount++;
						pipelineMetrics.frameCount++;
						if (frameCallbackCount === 1) {
							pipelineMetrics.firstFrameTime = Date.now();
							const delay = pipelineMetrics.firstFrameTime - pipelineMetrics.initStartTime;
							console.log(`🎯 [TRANSPORT] First frame received (${delay}ms after init start)`);
						}
						// DIRECTIVE 2: Always update analysis store for live monitoring (GlazeMixer)
						updateAnalysisFrame(frame);
						// CRITICAL FIX: Use isCapturing() instead of recordingStore.state
						// The $state proxy may not work correctly when read from non-reactive callbacks
						const capturing = isCapturing();
						if (capturing) {
							addAnalysisFrame(frame);
							if (frameCallbackCount % 30 === 0) {
								console.log(
									`📊 [TRANSPORT] Recording: ${frameCallbackCount} frames captured (isCapturing: ${capturing})`
								);
							}
						} else if (frameCallbackCount % 60 === 0) {
							console.log(
								`👁️ [TRANSPORT] Monitoring: ${frameCallbackCount} frames processed (isCapturing: ${capturing})`
							);
						}
					});

					console.log('✅ [TRANSPORT] Pipeline initialized successfully');
					pipelineMetrics.initSuccesses++;

					// DIRECTIVE 2: Verify worklet is writing before starting worker
					// Wait for worklet to write some data to the ring buffer
					let verifyAttempts = 0;
					const MAX_VERIFY_ATTEMPTS = 40; // 40 * 50ms = 2 seconds max wait

					const verifyWorkletWriting = () => {
						if (!ringBuffer) {
							console.error('❌ [TRANSPORT] Ring buffer is null - cannot verify worklet writing');
							return;
						}

						verifyAttempts++;
						const intView = new Int32Array(ringBuffer.buffer);
						const writePtr = Atomics.load(intView, 0);

						if (writePtr > 0) {
							console.log(
								`✅ [TRANSPORT] Worklet is writing (writePtr=${writePtr}, attempts=${verifyAttempts}) - starting worker`
							);
							if (workerClient) {
								workerClient.start();
								console.log('🎧 [TRANSPORT] Analysis worker started in monitor mode');
							} else {
								console.error('❌ [TRANSPORT] Worker client is null - cannot start');
							}
						} else if (verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
							// Timeout - start worker anyway and show warning
							console.warn(
								`⚠️ [TRANSPORT] Worklet verification timeout (${verifyAttempts} attempts) - starting worker anyway`
							);
							console.warn(
								'⚠️ [TRANSPORT] No audio data in buffer. Check: 1) Mic selected correctly 2) Mic not muted 3) Mic volume > 0'
							);
							if (workerClient) {
								workerClient.start();
								console.log('🎧 [TRANSPORT] Analysis worker started (no audio data yet)');
							}
						} else {
							// Retry after a short delay
							if (verifyAttempts % 10 === 0) {
								console.log(
									`🔍 [TRANSPORT] Waiting for worklet data... (attempt ${verifyAttempts}/${MAX_VERIFY_ATTEMPTS}, writePtr=${writePtr})`
								);
							}
							setTimeout(verifyWorkletWriting, 50);
						}
					};

					// Start verification after initial delay
					setTimeout(verifyWorkletWriting, 200);
				} else if (workerClient) {
					// Pipeline already exists - restart worker to ensure it's active
					// (Only restart if we didn't just initialize, to avoid duplicate start calls)
					workerClient.start();
					console.log('🔄 [TRANSPORT] Existing worker restarted before recording');
				} else {
					console.error('❌ [TRANSPORT] Worker client is null - cannot start recording');
				}

				// Only start recording if not already running
				if (recordingStore.state !== 'recording') {
					startRecording();

					// Start Song Mode if enabled (Song Mode Stack integration)
					if (songModeStore.enabled && !isSongModeRunning()) {
						startSongMode();
						console.log('🎵 [TRANSPORT] Song Mode started with recording');
					}
				}
				return; // Success, exit retry loop
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				console.error(`❌ [TRANSPORT] Initialization attempt ${attempt} failed:`, error);
				pipelineMetrics.initFailures++;

				// Reset state for retry
				resetRecording();
				ringBuffer = null;
				workerClient = null;

				if (attempt < maxRetries) {
					// Wait before retry
					await new Promise((resolve) => setTimeout(resolve, 1000));
				}
			}
		}

		// All retries failed
		console.error('📊 [METRICS] Pipeline initialization failed after all retries', pipelineMetrics);
		alert(`Failed to start recording after ${maxRetries} attempts: ${lastError?.message}`);
	}

	// Log metrics when recording stops
	function logMetrics() {
		const initTime = pipelineMetrics.firstFrameTime - pipelineMetrics.initStartTime;
		console.log(
			`
📊 [PIPELINE METRICS]
  Initialization:
    - Attempts: ${pipelineMetrics.initAttempts}
    - Successes: ${pipelineMetrics.initSuccesses}
    - Failures: ${pipelineMetrics.initFailures}
    - Time to first frame: ${initTime > 0 ? initTime + 'ms' : 'N/A'}
  Frame Capture:
    - Total frames received: ${pipelineMetrics.frameCount}
  Pipeline State:
    - Ring Buffer: ${ringBuffer !== null ? 'Active' : 'NULL'}
    - Worker Client: ${workerClient !== null ? 'Active' : 'NULL'}
		`.trim()
		);
	}

	async function stopRecordingFlow() {
		// Log metrics before stopping
		logMetrics();

		// Stop Song Mode if running (Song Mode Stack integration)
		if (isSongModeRunning()) {
			stopSongMode();
			console.log('🎵 [TRANSPORT] Song Mode stopped with recording');
		}

		// DIRECTIVE 2: Don't stop the worker - keep it running for continuous monitoring
		// The analysis worker should stay active for GlazeMixer to receive pitch/timbre data
		// workerClient?.stop(); // REMOVED - keep worker running

		// CRITICAL FIX: Don't stop microphone capture here!
		// Keep the mic open for live monitoring (GlazeMixer, visualizers, etc.)
		// The visualizer bypass needs continuous audio input for real-time feedback.
		// Only truly close the mic on explicit user action or page unload.
		// stopMicrophoneCapture(); // REMOVED - mic stays open
		await stopRecording();
		console.log('🎧 [TRANSPORT] Recording stopped, but analysis worker continues for monitoring');
	}

	function getButtonText(): string {
		const isGlazeMode = uiStore.workspace === 'glaze';
		const isForceMode = uiStore.workspace === 'force';

		// Glaze/Force Mode ALWAYS takes priority. It implies "Recording on top".
		if (isGlazeMode || isForceMode) {
			// Safety check: Can't paint/force without a sculpture
			if (!sculptureStore.currentSculpture && recordingStore.state === 'idle') {
				return `${isGlazeMode ? 'Paint' : 'Force'} (Disabled)`;
			}

			switch (recordingStore.state) {
				case 'idle':
					return isGlazeMode ? 'Paint' : 'Active'; // Force mode: "Active"
				case 'recording':
					return isGlazeMode ? 'Stop Painting' : 'Stop Force';
				case 'processing':
					return 'Processing...';
				case 'complete':
					return isGlazeMode ? 'Paint Again' : 'Push Again'; // Non-destructive
				default:
					return isGlazeMode ? 'Paint' : 'Active';
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
					return 'New Recording';
				default:
					return 'Record';
			}
		}
	}

	function getButtonColor(): string {
		const isGlazeMode = uiStore.workspace === 'glaze';
		const isForceMode = uiStore.workspace === 'force';

		if (isGlazeMode) {
			// Purple/Indigo for glaze mode
			return recordingStore.state === 'recording'
				? 'bg-[#6b46c1] hover:bg-[#7c3aed] border-[#8b5cf6]'
				: 'bg-[#7c3aed] hover:bg-[#8b5cf6] border-[#a78bfa]';
		} else if (isForceMode) {
			// Orange for force mode
			return recordingStore.state === 'recording'
				? 'bg-[#dd6b20] hover:bg-[#ed8936] border-[#f6ad55]'
				: 'bg-[#ed8936] hover:bg-[#f6ad55] border-[#fbd38d]';
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

	function handleHistoryInput(value: number) {
		setHistoryPosition(value);
		sculptureStore.geometryDirty = true;
	}

	// Cleanup: Dispose worker on component destroy
	// According to Svelte docs and best practices: Workers should be terminated on component unmount
	onDestroy(() => {
		if (workerClient) {
			console.log('🧹 [TRANSPORT] Component destroying - disposing worker');
			workerClient.dispose();
			workerClient = null;
		}
		// Note: ringBuffer is SharedArrayBuffer, doesn't need explicit cleanup
		// but we nullify the reference for clarity
		ringBuffer = null;
	});

	// Cleanup: Dispose worker on page unload
	// According to best practices: Workers should be terminated on page unload to prevent memory leaks
	if (browser) {
		window.addEventListener('beforeunload', () => {
			if (workerClient) {
				console.log('🧹 [TRANSPORT] Page unloading - disposing worker');
				workerClient.dispose();
				workerClient = null;
			}
		});
	}
</script>

<div class="flex items-center gap-3">
	<button
		data-record-button
		class="px-4 py-2 {getButtonColor()} border rounded-md text-white disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
		type="button"
		onclick={handleRecordClick}
		disabled={recordingStore.state === 'processing' ||
			((uiStore.workspace === 'glaze' || uiStore.workspace === 'force') &&
				!sculptureStore.currentSculpture &&
				recordingStore.state === 'idle')}
		aria-label={getButtonText()}
		aria-live="polite"
	>
		{#if uiStore.workspace === 'glaze' && recordingStore.state === 'idle'}
			<Palette size={14} />
		{:else if uiStore.workspace === 'force' && recordingStore.state === 'idle'}
			<Hand size={14} />
		{:else if recordingStore.state === 'idle'}
			<Circle size={14} fill="currentColor" />
		{/if}
		{getButtonText()}
	</button>
	<div class="flex-1 min-w-[80px]">
		<div class="text-[10px] text-[#aaa] mb-0.5" id="mic-level-label">Mic</div>
		<div
			class="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden border border-[#4a4a4a]"
			role="progressbar"
			aria-labelledby="mic-level-label"
			aria-valuenow={Math.round(getMicLevel() * 100)}
			aria-valuemin="0"
			aria-valuemax="100"
		>
			<div
				class="h-full bg-[#4a9eff] transition-all duration-100"
				style="width: {getMicLevel() * 100}%"
			></div>
		</div>
	</div>
	<div class="w-32">
		<div class="flex items-center justify-between text-[10px] text-[#aaa] mb-0.5">
			<span>History</span>
			<span>{Math.round(recordingStore.historyPosition * 100)}%</span>
		</div>
		<input
			type="range"
			min="0"
			max="1"
			step="0.01"
			value={recordingStore.historyPosition}
			oninput={(e) => handleHistoryInput(parseFloat((e.target as HTMLInputElement).value))}
			class="w-full h-1.5 accent-brand-primary disabled:opacity-50"
			disabled={!hasCapturedFrames()}
		/>
	</div>
	{#if recordingStore.state === 'recording'}
		<div
			class="px-1.5 py-0.5 text-[10px] bg-[#ff4444] text-white rounded font-medium flex items-center gap-1"
			role="status"
		>
			<span class="animate-pulse">●</span>
			REC
			{#if recordingStore.startTime}
				<span class="ml-1 font-mono">{formatDuration(Date.now() - recordingStore.startTime)}</span>
			{/if}
		</div>
		<!-- Recording Mode Indicator -->
		<div class="px-1.5 py-0.5 text-[10px] bg-[#333] text-[#aaa] rounded">
			{#if uiStore.recordingMode === 'song'}
				🎵 Song
			{:else if uiStore.recordingMode === 'coil'}
				🏺 Coil
			{:else}
				📍 Std
			{/if}
		</div>
	{/if}
</div>

<!-- Inline Guidance Components -->
<RecordingTips />
<RecordingSummary />
