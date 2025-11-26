/**
 * Song Mode Controller
 * 
 * Wires together all Song Mode components:
 * - Speech-to-Text → Lyrics Buffer
 * - Lyrics → AI Sentiment → Glaze Colors
 * - Formant Data → Sculpting Parameters
 * - Mood → Environment (BETA)
 * - Lyrics → Material (BETA)
 */

import { browser } from '$app/environment';
import {
	songModeStore,
	addLyricPhrase,
	updateSentiment,
	updateMood,
	updateMaterial,
	updateFormant,
	setAIStatus,
	getRecentLyrics,
	sentimentToColor,
	hslToHex,
	formantToSculptParams,
	CINEMATIC_PRESETS,
	type FormantData
} from '$lib/stores/songModeStore.svelte';
import { uiStore, setEnvironment, setLightingAngle } from '$lib/stores/uiStore.svelte';
import { analysisStore } from '$lib/stores/analysisStore.svelte';
import {
	createBrowserSpeechToText,
	type SpeechToTextService
} from '$lib/ai/speechToText';
import {
	analyzeSentiment,
	classifyMood,
	extractMaterial,
	analyzeSentimentOffline,
	classifyMoodOffline
} from '$lib/ai/songModeAI';
import { appSettings } from '$lib/stores/appSettingsStore.svelte';

// ============================================================================
// STATE
// ============================================================================

let speechService: SpeechToTextService | null = null;
let sentimentTimer: ReturnType<typeof setInterval> | null = null;
let moodTimer: ReturnType<typeof setInterval> | null = null;
let materialTimer: ReturnType<typeof setInterval> | null = null;
let formantTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

// Timing constants
const SENTIMENT_INTERVAL_MS = 5000; // Analyze sentiment every 5 seconds
const MOOD_INTERVAL_MS = 15000; // Classify mood every 15 seconds (BETA - less frequent)
const MATERIAL_INTERVAL_MS = 20000; // Extract material every 20 seconds (BETA - less frequent)
const FORMANT_APPLY_INTERVAL_MS = 100; // Apply formant data every 100ms

// ============================================================================
// SPEECH-TO-TEXT → LYRICS BUFFER
// ============================================================================

function initSpeechToText(): void {
	if (!browser) return;

	speechService = createBrowserSpeechToText({
		continuous: true,
		interimResults: true,
		lang: 'en-US',
		onResult: (text, isFinal) => {
			if (isFinal && text.trim().length > 0) {
				addLyricPhrase(text.trim());
				console.log(`🎤 [SONG CTRL] Captured phrase: "${text.trim()}"`);
			}
		},
		onError: (error) => {
			console.warn(`⚠️ [SONG CTRL] Speech error: ${error}`);
			songModeStore.status.speechToText = 'error';
		},
		onEnd: () => {
			// Auto-restart if still in song mode
			if (songModeStore.enabled && isRunning) {
				setTimeout(() => {
					if (speechService && songModeStore.enabled) {
						speechService.start();
					}
				}, 100);
			}
		}
	});
}

// ============================================================================
// SENTIMENT ANALYSIS → GLAZE COLORS
// ============================================================================

async function processSentiment(): Promise<void> {
	if (!songModeStore.layers.narrative) return;

	const lyrics = getRecentLyrics(3); // Last 3 phrases
	if (!lyrics || lyrics.length < 5) return;

	setAIStatus('sentimentAI', 'processing');

	try {
		// Try AI analysis first, fallback to offline
		let sentiment;
		if (appSettings.apiKey) {
			sentiment = await analyzeSentiment(lyrics);
		}

		if (!sentiment) {
			sentiment = analyzeSentimentOffline(lyrics);
		}

		if (sentiment) {
			updateSentiment(sentiment);
			applySentimentToGlaze(sentiment);
		}
	} catch (error) {
		console.error('❌ [SONG CTRL] Sentiment analysis failed:', error);
		setAIStatus('sentimentAI', 'error');
	}
}

function applySentimentToGlaze(sentiment: typeof songModeStore.currentSentiment): void {
	if (!sentiment) return;

	const hsl = sentimentToColor(sentiment);
	const hexColor = hslToHex(hsl.h, hsl.s, hsl.l);

	// Update the active glaze color
	uiStore.activeGlaze.color = hexColor;

	// Also adjust roughness based on energy
	// High energy = glossy (low roughness), low energy = matte (high roughness)
	const roughness = 0.7 - sentiment.energy * 0.4; // Range: 0.3 to 0.7
	uiStore.activeGlaze.roughness = Math.max(0.1, Math.min(1, roughness));

	console.log(
		`🎨 [SONG CTRL] Applied sentiment color: ${hexColor} (valence: ${sentiment.valence.toFixed(2)}, energy: ${sentiment.energy.toFixed(2)})`
	);
}

// ============================================================================
// MOOD CLASSIFICATION → ENVIRONMENT (BETA)
// ============================================================================

