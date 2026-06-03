import Meyda from 'meyda';
import type { AudioRingBuffer } from '../types';
import { readFromRingBuffer as readSamplesFromRingBuffer } from '../audio/ringBuffer';
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
const ANALYSIS_INTERVAL_MS = 33; // ~30fps (aligned with rendering frame rate)
let framesSent = 0;

// ============================================================================
// GENERATIVE PERFORMANCE: BEAT DETECTION
// ============================================================================
const BEAT_HISTORY_SIZE = 21; // ~700ms at 30fps (21 * 33ms = 693ms)
const energyHistory: number[] = [];
let lastBeatTime = 0;
const BEAT_COOLDOWN_MS = 150; // Minimum time between beats (150ms = ~400 BPM max)

// ============================================================================
// TEMPORAL SMOOTHING: Heavy smoothing for beautiful human-scale sculpture
// ============================================================================
// Human singing is slow - beautiful vibrato is 5-8Hz, not 30Hz
// These values create smooth curves instead of jittery noise
let smoothedPitch = 0;
let smoothedSpectralCentroid = 0;
let smoothedEnergy = 0;

// Heavy smoothing factors (lower = smoother)
// At 30fps: alpha=0.10 gives ~300ms smoothing (natural vocal response)
const PITCH_SMOOTHING_ATTACK = 0.1; // Attack: smooth pitch changes
const PITCH_SMOOTHING_RELEASE = 0.06; // Release: even smoother decay
const TIMBRE_SMOOTHING = 0.09; // Heavy timbre smoothing
const ENERGY_SMOOTHING = 0.08; // Heavy energy smoothing

// Pitch confidence tracking for better detection
let pitchConfidence = 0;
let _lastValidPitch = 0;

// Song Mode: Formant smoothing
let smoothedF1 = 500; // Default F1 (neutral vowel)
let smoothedF2 = 1500; // Default F2 (neutral vowel)
const FORMANT_SMOOTHING = 0.2; // Slightly slower smoothing for formants

