import { describe, it, expect } from 'vitest';
import { generateLathe, applyDeformation, deriveSurfaceParameters } from '../engine/physicsMapping';
import type { AnalysisFrame } from '../types';

describe('Physics Mapping', () => {
	it('should generate lathe curve from frames', () => {
		const frames: AnalysisFrame[] = [
			{
				time: 0,
				pitch: 200,
				energy: 0.5,
				timbre: { spectralCentroid: 1000, zcr: 0.1, spectralFlux: 0 }
			},
			{
				time: 1,
				pitch: 300,
				energy: 0.7,
				timbre: { spectralCentroid: 1500, zcr: 0.2, spectralFlux: 0 }
			}
		];

		const curve = generateLathe(frames);
		expect(curve.length).toBeGreaterThan(0);
		expect(curve[0]).toHaveProperty('x');
		expect(curve[0]).toHaveProperty('y');
	});

	it('should apply deformation', () => {
		const curve = [
			{ x: 0.1, y: 0 },
			{ x: 0.2, y: 0.5 },
			{ x: 0.1, y: 1 }
		];

		const deformed = applyDeformation(curve, {
			twist: 0.5,
			compression: 0.2,
			taper: 0.1
		});

		expect(deformed.length).toBe(curve.length);
	});

	it('should derive surface parameters', () => {
		const frames: AnalysisFrame[] = [
			{
				time: 0,
				pitch: 200,
				energy: 0.5,
				timbre: { spectralCentroid: 1000, zcr: 0.1, spectralFlux: 0 }
			}
		];

		const surface = deriveSurfaceParameters(frames);
		expect(surface.textureRoughness).toBeGreaterThanOrEqual(0);
		expect(surface.textureRoughness).toBeLessThanOrEqual(1);
		expect(surface.glazeTransmission).toBeGreaterThanOrEqual(0);
		expect(surface.glazeTransmission).toBeLessThanOrEqual(1);
	});
});