async function processMood(): Promise<void> {
	if (!songModeStore.layers.atmosphere) return;

	const lyrics = getRecentLyrics(5); // Last 5 phrases for more context
	if (!lyrics || lyrics.length < 10) return;

	setAIStatus('moodAI', 'processing');

	try {
		let mood;
		if (appSettings.apiKey) {
			mood = await classifyMood(lyrics);
		}

		if (!mood) {
			mood = classifyMoodOffline(lyrics);
		}

		if (mood) {
			updateMood(mood);
			applyMoodToEnvironment(mood);
		}
	} catch (error) {
		console.error('❌ [SONG CTRL] Mood classification failed:', error);
		setAIStatus('moodAI', 'error');
	}
}

function applyMoodToEnvironment(mood: typeof songModeStore.currentMood): void {
	if (!mood) return;

	const preset = CINEMATIC_PRESETS[mood.mood];
	if (!preset) return;

	// Apply environment with smooth transition
	setEnvironment(preset.environment, true);

	// Apply lighting angle with smooth transition
	setLightingAngle(preset.lightingAngle, true);

	console.log(`🎬 [SONG MODE] Cinematic transition: ${mood.mood} → ${preset.environment}`);

	// Note: Bloom and zoom would need PostProcessing integration
	// For now, we just apply environment and lighting with smooth transitions

	console.log(`🌤️ [SONG CTRL] Applied mood preset: ${mood.mood} → ${preset.environment}`);
}

// ============================================================================
// MATERIAL EXTRACTION (BETA)
// ============================================================================

async function processMaterial(): Promise<void> {
	if (!songModeStore.layers.material) return;
	if (!appSettings.apiKey) return; // Material requires AI

	const lyrics = getRecentLyrics(5);
	if (!lyrics || lyrics.length < 15) return;

	setAIStatus('materialAI', 'processing');

	try {
		const material = await extractMaterial(lyrics);

		if (material) {
			updateMaterial(material);
			applyMaterialToGlaze(material);
		}
	} catch (error) {
		console.error('❌ [SONG CTRL] Material extraction failed:', error);
		setAIStatus('materialAI', 'error');
	}
}

function applyMaterialToGlaze(material: typeof songModeStore.currentMaterial): void {
	if (!material) return;

	// Apply material properties to active glaze
	uiStore.activeGlaze.roughness = material.roughness;
	uiStore.activeGlaze.transmission = material.transmission;
	uiStore.activeGlaze.color = material.color;

	console.log(`🎨 [SONG CTRL] Applied material: ${material.description}`);
}

// ============================================================================
// FORMANT DATA → SCULPTING PARAMETERS + PHONETIC LANCE TRIGGER
// ============================================================================

// Threshold for detecting fricatives (S, F, SH sounds)
const FRICATIVE_F2_THRESHOLD = 2200; // Hz - high F2 indicates fricatives
const FRICATIVE_ZCR_THRESHOLD = 0.4; // Zero-crossing rate threshold for noisy sounds
const PLOSIVE_ENERGY_SPIKE_THRESHOLD = 0.7; // Energy threshold for plosive detection

// Track last tool type to avoid rapid switching
let lastPhoneticToolType: 'brush' | 'lance-carve' | null = null;
let toolSwitchCooldown = 0;
const TOOL_SWITCH_COOLDOWN_MS = 200; // Prevent jittery switching

