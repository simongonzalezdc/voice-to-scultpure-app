/**
 * Multi-Provider AI Adapter
 * Handles API calls to OpenAI, Anthropic, Google, Groq, OpenRouter, Ollama, Together.ai, and DeepSeek
 *
 * Each provider has slightly different API formats - this adapter normalizes them.
 */

import type { CloudProvider } from './providers';
import { PROVIDER_CONFIGS } from './providers';
import { SYSTEM_PROMPT } from './systemPrompt';
import type { SculptorResponse } from './sculptorActions';
import { AISculptorErrorImpl } from './types';

export interface Message {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export interface ProviderOptions {
	provider: CloudProvider;
	apiKey: string;
	model: string;
	temperature?: number;
	maxTokens?: number;
}

/**
 * Call the AI provider and get a structured response
 */
export async function callProvider(
	messages: Message[],
	options: ProviderOptions
): Promise<SculptorResponse> {
	const { provider, apiKey, model, temperature = 0.7, maxTokens = 2000 } = options;
	const config = PROVIDER_CONFIGS[provider];

	if (!config) {
		throw new AISculptorErrorImpl(`Unknown provider: ${provider}`, 'INIT_FAILED');
	}

	// Ollama doesn't need an API key (local)
	if (!apiKey && provider !== 'ollama') {
		throw new AISculptorErrorImpl(`API key required for ${config.name}`, 'INIT_FAILED');
	}

	// Add system prompt to messages if not present
	const fullMessages =
		messages[0]?.role === 'system'
			? messages
			: [{ role: 'system' as const, content: SYSTEM_PROMPT }, ...messages];

	try {
		let response: Response;
		let content: string;

		switch (provider) {
			case 'anthropic':
				({ response, content } = await callAnthropic(
					config,
					apiKey,
					model,
					fullMessages,
					temperature,
					maxTokens
				));
				break;
			case 'google':
				({ response, content } = await callGoogle(
					config,
					apiKey,
					model,
					fullMessages,
					temperature,
					maxTokens
				));
				break;
			case 'ollama':
				({ response, content } = await callOllama(
					config,
					model,
					fullMessages,
					temperature,
					maxTokens
				));
				break;
		case 'openai':
		case 'groq':
		case 'openrouter':
		case 'together':
		case 'deepseek':
		case 'zhipu':
		default:
			({ response, content } = await callOpenAICompatible(
					config,
					apiKey,
					model,
					fullMessages,
					temperature,
					maxTokens,
					provider
				));
				break;
		}

		if (!response.ok) {
			const errorText = await response.text().catch(() => 'Unknown error');
			throw new AISculptorErrorImpl(
				`${config.name} API error: ${response.status} - ${errorText}`,
				'API_ERROR'
			);
		}

		// Parse the response
		return parseResponse(content);
	} catch (error) {
		if (error instanceof AISculptorErrorImpl) {
			throw error;
		}
		throw new AISculptorErrorImpl(
			`Network error calling ${config.name}: ${error instanceof Error ? error.message : String(error)}`,
			'NETWORK_ERROR'
		);
	}
}

/**
 * OpenAI-compatible API (OpenAI, Groq, OpenRouter)
 */
async function callOpenAICompatible(
	config: (typeof PROVIDER_CONFIGS)[CloudProvider],
	apiKey: string,
	model: string,
	messages: Message[],
	temperature: number,
	maxTokens: number,
	provider: CloudProvider
): Promise<{ response: Response; content: string }> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		[config.authHeader]: `${config.authPrefix}${apiKey}`
	};

	// OpenRouter requires additional headers
	if (provider === 'openrouter') {
		headers['HTTP-Referer'] =
			typeof window !== 'undefined' ? window.location.origin : 'https://voice-to-sculpture.app';
		headers['X-Title'] = 'Voice-to-Sculpture Studio';
	}

	const body: Record<string, unknown> = {
		model,
		messages,
		temperature,
		max_tokens: maxTokens
	};

	// Request JSON mode if supported
	const modelConfig = config.models.find((m) => m.id === model);
	if (modelConfig?.supportsJson) {
		body.response_format = { type: 'json_object' };
	}

	const response = await fetch(`${config.baseUrl}/chat/completions`, {
		method: 'POST',
		headers,
		body: JSON.stringify(body)
	});

	const data = await response.json();
	const content = data.choices?.[0]?.message?.content || '';

	return { response, content };
}

/**
 * Anthropic Claude API
 */
async function callAnthropic(
	config: (typeof PROVIDER_CONFIGS)[CloudProvider],
	apiKey: string,
	model: string,
	messages: Message[],
	temperature: number,
	maxTokens: number
): Promise<{ response: Response; content: string }> {
	// Anthropic uses a different format - system message is separate
	const systemMessage = messages.find((m) => m.role === 'system')?.content || SYSTEM_PROMPT;
	const chatMessages = messages
		.filter((m) => m.role !== 'system')
		.map((m) => ({ role: m.role, content: m.content }));

	const response = await fetch(`${config.baseUrl}/messages`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model,
			system: systemMessage,
			messages: chatMessages,
			temperature,
			max_tokens: maxTokens
		})
	});

	const data = await response.json();
	const content = data.content?.[0]?.text || '';

	return { response, content };
}

/**
 * Google Gemini API
 */
