/**
 * Phrase Detection Store
 * P1: Musical phrase-level analysis for "human compatible" shapes
 * Groups raw frames into musical units (2-4 second phrases)
 */

import type { AnalysisFrame } from '$lib/types';

// ============================================================================
// PHRASE TYPES
// ============================================================================

export type PhraseType = 
	| 'crescendo'      // Building up in volume
	| 'decrescendo'    // Fading down in volume
	| 'sustained'      // Holding a note
	| 'staccato'       // Short, punchy notes
	| 'silence'        // No sound
	| 'attack'         // Sharp beginning
	| 'release';       // Fading end

export type PhraseContour = 
	| 'rising'         // Pitch going up
	| 'falling'        // Pitch going down
	| 'stable'         // Pitch staying same
	| 'arc'            // Up then down
	| 'valley';        // Down then up

export interface MusicalPhrase {
	id: string;
	type: PhraseType;
	contour: PhraseContour;
	
	// Timing
	startFrame: number;
	endFrame: number;
	duration: number; // seconds
	
	// Summary statistics
	avgPitch: number;
	avgEnergy: number;
	pitchRange: { min: number; max: number };
	energyRange: { min: number; max: number };
	
	// Musical qualities
	intensity: number;      // 0-1 overall power of phrase
	expressiveness: number; // 0-1 how much variation (vibrato, dynamics)
	stability: number;      // 0-1 how steady the pitch/volume
	
	// Beat information
	beatCount: number;
	isRhythmic: boolean;
	
	// Shape recommendations (how this phrase should affect the sculpture)
	shapeInfluence: {
		radiusModifier: number;     // -1 to 1, how to adjust radius
		smoothness: number;         // 0-1, how smooth the surface should be
		textureIntensity: number;   // 0-1, how much detail/noise
		growthRate: number;         // 0-1, how fast to grow during this phrase
	};
}

// ============================================================================
// PHRASE DETECTION CONFIG
// ============================================================================

const PHRASE_CONFIG = {
	// Minimum phrase duration in seconds
	minDuration: 0.5,
	// Maximum phrase duration in seconds (beyond this, split into multiple phrases)
	maxDuration: 4.0,
	// Energy threshold to detect start of phrase
	silenceThreshold: 0.02,
	// Minimum change in pitch to detect contour (Hz)
	pitchChangeThreshold: 20,
	// Minimum change in energy to detect dynamics
	energyChangeThreshold: 0.1,
	// Window size for smoothing (frames)
	smoothingWindow: 5,
	// Frames between phrase boundary checks
	analysisInterval: 15 // ~0.5 seconds at 30fps
};

// ============================================================================
// PHRASE STORE STATE
// ============================================================================

interface PhraseState {
	// All detected phrases in current session
	phrases: MusicalPhrase[];
	
	// Current phrase being built
	currentPhrase: Partial<MusicalPhrase> | null;
	
	// Recent frames buffer for phrase detection
	frameBuffer: AnalysisFrame[];
	
	// Summary of current musical expression
	currentExpression: {
		type: PhraseType;
		contour: PhraseContour;
		intensity: number;
	};
	
	// Statistics
	totalPhrases: number;
	avgPhraseDuration: number;
}

export const phraseStore = $state<PhraseState>({
	phrases: [],
	currentPhrase: null,
	frameBuffer: [],
	currentExpression: {
		type: 'silence',
		contour: 'stable',
		intensity: 0
	},
	totalPhrases: 0,
	avgPhraseDuration: 0
});

// ============================================================================
// PHRASE DETECTION FUNCTIONS
// ============================================================================

let frameCounter = 0;
let phraseIdCounter = 0;

/**
 * Add a frame to the phrase detector
 */
export function addFrame(frame: AnalysisFrame): void {
	phraseStore.frameBuffer.push(frame);
	frameCounter++;
	
	// Limit buffer size (keep ~10 seconds of history)
	const maxBufferSize = 300;
	if (phraseStore.frameBuffer.length > maxBufferSize) {
		phraseStore.frameBuffer = phraseStore.frameBuffer.slice(-maxBufferSize);
	}
	
	// Check for phrase boundaries periodically
	if (frameCounter % PHRASE_CONFIG.analysisInterval === 0) {
		analyzeCurrentPhrase();
	}
	
	// Update real-time expression
	updateCurrentExpression();
}

