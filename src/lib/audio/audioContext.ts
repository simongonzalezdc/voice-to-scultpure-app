let audioContext: AudioContext | null = null;
let workletNode: AudioWorkletNode | null = null;
let mediaStream: MediaStream | null = null;
let initialized = false;

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
	if (!audioContext || !workletNode) {
		throw new Error('Audio context not initialized');
	}

	const source = audioContext.createMediaStreamSource(stream);
	source.connect(workletNode);
}

export function stopMicrophoneCapture(): void {
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
	if (workletNode) {
		workletNode.disconnect();
		workletNode = null;
	}
	if (audioContext) {
		audioContext.close();
		audioContext = null;
	}
	initialized = false;
}
