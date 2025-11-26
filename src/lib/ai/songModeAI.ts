/**
 * Song Mode AI Service
 * 
 * Lightweight AI analysis for Song Mode features:
 * - #2 Narrative Strata: Sentiment analysis (valence/energy) → colors
 * - #5 Atmospheric Resonance: Mood classification → environment (BETA)
 * - #1 Material Metaphor: Material extraction → PBR properties (BETA)
 * 
 * Uses the unified MultiProviderAdapter for all AI calls, supporting:
 * - OpenAI, Anthropic, Google, Groq, OpenRouter (cloud)
 * - Ollama (local network)
 * - Together.ai, DeepSeek (budget-friendly)
 */

import type { SentimentScore, MoodClassification, MaterialSuggestion } from '$lib/stores/songModeStore.svelte';
import { appSettings } from '$lib/stores/appSettingsStore.svelte';
import { PROVIDER_CONFIGS, type CloudProvider } from './providers';

// ============================================================================
// PROMPTS
// ============================================================================

const SENTIMENT_PROMPT = `You are analyzing song lyrics for emotional content.
Given the lyrics, respond with JSON only:
{
  "valence": <number -1 to 1, negative=sad/angry, positive=happy/hopeful>,
  "energy": <number -1 to 1, low=calm/quiet, high=energetic/intense>
}
No explanation, just JSON.`;

const MOOD_PROMPT = `You are classifying the mood of song lyrics.
Given the lyrics, respond with JSON only:
{
  "mood": <one of: "intimate", "triumphant", "ethereal", "melancholic", "energetic">,
  "confidence": <number 0-1>
}
No explanation, just JSON.`;

const MATERIAL_PROMPT = `You are an artist extracting material/texture qualities from song lyrics.
Given the lyrics, suggest PBR material properties that match the feeling.
Respond with JSON only:
{
  "roughness": <0-1, 0=glossy/smooth, 1=matte/rough>,
  "transmission": <0-1, 0=opaque, 1=transparent/glass>,
  "color": <hex color that matches the mood>,
  "emissive": <0-1, 0=no glow, 1=bright glow>,
  "description": <brief description of the material>
}
No explanation, just JSON.`;

// ============================================================================
// PROVIDER HELPERS
// ============================================================================

/**
 * Get the default lightweight model for each provider (optimized for speed/cost)
 */
function getDefaultModelForProvider(provider: CloudProvider): string {
	const defaults: Record<CloudProvider, string> = {
		openai: 'gpt-4o-mini',
		anthropic: 'claude-3-haiku-20240307',
		google: 'gemini-1.5-flash',
		groq: 'llama-3.1-8b-instant', // Free tier, fast
		openrouter: 'meta-llama/llama-3.3-70b-instruct',
		ollama: 'llama3.2:3b',
		together: 'meta-llama/Llama-3.2-3B-Instruct-Turbo', // Free tier
		deepseek: 'deepseek-chat'
	};
	return defaults[provider] || 'gpt-4o-mini';
}

/**
 * Get the current active provider and API key
 */
function getActiveProvider(): { provider: CloudProvider; apiKey: string; model: string } {
	const provider = (appSettings.cloudProvider || 'openai') as CloudProvider;
	const apiKey = appSettings.apiKeys?.[provider] || appSettings.apiKey || '';
	const model = appSettings.selectedModel || getDefaultModelForProvider(provider);

	return { provider, apiKey, model };
}

// ============================================================================
// API CALL HELPER (Multi-Provider)
// ============================================================================

interface AIResponse {
	success: boolean;
	data?: unknown;
	error?: string;
}

/**
 * Call AI using the configured provider (unified multi-provider support)
 */
