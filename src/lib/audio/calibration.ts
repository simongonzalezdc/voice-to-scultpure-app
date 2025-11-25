import type { UserProfile, AnalysisFrame } from '$lib/types';
import { updateSettings } from '$lib/stores/appSettingsStore.svelte';
import {
	CALIBRATION_ATTACK_THRESHOLD_DEFAULT,
	CALIBRATION_ATTACK_THRESHOLD_MIN,
	CALIBRATION_ATTACK_THRESHOLD_MAX,
	CALIBRATION_ENERGY_DELTA_STDDEV_MULTIPLIER,
	PITCH_MIN_DEFAULT,
	PITCH_MAX_DEFAULT,
	ENERGY_MIN_DEFAULT,
	ENERGY_MAX_DEFAULT,
	TIMBRE_MIN_HZ,
	TIMBRE_MAX_HZ
} from '$lib/config/constants';

export interface CalibrationResult {
	pitchRange: {
		min: number;
		max: number;
		p25: number;
		p50: number;
		p75: number;
	};
	energyRange: {
		min: number;
		max: number;
		p25: number;
		p50: number;
		p75: number;
	};
	timbreRange: {
		min: number; // Timbre floor (noise/silence baseline)
		max: number; // Timbre ceiling (max grit/harsh sounds)
		p25: number;
		p50: number;
		p75: number;
	};
	attackThreshold: number; // Dynamic threshold for detecting sharp attacks
}

function calculatePercentiles(values: number[]): { p25: number; p50: number; p75: number } {
	const sorted = [...values].sort((a, b) => a - b);
	const len = sorted.length;
	return {
		p25: sorted[Math.floor(len * 0.25)] || 0,
		p50: sorted[Math.floor(len * 0.5)] || 0,
		p75: sorted[Math.floor(len * 0.75)] || 0
	};
}

export function computeCalibration(frames: AnalysisFrame[]): CalibrationResult {
	const pitches: number[] = [];
	const energies: number[] = [];
	const timbres: number[] = [];
	const energyDeltas: number[] = []; // For attack threshold calculation

	// Track previous energy for delta calculation
	let previousEnergy = 0;

	for (const frame of frames) {
		if (frame.pitch > 0) {
			pitches.push(frame.pitch);
		}
		energies.push(frame.energy);
		timbres.push(frame.timbre.spectralCentroid);

		// Calculate energy delta (change rate) for attack detection
		if (previousEnergy > 0) {
			const delta = Math.abs(frame.energy - previousEnergy);
			energyDeltas.push(delta);
		}
		previousEnergy = frame.energy;
	}

	// Human voice defaults when no audio detected - now using constants

	const pitchPercentiles = calculatePercentiles(pitches);
	const energyPercentiles = calculatePercentiles(energies);
	const timbrePercentiles = calculatePercentiles(timbres);

	// Calculate Attack Threshold: Mean Delta + (2 * StdDev)
	// This identifies sharp energy spikes (chisel/attack sounds)
	let attackThreshold = CALIBRATION_ATTACK_THRESHOLD_DEFAULT; // Default fallback
	if (energyDeltas.length > 0) {
		const meanDelta = energyDeltas.reduce((a, b) => a + b, 0) / energyDeltas.length;
		const variance =
			energyDeltas.reduce((sum, d) => sum + Math.pow(d - meanDelta, 2), 0) / energyDeltas.length;
		const stdDev = Math.sqrt(variance);
		attackThreshold = meanDelta + CALIBRATION_ENERGY_DELTA_STDDEV_MULTIPLIER * stdDev;
		// Clamp to reasonable range
		attackThreshold = Math.max(
			CALIBRATION_ATTACK_THRESHOLD_MIN,
			Math.min(CALIBRATION_ATTACK_THRESHOLD_MAX, attackThreshold)
		);
	}

	// Timbre Floor: Minimum spectral centroid (noise/silence baseline)
	// This prevents background hiss from creating rough textures
	const timbreMin = timbres.length > 0 ? Math.min(...timbres) : TIMBRE_MIN_HZ;

	// Timbre Ceiling: Maximum spectral centroid (max grit/harsh sounds)
	// This captures the full range of texture variation
	const timbreMax = timbres.length > 0 ? Math.max(...timbres) : TIMBRE_MAX_HZ;

	return {
		pitchRange: {
			min: pitches.length > 0 ? Math.min(...pitches) : PITCH_MIN_DEFAULT,
			max: pitches.length > 0 ? Math.max(...pitches) : PITCH_MAX_DEFAULT,
			...pitchPercentiles
		},
		energyRange: {
			min: energies.length > 0 ? Math.min(...energies) : ENERGY_MIN_DEFAULT,
			max: energies.length > 0 ? Math.max(...energies) : ENERGY_MAX_DEFAULT,
			...energyPercentiles
		},
		timbreRange: {
			min: timbreMin,
			max: timbreMax,
			...timbrePercentiles
		},
		attackThreshold
	};
}

export function saveCalibration(result: CalibrationResult): void {
	const profile: UserProfile = {
		id: crypto.randomUUID(),
		calibrated: true,
		...result
	};

	updateSettings({ userProfile: profile });
}

export function resetCalibration(): void {
	updateSettings({
		userProfile: {
			id: crypto.randomUUID(),
			calibrated: false,
			pitchRange: { min: 0, max: 0, p25: 0, p50: 0, p75: 0 },
			energyRange: { min: 0, max: 0, p25: 0, p50: 0, p75: 0 },
			timbreRange: { min: 0, max: 0, p25: 0, p50: 0, p75: 0 },
			attackThreshold: CALIBRATION_ATTACK_THRESHOLD_DEFAULT
		}
	});
}