/**
 * Analyze the frame buffer to detect phrase boundaries
 */
function analyzeCurrentPhrase(): void {
	const buffer = phraseStore.frameBuffer;
	if (buffer.length < 30) return; // Need at least 1 second
	
	// Get recent frames (last ~2 seconds)
	const recentFrames = buffer.slice(-60);
	
	// Calculate statistics
	const stats = calculateFrameStats(recentFrames);
	
	// Check if we're in a phrase or silence
	const isInPhrase = stats.avgEnergy > PHRASE_CONFIG.silenceThreshold;
	
	// Start new phrase
	if (isInPhrase && !phraseStore.currentPhrase) {
		phraseStore.currentPhrase = {
			id: `phrase_${phraseIdCounter++}`,
			startFrame: buffer.length - recentFrames.length,
			avgPitch: stats.avgPitch,
			avgEnergy: stats.avgEnergy
		};
	}
	
	// End current phrase
	if (!isInPhrase && phraseStore.currentPhrase) {
		finishPhrase(recentFrames);
	}
	
	// Check if phrase is too long
	if (phraseStore.currentPhrase) {
		const currentDuration = (buffer.length - (phraseStore.currentPhrase.startFrame ?? 0)) / 30;
		if (currentDuration > PHRASE_CONFIG.maxDuration) {
			finishPhrase(recentFrames);
		}
	}
}

/**
 * Finish and store the current phrase
 */
function finishPhrase(recentFrames: AnalysisFrame[]): void {
	if (!phraseStore.currentPhrase) return;
	
	const buffer = phraseStore.frameBuffer;
	const startFrame = phraseStore.currentPhrase.startFrame ?? 0;
	const endFrame = buffer.length;
	const phraseFrames = buffer.slice(startFrame, endFrame);
	
	if (phraseFrames.length < 15) {
		// Too short, discard
		phraseStore.currentPhrase = null;
		return;
	}
	
	const stats = calculateFrameStats(phraseFrames);
	const contour = detectContour(phraseFrames);
	const type = detectPhraseType(phraseFrames, stats);
	const shapeInfluence = calculateShapeInfluence(type, contour, stats);
	
	const phrase: MusicalPhrase = {
		id: phraseStore.currentPhrase.id ?? `phrase_${phraseIdCounter++}`,
		type,
		contour,
		startFrame,
		endFrame,
		duration: phraseFrames.length / 30,
		avgPitch: stats.avgPitch,
		avgEnergy: stats.avgEnergy,
		pitchRange: stats.pitchRange,
		energyRange: stats.energyRange,
		intensity: stats.avgEnergy,
		expressiveness: stats.expressiveness,
		stability: stats.stability,
		beatCount: phraseFrames.filter(f => f.beat).length,
		isRhythmic: phraseFrames.filter(f => f.beat).length > 2,
		shapeInfluence
	};
	
	phraseStore.phrases.push(phrase);
	phraseStore.totalPhrases++;
	
	// Update average duration
	const durations = phraseStore.phrases.map(p => p.duration);
	phraseStore.avgPhraseDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
	
	console.log(`🎵 [PHRASE] Detected: ${type} (${contour}), ${phrase.duration.toFixed(1)}s, intensity=${phrase.intensity.toFixed(2)}`);
	
	phraseStore.currentPhrase = null;
}

/**
 * Calculate statistics from a set of frames
 */
