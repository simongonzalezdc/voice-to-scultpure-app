/**
 * Song Mode Store - AI-Enhanced Lyrical Sculpting
 * 
 * The Song Mode Stack:
 * - Layer 1 (Shape): Formant-based geometry (real-time, no AI)
 * - Layer 2 (Color): AI sentiment → Glaze colors (5-10 sec buffer)
 * - Layer 3 (Atmosphere): AI mood → Environment/Lighting (10-15 sec buffer)
 * - Beta: Material Metaphor → PBR properties from lyrics
 */

// ============================================================================
// TYPES
// ============================================================================

export interface FormantData {
	f1: number; // First formant (vowel openness) - 300-800 Hz
	f2: number; // Second formant (vowel frontness) - 800-2500 Hz
	openness: number; // Normalized 0-1 (closed → open)
	frontness: number; // Normalized 0-1 (back → front)
}

export interface SentimentScore {
	valence: number; // -1 (negative) to 1 (positive)
	energy: number; // -1 (calm) to 1 (energetic)
	timestamp: number;
}

export interface MoodClassification {
	mood: 'intimate' | 'triumphant' | 'ethereal' | 'melancholic' | 'energetic';
	confidence: number; // 0-1
	timestamp: number;
}

export interface MaterialSuggestion {
	roughness: number; // 0-1
	transmission: number; // 0-1 (transparency)
	color: string; // Hex color
	emissive: number; // 0-1 (glow)
	description: string; // AI's reasoning
	timestamp: number;
}

export interface LyricPhrase {
	text: string;
	startTime: number;
	endTime: number;
	sentiment?: SentimentScore;
	mood?: MoodClassification;
	material?: MaterialSuggestion;
}

// Cinematic presets for Atmospheric Resonance
export interface CinematicPreset {
	name: string;
	environment: 'studio' | 'neon' | 'darkroom';
	lightingAngle: number;
	bloom: number;
	zoom: number;
	rotationSpeed: number; // 0 = static, >0 = auto-orbit
}

export const CINEMATIC_PRESETS: Record<string, CinematicPreset> = {
	intimate: {
		name: 'Intimate',
		environment: 'darkroom',
		lightingAngle: Math.PI / 4, // Dramatic side light
		bloom: 0.2,
		zoom: 1.8, // Close-up
		rotationSpeed: 0
	},
	triumphant: {
		name: 'Triumphant',
		environment: 'studio',
		lightingAngle: 0, // Heroic front light
		bloom: 0.8,
		zoom: 1.2, // Pull back to show scale
		rotationSpeed: 0.1
	},
	ethereal: {
		name: 'Ethereal',
		environment: 'neon',
		lightingAngle: Math.PI / 2,
		bloom: 1.2,
		zoom: 1.4,
		rotationSpeed: 0.05
	},
	melancholic: {
		name: 'Melancholic',
		environment: 'darkroom',
		lightingAngle: Math.PI * 0.75, // Backlight
		bloom: 0.3,
		zoom: 1.6,
		rotationSpeed: 0
	},
	energetic: {
		name: 'Energetic',
		environment: 'neon',
		lightingAngle: 0,
		bloom: 1.0,
		zoom: 1.0,
		rotationSpeed: 0.2
	}
};

// ============================================================================
// STORE STATE
// ============================================================================

export const songModeStore = $state<{
	// Master toggle
	enabled: boolean;

	// Layer toggles
	layers: {
		phonetic: boolean; // #3 Formant → Shape (real-time) - CORE
		narrative: boolean; // #2 Sentiment → Color (AI) - CORE
		atmosphere: boolean; // #5 Mood → Environment (AI) - BETA
		material: boolean; // #1 Material Metaphor (AI) - BETA
	};

	// Real-time formant data (updated every frame)
	currentFormant: FormantData | null;

	// Lyrics buffer (phrases collected over time)
	lyricsBuffer: LyricPhrase[];
	currentPhrase: string;

	// AI analysis results
	currentSentiment: SentimentScore | null;
	currentMood: MoodClassification | null;
	currentMaterial: MaterialSuggestion | null;

	// Target cinematic preset (for smooth transitions)
	targetPreset: CinematicPreset | null;

	// Processing status
	status: {
		speechToText: 'idle' | 'listening' | 'processing' | 'error';
		sentimentAI: 'idle' | 'processing' | 'ready' | 'error';
		moodAI: 'idle' | 'processing' | 'ready' | 'error';
		materialAI: 'idle' | 'processing' | 'ready' | 'error';
	};

	// Timing
	lastSentimentUpdate: number;
	lastMoodUpdate: number;
	lastMaterialUpdate: number;
}>({
	enabled: false,

	layers: {
		phonetic: true, // Default ON - core real-time feature
		narrative: true, // Default ON - core AI feature
		atmosphere: false, // Default OFF - BETA feature
		material: false // Default OFF - BETA feature
	},

	currentFormant: null,
	lyricsBuffer: [],
	currentPhrase: '',

	currentSentiment: null,
	currentMood: null,
	currentMaterial: null,

	targetPreset: null,

	status: {
		speechToText: 'idle',
		sentimentAI: 'idle',
		moodAI: 'idle',
		materialAI: 'idle'
	},

	lastSentimentUpdate: 0,
	lastMoodUpdate: 0,
	lastMaterialUpdate: 0
});

// ============================================================================
// ACTIONS
// ============================================================================