function analyzeFrame(audioData: Float32Array): AnalysisFrame | null {
	if (audioData.length === 0) {
		return null;
	}

	// Extract features using stateless API with raw Float32Array
	// NEW: Add spectralFlatness and mfcc for angular distribution mapping
	const features = Meyda.extract(
		['rms', 'zcr', 'spectralCentroid', 'spectralFlatness', 'mfcc'],
		audioData
	);

	if (!features) {
		return null;
	}

	// Guard against NaN and undefined from Meyda
	const energy = features.rms !== undefined && Number.isFinite(features.rms) ? features.rms : 0;

	// GENERATIVE PERFORMANCE: Beat Detection
	const beat = detectBeat(energy);

	// Calculate pitch using autocorrelation
	const rawPitch = estimatePitch(audioData, sampleRate);

	// GENERATIVE PERFORMANCE: Quantize pitch to musical scale
	let pitch = 0;
	if (rawPitch) {
		pitch = quantizePitch(rawPitch, 'major'); // Use major scale by default
	}

	// HUMAN-SCALE TEMPORAL SMOOTHING: Heavy smoothing for beautiful sculpture
	// Human singing is slow - use attack/release curves for natural response
	// Attack = fast response to new notes, Release = smooth decay

	// Pitch smoothing with attack/release asymmetry
	if (pitch > 0) {
		// ATTACK: New pitch detected - use faster response for note changes
		// But still smooth enough to avoid jitter (300ms time constant)
		const smoothingFactor = smoothedPitch > 0 ? PITCH_SMOOTHING_ATTACK : 0.3; // Jump to new pitch faster if starting from zero
		smoothedPitch = smoothedPitch + (pitch - smoothedPitch) * smoothingFactor;
		_lastValidPitch = pitch;
		pitchConfidence = Math.min(1.0, pitchConfidence + 0.2); // Build confidence
	} else {
		// RELEASE: No pitch detected - smooth decay toward zero
		// Use even slower smoothing (500ms) for graceful fade
		smoothedPitch = smoothedPitch + (0 - smoothedPitch) * PITCH_SMOOTHING_RELEASE;
		pitchConfidence = Math.max(0, pitchConfidence - 0.1); // Decay confidence
	}

	// Energy smoothing (heavily smoothed for visual beauty)
	smoothedEnergy = smoothedEnergy + (energy - smoothedEnergy) * ENERGY_SMOOTHING;

	// Smooth spectral centroid (timbre) - heavy smoothing for consistent texture
	const rawSpectralCentroid =
		features.spectralCentroid !== undefined && Number.isFinite(features.spectralCentroid)
			? features.spectralCentroid
			: 0;
	smoothedSpectralCentroid =
		smoothedSpectralCentroid + (rawSpectralCentroid - smoothedSpectralCentroid) * TIMBRE_SMOOTHING;

	// SONG MODE: Estimate formants for Phonetic Geometry (#3)
	const formant = estimateFormants(audioData, sampleRate, energy);

	// NEW: Angular distribution features
	// spectralFlatness: 0 = pure tone (harmonic), 1 = noise (breathy/harsh)
	// Guard against NaN from Meyda
	const rawSpectralFlatness = features.spectralFlatness;
	const spectralFlatness: number =
		rawSpectralFlatness !== undefined && Number.isFinite(rawSpectralFlatness)
			? rawSpectralFlatness
			: 0;

	// MFCC: 13 coefficients representing spectral shape (vowel character)
	const mfcc = features.mfcc || [];

	// Calculate angular position and spread for spiral geometry
	// Pitch maps to angle (low=0°, high=360°)
	const pitchForAngle = smoothedPitch > 0 ? smoothedPitch : 220; // Default to A3
	const angle = mapPitchToAngle(pitchForAngle);

	// Spectral flatness maps to spread (tone=narrow, noise=wide)
	// Pure tone (flatness≈0) = narrow spread = focused angular contribution
	// Noise/breath (flatness≈1) = wide spread = diffuse angular contribution
	const spread = 0.1 + spectralFlatness * 0.4; // Range: 0.1 to 0.5 radians

	return {
		time: Date.now() / 1000,
		pitch: smoothedPitch, // Use smoothed value
		energy,
		timbre: {
			spectralCentroid: smoothedSpectralCentroid, // Use smoothed value
			zcr: features.zcr !== undefined && Number.isFinite(features.zcr) ? features.zcr : 0,
			spectralFlux: 0, // Calculate if needed
			spectralFlatness, // NEW: For angular spread
			mfcc: mfcc ? [...mfcc] : [] // NEW: For profile variation
		},
		beat, // GENERATIVE PERFORMANCE: Beat flag
		formant, // SONG MODE: Formant data for phonetic sculpting
		angle, // NEW: Angular position (0-2π)
		spread // NEW: Angular distribution spread
	};
}

/**
 * SONG MODE: Formant Estimation for Phonetic Geometry (#3)
 * Estimates F1 (openness) and F2 (frontness) from audio spectrum
 *
 * Vowel Formant Reference:
 * - "Ah" (father): F1 ~700Hz, F2 ~1100Hz (OPEN, BACK)
 * - "Ee" (see):    F1 ~300Hz, F2 ~2300Hz (CLOSED, FRONT)
 * - "Oo" (boot):   F1 ~300Hz, F2 ~800Hz  (CLOSED, BACK/ROUNDED)
 * - "Eh" (bed):    F1 ~500Hz, F2 ~1800Hz (MID, FRONT)
 * - "Uh" (but):    F1 ~600Hz, F2 ~1200Hz (MID, CENTRAL)
 */