async function callAI(prompt: string, lyrics: string): Promise<AIResponse> {
	const { provider, apiKey, model } = getActiveProvider();
	const config = PROVIDER_CONFIGS[provider];

	// Ollama doesn't need an API key
	if (!apiKey && provider !== 'ollama') {
		return { success: false, error: `No API key configured for ${config?.name || provider}` };
	}

	try {
		let response: Response;
		let content: string;

		// Route to appropriate API format
		if (provider === 'ollama') {
			// Ollama uses different endpoint
			response = await fetch(`${config.baseUrl}/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model,
					messages: [
						{ role: 'system', content: prompt },
						{ role: 'user', content: `Lyrics: "${lyrics}"` }
					],
					stream: false,
					options: { temperature: 0.3, num_predict: 150 },
					format: 'json'
				})
			});
			const data = await response.json();
			content = data.message?.content || '';
		} else if (provider === 'anthropic') {
			// Anthropic uses different format
			response = await fetch(`${config.baseUrl}/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01'
				},
				body: JSON.stringify({
					model,
					system: prompt,
					messages: [{ role: 'user', content: `Lyrics: "${lyrics}"` }],
					temperature: 0.3,
					max_tokens: 150
				})
			});
			const data = await response.json();
			content = data.content?.[0]?.text || '';
		} else if (provider === 'google') {
			// Google Gemini uses different format
			response = await fetch(
				`${config.baseUrl}/models/${model}:generateContent?key=${apiKey}`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						systemInstruction: { parts: [{ text: prompt }] },
						contents: [{ role: 'user', parts: [{ text: `Lyrics: "${lyrics}"` }] }],
						generationConfig: {
							temperature: 0.3,
							maxOutputTokens: 150,
							responseMimeType: 'application/json'
						}
					})
				}
			);
			const data = await response.json();
			content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
		} else {
			// OpenAI-compatible: OpenAI, Groq, OpenRouter, Together.ai, DeepSeek
			const headers: Record<string, string> = {
				'Content-Type': 'application/json',
				[config.authHeader]: `${config.authPrefix}${apiKey}`
			};

			// OpenRouter requires additional headers
			if (provider === 'openrouter') {
				headers['HTTP-Referer'] = typeof window !== 'undefined'
					? window.location.origin
					: 'https://voice-to-sculpture.app';
				headers['X-Title'] = 'Voice-to-Sculpture Studio';
			}

			response = await fetch(`${config.baseUrl}/chat/completions`, {
				method: 'POST',
				headers,
				body: JSON.stringify({
					model,
					messages: [
						{ role: 'system', content: prompt },
						{ role: 'user', content: `Lyrics: "${lyrics}"` }
					],
					max_tokens: 150,
					temperature: 0.3,
					// Request JSON mode if supported
					...(config.models.find(m => m.id === model)?.supportsJson
						? { response_format: { type: 'json_object' } }
						: {})
				})
			});
			const data = await response.json();
			content = data.choices?.[0]?.message?.content || '';
		}

		if (!response.ok) {
			return { success: false, error: `API error: ${response.statusText}` };
		}

		if (!content) {
			return { success: false, error: 'Empty response from AI' };
		}

		// Parse JSON from response
		const jsonMatch = content.match(/\{[\s\S]*\}/);
		if (!jsonMatch) {
			return { success: false, error: 'No JSON in response' };
		}

		const data = JSON.parse(jsonMatch[0]);
		return { success: true, data };
	} catch (error) {
		return { success: false, error: `Request failed: ${error}` };
	}
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * #2 Narrative Strata: Analyze lyrics for sentiment (valence/energy)
 * Used to color the sculpture based on emotional content
 */
export async function analyzeSentiment(lyrics: string): Promise<SentimentScore | null> {
	if (!lyrics || lyrics.trim().length < 5) {
		return null;
	}

	console.log(`🎭 [SONG AI] Analyzing sentiment for: "${lyrics.slice(0, 50)}..."`);

	const result = await callAI(SENTIMENT_PROMPT, lyrics);

	if (!result.success || !result.data) {
		console.warn(`⚠️ [SONG AI] Sentiment analysis failed: ${result.error}`);
		return null;
	}

	const data = result.data as { valence?: number; energy?: number };

	// Validate and clamp values
	const valence = Math.max(-1, Math.min(1, data.valence ?? 0));
	const energy = Math.max(-1, Math.min(1, data.energy ?? 0));

	return {
		valence,
		energy,
		timestamp: Date.now()
	};
}

/**
 * #5 Atmospheric Resonance (BETA): Classify mood for environment changes
 */
