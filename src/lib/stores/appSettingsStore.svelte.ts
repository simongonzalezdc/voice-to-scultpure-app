import type { AppSettings, UserProfile } from '$lib/types';

const STORAGE_KEY = 'voice-to-sculpture-settings';
const ENCRYPTION_KEY = 'vts-api-key'; // In production, use proper encryption

function encryptApiKey(key: string): string {
	// Simple base64 encoding - replace with proper encryption in production
	return btoa(key);
}

function decryptApiKey(encrypted: string): string {
	try {
		return atob(encrypted);
	} catch {
		return '';
	}
}

function loadSettings(): AppSettings {
	if (typeof window === 'undefined') {
		return getDefaultSettings();
	}

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) return getDefaultSettings();

		const parsed = JSON.parse(stored);
		if (parsed.apiKeyEncrypted) {
			parsed.apiKey = decryptApiKey(parsed.apiKeyEncrypted);
			delete parsed.apiKeyEncrypted;
		}
		return { ...getDefaultSettings(), ...parsed };
	} catch {
		return getDefaultSettings();
	}
}

function getDefaultSettings(): AppSettings {
	return {
		aiProvider: 'cloud',
		graphicsQuality: 'high'
	};
}

function saveSettings(settings: AppSettings): void {
	if (typeof window === 'undefined') return;

	try {
		const toStore = { ...settings };
		if (toStore.apiKey) {
			(toStore as unknown as { apiKeyEncrypted: string }).apiKeyEncrypted = encryptApiKey(
				toStore.apiKey
			);
			delete toStore.apiKey;
		}
		localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
	} catch (error) {
		console.error('Failed to save settings:', error);
	}
}

export const appSettings = $state<AppSettings>(loadSettings());

export function updateSettings(updates: Partial<AppSettings>): void {
	appSettings.aiProvider = updates.aiProvider ?? appSettings.aiProvider;
	appSettings.apiKey = updates.apiKey ?? appSettings.apiKey;
	appSettings.apiEndpoint = updates.apiEndpoint ?? appSettings.apiEndpoint;
	appSettings.graphicsQuality = updates.graphicsQuality ?? appSettings.graphicsQuality;
	appSettings.defaultMicrophone = updates.defaultMicrophone ?? appSettings.defaultMicrophone;
	appSettings.userProfile = updates.userProfile ?? appSettings.userProfile;
	saveSettings(appSettings);
}

export function resetSettings(): void {
	const defaults = getDefaultSettings();
	appSettings.aiProvider = defaults.aiProvider;
	appSettings.apiKey = defaults.apiKey;
	appSettings.apiEndpoint = defaults.apiEndpoint;
	appSettings.graphicsQuality = defaults.graphicsQuality;
	appSettings.defaultMicrophone = defaults.defaultMicrophone;
	appSettings.userProfile = defaults.userProfile;
	saveSettings(appSettings);
}

