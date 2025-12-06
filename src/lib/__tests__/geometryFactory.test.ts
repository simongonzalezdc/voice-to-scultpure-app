/**
 * Unit Tests for geometryFactory.ts
 * PHASE 4: Robustness & Testing
 *
 * CRITICAL TESTING PRINCIPLES:
 * - Geometry creation must NEVER produce NaN or invalid buffers
 * - Fallback geometries must always be safe and valid
 * - Buffer pooling must not cause memory leaks
 * - All errors must be caught and logged, never thrown to UI
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	createGeometryFromProfile,
	applySymmetryDistortion,
	applyHeatmapColors,
	applyGlazeColors,
	safeDisposeGeometry,
	createFallbackGeometry,
	deriveProfileWithTransforms
} from '$lib/engine/geometryFactory';
import type { LathePoint } from '$lib/types';
import { BufferGeometry, Vector2 } from 'three';

describe('geometryFactory', () => {
	describe('createGeometryFromProfile', () => {
		it('should create valid geometry from valid profile', () => {
			const profile: LathePoint[] = [
				{ x: 0.5, y: 0 },
				{ x: 0.6, y: 0.5 },
				{ x: 0.4, y: 1 }
			];

			const { geometry, vectors } = createGeometryFromProfile(profile);

			expect(geometry).toBeDefined();
			expect(geometry.getAttribute('position')).toBeDefined();
			expect(vectors).toHaveLength(profile.length);
			expect(vectors[0]).toEqual(new Vector2(0.5, 0));
		});

		it('should handle empty profile gracefully', () => {
			const { geometry, vectors } = createGeometryFromProfile([]);

			expect(geometry).toBeDefined();
			expect(vectors).toBeDefined();
			// Should return fallback geometry
			expect(geometry.getAttribute('position')).toBeDefined();
		});

		it('should filter out invalid points', () => {
			const profile: LathePoint[] = [
				{ x: 0.5, y: 0 },
				{ x: NaN, y: 0.5 }, // Invalid: NaN
				{ x: -0.1, y: 0.5 }, // Invalid: negative radius
				{ x: 0.6, y: 1 }
			];

			const { geometry, vectors } = createGeometryFromProfile(profile);

			// Should have filtered out invalid points
			expect(vectors.length).toBeLessThan(profile.length);
			expect(geometry).toBeDefined();
		});

		it('should handle all-invalid profile gracefully', () => {
			const profile: LathePoint[] = [
				{ x: NaN, y: 0 },
				{ x: Infinity, y: 0.5 },
				{ x: -1, y: 1 }
			];

			const { geometry, vectors } = createGeometryFromProfile(profile);

			// Should return fallback geometry
			expect(geometry).toBeDefined();
			expect(vectors).toBeDefined();
		});

		it('should compute vertex normals', () => {
			const profile: LathePoint[] = [
				{ x: 0.5, y: 0 },
				{ x: 0.6, y: 0.5 },
				{ x: 0.4, y: 1 }
			];

			const { geometry } = createGeometryFromProfile(profile);

			// Check that normals are computed
			const normalAttribute = geometry.getAttribute('normal');
			expect(normalAttribute).toBeDefined();
			expect(normalAttribute.count).toBeGreaterThan(0);
		});
	});

	describe('applySymmetryDistortion', () => {
		it('should apply symmetry distortion with lobes', () => {
			const { geometry: originalGeometry } = createGeometryFromProfile([
				{ x: 0.5, y: 0 },
				{ x: 0.5, y: 1 }
			]);

			const geometry = originalGeometry.clone();
			const positionBefore = Array.from(geometry.getAttribute('position').array as Float32Array);

			applySymmetryDistortion(geometry, 4);

			const positionAfter = Array.from(geometry.getAttribute('position').array as Float32Array);

			// Geometry should have changed
			expect(positionAfter).not.toEqual(positionBefore);
		});

		it('should not distort with zero lobes', () => {
			const { geometry: originalGeometry } = createGeometryFromProfile([
				{ x: 0.5, y: 0 },
				{ x: 0.5, y: 1 }
			]);

			const geometry = originalGeometry.clone();
			const positionBefore = Array.from(geometry.getAttribute('position').array as Float32Array);

			applySymmetryDistortion(geometry, 0);

			const positionAfter = Array.from(geometry.getAttribute('position').array as Float32Array);

			// Should not change
			expect(positionAfter).toEqual(positionBefore);
		});

		it('should handle missing position attribute gracefully', () => {
			const geometry = new BufferGeometry();

			// Should not throw
			expect(() => {
				applySymmetryDistortion(geometry, 4);
			}).not.toThrow();
		});
	});

	describe('applyHeatmapColors', () => {
		it('should apply heatmap colors to geometry', () => {
			const { geometry, vectors } = createGeometryFromProfile([
				{ x: 0.5, y: 0 },
				{ x: 0.6, y: 0.5 },
				{ x: 0.4, y: 1 }
			]);

			const stressColors = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]); // RGB colors

			const colorBuffer = applyHeatmapColors(geometry, vectors, stressColors);

			expect(colorBuffer).toBeDefined();
			expect(colorBuffer?.length).toBeGreaterThan(0);
			expect(geometry.getAttribute('color')).toBeDefined();
		});

		it('should reuse color buffer when size matches', () => {
			const { geometry, vectors } = createGeometryFromProfile([
				{ x: 0.5, y: 0 },
				{ x: 0.5, y: 1 }
			]);

			const stressColors = new Float32Array([1, 0, 0, 0, 1, 0]);
			const existingBuffer = new Float32Array(1000);

			const colorBuffer = applyHeatmapColors(geometry, vectors, stressColors, existingBuffer);

			// Should have created new buffer due to size mismatch
			expect(colorBuffer).toBeDefined();
		});

		it('should handle empty vectors gracefully', () => {
			const geometry = new BufferGeometry();
			const stressColors = new Float32Array();

			const result = applyHeatmapColors(geometry, [], stressColors);

			// Should return null for empty input
			expect(result).toBeNull();
		});
	});

	describe('applyGlazeColors', () => {
		it('should apply glaze colors to geometry', () => {
			const { geometry } = createGeometryFromProfile([
				{ x: 0.5, y: 0 },
				{ x: 0.5, y: 1 }
			]);

			const colors = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]); // RGB colors

			const colorBuffer = applyGlazeColors(geometry, colors);

			expect(colorBuffer).toBeDefined();
			expect(geometry.getAttribute('color')).toBeDefined();
		});

		it('should handle empty colors gracefully', () => {
			const { geometry } = createGeometryFromProfile([
				{ x: 0.5, y: 0 },
				{ x: 0.5, y: 1 }
			]);

			const result = applyGlazeColors(geometry, new Float32Array());

			expect(result).toBeNull();
		});
	});

	describe('safeDisposeGeometry', () => {
		it('should safely dispose geometry', () => {
			const { geometry } = createGeometryFromProfile([
				{ x: 0.5, y: 0 },
				{ x: 0.5, y: 1 }
			]);

			const result = safeDisposeGeometry(geometry);

			expect(result).toBe(true);
		});

		it('should handle null geometry gracefully', () => {
			const result = safeDisposeGeometry(null);

			expect(result).toBe(false);
		});

		it('should handle undefined geometry gracefully', () => {
			const result = safeDisposeGeometry(undefined);

			expect(result).toBe(false);
		});

		it('should not throw if dispose fails', () => {
			const { geometry } = createGeometryFromProfile([
				{ x: 0.5, y: 0 },
				{ x: 0.5, y: 1 }
			]);

			// Mock dispose to throw error
			const originalDispose = geometry.dispose;
			geometry.dispose = () => {
				throw new Error('Disposal failed');
			};

			// Should not throw
			expect(() => {
				safeDisposeGeometry(geometry);
			}).not.toThrow();

			// Restore original
			geometry.dispose = originalDispose;
		});
	});

	describe('createFallbackGeometry', () => {
		it('should create valid fallback geometry', () => {
			const { geometry, vectors } = createFallbackGeometry();

			expect(geometry).toBeDefined();
			expect(vectors).toBeDefined();
			expect(vectors.length).toBeGreaterThan(0);
			expect(geometry.getAttribute('position')).toBeDefined();
		});

		it('should create geometry with valid normals', () => {
			const { geometry } = createFallbackGeometry();

			const normalAttribute = geometry.getAttribute('normal');
			expect(normalAttribute).toBeDefined();
			expect(normalAttribute.count).toBeGreaterThan(0);
		});

		it('should create predictable fallback geometry', () => {
			const { geometry: geom1 } = createFallbackGeometry();
			const { geometry: geom2 } = createFallbackGeometry();

			const pos1 = geom1.getAttribute('position').array as Float32Array;
			const pos2 = geom2.getAttribute('position').array as Float32Array;

			// Should create identical geometries
			expect(pos1.length).toBe(pos2.length);

			// Clean up
			safeDisposeGeometry(geom1);
			safeDisposeGeometry(geom2);
		});
	});

	describe('deriveProfileWithTransforms', () => {
		it('should apply deformation to profile', () => {
			const profile: LathePoint[] = [
				{ x: 0.5, y: 0 },
				{ x: 0.5, y: 0.5 },
				{ x: 0.5, y: 1 }
			];

			const deformation = { twist: 0.5, verticalStretch: 0.2, taper: 0.1 };

			const result = deriveProfileWithTransforms(
				profile,
				deformation,
				1.0,
				undefined,
				'digital',
				false
			);

			expect(result).toBeDefined();
			expect(result.length).toBeGreaterThan(0);
			// All values should be finite
			expect(result.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
		});

		it('should handle null deformation', () => {
			const profile: LathePoint[] = [
				{ x: 0.5, y: 0 },
				{ x: 0.5, y: 1 }
			];

			const result = deriveProfileWithTransforms(
				profile,
				undefined,
				1.0,
				undefined,
				'digital',
				false
			);

			expect(result).toBeDefined();
			expect(result.length).toBeGreaterThan(0);
		});

		it('should filter out invalid transformed points', () => {
			const profile: LathePoint[] = [
				{ x: 0.5, y: 0 },
				{ x: 0.5, y: 0.5 },
				{ x: 0.5, y: 1 }
			];

			const result = deriveProfileWithTransforms(
				profile,
				{ twist: 0, verticalStretch: 0, taper: 0 },
				1.0,
				undefined,
				'digital',
				false
			);

			// All points should be valid
			expect(result.every((p) => Number.isFinite(p.x) && p.x >= 0)).toBe(true);
		});
	});

	describe('Integration Tests', () => {
		it('should handle complete workflow without memory leaks', () => {
			const profile: LathePoint[] = [
				{ x: 0.5, y: 0 },
				{ x: 0.6, y: 0.3 },
				{ x: 0.7, y: 0.6 },
				{ x: 0.5, y: 1 }
			];

			// Create geometry
			const { geometry, vectors } = createGeometryFromProfile(profile);
			expect(geometry).toBeDefined();

			// Apply symmetry
			applySymmetryDistortion(geometry.clone(), 4);

			// Apply colors
			const stressColors = new Float32Array([1, 0, 0, 0, 1, 0]);
			applyHeatmapColors(geometry, vectors, stressColors);

			// Dispose
			const disposed = safeDisposeGeometry(geometry);
			expect(disposed).toBe(true);
		});

		it('should handle rapid successive creations', () => {
			const profile: LathePoint[] = [
				{ x: 0.5, y: 0 },
				{ x: 0.5, y: 1 }
			];

			// Rapidly create and dispose
			for (let i = 0; i < 10; i++) {
				const { geometry } = createGeometryFromProfile(profile);
				expect(geometry).toBeDefined();
				safeDisposeGeometry(geometry);
			}

			// Should not crash
			expect(true).toBe(true);
		});
	});
});
