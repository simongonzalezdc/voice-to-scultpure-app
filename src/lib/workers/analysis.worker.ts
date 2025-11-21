import Meyda from 'meyda';
import type { AnalysisFrame } from '../types';

interface WorkerMessage {
	type: 'start' | 'stop' | 'samples' | 'config';
	payload?: unknown;
}

interface ConfigPayload {
	ringBuffer: SharedArrayBuffer;
	sampleRate: number;
	fftSize?: number;
	hopSize?: number;
}

let ringBuffer: SharedArrayBuffer | null = null;
let sampleRate = 44100;
let fftSize = 2048;
let hopSize = 512;
let running = false;
let analyzer: ReturnType<typeof Meyda.createMeydaAnalyzer> | null = null;
let lastAnalysisTime = 0;
const ANALYSIS_INTERVAL_MS = 16; // ~60fps

function analyzeFrame(audioData: Float32Array): AnalysisFrame | null {
	if (!analyzer || audioData.length === 0) {
		return null;
	}

	const features = analyzer.get(['rms', 'zcr', 'spectralCentroid', 'chroma']);

	if (!features) {
		return null;
	}

	// Calculate pitch using YIN algorithm approximation
	// Meyda doesn't have YIN, so we use autocorrelation as approximation
	const pitch = estimatePitch(audioData, sampleRate);

	return {
		time: Date.now() / 1000,
		pitch: pitch || 0,
		energy: features.rms || 0,
		timbre: {
			spectralCentroid: features.spectralCentroid || 0,
			zcr: features.zcr || 0,
			spectralFlux: 0 // Calculate if needed
		}
	};
}

function estimatePitch(audioData: Float32Array, sampleRate: number): number | null {
	// Simple autocorrelation-based pitch estimation
	const minPeriod = Math.floor(sampleRate / 800); // Max 800Hz
	const maxPeriod = Math.floor(sampleRate / 80); // Min 80Hz

	let maxCorrelation = 0;
	let bestPeriod = 0;

	for (let period = minPeriod; period < maxPeriod && period < audioData.length / 2; period++) {
		let correlation = 0;
		for (let i = 0; i < audioData.length - period; i++) {
			correlation += audioData[i] * audioData[i + period];
		}
		correlation /= audioData.length - period;

		if (correlation > maxCorrelation) {
			maxCorrelation = correlation;
			bestPeriod = period;
		}
	}

	if (bestPeriod > 0 && maxCorrelation > 0.3) {
		return sampleRate / bestPeriod;
	}

	return null;
}

function readFromRingBuffer(buffer: SharedArrayBuffer, output: Float32Array): number {
	const view = new Float32Array(buffer);
	const intView = new Int32Array(buffer);
	const WRITE_PTR_INDEX = 0;
	const READ_PTR_INDEX = 1;
	const DATA_START_INDEX = 2;
	const capacity = (buffer.byteLength / 4) - DATA_START_INDEX;

	const writePtr = Atomics.load(intView, WRITE_PTR_INDEX);
	const readPtr = Atomics.load(intView, READ_PTR_INDEX);

	let available = 0;
	if (writePtr >= readPtr) {
		available = writePtr - readPtr;
	} else {
		available = capacity - (readPtr - writePtr);
	}

	const toRead = Math.min(available, output.length);
	if (toRead === 0) {
		return 0;
	}

	for (let i = 0; i < toRead; i++) {
		const readIndex = ((readPtr - DATA_START_INDEX + i) % capacity) + DATA_START_INDEX;
		output[i] = view[readIndex];
	}

	const newReadPtr = ((readPtr - DATA_START_INDEX + toRead) % capacity) + DATA_START_INDEX;
	Atomics.store(intView, READ_PTR_INDEX, newReadPtr);

	return toRead;
}

function processLoop(): void {
	if (!running || !ringBuffer) {
		return;
	}

	const now = Date.now();
	if (now - lastAnalysisTime < ANALYSIS_INTERVAL_MS) {
		setTimeout(processLoop, ANALYSIS_INTERVAL_MS - (now - lastAnalysisTime));
		return;
	}

	lastAnalysisTime = now;

	const buffer = new Float32Array(hopSize);
	const read = readFromRingBuffer(ringBuffer, buffer);

	if (read > 0 && analyzer) {
		// Meyda expects an AudioBuffer or AudioNode, but we have Float32Array
		// Create a temporary AudioBuffer-like object for Meyda
		const audioBuffer = {
			getChannelData: (channel: number) => {
				if (channel === 0) return buffer;
				return new Float32Array(buffer.length);
			},
			numberOfChannels: 1,
			sampleRate: sampleRate,
			length: buffer.length
		};
		analyzer.setSource(audioBuffer as any);
		const frame = analyzeFrame(buffer);
		if (frame) {
			self.postMessage({
				type: 'analysis-frame',
				payload: frame
			});
		}
	}

	setTimeout(processLoop, ANALYSIS_INTERVAL_MS);
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
	const { type, payload } = e.data;

	switch (type) {
		case 'start': {
			if (!ringBuffer) {
				self.postMessage({ type: 'error', payload: 'Ring buffer not configured' });
				return;
			}
			running = true;
			analyzer = Meyda.createMeydaAnalyzer({
				audioContext: {
					sampleRate
				} as AudioContext,
				bufferSize: fftSize,
				featureExtractors: ['rms', 'zcr', 'spectralCentroid', 'chroma']
			});
			processLoop();
			self.postMessage({ type: 'status', payload: 'started' });
			break;
		}

		case 'stop': {
			running = false;
			if (analyzer) {
				analyzer.stop();
				analyzer = null;
			}
			self.postMessage({ type: 'status', payload: 'stopped' });
			break;
		}

		case 'config': {
			const config = payload as ConfigPayload;
			ringBuffer = config.ringBuffer;
			sampleRate = config.sampleRate;
			fftSize = config.fftSize || 2048;
			hopSize = config.hopSize || 512;
			self.postMessage({ type: 'status', payload: 'configured' });
			break;
		}

		default:
			break;
	}
};

