import type { UserProfile, AnalysisFrame } from '$lib/types';
import { updateSettings } from '$lib/stores/appSettingsStore';

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
		min: number;
		max: number;
		p25: number;
		p50: number;
		p75: number;
	};
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

	for (const frame of frames) {
		if (frame.pitch > 0) {
			pitches.push(frame.pitch);
		}
		energies.push(frame.energy);
		timbres.push(frame.timbre.spectralCentroid);
	}

	const pitchPercentiles = calculatePercentiles(pitches);
	const energyPercentiles = calculatePercentiles(energies);
	const timbrePercentiles = calculatePercentiles(timbres);

	return {
		pitchRange: {
			min: Math.min(...pitches) || 0,
			max: Math.max(...pitches) || 0,
			...pitchPercentiles
		},
		energyRange: {
			min: Math.min(...energies) || 0,
			max: Math.max(...energies) || 0,
			...energyPercentiles
		},
		timbreRange: {
			min: Math.min(...timbres) || 0,
			max: Math.max(...timbres) || 0,
			...timbrePercentiles
		}
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
			timbreRange: { min: 0, max: 0, p25: 0, p50: 0, p75: 0 }
		}
	});
}