export async function classifyMood(lyrics: string): Promise<MoodClassification | null> {
	if (!lyrics || lyrics.trim().length < 10) {
		return null;
	}

	console.log(`🌤️ [SONG AI] Classifying mood for: "${lyrics.slice(0, 50)}..."`);

	const result = await callAI(MOOD_PROMPT, lyrics);

	if (!result.success || !result.data) {
		console.warn(`⚠️ [SONG AI] Mood classification failed: ${result.error}`);
		return null;
	}

	const data = result.data as { mood?: string; confidence?: number };

	// Validate mood
	const validMoods = ['intimate', 'triumphant', 'ethereal', 'melancholic', 'energetic'] as const;
	const mood = validMoods.includes(data.mood as typeof validMoods[number])
		? (data.mood as typeof validMoods[number])
		: 'intimate';

	return {
		mood,
		confidence: Math.max(0, Math.min(1, data.confidence ?? 0.5)),
		timestamp: Date.now()
	};
}

/**
 * #1 Material Metaphor (BETA): Extract material properties from lyrics
 */
export async function extractMaterial(lyrics: string): Promise<MaterialSuggestion | null> {
	if (!lyrics || lyrics.trim().length < 10) {
		return null;
	}

	console.log(`🎨 [SONG AI] Extracting material for: "${lyrics.slice(0, 50)}..."`);

	const result = await callAI(MATERIAL_PROMPT, lyrics);

	if (!result.success || !result.data) {
		console.warn(`⚠️ [SONG AI] Material extraction failed: ${result.error}`);
		return null;
	}

	const data = result.data as {
		roughness?: number;
		transmission?: number;
		color?: string;
		emissive?: number;
		description?: string;
	};

	return {
		roughness: Math.max(0, Math.min(1, data.roughness ?? 0.5)),
		transmission: Math.max(0, Math.min(1, data.transmission ?? 0.3)),
		color: data.color && /^#[0-9A-Fa-f]{6}$/.test(data.color) ? data.color : '#FFFFFF',
		emissive: Math.max(0, Math.min(1, data.emissive ?? 0)),
		description: data.description ?? 'No description',
		timestamp: Date.now()
	};
}

// ============================================================================
// FALLBACK (OFFLINE) ANALYSIS
// ============================================================================

/**
 * Simple keyword-based sentiment for offline use
 * Less accurate but works without API
 */
export function analyzeSentimentOffline(lyrics: string): SentimentScore {
	const text = lyrics.toLowerCase();

	// Simple keyword analysis
	const positiveWords = ['love', 'happy', 'joy', 'hope', 'light', 'sun', 'dance', 'smile', 'free', 'dream'];
	const negativeWords = ['sad', 'pain', 'dark', 'lost', 'cry', 'broken', 'fear', 'alone', 'cold', 'hate'];
	const energeticWords = ['run', 'jump', 'fire', 'loud', 'fast', 'wild', 'burn', 'explode', 'rush', 'power'];
	const calmWords = ['soft', 'quiet', 'peace', 'gentle', 'slow', 'calm', 'sleep', 'rest', 'still', 'whisper'];

	let valence = 0;
	let energy = 0;

	for (const word of positiveWords) {
		if (text.includes(word)) valence += 0.2;
	}
	for (const word of negativeWords) {
		if (text.includes(word)) valence -= 0.2;
	}
	for (const word of energeticWords) {
		if (text.includes(word)) energy += 0.2;
	}
	for (const word of calmWords) {
		if (text.includes(word)) energy -= 0.2;
	}

	return {
		valence: Math.max(-1, Math.min(1, valence)),
		energy: Math.max(-1, Math.min(1, energy)),
		timestamp: Date.now()
	};
}

/**
 * Simple keyword-based mood for offline use
 */
export function classifyMoodOffline(lyrics: string): MoodClassification {
	const sentiment = analyzeSentimentOffline(lyrics);

	let mood: MoodClassification['mood'];

	if (sentiment.energy > 0.3) {
		mood = sentiment.valence > 0 ? 'energetic' : 'triumphant';
	} else if (sentiment.energy < -0.3) {
		mood = sentiment.valence > 0 ? 'ethereal' : 'melancholic';
	} else {
		mood = 'intimate';
	}

	return {
		mood,
		confidence: 0.5, // Lower confidence for offline
		timestamp: Date.now()
	};
}

