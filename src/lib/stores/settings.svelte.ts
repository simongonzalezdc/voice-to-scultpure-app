import { appSettings, updateSettings } from './appSettingsStore.svelte';

export const graphicsQuality = $derived(appSettings.graphicsQuality);

export function setGraphicsQuality(quality: 'low' | 'high'): void {
	updateSettings({ graphicsQuality: quality });
}

export const shadowMapSize = $derived(
	graphicsQuality === 'high' ? 2048 : 1024
);

export const ssaoEnabled = $derived(graphicsQuality === 'high');

export const particleCount = $derived(graphicsQuality === 'high' ? 1000 : 500);

