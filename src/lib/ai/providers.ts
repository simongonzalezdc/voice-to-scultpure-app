/**
 * AI Provider Configurations
 *
 * Defines all supported AI providers and their models.
 */

export type CloudProvider = 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter' | 'ollama' | 'together' | 'deepseek';
export type AIProviderType = CloudProvider | 'local';

export interface ModelConfig {
	id: string;
	name: string;
	contextWindow: number;
	maxOutput: number;
	supportsJson: boolean;
	cost: 'free' | 'low' | 'medium' | 'high';
}

export interface ProviderConfig {
	name: string;
	baseUrl: string;
	authHeader: string;
	authPrefix: string;
	models: ModelConfig[];
	keyFormat?: string; // Regex pattern for API key validation
}

export const PROVIDER_CONFIGS: Record<CloudProvider, ProviderConfig> = {
	openai: {
		name: 'OpenAI',
		baseUrl: 'https://api.openai.com/v1',
		authHeader: 'Authorization',
		authPrefix: 'Bearer ',
		keyFormat: '^sk-[a-zA-Z0-9-_]+$',
		models: [
			{
				id: 'gpt-4o',
				name: 'GPT-4o',
				contextWindow: 128000,
				maxOutput: 16384,
				supportsJson: true,
				cost: 'medium'
			},
			{
				id: 'gpt-4o-mini',
				name: 'GPT-4o Mini',
				contextWindow: 128000,
				maxOutput: 16384,
				supportsJson: true,
				cost: 'low'
			},
			{
				id: 'gpt-4-turbo',
				name: 'GPT-4 Turbo',
				contextWindow: 128000,
				maxOutput: 4096,
				supportsJson: true,
				cost: 'high'
			},
			{
				id: 'gpt-3.5-turbo',
				name: 'GPT-3.5 Turbo',
				contextWindow: 16385,
				maxOutput: 4096,
				supportsJson: true,
				cost: 'low'
			}
		]
	},

	anthropic: {
		name: 'Anthropic',
		baseUrl: 'https://api.anthropic.com/v1',
		authHeader: 'x-api-key',
		authPrefix: '',
		keyFormat: '^sk-ant-[a-zA-Z0-9-_]+$',
		models: [
			{
				id: 'claude-sonnet-4-20250514',
				name: 'Claude Sonnet 4',
				contextWindow: 200000,
				maxOutput: 8192,
				supportsJson: false,
				cost: 'medium'
			},
			{
				id: 'claude-3-5-sonnet-20241022',
				name: 'Claude 3.5 Sonnet',
				contextWindow: 200000,
				maxOutput: 8192,
				supportsJson: false,
				cost: 'medium'
			},
			{
				id: 'claude-3-haiku-20240307',
				name: 'Claude 3 Haiku',
				contextWindow: 200000,
				maxOutput: 4096,
				supportsJson: false,
				cost: 'low'
			}
		]
	},

	google: {
		name: 'Google AI',
		baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
		authHeader: 'x-goog-api-key',
		authPrefix: '',
		keyFormat: '^AIza[a-zA-Z0-9-_]+$',
		models: [
			{
				id: 'gemini-1.5-pro',
				name: 'Gemini 1.5 Pro',
				contextWindow: 1048576,
				maxOutput: 8192,
				supportsJson: true,
				cost: 'medium'
			},
			{
				id: 'gemini-1.5-flash',
				name: 'Gemini 1.5 Flash',
				contextWindow: 1048576,
				maxOutput: 8192,
				supportsJson: true,
				cost: 'low'
			},
			{
				id: 'gemini-2.0-flash-exp',
				name: 'Gemini 2.0 Flash (Exp)',
				contextWindow: 1048576,
				maxOutput: 8192,
				supportsJson: true,
				cost: 'low'
			}
		]
	},

	groq: {
		name: 'Groq',
		baseUrl: 'https://api.groq.com/openai/v1',
		authHeader: 'Authorization',
		authPrefix: 'Bearer ',
		keyFormat: '^gsk_[a-zA-Z0-9]+$',
		models: [
			{
				id: 'llama-3.3-70b-versatile',
				name: 'Llama 3.3 70B',
				contextWindow: 128000,
				maxOutput: 32768,
				supportsJson: true,
				cost: 'low'
			},
			{
				id: 'llama-3.1-8b-instant',
				name: 'Llama 3.1 8B Instant',
				contextWindow: 128000,
				maxOutput: 8000,
				supportsJson: true,
				cost: 'free'
			},
			{
				id: 'mixtral-8x7b-32768',
				name: 'Mixtral 8x7B',
				contextWindow: 32768,
				maxOutput: 32768,
				supportsJson: true,
				cost: 'low'
			}
		]
	},

	openrouter: {
		name: 'OpenRouter',
		baseUrl: 'https://openrouter.ai/api/v1',
		authHeader: 'Authorization',
		authPrefix: 'Bearer ',
		keyFormat: '^sk-or-v1-[a-zA-Z0-9]+$',
		models: [
			{
				id: 'anthropic/claude-3.5-sonnet',
				name: 'Claude 3.5 Sonnet (via OR)',
				contextWindow: 200000,
				maxOutput: 8192,
				supportsJson: false,
				cost: 'medium'
			},
			{
				id: 'openai/gpt-4o',
				name: 'GPT-4o (via OR)',
				contextWindow: 128000,
				maxOutput: 16384,
				supportsJson: true,
				cost: 'medium'
			},
			{
				id: 'google/gemini-pro-1.5',
				name: 'Gemini Pro 1.5 (via OR)',
				contextWindow: 1048576,
				maxOutput: 8192,
				supportsJson: true,
				cost: 'medium'
			},
			{
				id: 'meta-llama/llama-3.3-70b-instruct',
				name: 'Llama 3.3 70B (via OR)',
				contextWindow: 128000,
				maxOutput: 32768,
				supportsJson: true,
				cost: 'low'
			}
		]
	},

	ollama: {
		name: 'Ollama (Local)',
		baseUrl: 'http://localhost:11434/api',
		authHeader: '',
		authPrefix: '',
		keyFormat: '', // No key needed for local Ollama
		models: [
			{
				id: 'llama3.2:3b',
				name: 'Llama 3.2 3B',
				contextWindow: 4096,
				maxOutput: 4096,
				supportsJson: true,
				cost: 'free'
			},
			{
				id: 'llama3.1:8b',
				name: 'Llama 3.1 8B',
				contextWindow: 8192,
				maxOutput: 4096,
				supportsJson: true,
				cost: 'free'
			},
			{
				id: 'mistral:7b',
				name: 'Mistral 7B',
				contextWindow: 8192,
				maxOutput: 4096,
				supportsJson: true,
				cost: 'free'
			},
			{
				id: 'phi3:mini',
				name: 'Phi-3 Mini',
				contextWindow: 4096,
				maxOutput: 2048,
				supportsJson: true,
				cost: 'free'
			},
			{
				id: 'qwen2.5:7b',
				name: 'Qwen 2.5 7B',
				contextWindow: 8192,
				maxOutput: 4096,
				supportsJson: true,
				cost: 'free'
			}
		]
	},

	together: {
		name: 'Together.ai',
		baseUrl: 'https://api.together.xyz/v1',
		authHeader: 'Authorization',
		authPrefix: 'Bearer ',
		keyFormat: '^[a-f0-9]{64}$',
		models: [
			{
				id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
				name: 'Llama 3.3 70B Turbo',
				contextWindow: 131072,
				maxOutput: 4096,
				supportsJson: true,
				cost: 'low'
			},
			{
				id: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
				name: 'Mixtral 8x7B',
				contextWindow: 32768,
				maxOutput: 4096,
				supportsJson: true,
				cost: 'low'
			},
			{
				id: 'Qwen/Qwen2.5-72B-Instruct-Turbo',
				name: 'Qwen 2.5 72B',
				contextWindow: 32768,
				maxOutput: 4096,
				supportsJson: true,
				cost: 'low'
			},
			{
				id: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
				name: 'Llama 3.2 3B (Fast)',
				contextWindow: 4096,
				maxOutput: 4096,
				supportsJson: true,
				cost: 'free'
			}
		]
	},

	deepseek: {
		name: 'DeepSeek',
		baseUrl: 'https://api.deepseek.com/v1',
		authHeader: 'Authorization',
		authPrefix: 'Bearer ',
		keyFormat: '^sk-[a-zA-Z0-9]+$',
		models: [
			{
				id: 'deepseek-chat',
				name: 'DeepSeek Chat',
				contextWindow: 64000,
				maxOutput: 4096,
				supportsJson: true,
				cost: 'low'
			},
			{
				id: 'deepseek-coder',
				name: 'DeepSeek Coder',
				contextWindow: 64000,
				maxOutput: 4096,
				supportsJson: true,
				cost: 'low'
			}
		]
	}
};