export function enableSongMode(): void {
	songModeStore.enabled = true;
	console.log('🎵 [SONG MODE] Enabled');
}

export function disableSongMode(): void {
	songModeStore.enabled = false;
	songModeStore.lyricsBuffer = [];
	songModeStore.currentPhrase = '';
	songModeStore.currentSentiment = null;
	songModeStore.currentMood = null;
	songModeStore.currentMaterial = null;
	console.log('🎵 [SONG MODE] Disabled');
}

export function toggleSongModeLayer(
	layer: 'phonetic' | 'narrative' | 'atmosphere' | 'material'
): void {
	songModeStore.layers[layer] = !songModeStore.layers[layer];
	console.log(`🎵 [SONG MODE] ${layer} layer: ${songModeStore.layers[layer] ? 'ON' : 'OFF'}`);
}

export function updateFormant(formant: FormantData): void {
	songModeStore.currentFormant = formant;
}

export function addLyricPhrase(text: string): void {
	const phrase: LyricPhrase = {
		text,
		startTime: Date.now(),
		endTime: Date.now()
	};
	songModeStore.lyricsBuffer.push(phrase);
	songModeStore.currentPhrase = text;

	// Keep only last 20 phrases (memory management)
	if (songModeStore.lyricsBuffer.length > 20) {
		songModeStore.lyricsBuffer = songModeStore.lyricsBuffer.slice(-20);
	}

	console.log(`🎤 [SONG MODE] Phrase: "${text}"`);
}

export function updateSentiment(sentiment: SentimentScore): void {
	songModeStore.currentSentiment = sentiment;
	songModeStore.lastSentimentUpdate = Date.now();
	songModeStore.status.sentimentAI = 'ready';

	// Update the most recent phrase with sentiment
	if (songModeStore.lyricsBuffer.length > 0) {
		const lastIndex = songModeStore.lyricsBuffer.length - 1;
		const lastPhrase = songModeStore.lyricsBuffer[lastIndex];
		if (lastPhrase) {
			songModeStore.lyricsBuffer[lastIndex] = { ...lastPhrase, sentiment };
		}
	}

	console.log(
		`💚 [SONG MODE] Sentiment: valence=${sentiment.valence.toFixed(2)}, energy=${sentiment.energy.toFixed(2)}`
	);
}

export function updateMood(mood: MoodClassification): void {
	songModeStore.currentMood = mood;
	songModeStore.lastMoodUpdate = Date.now();
	songModeStore.status.moodAI = 'ready';

	// Set target cinematic preset
	songModeStore.targetPreset = CINEMATIC_PRESETS[mood.mood] ?? null;

	console.log(`🎭 [SONG MODE] Mood: ${mood.mood} (${(mood.confidence * 100).toFixed(0)}% confidence)`);
}

export function updateMaterial(material: MaterialSuggestion): void {
	songModeStore.currentMaterial = material;
	songModeStore.lastMaterialUpdate = Date.now();
	songModeStore.status.materialAI = 'ready';

	console.log(`🎨 [SONG MODE] Material suggestion: ${material.description}`);
}

export function setAIStatus(
	type: 'sentimentAI' | 'moodAI' | 'materialAI',
	status: 'idle' | 'processing' | 'ready' | 'error'
): void {
	songModeStore.status[type] = status;
}

export function clearLyricsBuffer(): void {
	songModeStore.lyricsBuffer = [];
	songModeStore.currentPhrase = '';
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get recent lyrics as a single string (for AI analysis)
 */
export function getRecentLyrics(maxPhrases: number = 5): string {
	return songModeStore.lyricsBuffer
		.slice(-maxPhrases)
		.map((p) => p.text)
		.join(' ');
}

/**
 * Map sentiment to HSL color for glaze
 * Valence: blue (-1) → gold (+1)
 * Energy: desaturated (-1) → saturated (+1)
 */
export function sentimentToColor(sentiment: SentimentScore): { h: number; s: number; l: number } {
	// Hue: blue (220) for negative, gold (45) for positive
	const h = Math.round(((sentiment.valence + 1) / 2) * (45 - 220) + 220);
	// Normalize to 0-360
	const hNormalized = ((h % 360) + 360) % 360;

	// Saturation: 30% at low energy, 90% at high energy
	const s = Math.round(((sentiment.energy + 1) / 2) * 60 + 30);

	// Lightness: slightly brighter for positive, darker for negative
	const l = Math.round(((sentiment.valence + 1) / 2) * 20 + 40);

	return { h: hNormalized, s, l };
}

/**
 * Convert HSL to hex color
 */
export function hslToHex(h: number, s: number, l: number): string {
	s /= 100;
	l /= 100;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
		return Math.round(255 * color)
			.toString(16)
			.padStart(2, '0');
	};
	return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Map formant data to sculpting parameters
 * F1 (openness) → radius expansion
 * F2 (frontness) → twist modulation
 */
export function formantToSculptParams(formant: FormantData): {
	radiusMultiplier: number;
	twistModulation: number;
	symmetryBoost: number;
} {
	return {
		// Open vowels (Ah, Oh) expand radius
		radiusMultiplier: 0.8 + formant.openness * 0.4, // 0.8 to 1.2

		// Front vowels (Ee, Ay) add twist
		twistModulation: (formant.frontness - 0.5) * 0.5, // -0.25 to +0.25

		// Rounded vowels (Oo) add symmetry
		symmetryBoost: formant.openness < 0.3 && formant.frontness < 0.5 ? 2 : 0
	};
}

