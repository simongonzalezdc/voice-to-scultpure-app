import type { SculptureDefinition } from '$lib/types';

export type AISculptorStatus = 'idle' | 'initializing' | 'ready' | 'generating' | 'error';

export interface AISculptorError extends Error {
	code: 'INIT_FAILED' | 'API_ERROR' | 'PARSE_ERROR' | 'SCHEMA_ERROR' | 'NETWORK_ERROR';
}

export interface SculptureMutation {
	radiusCurve?: Array<{ x: number; y: number }>;
	surface?: {
		textureRoughness?: number;
		glazeTransmission?: number;
	};
	deformation?: {
		twist?: number;
		verticalStretch?: number;
		taper?: number;
	};
}

export interface AISculptor {
	initialize(): Promise<void>;
	generateVariation(
		current: SculptureDefinition,
		instruction: string,
		conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
	): Promise<SculptureMutation>;
	getStatus(): AISculptorStatus;
}

export class AISculptorErrorImpl extends Error implements AISculptorError {
	code: AISculptorError['code'];

	constructor(message: string, code: AISculptorError['code']) {
		super(message);
		this.name = 'AISculptorError';
		this.code = code;
	}
}
