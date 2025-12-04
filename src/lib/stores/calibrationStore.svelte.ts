/**
 * Voice Calibration Store
 * Tracks user's vocal range, dynamics, and creates personalized mappings
 * P0: Critical for "human compatibility" - makes the experience personal
 */

export type CalibrationStep = 
	| 'idle'
	| 'low-note'      // Sing your lowest comfortable note
	| 'high-note'     // Sing your highest comfortable note
	| 'loud'          // Sing as loud as you can
	| 'soft'          // Whisper gently
	| 'processing'    // Analyzing calibration data
	| 'complete';     // Calibration finished

export interface VoiceCalibration {
	// Pitch range (Hz)
	pitchLow: number;
	pitchHigh: number;
	pitchComfortable: number; // Middle of their range
	
	// Energy/volume range (0-1 normalized RMS)
	energyFloor: number;     // Quietest they can sing
	energyCeiling: number;   // Loudest they can sing
	energyComfortable: number;
	
	// Timbre characteristics
	timbreFloor: number;     // Baseline spectral centroid
	timbreCeiling: number;   // Max "brightness"
	
	// Derived mappings
	pitchToRadius: (pitch: number) => number;   // Maps their pitch range to 0-1
	energyToScale: (energy: number) => number;  // Maps their energy range to 0-1
	
	// Calibration quality
	confidence: number;      // 0-1, how confident we are in the calibration
	timestamp: number;       // When calibration was performed
}

interface CalibrationSample {
	pitch: number;
	energy: number;
	timbre: number;
	timestamp: number;
}

interface CalibrationState {
	step: CalibrationStep;
	samples: {
		lowNote: CalibrationSample[];
		highNote: CalibrationSample[];
		loud: CalibrationSample[];
		soft: CalibrationSample[];
	};
	result: VoiceCalibration | null;
	isCalibrated: boolean;
	error: string | null;
}

// Default calibration for uncalibrated users
const DEFAULT_CALIBRATION: VoiceCalibration = {
	pitchLow: 80,
	pitchHigh: 600,
	pitchComfortable: 220,
	energyFloor: 0.01,
	energyCeiling: 0.8,
	energyComfortable: 0.3,
	timbreFloor: 1000,
	timbreCeiling: 4000,
	pitchToRadius: (pitch: number) => {
		const range = 600 - 80;
		return Math.max(0, Math.min(1, (pitch - 80) / range));
	},
	energyToScale: (energy: number) => {
		return Math.max(0, Math.min(1, (energy - 0.01) / 0.79));
	},
	confidence: 0,
	timestamp: 0
};

export const calibrationStore = $state<CalibrationState>({
	step: 'idle',
	samples: {
		lowNote: [],
		highNote: [],
		loud: [],
		soft: []
	},
	result: null,
	isCalibrated: false,
	error: null
});

// Minimum samples needed per step for valid calibration
const MIN_SAMPLES_PER_STEP = 30; // ~1 second at 30fps
const SAMPLE_DURATION_MS = 2000; // 2 seconds per step

let sampleCollectionTimer: ReturnType<typeof setTimeout> | null = null;
let stepStartTime = 0;

/**
 * Start the calibration process
 */
export function startCalibration(): void {
	calibrationStore.step = 'low-note';
	calibrationStore.samples = {
		lowNote: [],
		highNote: [],
		loud: [],
		soft: []
	};
	calibrationStore.result = null;
	calibrationStore.error = null;
	stepStartTime = Date.now();
	
	console.log('🎤 [CALIBRATION] Starting voice calibration...');
}

/**
 * Add a sample during calibration
 */
export function addCalibrationSample(pitch: number, energy: number, timbre: number): void {
	if (calibrationStore.step === 'idle' || calibrationStore.step === 'complete' || calibrationStore.step === 'processing') {
		return;
	}
	
	const sample: CalibrationSample = {
		pitch,
		energy,
		timbre,
		timestamp: Date.now()
	};
	
	switch (calibrationStore.step) {
		case 'low-note':
			calibrationStore.samples.lowNote.push(sample);
			break;
		case 'high-note':
			calibrationStore.samples.highNote.push(sample);
			break;
		case 'loud':
			calibrationStore.samples.loud.push(sample);
			break;
		case 'soft':
			calibrationStore.samples.soft.push(sample);
			break;
	}
}