function calculateFrameStats(frames: AnalysisFrame[]): {
	avgPitch: number;
	avgEnergy: number;
	pitchRange: { min: number; max: number };
	energyRange: { min: number; max: number };
	expressiveness: number;
	stability: number;
} {
	const validPitches = frames.filter(f => f.pitch > 0).map(f => f.pitch);
	const energies = frames.map(f => f.energy);
	
	const avgPitch = validPitches.length > 0 
		? validPitches.reduce((a, b) => a + b, 0) / validPitches.length 
		: 0;
	const avgEnergy = energies.reduce((a, b) => a + b, 0) / energies.length;
	
	const pitchRange = validPitches.length > 0 
		? { min: Math.min(...validPitches), max: Math.max(...validPitches) }
		: { min: 0, max: 0 };
	const energyRange = { min: Math.min(...energies), max: Math.max(...energies) };
	
	// Expressiveness: how much variation in pitch and energy
	const pitchVariance = validPitches.length > 1 
		? calculateVariance(validPitches) 
		: 0;
	const energyVariance = calculateVariance(energies);
	const expressiveness = Math.min(1, (pitchVariance / 1000 + energyVariance * 10) / 2);
	
	// Stability: inverse of variance
	const stability = 1 - expressiveness;
	
	return {
		avgPitch,
		avgEnergy,
		pitchRange,
		energyRange,
		expressiveness,
		stability
	};
}

/**
 * Detect melodic contour of a phrase
 */
function detectContour(frames: AnalysisFrame[]): PhraseContour {
	const validPitches = frames.filter(f => f.pitch > 0).map(f => f.pitch);
	if (validPitches.length < 5) return 'stable';
	
	// Split into halves
	const mid = Math.floor(validPitches.length / 2);
	const firstHalf = validPitches.slice(0, mid);
	const secondHalf = validPitches.slice(mid);
	
	const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
	const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
	
	const diff = secondAvg - firstAvg;
	const threshold = PHRASE_CONFIG.pitchChangeThreshold;
	
	if (Math.abs(diff) < threshold) return 'stable';
	if (diff > threshold) return 'rising';
	if (diff < -threshold) return 'falling';
	
	// Check for arc or valley
	const quarterLen = Math.floor(validPitches.length / 4);
	const q1 = validPitches.slice(0, quarterLen);
	const q2 = validPitches.slice(quarterLen, mid);
	const q3 = validPitches.slice(mid, mid + quarterLen);
	const q4 = validPitches.slice(mid + quarterLen);
	
	const q1Avg = average(q1);
	const q2Avg = average(q2);
	const q3Avg = average(q3);
	const q4Avg = average(q4);
	
	// Arc: rises then falls
	if (q2Avg > q1Avg && q3Avg > q4Avg) return 'arc';
	// Valley: falls then rises
	if (q2Avg < q1Avg && q3Avg < q4Avg) return 'valley';
	
	return 'stable';
}

/**
 * Detect phrase type based on energy dynamics
 */
function detectPhraseType(frames: AnalysisFrame[], stats: ReturnType<typeof calculateFrameStats>): PhraseType {
	const energies = frames.map(f => f.energy);
	
	// Check for silence
	if (stats.avgEnergy < PHRASE_CONFIG.silenceThreshold) {
		return 'silence';
	}
	
	// Split into halves for trend detection
	const mid = Math.floor(energies.length / 2);
	const firstHalf = energies.slice(0, mid);
	const secondHalf = energies.slice(mid);
	
	const firstAvg = average(firstHalf);
	const secondAvg = average(secondHalf);
	
	const diff = secondAvg - firstAvg;
	const threshold = PHRASE_CONFIG.energyChangeThreshold;
	
	// Check for sharp attack at beginning
	const firstFew = energies.slice(0, 5);
	const restAvg = average(energies.slice(5));
	if (Math.max(...firstFew) > restAvg * 2) {
		return 'attack';
	}
	
	// Check for fade at end
	const lastFew = energies.slice(-5);
	const beforeEnd = average(energies.slice(0, -5));
	if (average(lastFew) < beforeEnd * 0.3) {
		return 'release';
	}
	
	// Crescendo: getting louder
	if (diff > threshold) return 'crescendo';
	
	// Decrescendo: getting quieter
	if (diff < -threshold) return 'decrescendo';
	
	// Check for staccato (many short bursts)
	const zeroCrossings = countZeroCrossings(energies, stats.avgEnergy);
	if (zeroCrossings > frames.length / 10) {
		return 'staccato';
	}
	
	// Sustained: relatively constant
	return 'sustained';
}

