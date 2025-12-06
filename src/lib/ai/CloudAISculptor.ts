import type { AISculptor, SculptureMutation, AISculptorStatus } from './types';
import { AISculptorErrorImpl } from './types';
import type { SculptureDefinition } from '$lib/types';
import { SYSTEM_PROMPT } from './systemPrompt';
import { uiStore } from '$lib/stores/uiStore.svelte';

export class CloudAISculptor implements AISculptor {
	private status: AISculptorStatus = 'idle';
	private apiKey: string;
	private apiEndpoint: string;

	constructor(apiKey: string, apiEndpoint: string = 'https://api.openai.com/v1/chat/completions') {
		this.apiKey = apiKey;
		this.apiEndpoint = apiEndpoint;
	}

	async initialize(): Promise<void> {
		if (!this.apiKey) {
			throw new AISculptorErrorImpl('API key is required', 'INIT_FAILED');
		}

		this.status = 'initializing';

		// Validate API key by making a test request
		try {
			const response = await fetch(this.apiEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.apiKey}`
				},
				body: JSON.stringify({
					model: 'gpt-4',
					messages: [{ role: 'user', content: 'test' }],
					max_tokens: 1
				})
			});

			if (!response.ok) {
				throw new Error(`API validation failed: ${response.statusText}`);
			}

			this.status = 'ready';
		} catch (error) {
			this.status = 'error';
			throw new AISculptorErrorImpl(`Failed to initialize AI: ${error}`, 'INIT_FAILED');
		}
	}

	async generateVariation(
		current: SculptureDefinition,
		instruction: string,
		conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
	): Promise<SculptureMutation> {
		if (this.status !== 'ready') {
			throw new AISculptorErrorImpl('AI not ready', 'INIT_FAILED');
		}

		this.status = 'generating';

		// Read current values from uiStore
		const radiusCurve = current.radiusCurve || [];
		const roughness = uiStore.activeGlaze.roughness ?? 0.5;
		const transmission = uiStore.activeGlaze.transmission ?? 0.3;
		const twist = uiStore.deformation.twist;
		const verticalStretch = uiStore.deformation.verticalStretch;

		const userMessage = `Current sculpture:
- Radius curve: ${JSON.stringify(radiusCurve.slice(0, 10))}... (${radiusCurve.length} points)
- Surface roughness: ${roughness}
- Glaze transmission: ${transmission}
- Twist: ${twist}
- Vertical Stretch: ${verticalStretch}

User instruction: ${instruction}

Respond with JSON mutation only.`;

		const messages = [
			{ role: 'system', content: SYSTEM_PROMPT },
			...conversationHistory,
			{ role: 'user', content: userMessage }
		];

		try {
			const response = await fetch(this.apiEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.apiKey}`
				},
				body: JSON.stringify({
					model: 'gpt-4',
					messages,
					temperature: 0.7,
					max_tokens: 2000,
					response_format: { type: 'json_object' }
				})
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`API error: ${response.status} ${errorText}`);
			}

			const data = await response.json();
			const content = data.choices?.[0]?.message?.content;

			if (!content) {
				throw new Error('No content in response');
			}

			// Parse JSON response
			let mutation: SculptureMutation;
			try {
				mutation = JSON.parse(content);
			} catch (parseError) {
				// Try to extract JSON from markdown code blocks
				const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
				if (jsonMatch) {
					mutation = JSON.parse(jsonMatch[1]);
				} else {
					throw parseError;
				}
			}

			// Validate schema
			validateMutation(mutation);

			this.status = 'ready';
			return mutation;
		} catch (error) {
			this.status = 'error';
			if (error instanceof AISculptorErrorImpl) {
				throw error;
			}
			if (error instanceof SyntaxError) {
				throw new AISculptorErrorImpl(`Failed to parse JSON: ${error}`, 'PARSE_ERROR');
			}
			if (error instanceof Error && error.message.includes('API error')) {
				throw new AISculptorErrorImpl(error.message, 'API_ERROR');
			}
			throw new AISculptorErrorImpl(`Network error: ${error}`, 'NETWORK_ERROR');
		}
	}

	getStatus(): AISculptorStatus {
		return this.status;
	}
}

function validateMutation(mutation: SculptureMutation): void {
	if (mutation.radiusCurve) {
		if (!Array.isArray(mutation.radiusCurve)) {
			throw new AISculptorErrorImpl('radiusCurve must be an array', 'SCHEMA_ERROR');
		}
		for (const point of mutation.radiusCurve) {
			if (typeof point.x !== 'number' || typeof point.y !== 'number') {
				throw new AISculptorErrorImpl(
					'radiusCurve points must have x and y numbers',
					'SCHEMA_ERROR'
				);
			}
			if (!isFinite(point.x) || !isFinite(point.y)) {
				throw new AISculptorErrorImpl('radiusCurve points must be finite numbers', 'SCHEMA_ERROR');
			}
		}
	}

	if (mutation.surface) {
		if (mutation.surface.textureRoughness !== undefined) {
			if (
				typeof mutation.surface.textureRoughness !== 'number' ||
				!isFinite(mutation.surface.textureRoughness)
			) {
				throw new AISculptorErrorImpl('textureRoughness must be a finite number', 'SCHEMA_ERROR');
			}
		}
		if (mutation.surface.glazeTransmission !== undefined) {
			if (
				typeof mutation.surface.glazeTransmission !== 'number' ||
				!isFinite(mutation.surface.glazeTransmission)
			) {
				throw new AISculptorErrorImpl('glazeTransmission must be a finite number', 'SCHEMA_ERROR');
			}
		}
	}

	if (mutation.deformation) {
		if (mutation.deformation.twist !== undefined) {
			if (typeof mutation.deformation.twist !== 'number' || !isFinite(mutation.deformation.twist)) {
				throw new AISculptorErrorImpl('twist must be a finite number', 'SCHEMA_ERROR');
			}
		}
		if (mutation.deformation.verticalStretch !== undefined) {
			if (
				typeof mutation.deformation.verticalStretch !== 'number' ||
				!isFinite(mutation.deformation.verticalStretch)
			) {
				throw new AISculptorErrorImpl('verticalStretch must be a finite number', 'SCHEMA_ERROR');
			}
		}
		if (mutation.deformation.taper !== undefined) {
			if (typeof mutation.deformation.taper !== 'number' || !isFinite(mutation.deformation.taper)) {
				throw new AISculptorErrorImpl('taper must be a finite number', 'SCHEMA_ERROR');
			}
		}
	}
}

export function mergeSculpture(
	current: SculptureDefinition,
	mutation: SculptureMutation
): SculptureDefinition {
	return {
		...current,
		radiusCurve: mutation.radiusCurve || current.radiusCurve,
		instructions: [...(current.instructions || []), JSON.stringify(mutation)]
	};
}