function estimateFormants(
	audioData: Float32Array,
	sampleRate: number,
	energy: number
): { f1: number; f2: number; openness: number; frontness: number } | undefined {
	// Only estimate formants if there's enough energy (voiced speech)
	if (energy < 0.05) {
		return undefined;
	}

	// Simple formant estimation using spectral peak detection
	// This is a simplified approach - production would use LPC analysis
	const fftSize = 512;
	const spectrum = computeSpectrum(audioData, fftSize);

	if (!spectrum || spectrum.length === 0) {
		return undefined;
	}

	// Find peaks in F1 range (250-900 Hz) and F2 range (800-2500 Hz)
	const binSize = sampleRate / fftSize;

	// F1 range bins
	const f1MinBin = Math.floor(250 / binSize);
	const f1MaxBin = Math.ceil(900 / binSize);

	// F2 range bins
	const f2MinBin = Math.floor(800 / binSize);
	const f2MaxBin = Math.ceil(2500 / binSize);

	// Find F1 peak
	let f1Peak = 0;
	let f1Freq = 500; // Default
	for (let i = f1MinBin; i < f1MaxBin && i < spectrum.length; i++) {
		const val = spectrum[i] ?? 0;
		if (val > f1Peak) {
			f1Peak = val;
			f1Freq = i * binSize;
		}
	}

	// Find F2 peak (must be after F1)
	let f2Peak = 0;
	let f2Freq = 1500; // Default
	for (let i = f2MinBin; i < f2MaxBin && i < spectrum.length; i++) {
		const val = spectrum[i] ?? 0;
		if (val > f2Peak) {
			f2Peak = val;
			f2Freq = i * binSize;
		}
	}

	// Apply smoothing
	smoothedF1 = smoothedF1 + (f1Freq - smoothedF1) * FORMANT_SMOOTHING;
	smoothedF2 = smoothedF2 + (f2Freq - smoothedF2) * FORMANT_SMOOTHING;

	// Normalize to 0-1 range
	// F1: 250-900 Hz → openness (higher F1 = more open vowel)
	const openness = Math.max(0, Math.min(1, (smoothedF1 - 250) / (900 - 250)));

	// F2: 800-2500 Hz → frontness (higher F2 = more front vowel)
	const frontness = Math.max(0, Math.min(1, (smoothedF2 - 800) / (2500 - 800)));

	return {
		f1: smoothedF1,
		f2: smoothedF2,
		openness,
		frontness
	};
}

/**
 * Simple FFT-based spectrum computation
 * Returns magnitude spectrum for formant peak detection
 */