async function callGoogle(
	config: (typeof PROVIDER_CONFIGS)[CloudProvider],
	apiKey: string,
	model: string,
	messages: Message[],
	temperature: number,
	maxTokens: number
): Promise<{ response: Response; content: string }> {
	// Google uses a different format
	const systemInstruction = messages.find((m) => m.role === 'system')?.content || SYSTEM_PROMPT;
	const contents = messages
		.filter((m) => m.role !== 'system')
		.map((m) => ({
			role: m.role === 'assistant' ? 'model' : 'user',
			parts: [{ text: m.content }]
		}));

	const response = await fetch(`${config.baseUrl}/models/${model}:generateContent?key=${apiKey}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			systemInstruction: { parts: [{ text: systemInstruction }] },
			contents,
			generationConfig: {
				temperature,
				maxOutputTokens: maxTokens,
				responseMimeType: 'application/json'
			}
		})
	});

	const data = await response.json();
	const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

	return { response, content };
}

/**
 * Ollama API (Local LLMs)
 * Uses different endpoint structure than OpenAI-compatible
 */
async function callOllama(
	config: (typeof PROVIDER_CONFIGS)[CloudProvider],
	model: string,
	messages: Message[],
	temperature: number,
	maxTokens: number
): Promise<{ response: Response; content: string }> {
	const response = await fetch(`${config.baseUrl}/chat`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model,
			messages: messages.map((m) => ({
				role: m.role,
				content: m.content
			})),
			stream: false,
			options: {
				temperature,
				num_predict: maxTokens
			},
			format: 'json' // Request JSON output
		})
	});

	const data = await response.json();
	const content = data.message?.content || '';

	return { response, content };
}

/**
 * Parse AI response into structured SculptorResponse
 */
function parseResponse(content: string): SculptorResponse {
	if (!content) {
		throw new AISculptorErrorImpl('Empty response from AI', 'PARSE_ERROR');
	}

	// Try to parse directly
	try {
		const parsed = JSON.parse(content);
		validateResponse(parsed);
		return parsed;
	} catch (e) {
		// Try to extract JSON from markdown code blocks
		const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
		if (jsonMatch && jsonMatch[1]) {
			try {
				const parsed = JSON.parse(jsonMatch[1]);
				validateResponse(parsed);
				return parsed;
			} catch {
				// Fall through to error
			}
		}

		// Try to find JSON object anywhere in the content
		const objectMatch = content.match(/\{[\s\S]*"actions"[\s\S]*\}/);
		if (objectMatch) {
			try {
				const parsed = JSON.parse(objectMatch[0]);
				validateResponse(parsed);
				return parsed;
			} catch {
				// Fall through to error
			}
		}

		throw new AISculptorErrorImpl(
			`Failed to parse AI response as JSON: ${content.slice(0, 200)}...`,
			'PARSE_ERROR'
		);
	}
}

/**
 * Validate the response structure
 */
function validateResponse(response: unknown): asserts response is SculptorResponse {
	if (!response || typeof response !== 'object') {
		throw new AISculptorErrorImpl('Response is not an object', 'SCHEMA_ERROR');
	}

	const r = response as Record<string, unknown>;

	if (typeof r.explanation !== 'string') {
		throw new AISculptorErrorImpl('Response missing explanation string', 'SCHEMA_ERROR');
	}

	if (!Array.isArray(r.actions)) {
		throw new AISculptorErrorImpl('Response missing actions array', 'SCHEMA_ERROR');
	}

	for (const action of r.actions) {
		if (!action || typeof action !== 'object') {
			throw new AISculptorErrorImpl('Invalid action in response', 'SCHEMA_ERROR');
		}
		const a = action as Record<string, unknown>;
		if (typeof a.type !== 'string') {
			throw new AISculptorErrorImpl('Action missing type', 'SCHEMA_ERROR');
		}
		if (!a.params || typeof a.params !== 'object') {
			throw new AISculptorErrorImpl('Action missing params object', 'SCHEMA_ERROR');
		}
	}
}

/**
 * Test API connection
 */
export async function testConnection(provider: CloudProvider, apiKey: string): Promise<boolean> {
	try {
		// Ollama doesn't need an API key
		const effectiveKey = provider === 'ollama' ? '' : apiKey;

		const response = await callProvider(
			[
				{
					role: 'user',
					content: 'Respond with: {"explanation":"test","actions":[],"suggestions":[]}'
				}
			],
			{
				provider,
				apiKey: effectiveKey,
				model: PROVIDER_CONFIGS[provider].models[0]?.id || '',
				maxTokens: 50
			}
		);
		return response.actions !== undefined;
	} catch {
		return false;
	}
}

/**
 * Check if Ollama is available (running locally)
 */
export async function checkOllamaAvailable(): Promise<boolean> {
	try {
		const response = await fetch('http://localhost:11434/api/tags', {
			method: 'GET'
		});
		return response.ok;
	} catch {
		return false;
	}
}

/**
 * Get available Ollama models (dynamically detected)
 */
export async function getOllamaModels(): Promise<string[]> {
	try {
		const response = await fetch('http://localhost:11434/api/tags', {
			method: 'GET'
		});
		if (!response.ok) return [];

		const data = await response.json();
		return data.models?.map((m: { name: string }) => m.name) || [];
	} catch {
		return [];
	}
}
