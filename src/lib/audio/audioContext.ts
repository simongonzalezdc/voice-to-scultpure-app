let audioContext: AudioContext | null = null;
let workletNode: AudioWorkletNode | null = null;
let mediaStream: MediaStream | null = null;
let initialized = false;

// Directive 1: Visualizer Bypass - Direct AnalyserNode for guaranteed feedback
let analyserNode: AnalyserNode | null = null;
let analyserDataArray: Uint8Array<ArrayBuffer> | null = null;
let visualizerPollInterval: number | null = null;
let gainNode: GainNode | null = null; // Directive 2: Keep graph alive
let inputGainNode: GainNode | null = null; // Mic sensitivity boost
let sourceNode: MediaStreamAudioSourceNode | null = null; // Track the mic source node
let dynamicsCompressor: DynamicsCompressorNode | null = null; // DIRECTIVE 3: Normalize volume for consistent shapes
const MIC_SENSITIVITY_MULTIPLIER = 3.0; // Increase mic sensitivity (1.0 = normal, 3.0 = 3x boost)

// CRITICAL FIX: Volume smoothing to prevent jitter
let smoothedMicLevel = 0;
const SMOOTHING_FACTOR = 0.15; // Lower = smoother (0.1-0.3 is good range)

// Store module reference (imported once, not in polling loop)
let analysisStoreModule: typeof import('$lib/stores/analysisStore.svelte') | null = null;

export async function initializeAudioContext(
	ringBuffer: SharedArrayBuffer,
	sampleRate: number = 44100
): Promise<AudioWorkletNode> {
	if (initialized && audioContext && workletNode) {
		return workletNode;
	}

	// Create audio context on first user gesture
	audioContext = new AudioContext({ sampleRate });

	// Add worklet module
	try {
		await audioContext.audioWorklet.addModule(
			new URL('../workers/recorder.worklet.js', import.meta.url)
		);
	} catch (error) {
		throw new Error(`Failed to load audio worklet: ${error}`);
	}

	// Create worklet node with ring buffer
	const capacity = ringBuffer.byteLength / 4 - 2; // Subtract write/read pointers
	workletNode = new AudioWorkletNode(audioContext, 'recorder-processor', {
		processorOptions: {
			ringBuffer,
			sampleRate,
			capacity
		}
	});

	// Create input gain node for mic sensitivity boost
	inputGainNode = audioContext.createGain();
	inputGainNode.gain.value = MIC_SENSITIVITY_MULTIPLIER; // Boost mic input

	// DIRECTIVE 3: Create DynamicsCompressorNode to normalize volume
	// This reduces jittery shapes and makes thickness mapping consistent
	// Chain: Source -> Compressor -> Worklet -> Destination
	dynamicsCompressor = audioContext.createDynamicsCompressor();
	dynamicsCompressor.threshold.value = -50; // Very sensitive to all input
	dynamicsCompressor.knee.value = 40; // Smooth compression curve
	dynamicsCompressor.ratio.value = 12; // Heavy compression (12:1)
	dynamicsCompressor.attack.value = 0; // Instant response
	dynamicsCompressor.release.value = 0.25; // 250ms release for smoothness

	// Directive 2: Keep the graph alive - Connect to destination (muted)
	gainNode = audioContext.createGain();
	gainNode.gain.value = 0; // Mute to prevent feedback
	workletNode.connect(gainNode);
	gainNode.connect(audioContext.destination);

	// Directive 1: Create AnalyserNode for direct visual feedback bypass
	analyserNode = audioContext.createAnalyser();
	analyserNode.fftSize = 2048;
	analyserNode.smoothingTimeConstant = 0.8;
	// Explicitly create with ArrayBuffer (not SharedArrayBuffer) to satisfy TypeScript
	const buffer = new ArrayBuffer(analyserNode.frequencyBinCount);
	analyserDataArray = new Uint8Array(buffer);

	initialized = true;
	return workletNode;
}

export async function startMicrophoneCapture(deviceId?: string): Promise<MediaStream> {
	if (mediaStream) {
		return mediaStream;
	}

	const constraints: MediaStreamConstraints = {
		audio: deviceId
			? {
					deviceId: { exact: deviceId },
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				}
			: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				}
	};

	try {
		mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
		return mediaStream;
	} catch (error) {
		throw new Error(`Failed to access microphone: ${error}`);
	}
}