function computeSpectrum(audioData: Float32Array, fftSize: number): Float32Array | null {
	if (audioData.length < fftSize) {
		return null;
	}

	// Use Meyda's amplitudeSpectrum if available, otherwise compute manually
	const features = Meyda.extract(['amplitudeSpectrum'], audioData.slice(0, fftSize));

	if (features && features.amplitudeSpectrum) {
		return new Float32Array(features.amplitudeSpectrum);
	}

	return null;
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

	// PERCEPTUAL FIX: Use dB thresholds instead of linear ratios
	// Convert to dB for perceptual comparison (hearing is logarithmic)
	const toDb = (amp: number) => 20 * Math.log10(Math.max(amp, 0.0001));
	const currentDb = toDb(energy);
	const avgDb = toDb(average);
	const BEAT_THRESHOLD_DB = 6; // 6dB louder = clearly perceived accent (perceived as ~2x louder)
	const isBeat = currentDb > avgDb + BEAT_THRESHOLD_DB && energy > 0.05; // Minimum energy gate

	// Apply cooldown to prevent double-triggering
	if (isBeat && now - lastBeatTime > BEAT_COOLDOWN_MS) {
		lastBeatTime = now;
		// Log beats occasionally for debugging
		if (Math.random() < 0.3) {
			// 30% of the time
			console.log(
				`🥁 [BEAT] Detected! Energy: ${currentDb.toFixed(1)}dB vs Avg: ${avgDb.toFixed(1)}dB (threshold: ${(avgDb + BEAT_THRESHOLD_DB).toFixed(1)}dB)`
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
	// Guard against NaN, zero, or negative values which cause -Infinity in Math.log2
	if (!Number.isFinite(pitch) || pitch <= 0) return 0;

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
	let closestInterval = intervals[0] ?? 0;
	let minDistance = Math.abs(semitone - (intervals[0] ?? 0));

	for (const interval of intervals) {
		if (interval === undefined) continue;
		const distance = Math.abs(semitone - interval);
		if (distance < minDistance) {
			minDistance = distance;
			closestInterval = interval;
		}
	}

	// Reconstruct quantized MIDI note
	const quantizedMidi = octave * 12 + (closestInterval ?? 0);

	// Convert back to Hz
	const quantizedPitch = 440 * Math.pow(2, (quantizedMidi - 69) / 12);

	return quantizedPitch;
}

/**
 * ANGULAR DISTRIBUTION: Pitch to Angle Mapper
 * Maps pitch to angular position on the sculpture (0-2π)
 * This creates the spiral effect - low pitches at 0°, high pitches at 360°
 *
 * @param pitch - Pitch in Hz
 * @returns Angle in radians (0-2π)
 */
function mapPitchToAngle(pitch: number): number {
	// Guard against NaN, zero, or negative values which cause -Infinity in Math.log2
	if (!Number.isFinite(pitch) || pitch <= 0) return 0;

	// Map pitch range (80-600 Hz) to angle (0-2π)
	// Using logarithmic scaling for perceptual linearity
	const minPitch = 80; // Low male voice
	const maxPitch = 600; // High soprano

	// Convert to semitones for perceptual mapping
	const semitones = 12 * Math.log2(pitch / minPitch);
	const maxSemitones = 12 * Math.log2(maxPitch / minPitch);

	// Normalize to 0-1 range
	const normalized = Math.max(0, Math.min(1, semitones / maxSemitones));

	// Map to angle (0-2π) - creates spiral
	// One full rotation per octave
	return normalized * Math.PI * 2;
}

function estimatePitch(audioData: Float32Array, sampleRate: number): number | null {
	// IMPROVED autocorrelation with pre-processing for 512-sample buffer

	// Step 1: Pre-process - Remove DC offset and normalize
	let sum = 0;
	for (let i = 0; i < audioData.length; i++) {
		const val = audioData[i];
		if (val !== undefined) {
			sum += val;
		}
	}
	const mean = sum / audioData.length;

	// Create centered signal
	const centered = new Float32Array(audioData.length);
	let maxAbs = 0;
	for (let i = 0; i < audioData.length; i++) {
		const val = audioData[i] ?? 0;
		centered[i] = val - mean;
		maxAbs = Math.max(maxAbs, Math.abs(centered[i] ?? 0));
	}

	// Normalize to prevent very quiet signals from failing
	if (maxAbs > 0) {
		for (let i = 0; i < centered.length; i++) {
			const val = centered[i];
			if (val !== undefined) {
				centered[i] = val / maxAbs;
			}
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
			const val1 = centered[i] ?? 0;
			const val2 = centered[i + period] ?? 0;
			correlation += val1 * val2;
			energy1 += val1 * val1;
			energy2 += val2 * val2;
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
		console.log(
			`🔍 [ANALYSIS WORKER] Ring buffer check: writePtr=${writePtr}, readPtr=${readPtr}, available=${available}, read=${read}`
		);
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
			console.warn(
				'⚠️ [ANALYSIS WORKER] No audio data in ring buffer yet - check worklet connection'
			);
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
				console.warn(
					'⚠️ [ANALYSIS WORKER] Already running - ignoring duplicate start call to prevent concurrent loops'
				);
				return; // Guard against duplicate processLoop chains
			}
			// Reset smoothing state for new recording
			smoothedPitch = 0;
			smoothedSpectralCentroid = 0;
			energyHistory.length = 0;
			console.log('🚀 [ANALYSIS WORKER] Starting analysis loop (smoothing reset)');
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
