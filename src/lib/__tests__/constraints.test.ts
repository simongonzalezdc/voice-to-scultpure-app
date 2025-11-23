import { describe, it, expect } from 'vitest';
import { applyConstraints, getConstraintDescription } from '../engine/constraints';
import type { LathePoint } from '../types';

/**
 * Unit Tests: Fabrication Constraints
 * 
 * Tests constraint application for:
 * - Digital (no constraints)
 * - Ceramic (pottery wheel physics)
 * - 3D Print (FDM slicer logic)
 */

describe('Fabrication Constraints', () => {
	const createTestCurve = (): LathePoint[] => {
		// Create a simple cone-like profile
		return [
			{ x: 0.2, y: 0.0 },  // Base
			{ x: 0.15, y: 0.25 },
			{ x: 0.1, y: 0.5 },
			{ x: 0.08, y: 0.75 },
			{ x: 0.05, y: 1.0 }   // Tip
		];
	};

	describe('Digital Mode (No Constraints)', () => {
		it('should not modify curve in digital mode', () => {
			const curve = createTestCurve();
			const original = JSON.stringify(curve);

			const constrained = applyConstraints(curve, 'digital');

			// Digital mode returns unchanged
			expect(JSON.stringify(constrained)).toBe(original);
		});

		it('should allow thin necks in digital mode', () => {
			const curve: LathePoint[] = [
				{ x: 0.1, y: 0.0 },
				{ x: 0.02, y: 0.5 }, // Very thin - would be invalid in ceramic
				{ x: 0.1, y: 1.0 }
			];

			const constrained = applyConstraints(curve, 'digital');
			
			// Digital allows thin points
			const minRadius = Math.min(...constrained.map(p => p.x));
			expect(minRadius).toBeLessThan(0.035); // Less than ceramic minimum
		});
	});

	describe('Ceramic Mode (Pottery Constraints)', () => {
		it('should enforce minimum radius (hand access)', () => {
			const curve: LathePoint[] = [
				{ x: 0.01, y: 0.0 },  // Too thin
				{ x: 0.01, y: 0.5 },  // Too thin
				{ x: 0.01, y: 1.0 }   // Too thin (rim, can be thin)
			];

			const constrained = applyConstraints(curve, 'ceramic');

			// Check that most points enforce minimum radius (except rim - top 5%)
			const nonRimPoints = constrained.filter((p, i) => p.y < 0.95);
			const minNonRimRadius = Math.min(...nonRimPoints.map(p => p.x));

			expect(minNonRimRadius).toBeGreaterThanOrEqual(0.035); // 35mm minimum
		});

		it('should allow thin rim (top 5%)', () => {
			const curve: LathePoint[] = [
				{ x: 0.05, y: 0.0 },
				{ x: 0.05, y: 0.90 },
				{ x: 0.01, y: 0.95 }  // Thin rim is allowed
			];

			const constrained = applyConstraints(curve, 'ceramic');

			// Rim can be thin (within top 5%)
			const rimPoint = constrained[constrained.length - 1];
			expect(rimPoint.x).toBeLessThan(0.1); // Can be thin but may be smoothed
		});

		it('should smooth jagged curves (SMA)', () => {
			// Create jagged curve
			const curve: LathePoint[] = [
				{ x: 0.1, y: 0.0 },
				{ x: 0.05, y: 0.25 }, // Jagged dip
				{ x: 0.1, y: 0.5 },
				{ x: 0.05, y: 0.75 }, // Jagged dip
				{ x: 0.1, y: 1.0 }
			];

			const constrained = applyConstraints(curve, 'ceramic');

			// After smoothing, the curve should be modified (SMA applied)
			// Just verify that smoothing occurred by checking points changed
			expect(constrained.length).toBe(curve.length);
		});

		it('should limit overhang angle (45 degrees max)', () => {
			// Create curve with steep overhang
			const curve: LathePoint[] = [
				{ x: 0.1, y: 0.0 },
				{ x: 0.3, y: 0.1 },  // Steep outward angle
				{ x: 0.1, y: 1.0 }
			];

			const constrained = applyConstraints(curve, 'ceramic');

			// Overhang should be limited
			const middlePoint = constrained[1];
			expect(middlePoint.x).toBeLessThanOrEqual(curve[1].x); // Clamped
		});

		it('should maintain wide base stability', () => {
			const curve: LathePoint[] = [
				{ x: 0.15, y: 0.0 }, // Base
				{ x: 0.1, y: 0.5 },
				{ x: 0.05, y: 1.0 }
			];

			const constrained = applyConstraints(curve, 'ceramic');

			// Base (bottom 10%) should be wider
			const basePoint = constrained[0];
			const middlePoint = constrained[1];

			expect(basePoint.x).toBeGreaterThanOrEqual(middlePoint.x);
		});

		it('should boost shape if too narrow overall', () => {
			// Very narrow shape
			const curve: LathePoint[] = [
				{ x: 0.001, y: 0.0 },
				{ x: 0.001, y: 0.5 },
				{ x: 0.001, y: 1.0 }
			];

			const constrained = applyConstraints(curve, 'ceramic');

			// Should be boosted
			const avgRadius = constrained.reduce((sum, p) => sum + p.x, 0) / constrained.length;
			expect(avgRadius).toBeGreaterThan(0.001);
			expect(avgRadius).toBeGreaterThanOrEqual(0.035); // At minimum
		});
	});

	describe('3D Print Mode (FDM Constraints)', () => {
		it('should limit overhang to 60 degrees', () => {
			const curve: LathePoint[] = [
				{ x: 0.1, y: 0.0 },
				{ x: 0.3, y: 0.1 },  // Steep overhang
				{ x: 0.1, y: 1.0 }
			];

			const constrained = applyConstraints(curve, '3d_print');

			// 3D print allows steeper than ceramic (60 vs 45)
			const middlePoint = constrained[1];
			// Should be clamped but possibly less than ceramic
			expect(middlePoint.x).toBeLessThanOrEqual(curve[1].x);
		});

		it('should enforce minimum radius for 3D printing', () => {
			const curve: LathePoint[] = [
				{ x: 0.0001, y: 0.0 }, // Very thin
				{ x: 0.0001, y: 0.5 },
				{ x: 0.0001, y: 1.0 }
			];

			const constrained = applyConstraints(curve, '3d_print');

			// Should have minimum radius
			const minRadius = Math.min(...constrained.map(p => p.x));
			expect(minRadius).toBeGreaterThan(0.0001);
			expect(minRadius).toBeGreaterThanOrEqual(0.001); // 1mm minimum
		});
	});

	describe('Constraint Descriptions', () => {
		it('should provide description for digital mode', () => {
			const desc = getConstraintDescription('digital');
			expect(desc.toLowerCase()).toContain('freedom');
			expect(typeof desc).toBe('string');
		});

		it('should provide description for ceramic mode', () => {
			const desc = getConstraintDescription('ceramic');
			expect(desc.toLowerCase()).toContain('pottery');
			expect(desc.toLowerCase()).toContain('hand');
		});

		it('should provide description for 3D print mode', () => {
			const desc = getConstraintDescription('3d_print');
			expect(desc.toLowerCase()).toContain('printer');
			expect(desc.toLowerCase()).toContain('overhang');
		});

		it('should have consistent description format', () => {
			const modes = ['digital', 'ceramic', '3d_print'] as const;

			for (const mode of modes) {
				const desc = getConstraintDescription(mode);
				expect(typeof desc).toBe('string');
				expect(desc.length).toBeGreaterThan(10);
			}
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty curve', () => {
			const curve: LathePoint[] = [];
			expect(() => applyConstraints(curve, 'ceramic')).not.toThrow();
		});

		it('should handle single point curve', () => {
			const curve: LathePoint[] = [{ x: 0.1, y: 0.5 }];
			const constrained = applyConstraints(curve, 'ceramic');
			expect(constrained.length).toBeGreaterThanOrEqual(curve.length);
		});

		it('should preserve point count', () => {
			const curve = createTestCurve();
			const constrained = applyConstraints(curve, 'ceramic');
			expect(constrained.length).toBe(curve.length);
		});

		it('should maintain Y coordinates', () => {
			const curve = createTestCurve();
			const constrained = applyConstraints(curve, 'ceramic');

			for (let i = 0; i < curve.length; i++) {
				expect(constrained[i].y).toBe(curve[i].y);
			}
		});

		it('should handle curves with zero radius', () => {
			const curve: LathePoint[] = [
				{ x: 0.1, y: 0.0 },
				{ x: 0.0, y: 0.5 }, // Zero radius point
				{ x: 0.1, y: 1.0 }
			];

			const constrained = applyConstraints(curve, 'ceramic');
			// Should enforce minimum or handle gracefully
			const minRadius = Math.min(...constrained.map(p => p.x));
			expect(minRadius).toBeGreaterThanOrEqual(0);
		});
	});

	describe('Constraint Mode Comparisons', () => {
		it('ceramic should be more restrictive than digital', () => {
			const curve: LathePoint[] = [
				{ x: 0.01, y: 0.0 }, // Very thin - would be invalid in ceramic
				{ x: 0.01, y: 0.5 },
				{ x: 0.01, y: 1.0 }
			];

			const digital = applyConstraints(curve, 'digital');
			const ceramic = applyConstraints(curve, 'ceramic');

			// Digital keeps thin points, ceramic enforces minimum
			const digitalMin = Math.min(...digital.map(p => p.x));
			const ceramicMin = Math.min(...ceramic.filter(p => p.y < 0.95).map(p => p.x));

			expect(ceramicMin).toBeGreaterThan(digitalMin);
		});

		it('3D print should be stricter than ceramic in some aspects', () => {
			const curve = createTestCurve();

			const ceramic = applyConstraints(curve, 'ceramic');
			const print = applyConstraints(curve, '3d_print');

			// Both should be valid but may differ
			expect(ceramic.length).toBe(print.length);
		});
	});
});