function processFormant(): void {
	if (!songModeStore.layers.phonetic) return;

	// Get latest formant from analysis store
	const latestFrame = analysisStore.latestFrame;
	if (!latestFrame?.formant) return;

	const formant = latestFrame.formant as FormantData;
	updateFormant(formant);

	// Apply formant to sculpting parameters
	const params = formantToSculptParams(formant);

	// Apply to deformation (subtle effect)
	// Twist modulation based on vowel frontness
	const currentTwist = uiStore.deformation.twist;
	const targetTwist = currentTwist + params.twistModulation * 0.1;
	uiStore.deformation.twist = Math.max(-5, Math.min(5, targetTwist));

	// Apply symmetry boost for rounded vowels (Oo sound)
	if (params.symmetryBoost > 0 && uiStore.modifiers.symmetryCount < 2) {
		// Temporarily boost symmetry for rounded vowels
		// This creates a pulsing effect
	}

	// =========================================================================
	// PHONETIC LANCE TRIGGER: Auto-switch tool based on phoneme type
	// Fricatives (S, F, SH) → Lance mode for carving
	// Vowels (A, E, O) → Brush mode for shaping
	// =========================================================================

	// Only activate in Force workspace
	if (uiStore.workspace !== 'force') return;

	// Check cooldown to prevent jittery switching
	const now = Date.now();
	if (now - toolSwitchCooldown < TOOL_SWITCH_COOLDOWN_MS) return;

	// Get zero-crossing rate for fricative detection
	const zcr = latestFrame.timbre?.zcr ?? 0;
	const energy = analysisStore.micLevel;

	// Detect fricatives: High F2 + high ZCR (noisy spectrum)
	const isFricative = formant.f2 > FRICATIVE_F2_THRESHOLD && zcr > FRICATIVE_ZCR_THRESHOLD;

	// Detect plosives: Sudden energy spike (P, T, K sounds)
	// Note: This is a simplified detection - real plosive detection would need onset analysis
	const isPlosive = energy > PLOSIVE_ENERGY_SPIKE_THRESHOLD && zcr > 0.5;

	// Determine target tool type
	let targetToolType: 'brush' | 'lance-carve' | null = null;

	if (isFricative || isPlosive) {
		targetToolType = 'lance-carve';
	} else if (formant.f1 > 300 && formant.f1 < 1000) {
		// Clear vowel detected (F1 in typical vowel range)
		targetToolType = 'brush';
	}

	// Apply tool switch if different from current
	if (targetToolType && targetToolType !== lastPhoneticToolType) {
		uiStore.forceParams.toolType = targetToolType;
		lastPhoneticToolType = targetToolType;
		toolSwitchCooldown = now;

		if (targetToolType === 'lance-carve') {
			console.log(`🗡️ [SONG CTRL] Phonetic Lance triggered (${isFricative ? 'fricative' : 'plosive'} detected)`);
		} else {
			console.log(`🖌️ [SONG CTRL] Phonetic Brush restored (vowel detected)`);
		}
	}
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Start Song Mode - activates all enabled layers
 */
export function startSongMode(): void {
	if (isRunning) {
		console.warn('⚠️ [SONG CTRL] Already running');
		return;
	}

	if (!browser) return;

	console.log('🎵 [SONG CTRL] Starting Song Mode...');
	isRunning = true;

	// Initialize and start speech-to-text
	if (!speechService) {
		initSpeechToText();
	}

	if (speechService?.isSupported()) {
		speechService.start();
		songModeStore.status.speechToText = 'listening';
	} else {
		console.warn('⚠️ [SONG CTRL] Speech recognition not supported');
		songModeStore.status.speechToText = 'error';
	}

	// Start sentiment analysis timer (Core feature)
	if (songModeStore.layers.narrative) {
		sentimentTimer = setInterval(processSentiment, SENTIMENT_INTERVAL_MS);
		console.log('💚 [SONG CTRL] Sentiment analysis started');
	}

	// Start mood classification timer (Beta)
	if (songModeStore.layers.atmosphere) {
		moodTimer = setInterval(processMood, MOOD_INTERVAL_MS);
		console.log('🌤️ [SONG CTRL] Mood classification started (BETA)');
	}

	// Start material extraction timer (Beta)
	if (songModeStore.layers.material) {
		materialTimer = setInterval(processMaterial, MATERIAL_INTERVAL_MS);
		console.log('🎨 [SONG CTRL] Material extraction started (BETA)');
	}

	// Start formant processing (real-time)
	if (songModeStore.layers.phonetic) {
		formantTimer = setInterval(processFormant, FORMANT_APPLY_INTERVAL_MS);
		console.log('🔊 [SONG CTRL] Formant processing started');
	}

	console.log('✅ [SONG CTRL] Song Mode fully started');
}

/**
 * Stop Song Mode - deactivates all layers
 */
export function stopSongMode(): void {
	if (!isRunning) return;

	console.log('🛑 [SONG CTRL] Stopping Song Mode...');
	isRunning = false;

	// Stop speech-to-text
	if (speechService) {
		speechService.stop();
		songModeStore.status.speechToText = 'idle';
	}

	// Clear all timers
	if (sentimentTimer) {
		clearInterval(sentimentTimer);
		sentimentTimer = null;
	}
	if (moodTimer) {
		clearInterval(moodTimer);
		moodTimer = null;
	}
	if (materialTimer) {
		clearInterval(materialTimer);
		materialTimer = null;
	}
	if (formantTimer) {
		clearInterval(formantTimer);
		formantTimer = null;
	}

	// Reset AI statuses
	setAIStatus('sentimentAI', 'idle');
	setAIStatus('moodAI', 'idle');
	setAIStatus('materialAI', 'idle');

	console.log('✅ [SONG CTRL] Song Mode stopped');
}

/**
 * Check if Song Mode is currently running
 */
export function isSongModeRunning(): boolean {
	return isRunning;
}

/**
 * Restart Song Mode with current layer settings
 */
export function restartSongMode(): void {
	stopSongMode();
	setTimeout(() => startSongMode(), 100);
}

/**
 * Process a single formant frame (called from analysis store subscriber)
 */
export function processFormantFrame(formant: FormantData): void {
	if (!songModeStore.enabled || !songModeStore.layers.phonetic) return;
	updateFormant(formant);
}

/**
 * Force immediate sentiment analysis (useful after significant lyrics change)
 */
export function forceProcessSentiment(): void {
	if (songModeStore.enabled && songModeStore.layers.narrative) {
		processSentiment();
	}
}

