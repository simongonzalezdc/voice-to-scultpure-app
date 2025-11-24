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

// ============================================================================
// GENERATIVE PERFORMANCE: BEAT DETECTION
// ============================================================================
const BEAT_HISTORY_SIZE = 43; // ~700ms at 60fps (43 * 16ms)
const energyHistory: number[] = [];
let lastBeatTime = 0;
const BEAT_COOLDOWN_MS = 150; // Minimum time between beats (150ms = ~400 BPM max)

function analyzeFrame(audioData: Float32Array): AnalysisFrame | null {
	if (audioData.length === 0) {
		return null;
	}

	// Extract features using stateless API with raw Float32Array
	const features = Meyda.extract(['rms', 'zcr', 'spectralCentroid'], audioData);

	if (!features) {
		return null;
	}

	const energy = features.rms || 0;

	// GENERATIVE PERFORMANCE: Beat Detection
	const beat = detectBeat(energy);

	// Calculate pitch using autocorrelation
	let rawPitch = estimatePitch(audioData, sampleRate);

	// GENERATIVE PERFORMANCE: Quantize pitch to musical scale
	let pitch = 0;
	if (rawPitch) {
		pitch = quantizePitch(rawPitch, 'major'); // Use major scale by default
	}

	return {
		time: Date.now() / 1000,
		pitch: pitch || 0,
		energy,
		timbre: {
			spectralCentroid: features.spectralCentroid || 0,
			zcr: features.zcr || 0,
			spectralFlux: 0 // Calculate if needed
		},
		beat // GENERATIVE PERFORMANCE: Beat flag
	};
}

/**
 * GENERATIVE PERFORMANCE: Beat Detection
 * Detects rhythmic impulses using energy thresholding
 * @param energy - Current frame energy (RMS)
 * @returns true if a beat is detected
 */
function detectBeat(energy: number): boolean {
	const now = Date.now();

	// Add current energy to history
	energyHistory.push(energy);
	if (energyHistory.length > BEAT_HISTORY_SIZE) {
		energyHistory.shift(); // Keep only recent history
	}

	// Need enough history to calculate average
	if (energyHistory.length < BEAT_HISTORY_SIZE / 2) {
		return false;
	}

	// Calculate moving average
	const average = energyHistory.reduce((sum, e) => sum + e, 0) / energyHistory.length;

	// Detect beat: instant energy is significantly higher than average
	const threshold = average * 1.5; // 50% higher than average
	const isBeat = energy > threshold && energy > 0.1; // Minimum energy gate

	// Apply cooldown to prevent double-triggering
	if (isBeat && now - lastBeatTime > BEAT_COOLDOWN_MS) {
		lastBeatTime = now;
		// Log beats occasionally for debugging
		if (Math.random() < 0.3) {
			// 30% of the time
			console.log(
				`🥁 [BEAT] Detected! Energy: ${energy.toFixed(3)} vs Avg: ${average.toFixed(3)} (threshold: ${threshold.toFixed(3)})`
			);
		}
		return true;
	}

	return false;
}

/**
 * GENERATIVE PERFORMANCE: Harmonic Quantizer
 * Snaps detected pitch to nearest note in a musical scale
 * @param pitch - Raw detected pitch in Hz
 * @param scale - Musical scale to use ('major', 'minor', 'pentatonic')
 * @returns Quantized pitch in Hz
 */
function quantizePitch(pitch: number, scale: 'major' | 'minor' | 'pentatonic' = 'major'): number {
	if (pitch <= 0) return 0;

	// Define scale intervals (semitones from root)
	const scales = {
		major: [0, 2, 4, 5, 7, 9, 11], // Major scale (Ionian)
		minor: [0, 2, 3, 5, 7, 8, 10], // Natural minor (Aeolian)
		pentatonic: [0, 2, 4, 7, 9] // Major pentatonic
	};

	const intervals = scales[scale];

	// Convert pitch to MIDI note number
	const midiNote = 12 * Math.log2(pitch / 440) + 69; // A4 = 440Hz = MIDI 69

	// Find nearest scale degree
	const octave = Math.floor(midiNote / 12);
	const semitone = midiNote % 12;

	// Find closest note in scale
	let closestInterval = intervals[0];
	let minDistance = Math.abs(semitone - intervals[0]);

	for (const interval of intervals) {
		const distance = Math.abs(semitone - interval);
		if (distance < minDistance) {
			minDistance = distance;
			closestInterval = interval;
		}
	}

	// Reconstruct quantized MIDI note
	const quantizedMidi = octave * 12 + closestInterval;

	// Convert back to Hz
	const quantizedPitch = 440 * Math.pow(2, (quantizedMidi - 69) / 12);

	return quantizedPitch;
}

/**
 * GENERATIVE PERFORMANCE: Pitch to Hue Mapper
 * Maps quantized pitch to a specific hue in a pre-defined palette
 * @param pitch - Quantized pitch in Hz
 * @param palette - Color palette ('earth', 'neon', 'ocean')
 * @returns Hue value (0-360)
 */
function pitchToHue(pitch: number, palette: 'earth' | 'neon' | 'ocean' = 'earth'): number {
	if (pitch <= 0) return 0;

	// Map pitch to chromatic scale position (0-11 semitones)
	const midiNote = 12 * Math.log2(pitch / 440) + 69;
	const semitone = Math.floor(midiNote) % 12;

	// Define color palettes (hue values for each semitone)
	const palettes = {
		earth: [30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85], // Warm earth tones (yellow-green)
		neon: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330], // Full spectrum
		ocean: [180, 190, 200, 210, 220, 230, 240, 250, 260, 270, 280, 290] // Cool blues/purples
	};

	return palettes[palette][semitone];
}