export function connectMicrophoneToWorklet(stream: MediaStream): void {
	if (!audioContext || !workletNode || !analyserNode || !inputGainNode || !dynamicsCompressor) {
		throw new Error('Audio context not initialized');
	}

	// Disconnect existing source if present (prevents duplicate connections)
	if (sourceNode) {
		sourceNode.disconnect();
		sourceNode = null;
	}

	// Create and track the source node
	sourceNode = audioContext.createMediaStreamSource(stream);
	
	// DIRECTIVE 3: Connect audio chain for volume normalization
	// Chain: Source -> Input Gain -> Compressor -> Worklet & Analyser
	sourceNode.connect(inputGainNode);
	inputGainNode.connect(dynamicsCompressor);
	
	// Connect compressed signal to both worklet (for recording) and analyser (for visualizer bypass)
	dynamicsCompressor.connect(workletNode);
	dynamicsCompressor.connect(analyserNode); // Directive 1: Parallel connection for direct feedback

	// Start the visualizer bypass polling
	startVisualizerBypass();
	
	console.log('🎤 [AUDIO] Microphone connected to worklet with dynamics compression - ready to record');
}

// Directive 1: Visualizer Bypass - Direct mic level calculation
export async function startVisualizerBypass(): Promise<void> {
	if (visualizerPollInterval !== null) {
		return; // Already running
	}

	// Import store module ONCE during initialization (not in polling loop)
	try {
		analysisStoreModule = await import('$lib/stores/analysisStore.svelte');
	} catch (error) {
		console.error('Failed to load analysisStore module:', error);
		return; // Abort if module can't be loaded
	}

	const poll = () => {
		if (!analyserNode || !analyserDataArray || !analysisStoreModule) {
			return;
		}

		// Read frequency data
		analyserNode.getByteFrequencyData(analyserDataArray);

		// Calculate RMS from frequency bins
		let sum = 0;
		for (let i = 0; i < analyserDataArray.length; i++) {
			const normalized = analyserDataArray[i] / 255; // 0-1 range
			sum += normalized * normalized;
		}
		let rms = Math.sqrt(sum / analyserDataArray.length);
		
		// Apply sensitivity boost
		rms = Math.min(1.0, rms * MIC_SENSITIVITY_MULTIPLIER);
		
		// CRITICAL FIX: Exponential Moving Average smoothing to prevent jitter
		// This prevents wild 0-100 jumps by gradually following the signal
		smoothedMicLevel = smoothedMicLevel + SMOOTHING_FACTOR * (rms - smoothedMicLevel);
		
		// DIRECTIVE 3: Add signal threshold for pitch detection
		// Don't guess pitch for silence (prevents false positives from noise)
		const SIGNAL_THRESHOLD = 0.02; // Lowered from 0.05 for more sensitivity
		if (smoothedMicLevel < SIGNAL_THRESHOLD) {
			// Too quiet - just update mic level with smoothed value
			analysisStoreModule.updateMicLevel(smoothedMicLevel);
			return;
		}

		// Directly update store with SMOOTHED value (no more jitter!)
		analysisStoreModule.updateMicLevel(smoothedMicLevel);
	};

	// Poll at ~60fps
	visualizerPollInterval = setInterval(poll, 16) as unknown as number;
}

function stopVisualizerBypass(): void {
	if (visualizerPollInterval !== null) {
		clearInterval(visualizerPollInterval);
		visualizerPollInterval = null;
	}
	// Keep module reference for next start (avoid re-importing)
}

export function stopMicrophoneCapture(): void {
	// CRITICAL FIX: Don't stop visualizer bypass here!
	// GlazeMixer and other UI components need continuous audio monitoring
	// even when not actively recording. The visualizer bypass is lightweight
	// and provides essential real-time feedback.
	// Only stop it on full audio context reset.
	
	// Disconnect source node
	if (sourceNode) {
		sourceNode.disconnect();
		sourceNode = null;
	}
	
	// Stop media stream tracks
	if (mediaStream) {
		mediaStream.getTracks().forEach((track) => track.stop());
		mediaStream = null;
	}
	
	console.log('🎤 [AUDIO] Microphone capture stopped');
}

export function getAudioContext(): AudioContext | null {
	return audioContext;
}

export function getWorkletNode(): AudioWorkletNode | null {
	return workletNode;
}

export function resetAudioContext(): void {
	stopMicrophoneCapture();
	stopVisualizerBypass();
	
	if (sourceNode) {
		sourceNode.disconnect();
		sourceNode = null;
	}
	if (dynamicsCompressor) {
		dynamicsCompressor.disconnect();
		dynamicsCompressor = null;
	}
	if (workletNode) {
		workletNode.disconnect();
		workletNode = null;
	}
	if (inputGainNode) {
		inputGainNode.disconnect();
		inputGainNode = null;
	}
	if (gainNode) {
		gainNode.disconnect();
		gainNode = null;
	}
	if (analyserNode) {
		analyserNode.disconnect();
		analyserNode = null;
	}
	if (audioContext) {
		audioContext.close();
		audioContext = null;
	}
	
	analyserDataArray = null;
	initialized = false;
	
	console.log('🔄 [AUDIO] Audio context fully reset');
}
