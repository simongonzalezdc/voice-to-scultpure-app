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
const MIC_SENSITIVITY_MULTIPLIER = 3.0; // Increase mic sensitivity (1.0 = normal, 3.0 = 3x boost)

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
	if (!audioContext || !workletNode || !analyserNode || !inputGainNode) {
		throw new Error('Audio context not initialized');
	}

	const source = audioContext.createMediaStreamSource(stream);
	
	// Connect source through input gain node for sensitivity boost
	source.connect(inputGainNode);
	
	// Connect amplified signal to both worklet (for recording) and analyser (for visualizer bypass)
	inputGainNode.connect(workletNode);
	inputGainNode.connect(analyserNode); // Directive 1: Parallel connection for direct feedback

	// Start the visualizer bypass polling
	startVisualizerBypass();
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
		
		// Apply additional sensitivity boost to RMS calculation
		rms = Math.min(1.0, rms * MIC_SENSITIVITY_MULTIPLIER);

		// Directly update store (module already imported)
		analysisStoreModule.updateMicLevel(rms);
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
	
	if (mediaStream) {
		mediaStream.getTracks().forEach((track) => track.stop());
		mediaStream = null;
	}
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
}
