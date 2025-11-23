import Meyda from 'meyda';
import type { AudioRingBuffer } from '$lib/types';
import { readFromRingBuffer as readSamplesFromRingBuffer } from '$lib/audio/ringBuffer';
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

let ringBuffer: AudioRingBuffer | null = null;
let sampleRate = 44100;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let fftSize = 2048;
let hopSize = 512; // Standard hop size: 11.6ms at 44.1kHz. Pitch detection improved via autocorrelation tuning.
let running = false;
let lastAnalysisTime = 0;
const ANALYSIS_INTERVAL_MS = 16; // ~60fps
let framesSent = 0;
let pitchDetectionFailures = 0; // Track how often pitch detection fails

function analyzeFrame(audioData: Float32Array): AnalysisFrame | null {
	if (audioData.length === 0) {
		return null;
	}

	// Extract features using stateless API with raw Float32Array
	const features = Meyda.extract(
		['rms', 'zcr', 'spectralCentroid'],
		audioData
	);

	if (!features) {
		return null;
	}

	// Calculate pitch using autocorrelation
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

	// CRITICAL FIX: Lower threshold from 0.3 to 0.08 for more sensitive pitch detection
	// 0.3 was too strict - many valid pitched sounds were rejected
	// 0.08 is more forgiving while still filtering noise
	if (bestPeriod > 0 && maxCorrelation > 0.08) {
		const pitch = sampleRate / bestPeriod;
		
		// Log successful pitch detection occasionally for debugging
		if (Math.random() < 0.01) { // 1% of the time
			console.log(`[PITCH] Detected ${pitch.toFixed(1)}Hz (correlation: ${maxCorrelation.toFixed(3)})`);
		}
		
		return pitch;
	}

	// Log failures occasionally to see why pitch isn't detected
	if (Math.random() < 0.01) { // 1% of the time
		console.log(`[PITCH] Failed - bestPeriod: ${bestPeriod}, maxCorrelation: ${maxCorrelation.toFixed(3)} (need > 0.08)`);
	}

	return null;
}

function readIntoBuffer(buffer: AudioRingBuffer | null, output: Float32Array): number {
	if (!buffer) {
		return 0;
	}

	return readSamplesFromRingBuffer(buffer, output);
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
	const read = readIntoBuffer(ringBuffer, buffer);

	if (read > 0) {
		// Create a properly sized buffer with only the read samples
		const signal = buffer.subarray(0, read);
		
		// Analyze the frame using stateless Meyda extraction
		const frame = analyzeFrame(signal);
		if (frame) {
			framesSent++;
			if (framesSent === 1) {
				console.log('🔬 [ANALYSIS WORKER] First frame analyzed and sent');
			} else if (framesSent % 60 === 0) {
				// Log pitch detection success rate every 60 frames
				console.log(`🔬 [ANALYSIS WORKER] ${framesSent} frames sent (${(framesSent / 60).toFixed(1)}s)`);
			}
			
			// Debug: Log pitch values occasionally
			if (framesSent % 30 === 0 && frame.pitch > 0) {
				console.log(`🎵 [PITCH DEBUG] ${frame.pitch.toFixed(1)}Hz detected (energy: ${frame.energy.toFixed(3)})`);
			}
			
			self.postMessage({
				type: 'analysis-frame',
				payload: frame
			});
		}
	} else {
		// Log if no audio data is being read
		if (framesSent === 0) {
			console.warn('⚠️ [ANALYSIS WORKER] No audio data in ring buffer yet');
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
			console.log('🚀 [ANALYSIS WORKER] Starting analysis loop');
			running = true;
			framesSent = 0;
			// No analyzer needed - using stateless Meyda.extract() API
			processLoop();
			self.postMessage({ type: 'status', payload: 'started' });
			break;
		}

		case 'stop': {
			console.log(`🛑 [ANALYSIS WORKER] Stopping (sent ${framesSent} frames total)`);
			running = false;
			// No analyzer to clean up
			self.postMessage({ type: 'status', payload: 'stopped' });
			break;
		}

		case 'config': {
			const config = payload as ConfigPayload;
			const capacity = config.ringBuffer.byteLength / 4 - 2;
			ringBuffer = {
				buffer: config.ringBuffer,
				capacity,
				sampleRate: config.sampleRate
			};
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
