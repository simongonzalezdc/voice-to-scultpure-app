import type { AnalysisFrame, LathePoint, SculptureDefinition, UserProfile } from '$lib/types';

export function generateLathe(frames: AnalysisFrame[], profile?: UserProfile): LathePoint[] {
	if (frames.length === 0) {
		return [{ x: 0, y: 0.1 }]; // Default point
	}

	const points: LathePoint[] = [];
	const height = frames.length;
	const pitchRange = profile?.pitchRange || {
		min: Math.min(...frames.map((f) => f.pitch).filter((p) => p > 0)) || 80,
		max: Math.max(...frames.map((f) => f.pitch)) || 400,
		p25: 0,
		p50: 0,
		p75: 0
	};

	const energyRange = profile?.energyRange || {
		min: Math.min(...frames.map((f) => f.energy)) || 0,
		max: Math.max(...frames.map((f) => f.energy)) || 1,
		p25: 0,
		p50: 0,
		p75: 0
	};

	const baseRadius = 0.1;
	const maxRadius = 0.5;

	for (let i = 0; i < frames.length; i++) {
		const frame = frames[i];
		const normalizedHeight = i / height;

		// Map pitch to height variation (subtle)
		const pitchNormalized =
			frame.pitch > 0
				? (frame.pitch - pitchRange.min) / (pitchRange.max - pitchRange.min || 1)
				: 0.5;
		const heightOffset = (pitchNormalized - 0.5) * 0.1;

		// Map energy to radius
		const energyNormalized =
			(frame.energy - energyRange.min) / (energyRange.max - energyRange.min || 1);
		const radiusDelta = energyNormalized * (maxRadius - baseRadius);
		const radius = baseRadius + radiusDelta;

		points.push({
			x: radius,
			y: normalizedHeight + heightOffset
		});
	}

	// Smooth the curve using timbre-weighted kernel
	return smoothCurve(points, frames);
}

function smoothCurve(points: LathePoint[], frames: AnalysisFrame[]): LathePoint[] {
	if (points.length < 3) {
		return points;
	}

	const smoothed: LathePoint[] = [];
	const kernelSize = 5;
	const halfKernel = Math.floor(kernelSize / 2);

	for (let i = 0; i < points.length; i++) {
		let sumX = 0;
		let sumY = 0;
		let weightSum = 0;

		for (let j = -halfKernel; j <= halfKernel; j++) {
			const idx = i + j;
			if (idx >= 0 && idx < points.length) {
				// Weight by timbre (spectral centroid) - higher timbre = more influence
				const timbreWeight = frames[idx]?.timbre?.spectralCentroid || 0.5;
				const weight = Math.exp(-(j * j) / (2 * (halfKernel / 2) ** 2)) * (1 + timbreWeight);

				sumX += points[idx].x * weight;
				sumY += points[idx].y * weight;
				weightSum += weight;
			}
		}

		smoothed.push({
			x: sumX / weightSum,
			y: sumY / weightSum
		});
	}

	return smoothed;
}

export function applyDeformation(
	curve: LathePoint[],
	deformation: { twist: number; compression: number; taper: number }
): LathePoint[] {
	return curve.map((point, i) => {
		const normalizedHeight = i / curve.length;
		const angle = deformation.twist * normalizedHeight * Math.PI * 2;
		const compressedY = point.y * (1 - deformation.compression * normalizedHeight);
		const taperedX = point.x * (1 - deformation.taper * normalizedHeight);

		// Apply twist (rotate around Y axis)
		const rotatedX = taperedX * Math.cos(angle);

		return {
			x: rotatedX,
			y: compressedY
		};
	});
}

export function deriveSurfaceParameters(frames: AnalysisFrame[]): {
	textureRoughness: number;
	glazeTransmission: number;
} {
	if (frames.length === 0) {
		return { textureRoughness: 0.5, glazeTransmission: 0.3 };
	}

	// Average timbre (spectral centroid) influences roughness
	const avgTimbre =
		frames.reduce((sum, f) => sum + (f.timbre?.spectralCentroid || 0), 0) / frames.length;
	const normalizedTimbre = Math.min(1, Math.max(0, avgTimbre / 5000)); // Normalize to 0-1

	// Energy variance influences glaze
	const energies = frames.map((f) => f.energy);
	const avgEnergy = energies.reduce((a, b) => a + b, 0) / energies.length;
	const variance = energies.reduce((sum, e) => sum + (e - avgEnergy) ** 2, 0) / energies.length;
	const normalizedVariance = Math.min(1, variance * 10);

	return {
		textureRoughness: normalizedTimbre,
		glazeTransmission: 0.3 + normalizedVariance * 0.4
	};
}

export function createSculptureFromFrames(
	frames: AnalysisFrame[],
	profile?: UserProfile,
	name?: string
): SculptureDefinition {
	const radiusCurve = generateLathe(frames, profile);
	const surface = deriveSurfaceParameters(frames);

	return {
		id: crypto.randomUUID(),
		name: name || `Sculpture ${new Date().toLocaleString()}`,
		createdAt: Date.now(),
		radiusCurve,
		surface: {
			...surface,
			displacementStrength: 0
		},
		deformation: {
			twist: 0,
			compression: 0,
			taper: 0
		}
	};
}
