/**
 * FORM FIDELITY MODES
 * 
 * Modular voice-to-form transformation modes that can be toggled and combined independently.
 * Each mode is a pure function that transforms the profile without side effects.
 */

import type { LathePoint } from '$lib/types';

export type FormMode = 'silhouette_core' | 'profile_fins' | 'envelope_smooth';

export interface FormModeConfig {
	silhouetteCoreEnabled: boolean;
	profileFinsEnabled: boolean;
	profileFinsBaseRadius: number; // Inner radius for fins (0-1 normalized)
	envelopeSmoothEnabled: boolean;
	envelopeSmoothAmount: number; // 0-1, how much smoothing to apply
}

/**
 * MODE 1: SILHOUETTE CORE
 * 
 * Removes beat ridges and phrase markers that create "spark plug" rings.
 * Keeps only the fundamental pitch-to-radius mapping.
 * 
 * The voice-driven profile IS the silhouette.
 * Fins are purely aesthetic decoration.
 */
export function applySilhouetteCore(profile: LathePoint[], enabled: boolean): LathePoint[] {
	if (!enabled) return profile;
	
	// Simply return the profile as-is. The key is that
	// physicsMapping.ts will skip beat/phrase additions when this is enabled.
	// This function is a marker for the transformation pipeline.
	console.log(`🎨 [FORM MODES] Silhouette Core applied (${profile.length} points)`);
	return profile;
}

/**
 * MODE 2: PROFILE-FOLLOWING FINS
 * 
 * Fin TIPS follow the voice profile radius.
 * Fin BASES stay at a consistent minimum radius.
 * Loud moments = long fins (outer radius extends far from center)
 * Quiet moments = short fins (outer radius closer to center)
 * 
 * The silhouette recreates the voice data, but as fin tips.
 * 
 * Formula:
 *   outer_radius = voiceProfile.x (original radius)
 *   inner_radius = baseRadius (constant)
 *   fin_length = outer_radius - inner_radius
 * 
 * But we render with the outer_radius so fins extend to voice contour.
 */
export function applyProfileFollowingFins(
	profile: LathePoint[],
	enabled: boolean,
	baseRadius: number = 0.3
): LathePoint[] {
	if (!enabled) return profile;
	
	// Ensure all radii are at least baseRadius
	// This creates the "fin effect" - the outer edge follows voice, inner stays constant
	const adjusted = profile.map(point => {
		const voiceRadius = point.x ?? 0.5;
		// Ensure outer radius is never less than base (fins always exist)
		const outerRadius = Math.max(baseRadius, voiceRadius);
		
		return {
			...point,
			x: outerRadius
		};
	});
	
	if (profile.length > 0) {
		const minRadius = Math.min(...adjusted.map(p => p.x ?? 0.5));
		const maxRadius = Math.max(...adjusted.map(p => p.x ?? 0.5));
		console.log(
			`🎨 [FORM MODES] Profile-Following Fins applied: base=${baseRadius.toFixed(2)}, ` +
			`fin range=${(minRadius - baseRadius).toFixed(2)} to ${(maxRadius - baseRadius).toFixed(2)}`
		);
	}
	
	return adjusted;
}

/**
 * MODE 3: AMPLITUDE ENVELOPE SMOOTHING
 * 
 * Applies a smooth envelope follower to remove jagged "spark plug" rings
 * while preserving the essential shape of the voice performance.
 * 
 * Algorithm:
 * 1. Forward pass: track maximum with decay (envelope follower)
 * 2. Backward pass: smooth transitions
 * 3. Blend original vs smoothed based on amount parameter
 */
export function applyAmplitudeEnvelope(
	profile: LathePoint[],
	enabled: boolean,
	amount: number = 0.5
): LathePoint[] {
	if (!enabled || amount <= 0) return profile;
	
	if (profile.length < 2) return profile;
	
	// Clamp amount to 0-1
	const smoothAmount = Math.max(0, Math.min(1, amount));
	
	// FORWARD PASS: Envelope follower
	// Track the maximum value with exponential decay
	const decayRate = 0.85; // How fast the envelope decays (0-1, higher = slower decay)
	const envelope: number[] = [];
	let maxValue = profile[0]?.x ?? 0.5;
	
	for (let i = 0; i < profile.length; i++) {
		const current = profile[i]?.x ?? 0.5;
		// Take max of current or decayed previous max
		maxValue = Math.max(current, maxValue * decayRate);
		envelope[i] = maxValue;
	}
	
	// BACKWARD PASS: Smooth peak transitions
	// Apply a simple moving average in reverse to smooth peaks
	const smoothWindow = Math.max(1, Math.floor(profile.length * 0.05)); // 5% of profile length
	const smoothed: number[] = [...envelope];
	
	for (let i = profile.length - 1; i >= 0; i--) {
		let sum = 0;
		let count = 0;
		
		for (let j = Math.max(0, i - smoothWindow); j <= Math.min(profile.length - 1, i + smoothWindow); j++) {
			sum += envelope[j] ?? 0.5;
			count++;
		}
		
		smoothed[i] = sum / count;
	}
	
	// BLEND: Interpolate between original and smoothed based on amount
	const result = profile.map((point, i) => {
		const original = point.x ?? 0.5;
		const smoothedValue = smoothed[i] ?? original;
		const blended = original + (smoothedValue - original) * smoothAmount;
		
		return {
			...point,
			x: blended
		};
	});
	
	if (profile.length > 0) {
		console.log(
			`🎨 [FORM MODES] Amplitude Envelope Smoothing applied (amount: ${(smoothAmount * 100).toFixed(0)}%)`
		);
	}
	
	return result;
}

/**
 * COMPOSE MODES
 * 
 * Apply multiple modes in sequence.
 * Modes are applied in order: envelope → fins → silhouette.
 * Each mode is a pure transformation that can be combined.
 */
export function applyFormModes(profile: LathePoint[], config: FormModeConfig): LathePoint[] {
	let result = profile;
	
	// Order matters: smoothing first, then fins, then silhouette
	result = applyAmplitudeEnvelope(result, config.envelopeSmoothEnabled, config.envelopeSmoothAmount);
	result = applyProfileFollowingFins(result, config.profileFinsEnabled, config.profileFinsBaseRadius);
	result = applySilhouetteCore(result, config.silhouetteCoreEnabled);
	
	return result;
}