function estimatePitch(audioData: Float32Array, sampleRate: number): number | null {
	// IMPROVED autocorrelation with pre-processing for 512-sample buffer

	// Step 1: Pre-process - Remove DC offset and normalize
	let sum = 0;
	for (let i = 0; i < audioData.length; i++) {
		sum += audioData[i];
	}
	const mean = sum / audioData.length;

	// Create centered signal
	const centered = new Float32Array(audioData.length);
	let maxAbs = 0;
	for (let i = 0; i < audioData.length; i++) {
		centered[i] = audioData[i] - mean;
		maxAbs = Math.max(maxAbs, Math.abs(centered[i]));
	}

	// Normalize to prevent very quiet signals from failing
	if (maxAbs > 0) {
		for (let i = 0; i < centered.length; i++) {
			centered[i] /= maxAbs;
		}
	}

	// Step 2: Autocorrelation with improved algorithm
	const minPeriod = Math.floor(sampleRate / 800); // Max 800Hz
	const maxPeriod = Math.min(
		Math.floor(sampleRate / 80), // Min 80Hz
		Math.floor(centered.length / 2) // Don't exceed half buffer
	);

	let maxCorrelation = -1;
	let bestPeriod = 0;

	// Calculate autocorrelation with normalization
	for (let period = minPeriod; period < maxPeriod; period++) {
		let correlation = 0;
		let energy1 = 0;
		let energy2 = 0;

		for (let i = 0; i < centered.length - period; i++) {
			correlation += centered[i] * centered[i + period];
			energy1 += centered[i] * centered[i];
			energy2 += centered[i + period] * centered[i + period];
		}

		// Normalized correlation (prevents bias toward loud signals)
		const normalizedCorr =
			energy1 > 0 && energy2 > 0 ? correlation / Math.sqrt(energy1 * energy2) : 0;

		if (normalizedCorr > maxCorrelation) {
			maxCorrelation = normalizedCorr;
			bestPeriod = period;
		}
	}

	// CRITICAL FIX: Much lower threshold for 512-sample buffer
	// With proper normalization, correlation values are more reliable
	const CORRELATION_THRESHOLD = 0.5; // Normalized correlation is 0-1 scale

	if (bestPeriod > 0 && maxCorrelation > CORRELATION_THRESHOLD) {
		const pitch = sampleRate / bestPeriod;

		// Only accept human vocal range
		if (pitch >= 60 && pitch <= 800) {
			// Log successful pitch detection occasionally for debugging
			if (Math.random() < 0.02) {
				// 2% of the time
				console.log(`[PITCH] ✓ ${pitch.toFixed(1)}Hz (correlation: ${maxCorrelation.toFixed(3)})`);
			}
			return pitch;
		}
	}

	// Log failures occasionally to see why pitch isn't detected
	if (Math.random() < 0.01) {
		// 1% of the time
		console.log(
			`[PITCH] ✗ Failed - period: ${bestPeriod}, corr: ${maxCorrelation.toFixed(3)} (need > ${CORRELATION_THRESHOLD})`
		);
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

	// Debug: Log ring buffer state occasionally
	if (framesSent === 0 && Date.now() % 2000 < ANALYSIS_INTERVAL_MS) {
		const intView = new Int32Array(ringBuffer.buffer);
		const writePtr = Atomics.load(intView, 0);
		const readPtr = Atomics.load(intView, 1);
		const available = writePtr - readPtr;
		console.log(`🔍 [ANALYSIS WORKER] Ring buffer check: writePtr=${writePtr}, readPtr=${readPtr}, available=${available}, read=${read}`);
	}

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
				console.log(
					`🔬 [ANALYSIS WORKER] ${framesSent} frames sent (${(framesSent / 60).toFixed(1)}s)`
				);
			}

			// Debug: Log pitch values occasionally
			if (framesSent % 30 === 0 && frame.pitch > 0) {
				console.log(
					`🎵 [PITCH DEBUG] ${frame.pitch.toFixed(1)}Hz detected (energy: ${frame.energy.toFixed(3)})`
				);
			}

			self.postMessage({
				type: 'analysis-frame',
				payload: frame
			});
		}
	} else {
		// Log if no audio data is being read (but only occasionally to avoid spam)
		if (framesSent === 0 && Date.now() - lastAnalysisTime > 1000) {
			// Only warn once per second if no frames have been sent
			console.warn('⚠️ [ANALYSIS WORKER] No audio data in ring buffer yet - check worklet connection');
		}
	}

	setTimeout(processLoop, ANALYSIS_INTERVAL_MS);
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
	const { type, payload } = e.data;

	switch (type) {
		case 'start': {
			if (!ringBuffer) {
				console.error('❌ [ANALYSIS WORKER] Cannot start: ring buffer not configured');
				self.postMessage({ type: 'error', payload: 'Ring buffer not configured' });
				return;
			}
			if (running) {
				console.warn('⚠️ [ANALYSIS WORKER] Already running - ignoring duplicate start call to prevent concurrent loops');
				return; // Guard against duplicate processLoop chains
			}
			console.log('🚀 [ANALYSIS WORKER] Starting analysis loop');
			running = true;
			framesSent = 0;
			lastAnalysisTime = 0; // Reset timing
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
