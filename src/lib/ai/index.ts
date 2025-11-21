import { CloudAISculptor } from './CloudAISculptor';
import { LocalAISculptor } from './LocalAISculptor';
import { mergeSculpture } from './CloudAISculptor';
import type { AISculptor } from './types';
import type { AIProvider } from '$lib/types';

export function createAISculptor(
	provider: AIProvider,
	config: {
		apiKey?: string;
		apiEndpoint?: string;
		model?: 'desktop' | 'mobile';
		progressCallback?: (progress: number) => void;
	}
): AISculptor {
	if (provider === 'cloud') {
		if (!config.apiKey) {
			throw new Error('API key required for cloud provider');
		}
		return new CloudAISculptor(config.apiKey, config.apiEndpoint);
	} else {
		return new LocalAISculptor(config.model, config.progressCallback);
	}
}

export { mergeSculpture };
export type { AISculptor, SculptureMutation } from './types';

