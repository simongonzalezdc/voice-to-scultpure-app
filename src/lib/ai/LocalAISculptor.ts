import type { AISculptor, SculptureMutation, AISculptorStatus } from './types';
import { AISculptorErrorImpl } from './types';
import type { SculptureDefinition } from '$lib/types';
import { SYSTEM_PROMPT } from './systemPrompt';

let WebLLM: any = null;

async function loadWebLLM() {
	if (WebLLM) return WebLLM;
	try {
		WebLLM = await import('@mlc-ai/web-llm');
		return WebLLM;
	} catch (error) {
		throw new AISculptorErrorImpl(`Failed to load WebLLM: ${error}`, 'INIT_FAILED');
	}
}

export class LocalAISculptor implements AISculptor {
	private status: AISculptorStatus = 'idle';
	private engine: any = null;
	private model: string;
	private progressCallback?: (progress: number) => void;

	constructor(
		model: 'desktop' | 'mobile' = 'desktop',
		progressCallback?: (progress: number) => void
	) {
		this.model =
			model === 'desktop'
				? 'Llama-3-8B-Instruct-q4f16_1'
				: 'Phi-3-mini-4k-instruct-q4f16_1';
		this.progressCallback = progressCallback;
	}

	async initialize(): Promise<void> {
		if (!('gpu' in navigator)) {
			throw new AISculptorErrorImpl('WebGPU not available', 'INIT_FAILED');
		}

		this.status = 'initializing';

		try {
			const webllm = await loadWebLLM();
			const initProgressCallback = (report: { progress: number }) => {
				if (this.progressCallback) {
					this.progressCallback(report.progress);
				}
			};

			this.engine = await webllm.CreateWebLLMEngine(this.model, {
				initProgressCallback
			});

			this.status = 'ready';
		} catch (error) {
			this.status = 'error';
			throw new AISculptorErrorImpl(`Failed to initialize local AI: ${error}`, 'INIT_FAILED');
		}
	}

	async generateVariation(
		current: SculptureDefinition,
		instruction: string,
		conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
	): Promise<SculptureMutation> {
		if (this.status !== 'ready' || !this.engine) {
			throw new AISculptorErrorImpl('AI not ready', 'INIT_FAILED');
		}

		this.status = 'generating';

		const userMessage = `Current sculpture:
- Radius curve: ${JSON.stringify(current.radiusCurve.slice(0, 10))}... (${current.radiusCurve.length} points)
- Surface roughness: ${current.surface.textureRoughness}
- Glaze transmission: ${current.surface.glazeTransmission}
- Twist: ${current.deformation.twist}
- Compression: ${current.deformation.compression}

User instruction: ${instruction}

Respond with JSON mutation only.`;

		const messages = [
			{ role: 'system', content: SYSTEM_PROMPT },
			...conversationHistory,
			{ role: 'user', content: userMessage }
		];

		try {
			const response = await this.engine.chat.completions.create({
				messages,
				temperature: 0.7,
				max_tokens: 2000
			});

			const content = response.choices?.[0]?.message?.content;

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

			// Validate schema (reuse from CloudAISculptor)
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
			throw new AISculptorErrorImpl(`Generation error: ${error}`, 'API_ERROR');
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
				throw new AISculptorErrorImpl('radiusCurve points must have x and y numbers', 'SCHEMA_ERROR');
			}
			if (!isFinite(point.x) || !isFinite(point.y)) {
				throw new AISculptorErrorImpl('radiusCurve points must be finite numbers', 'SCHEMA_ERROR');
			}
		}
	}

	if (mutation.surface) {
		if (mutation.surface.textureRoughness !== undefined) {
			if (typeof mutation.surface.textureRoughness !== 'number' || !isFinite(mutation.surface.textureRoughness)) {
				throw new AISculptorErrorImpl('textureRoughness must be a finite number', 'SCHEMA_ERROR');
			}
		}
		if (mutation.surface.glazeTransmission !== undefined) {
			if (typeof mutation.surface.glazeTransmission !== 'number' || !isFinite(mutation.surface.glazeTransmission)) {
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
		if (mutation.deformation.compression !== undefined) {
			if (typeof mutation.deformation.compression !== 'number' || !isFinite(mutation.deformation.compression)) {
				throw new AISculptorErrorImpl('compression must be a finite number', 'SCHEMA_ERROR');
			}
		}
		if (mutation.deformation.taper !== undefined) {
			if (typeof mutation.deformation.taper !== 'number' || !isFinite(mutation.deformation.taper)) {
				throw new AISculptorErrorImpl('taper must be a finite number', 'SCHEMA_ERROR');
			}
		}
	}
}