/**
 * Move to next calibration step
 */
export function nextCalibrationStep(): void {
	const stepOrder: CalibrationStep[] = ['low-note', 'high-note', 'loud', 'soft', 'processing'];
	const currentIndex = stepOrder.indexOf(calibrationStore.step);
	
	if (currentIndex >= 0 && currentIndex < stepOrder.length - 1) {
		const nextStep = stepOrder[currentIndex + 1];
		if (nextStep) {
			calibrationStore.step = nextStep;
			stepStartTime = Date.now();
			console.log(`🎤 [CALIBRATION] Moving to step: ${nextStep}`);
			
			if (nextStep === 'processing') {
				processCalibration();
			}
		}
	}
}

/**
 * Skip calibration and use defaults
 */
export function skipCalibration(): void {
	calibrationStore.step = 'complete';
	calibrationStore.result = DEFAULT_CALIBRATION;
	calibrationStore.isCalibrated = false; // Still false since we used defaults
	console.log('⏭️ [CALIBRATION] Skipped, using default voice mapping');
}

/**
 * Process collected samples and create calibration
 */
function processCalibration(): void {
	console.log('🔬 [CALIBRATION] Processing samples...');
	
	try {
		const { lowNote, highNote, loud, soft } = calibrationStore.samples;
		
		// Validate we have enough samples
		if (lowNote.length < MIN_SAMPLES_PER_STEP / 2) {
			throw new Error('Not enough low note samples. Please try again.');
		}
		
		// Extract pitch range from low/high note samples
		// Filter out silence (energy < threshold) and invalid pitch (0)
		const validLowPitches = lowNote.filter(s => s.energy > 0.02 && s.pitch > 0).map(s => s.pitch);
		const validHighPitches = highNote.filter(s => s.energy > 0.02 && s.pitch > 0).map(s => s.pitch);
		
		// Use percentiles to avoid outliers
		const pitchLow = validLowPitches.length > 0 
			? percentile(validLowPitches, 25) 
			: DEFAULT_CALIBRATION.pitchLow;
		const pitchHigh = validHighPitches.length > 0 
			? percentile(validHighPitches, 75) 
			: DEFAULT_CALIBRATION.pitchHigh;
		const pitchComfortable = (pitchLow + pitchHigh) / 2;
		
		// Extract energy range from loud/soft samples
		const loudEnergies = loud.filter(s => s.energy > 0).map(s => s.energy);
		const softEnergies = soft.filter(s => s.energy > 0).map(s => s.energy);
		
		const energyCeiling = loudEnergies.length > 0 
			? percentile(loudEnergies, 90) 
			: DEFAULT_CALIBRATION.energyCeiling;
		const energyFloor = softEnergies.length > 0 
			? percentile(softEnergies, 10) 
			: DEFAULT_CALIBRATION.energyFloor;
		const energyComfortable = (energyFloor + energyCeiling) / 2;
		
		// Extract timbre range
		const allTimbres = [...lowNote, ...highNote, ...loud, ...soft]
			.filter(s => s.timbre > 0)
			.map(s => s.timbre);
		const timbreFloor = allTimbres.length > 0 ? percentile(allTimbres, 10) : DEFAULT_CALIBRATION.timbreFloor;
		const timbreCeiling = allTimbres.length > 0 ? percentile(allTimbres, 90) : DEFAULT_CALIBRATION.timbreCeiling;
		
		// Calculate confidence based on sample counts and variance
		const sampleCount = lowNote.length + highNote.length + loud.length + soft.length;
		const expectedSamples = MIN_SAMPLES_PER_STEP * 4;
		const sampleConfidence = Math.min(1, sampleCount / expectedSamples);
		
		// Create mapping functions
		const pitchRange = Math.max(1, pitchHigh - pitchLow);
		const energyRange = Math.max(0.01, energyCeiling - energyFloor);
		
		const result: VoiceCalibration = {
			pitchLow,
			pitchHigh,
			pitchComfortable,
			energyFloor,
			energyCeiling,
			energyComfortable,
			timbreFloor,
			timbreCeiling,
			pitchToRadius: (pitch: number) => {
				// Map pitch to 0-1, inverted so low pitch = wide (1), high pitch = narrow (0)
				const normalized = (pitch - pitchLow) / pitchRange;
				return Math.max(0, Math.min(1, 1 - normalized)); // Inverted
			},
			energyToScale: (energy: number) => {
				return Math.max(0, Math.min(1, (energy - energyFloor) / energyRange));
			},
			confidence: sampleConfidence,
			timestamp: Date.now()
		};
		
		calibrationStore.result = result;
		calibrationStore.isCalibrated = true;
		calibrationStore.step = 'complete';
		
		console.log('✅ [CALIBRATION] Complete!', {
			pitchRange: `${pitchLow.toFixed(0)}-${pitchHigh.toFixed(0)} Hz`,
			energyRange: `${energyFloor.toFixed(3)}-${energyCeiling.toFixed(3)}`,
			confidence: `${(sampleConfidence * 100).toFixed(0)}%`
		});
		
		// Persist to localStorage
		try {
			localStorage.setItem('voice-calibration', JSON.stringify({
				...result,
				pitchToRadius: null, // Can't serialize functions
				energyToScale: null
			}));
		} catch (e) {
			console.warn('Could not persist calibration to localStorage');
		}
		
	} catch (error) {
		calibrationStore.error = error instanceof Error ? error.message : 'Calibration failed';
		calibrationStore.step = 'idle';
		console.error('❌ [CALIBRATION] Failed:', error);
	}
}