/**
 * Calculate shape influence based on phrase characteristics
 */
function calculateShapeInfluence(
	type: PhraseType, 
	contour: PhraseContour, 
	stats: ReturnType<typeof calculateFrameStats>
): MusicalPhrase['shapeInfluence'] {
	// Default influence
	const influence = {
		radiusModifier: 0,
		smoothness: 0.5,
		textureIntensity: 0.5,
		growthRate: 0.5
	};
	
	// Phrase type affects radius and texture
	switch (type) {
		case 'crescendo':
			influence.radiusModifier = 0.3; // Bulge outward
			influence.growthRate = 0.8;
			break;
		case 'decrescendo':
			influence.radiusModifier = -0.2; // Taper inward
			influence.growthRate = 0.3;
			break;
		case 'sustained':
			influence.smoothness = 0.8; // Very smooth
			influence.textureIntensity = 0.2;
			break;
		case 'staccato':
			influence.smoothness = 0.2; // Angular
			influence.textureIntensity = 0.8;
			break;
		case 'attack':
			influence.radiusModifier = 0.5; // Sharp bulge
			influence.smoothness = 0.3;
			break;
		case 'release':
			influence.radiusModifier = -0.3; // Taper
			influence.smoothness = 0.7;
			break;
	}
	
	// Contour affects overall shape trend
	switch (contour) {
		case 'rising':
			influence.radiusModifier -= 0.1; // Higher pitch = narrower
			break;
		case 'falling':
			influence.radiusModifier += 0.1; // Lower pitch = wider
			break;
		case 'arc':
			// Arc shape in the profile
			influence.smoothness = 0.7;
			break;
		case 'valley':
			// Valley shape
			influence.smoothness = 0.6;
			break;
	}
	
	// Expressiveness affects texture
	influence.textureIntensity = Math.max(0.1, Math.min(0.9, stats.expressiveness));
	
	return influence;
}

/**
 * Update the real-time current expression
 */
function updateCurrentExpression(): void {
	const recentFrames = phraseStore.frameBuffer.slice(-15); // Last 0.5 seconds
	if (recentFrames.length < 5) return;
	
	const stats = calculateFrameStats(recentFrames);
	const type = detectPhraseType(recentFrames, stats);
	const contour = detectContour(recentFrames);
	
	phraseStore.currentExpression = {
		type,
		contour,
		intensity: stats.avgEnergy
	};
}

/**
 * Clear phrase history
 */
export function clearPhrases(): void {
	phraseStore.phrases = [];
	phraseStore.currentPhrase = null;
	phraseStore.frameBuffer = [];
	phraseStore.totalPhrases = 0;
	phraseStore.avgPhraseDuration = 0;
	frameCounter = 0;
}

/**
 * Get the most recent phrase
 */
export function getLastPhrase(): MusicalPhrase | null {
	return phraseStore.phrases[phraseStore.phrases.length - 1] ?? null;
}

/**
 * Get phrases within a time range
 */
export function getPhrasesInRange(startFrame: number, endFrame: number): MusicalPhrase[] {
	return phraseStore.phrases.filter(
		p => p.startFrame >= startFrame && p.endFrame <= endFrame
	);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculateVariance(arr: number[]): number {
	if (arr.length < 2) return 0;
	const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
	const squareDiffs = arr.map(x => Math.pow(x - mean, 2));
	return squareDiffs.reduce((a, b) => a + b, 0) / arr.length;
}

function average(arr: number[]): number {
	if (arr.length === 0) return 0;
	return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function countZeroCrossings(arr: number[], threshold: number): number {
	if (arr.length < 2) return 0;
	
	let crossings = 0;
	let wasAbove = (arr[0] ?? 0) > threshold;
	
	for (let i = 1; i < arr.length; i++) {
		const value = arr[i];
		if (value === undefined) continue;
		const isAbove = value > threshold;
		if (isAbove !== wasAbove) {
			crossings++;
			wasAbove = isAbove;
		}
	}
	
	return crossings;
}

