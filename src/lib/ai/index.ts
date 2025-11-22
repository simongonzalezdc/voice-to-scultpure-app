import { mergeSculpture } from './CloudAISculptor';
import type { AISculptor } from './types';
import type { AIProvider } from '$lib/types';

export async function createAISculptor(
	provider: AIProvider,
	config: {
		apiKey?: string;
		apiEndpoint?: string;
		model?: 'desktop' | 'mobile';
		progressCallback?: (progress: number) => void;
	}
): Promise<AISculptor> {
	if (provider === 'cloud') {
		if (!config.apiKey) {
			throw new Error('API key required for cloud provider');
		}
		const { CloudAISculptor } = await import('./CloudAISculptor');
		return new CloudAISculptor(config.apiKey, config.apiEndpoint);
	} else {
		const { LocalAISculptor } = await import('./LocalAISculptor');
		return new LocalAISculptor(config.model, config.progressCallback);
	}
}

export { mergeSculpture };
export type { AISculptor, SculptureMutation } from './types';