/**
 * Load calibration from localStorage
 */
export function loadSavedCalibration(): boolean {
	try {
		const saved = localStorage.getItem('voice-calibration');
		if (!saved) return false;
		
		const data = JSON.parse(saved);
		if (!data.pitchLow || !data.pitchHigh) return false;
		
		// Reconstruct mapping functions
		const pitchRange = Math.max(1, data.pitchHigh - data.pitchLow);
		const energyRange = Math.max(0.01, data.energyCeiling - data.energyFloor);
		
		const result: VoiceCalibration = {
			...data,
			pitchToRadius: (pitch: number) => {
				const normalized = (pitch - data.pitchLow) / pitchRange;
				return Math.max(0, Math.min(1, 1 - normalized));
			},
			energyToScale: (energy: number) => {
				return Math.max(0, Math.min(1, (energy - data.energyFloor) / energyRange));
			}
		};
		
		calibrationStore.result = result;
		calibrationStore.isCalibrated = true;
		calibrationStore.step = 'complete';
		
		console.log('📂 [CALIBRATION] Loaded saved calibration');
		return true;
	} catch {
		return false;
	}
}

/**
 * Get current calibration or default
 */
export function getCalibration(): VoiceCalibration {
	return calibrationStore.result ?? DEFAULT_CALIBRATION;
}

/**
 * Reset calibration
 */
export function resetCalibration(): void {
	calibrationStore.step = 'idle';
	calibrationStore.samples = {
		lowNote: [],
		highNote: [],
		loud: [],
		soft: []
	};
	calibrationStore.result = null;
	calibrationStore.isCalibrated = false;
	calibrationStore.error = null;
	
	try {
		localStorage.removeItem('voice-calibration');
	} catch {
		// Ignore
	}
	
	console.log('🔄 [CALIBRATION] Reset');
}

// Utility: Calculate percentile
function percentile(arr: number[], p: number): number {
	if (arr.length === 0) return 0;
	const sorted = [...arr].sort((a, b) => a - b);
	const index = Math.ceil((p / 100) * sorted.length) - 1;
	return sorted[Math.max(0, index)] ?? 0;
}

// Check progress for current step
export function getStepProgress(): number {
	const elapsed = Date.now() - stepStartTime;
	return Math.min(1, elapsed / SAMPLE_DURATION_MS);
}

// Get human-readable instruction for current step
export function getStepInstruction(): string {
	switch (calibrationStore.step) {
		case 'low-note':
			return 'Sing your LOWEST comfortable note and hold it...';
		case 'high-note':
			return 'Now sing your HIGHEST comfortable note and hold it...';
		case 'loud':
			return 'Sing as LOUD as you comfortably can...';
		case 'soft':
			return 'Now whisper gently or sing very softly...';
		case 'processing':
			return 'Analyzing your voice...';
		case 'complete':
			return 'Calibration complete! Your sculpture will respond to YOUR voice.';
		default:
			return 'Ready to calibrate your voice?';
	}
}

