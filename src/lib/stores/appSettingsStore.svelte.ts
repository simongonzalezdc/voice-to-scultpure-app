import type { AppSettings } from '$lib/types';
import {
	CALIBRATION_ATTACK_THRESHOLD_DEFAULT,
	ENERGY_MAX_DEFAULT,
	ENERGY_MIN_DEFAULT,
	PITCH_MAX_DEFAULT,
	PITCH_MIN_DEFAULT,
	TIMBRE_MAX_HZ,
	TIMBRE_MIN_HZ
} from '$lib/config/constants';

const STORAGE_KEY = 'voice-to-sculpture-settings';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

		const defaults = getDefaultSettings();

		return {
			...defaults,
			...parsed,
			userProfile: normalizeUserProfile(parsed.userProfile, defaults.userProfile)
		} satisfies AppSettings;
	} catch {
		return getDefaultSettings();
	}
}

function getDefaultSettings(): AppSettings {
	return {
		aiProvider: 'local', // Default to local for privacy
		cloudProvider: 'openai',
		apiKeys: {}, // Multi-provider API keys
		selectedModel: undefined,
		graphicsQuality: 'high',
		viewMode: {
			potteryMode: false
		},
		speechToTextEnabled: false,
		preferWhisperAPI: false,
		// Accessibility defaults
		reduceMotion: false,
		flashIntensity: 1.0,
		userProfile: {
			id: 'default-profile',
			calibrated: true, // Enable studio access out of the box
			pitchRange: {
				min: PITCH_MIN_DEFAULT,
				max: PITCH_MAX_DEFAULT,
				p25: PITCH_MIN_DEFAULT,
				p50: (PITCH_MIN_DEFAULT + PITCH_MAX_DEFAULT) / 2,
				p75: PITCH_MAX_DEFAULT
			},
			energyRange: {
				min: ENERGY_MIN_DEFAULT,
				max: ENERGY_MAX_DEFAULT,
				p25: ENERGY_MIN_DEFAULT,
				p50: (ENERGY_MIN_DEFAULT + ENERGY_MAX_DEFAULT) / 2,
				p75: ENERGY_MAX_DEFAULT
			},
			timbreRange: {
				min: TIMBRE_MIN_HZ,
				max: TIMBRE_MAX_HZ,
				p25: TIMBRE_MIN_HZ,
				p50: (TIMBRE_MIN_HZ + TIMBRE_MAX_HZ) / 2,
				p75: TIMBRE_MAX_HZ
			},
			attackThreshold: CALIBRATION_ATTACK_THRESHOLD_DEFAULT
		}
	};
}

function normalizeUserProfile(
	storedProfile: AppSettings['userProfile'],
	defaultProfile: AppSettings['userProfile']
): AppSettings['userProfile'] {
	if (!defaultProfile) return storedProfile;

	// If no stored profile, use defaults (ensures studio unlock path remains intact)
	if (!storedProfile) return defaultProfile;

	return {
		...defaultProfile,
		...storedProfile,
		pitchRange: {
			...defaultProfile.pitchRange,
			...storedProfile.pitchRange
		},
		energyRange: {
			...defaultProfile.energyRange,
			...storedProfile.energyRange
		},
		timbreRange: {
			...defaultProfile.timbreRange,
			...storedProfile.timbreRange
		}
	} satisfies AppSettings['userProfile'];
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
	appSettings.userProfile = normalizeUserProfile(
		updates.userProfile,
		appSettings.userProfile ?? getDefaultSettings().userProfile
	);
	appSettings.viewMode = updates.viewMode ?? appSettings.viewMode;
	// Accessibility
	if (updates.reduceMotion !== undefined) appSettings.reduceMotion = updates.reduceMotion;
	if (updates.flashIntensity !== undefined) appSettings.flashIntensity = updates.flashIntensity;
	saveSettings(appSettings);
}

// Convenience setters for accessibility
export function setReduceMotion(enabled: boolean): void {
	appSettings.reduceMotion = enabled;
	saveSettings(appSettings);
	console.log(`♿ [ACCESSIBILITY] Reduce motion: ${enabled}`);
}

export function setFlashIntensity(intensity: number): void {
	appSettings.flashIntensity = Math.max(0, Math.min(1, intensity));
	saveSettings(appSettings);
	console.log(`♿ [ACCESSIBILITY] Flash intensity: ${intensity}`);
}

export function resetSettings(): void {
	const defaults = getDefaultSettings();
	appSettings.aiProvider = defaults.aiProvider;
	appSettings.apiKey = defaults.apiKey;
	appSettings.apiEndpoint = defaults.apiEndpoint;
	appSettings.graphicsQuality = defaults.graphicsQuality;
	appSettings.defaultMicrophone = defaults.defaultMicrophone;
	appSettings.userProfile = defaults.userProfile;
	appSettings.viewMode = defaults.viewMode;
	saveSettings(appSettings);
}

export function resetCalibration(): void {
	if (appSettings.userProfile) {
		appSettings.userProfile.calibrated = false;
		saveSettings(appSettings);
	}
}
