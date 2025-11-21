import { updateSettings } from './appSettingsStore.svelte';

export function setGraphicsQuality(quality: 'low' | 'high'): void {
	updateSettings({ graphicsQuality: quality });
}