/**
 * Local AI configuration (WebLLM)
 */
export const LOCAL_AI_CONFIG = {
	name: 'Local (WebGPU)',
	models: [
		{
			id: 'Llama-3.1-8B-Instruct-q4f32_1-MLC',
			name: 'Llama 3.1 8B (Desktop)',
			vramRequired: 6000, // MB
			contextWindow: 4096,
			cost: 'free' as const
		},
		{
			id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
			name: 'Llama 3.2 3B (Mobile)',
			vramRequired: 3000, // MB
			contextWindow: 4096,
			cost: 'free' as const
		},
		{
			id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
			name: 'Phi-3.5 Mini (Fast)',
			vramRequired: 2500, // MB
			contextWindow: 4096,
			cost: 'free' as const
		}
	]
};

/**
 * Get all available models for a provider
 */
export function getModelsForProvider(
	provider: AIProviderType
): ModelConfig[] | typeof LOCAL_AI_CONFIG.models {
	if (provider === 'local') {
		return LOCAL_AI_CONFIG.models;
	}
	return PROVIDER_CONFIGS[provider]?.models ?? [];
}

/**
 * Get provider display name
 */
export function getProviderName(provider: AIProviderType): string {
	if (provider === 'local') {
		return LOCAL_AI_CONFIG.name;
	}
	return PROVIDER_CONFIGS[provider]?.name ?? provider;
}

/**
 * Validate API key format
 */
export function validateApiKey(provider: CloudProvider, key: string): boolean {
	const config = PROVIDER_CONFIGS[provider];
	if (!config?.keyFormat) return true;
	return new RegExp(config.keyFormat).test(key);
}
