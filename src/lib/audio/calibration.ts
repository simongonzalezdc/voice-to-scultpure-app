import type { UserProfile, AnalysisFrame } from '$lib/types';
import { updateSettings } from '$lib/stores/appSettingsStore.svelte';

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

	// Human voice defaults when no audio detected
	const DEFAULT_PITCH_MIN = 80;
	const DEFAULT_PITCH_MAX = 400;
	const DEFAULT_ENERGY_MIN = 0.05;
	const DEFAULT_ENERGY_MAX = 0.8;
	const DEFAULT_TIMBRE_MIN = 1000; // Typical spectral centroid for silence/breathing
	const DEFAULT_TIMBRE_MAX = 5000; // Typical spectral centroid for harsh sounds (Shhh, Ka!)

	const pitchPercentiles = calculatePercentiles(pitches);
	const energyPercentiles = calculatePercentiles(energies);
	const timbrePercentiles = calculatePercentiles(timbres);

	// Calculate Attack Threshold: Mean Delta + (2 * StdDev)
	// This identifies sharp energy spikes (chisel/attack sounds)
	let attackThreshold = 0.15; // Default fallback
	if (energyDeltas.length > 0) {
		const meanDelta = energyDeltas.reduce((a, b) => a + b, 0) / energyDeltas.length;
		const variance = energyDeltas.reduce((sum, d) => sum + Math.pow(d - meanDelta, 2), 0) / energyDeltas.length;
		const stdDev = Math.sqrt(variance);
		attackThreshold = meanDelta + (2 * stdDev);
		// Clamp to reasonable range
		attackThreshold = Math.max(0.05, Math.min(0.5, attackThreshold));
	}

	// Timbre Floor: Minimum spectral centroid (noise/silence baseline)
	// This prevents background hiss from creating rough textures
	const timbreMin = timbres.length > 0 ? Math.min(...timbres) : DEFAULT_TIMBRE_MIN;
	
	// Timbre Ceiling: Maximum spectral centroid (max grit/harsh sounds)
	// This captures the full range of texture variation
	const timbreMax = timbres.length > 0 ? Math.max(...timbres) : DEFAULT_TIMBRE_MAX;

	return {
		pitchRange: {
			min: pitches.length > 0 ? Math.min(...pitches) : DEFAULT_PITCH_MIN,
			max: pitches.length > 0 ? Math.max(...pitches) : DEFAULT_PITCH_MAX,
			...pitchPercentiles
		},
		energyRange: {
			min: energies.length > 0 ? Math.min(...energies) : DEFAULT_ENERGY_MIN,
			max: energies.length > 0 ? Math.max(...energies) : DEFAULT_ENERGY_MAX,
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
			attackThreshold: 0.15
		}
	});
}
