/**
 * Voice Links (Modulators)
 * Allows voice control of sculpture parameters hands-free while singing
 *
 * DIRECTIVE 1: Link UI - Track which parameters are linked to voice data
 * - Twist: Can be linked to Pitch (low-high melodies)
 * - Roughness: Can be linked to Timbre (smooth vs raspy)
 */

import {
	VOICE_LINK_PITCH_MIN,
	VOICE_LINK_PITCH_MAX,
	VOICE_LINK_TIMBRE_SMOOTH_MIN,
	VOICE_LINK_TIMBRE_RASPY_MAX
} from '$lib/config/constants';

export type VoiceLinkType = 'none' | 'pitch' | 'timbre';

export interface VoiceLinks {
	twist: VoiceLinkType;
	roughness: VoiceLinkType;
}

export const voiceLinksStore = $state<VoiceLinks>({
	twist: 'none',
	roughness: 'none'
});

/**
 * Toggle a voice link for a parameter
 * Cycles: none → pitch/timbre → none
 */
export function toggleVoiceLink(parameter: 'twist' | 'roughness'): void {
	if (parameter === 'twist') {
		voiceLinksStore.twist = voiceLinksStore.twist === 'none' ? 'pitch' : 'none';
		console.log(`🎤 [VOICE LINK] Twist link toggled → ${voiceLinksStore.twist}`);
	} else if (parameter === 'roughness') {
		voiceLinksStore.roughness = voiceLinksStore.roughness === 'none' ? 'timbre' : 'none';
		console.log(`🎤 [VOICE LINK] Roughness link toggled → ${voiceLinksStore.roughness}`);
	}
}

/**
 * DIRECTIVE 2: Automation Engine
 * Map audio features to parameter ranges
 */

// Pitch range detection (Hz)
// Typical human voice: 80-400 Hz (males 80-180, females 160-300)
// These constants are now imported from constants.ts

/**
 * Map pitch (Hz) to twist range (-1.0 to 1.0)
 * Low pitches → negative twist (counterclockwise)
 * High pitches → positive twist (clockwise)
 */
export function pitchToTwist(pitch: number): number {
	// Clamp pitch to range
	const clamped = Math.max(VOICE_LINK_PITCH_MIN, Math.min(VOICE_LINK_PITCH_MAX, pitch));

	// Normalize to 0-1
	const normalized =
		(clamped - VOICE_LINK_PITCH_MIN) / (VOICE_LINK_PITCH_MAX - VOICE_LINK_PITCH_MIN);

	// Map to -1 to 1 range
	const twisted = normalized * 2 - 1;

	return twisted;
}

/**
 * Map timbre (spectralCentroid) to roughness (0.0 to 1.0)
 * Smooth sounds (low centroid) → low roughness (smooth surface)
 * Raspy sounds (high centroid) → high roughness (rough surface)
 */
export function timbreToRoughness(spectralCentroid: number): number {
	// Clamp spectral centroid to range
	const clamped = Math.max(
		VOICE_LINK_TIMBRE_SMOOTH_MIN,
		Math.min(VOICE_LINK_TIMBRE_RASPY_MAX, spectralCentroid)
	);

	// Normalize to 0-1
	const normalized =
		(clamped - VOICE_LINK_TIMBRE_SMOOTH_MIN) /
		(VOICE_LINK_TIMBRE_RASPY_MAX - VOICE_LINK_TIMBRE_SMOOTH_MIN);

	return normalized;
}

/**
 * Reset all voice links
 */
export function resetVoiceLinks(): void {
	voiceLinksStore.twist = 'none';
	voiceLinksStore.roughness = 'none';
	console.log('🔄 [VOICE LINK] All links reset');
}
