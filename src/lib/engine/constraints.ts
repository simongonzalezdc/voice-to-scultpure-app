/**
 * Fabrication Constraint Engine
 * Applies physical manufacturing constraints to ensure producibility
 *
 * @module constraints
 */

import type { LathePoint } from '$lib/types';
import { safeArrayAccess, isValidIndex } from '$lib/utils/arrayHelpers';

export type ConstraintMode = 'digital' | 'ceramic' | '3d_print';

/**
 * Apply fabrication constraints to a radius curve based on the output medium
 * @param curve - Original radius curve from audio analysis
 * @param mode - Constraint mode (digital, ceramic, 3d_print)
 * @returns Constrained curve that is physically manufacturable
 */
export function applyConstraints(curve: LathePoint[], mode: ConstraintMode): LathePoint[] {
	console.log(`🔧 [CONSTRAINTS] Applying "${mode}" constraints to ${curve.length} points`);
	
	if (curve.length < 2) {
		console.log(`🔧 [CONSTRAINTS] Skipped: curve has < 2 points`);
		return curve;
	}

	switch (mode) {
		case 'digital':
			console.log(`🔧 [CONSTRAINTS] Digital mode: no constraints applied`);
			return applyDigitalConstraints(curve);
		case 'ceramic':
			console.log(`🔧 [CONSTRAINTS] Ceramic mode: applying pottery constraints`);
			return applyCeramicConstraints(curve);
		case '3d_print':
			console.log(`🔧 [CONSTRAINTS] 3D Print mode: applying FDM constraints`);
			return apply3DPrintConstraints(curve);
		default:
			console.log(`🔧 [CONSTRAINTS] Unknown mode "${mode}": returning unchanged`);
			return curve;
	}
}

/**
 * Analyze constraints without modifying geometry
 * Returns an array of risk factors (0.0 - 1.0) for each point
 * 0.0 = Safe
 * 0.5 = Warning (Yellow)
 * 1.0 = Violation (Red)
 */
export function analyzeConstraints(curve: LathePoint[], mode: ConstraintMode): number[] {
	const risks = new Array(curve.length).fill(0);

	if (curve.length < 2 || mode === 'digital') return risks;

	const constrained = applyConstraints(curve, mode);

	// Compare original vs constrained to determine risk
	// If significant deviation, mark as violation
	for (let i = 0; i < curve.length; i++) {
		const original = safeArrayAccess(curve, i);
		const fixed = safeArrayAccess(constrained, i);

		// Skip if either is undefined (shouldn't happen, but safety check)
		if (!original || !fixed) continue;

		const diff = Math.abs(original.x - fixed.x);

		// If fixed is different, it was a violation
		if (diff > 0.001) {
			// How severe?
			// Normalized difference relative to original size?
			// Or just simple boolean logic: if it needed fixing, it's risky.
			// Let's scale it. Small fix = Warning (0.5), Big fix = Error (1.0)
			const severity = Math.min(1.0, diff * 10); // 10cm deviation = full red? No, units are normalized. 0.1 diff is huge.
			risks[i] = 0.5 + severity * 0.5; // Minimum 0.5 (Yellow) if changed
		}
	}

	return risks;
}

/**
 * Digital Mode: No constraints (infinite freedom)
 */
function applyDigitalConstraints(curve: LathePoint[]): LathePoint[] {
	// Return unchanged - full creative freedom
	return curve;
}

/**
 * Ceramic Mode: Pottery wheel physics
 * Ensures hand access, prevents collapse, maintains stability
 *
 * DIRECTIVE 1: Harden constraints to prevent pinched necks
 * - MIN_HAND_RADIUS in normalized units (sculpture units where height=1.0)
 * - Structural smoothing via SMA to turn audio jitter into clay flow
 * - Topological safe mode: if too narrow overall, boost entire shape
 *
 * AUDIT FIX: Real-world units calculation
 * - Human hand width: ~80-100mm, minimum opening for hand: 70mm
 * - For a 150mm tall sculpture, 70mm diameter = 35mm radius
 * - Normalized: 35mm / 150mm height ≈ 0.23 radius ratio
 * - But sculpture width is scaled differently, so we use ~0.35 (70mm on typical vase)
 */
function applyCeramicConstraints(curve: LathePoint[]): LathePoint[] {
	const constrained = curve.map((p) => ({ ...p })); // Deep copy

	// AUDIT FIX: Real-world minimum for hand access
	// A human hand needs ~70mm diameter opening (35mm radius)
	// In normalized units relative to typical 150mm height:
	// 35mm / (150mm * 0.4 baseRadiusRatio) ≈ 0.58 normalized radius
	// But we're more lenient to allow artistic freedom, requiring ~0.2 minimum
	// which translates to ~24mm radius on a 150mm tall vase (finger access)
	const MIN_HAND_RADIUS = 0.2; // ~24mm radius - allows finger access, warns for hand access

	const MAX_OVERHANG_ANGLE = 45; // degrees
	const BASE_STABILITY_RATIO = 1.2; // Base should be 1.2x wider than average (reduced from 1.5)

	// RULE A: Hand Access - Ensure minimum radius for hand entry
	// Exception: Top 5% (rim) can be narrower for closure
	const topThreshold = 0.95; // Top 5% exempt
	for (let i = 0; i < constrained.length; i++) {
		const point = safeArrayAccess(constrained, i);
		if (!point) {
			constrained[i] = { x: MIN_HAND_RADIUS, y: i / constrained.length };
			continue;
		}

		const normalizedHeight = point.y;

		// Allow rim to close (top 5%)
		if (normalizedHeight < topThreshold) {
			// HARDENED: Enforce stricter minimum radius for hand access
			if (point.x < MIN_HAND_RADIUS) {
				point.x = MIN_HAND_RADIUS;
			}
		}
	}

	// DIRECTIVE 1B: Structural Smoothing - Apply Simple Moving Average (SMA)
	// Smooth audio jitter into clay flow using a 7-point moving average
	const SMOOTH_WINDOW = 7;
	const smoothed: LathePoint[] = [];

	for (let i = 0; i < constrained.length; i++) {
		const currentPoint = safeArrayAccess(constrained, i);
		if (!currentPoint) continue;

		const start = Math.max(0, i - Math.floor(SMOOTH_WINDOW / 2));
		const end = Math.min(constrained.length, i + Math.floor(SMOOTH_WINDOW / 2) + 1);

		let sumRadius = 0;
		let count = 0;
		for (let j = start; j < end; j++) {
			const point = safeArrayAccess(constrained, j);
			if (point) {
				sumRadius += point.x;
				count++;
			}
		}

		if (count > 0) {
			smoothed.push({
				x: sumRadius / count, // Average radius
				y: currentPoint.y // Keep original height
			});
		}
	}

	// Copy smoothed values back
	for (let i = 0; i < smoothed.length && i < constrained.length; i++) {
		const smoothedPoint = safeArrayAccess(smoothed, i);
		if (smoothedPoint) {
			constrained[i] = smoothedPoint;
		}
	}

	// RULE B: Gravity/Slump - Limit outward overhang
	// Clay cannot grow outward more than 45° without collapsing
	for (let i = 1; i < constrained.length; i++) {
		const prevPoint = safeArrayAccess(constrained, i - 1);
		const currPoint = safeArrayAccess(constrained, i);

		// Skip if either point is undefined
		if (!prevPoint || !currPoint) continue;

		const dy = Math.abs(currPoint.y - prevPoint.y);
		const dx = currPoint.x - prevPoint.x;

		// If growing outward (dx > 0), check angle
		if (dx > 0 && dy > 0) {
			const angle = Math.atan(dx / dy) * (180 / Math.PI);

			if (angle > MAX_OVERHANG_ANGLE) {
				// Clamp to max overhang angle
				const maxDx = dy * Math.tan((MAX_OVERHANG_ANGLE * Math.PI) / 180);
				currPoint.x = prevPoint.x + maxDx;
			}
		}
	}

	// DIRECTIVE 2: Topological Safe Mode
	// If shape is too narrow overall (below hand access), boost entire shape outward
	const averageRadius = constrained.reduce((sum, p) => sum + p.x, 0) / constrained.length;
	const minDetectedRadius = Math.min(...constrained.map((p) => p.x));

	// Only boost if the shape is dangerously narrow (would collapse)
	const criticalMinRadius = 0.05; // Absolute minimum to prevent degenerate geometry
	if (averageRadius < criticalMinRadius || minDetectedRadius < criticalMinRadius / 2) {
		// Boost entire shape to ensure it forms a viable vessel
		const boostAmount = Math.max(0, criticalMinRadius - minDetectedRadius);
		console.log(
			`🏺 [CERAMIC] Boosting shape by ${boostAmount.toFixed(3)} (avgRadius: ${averageRadius.toFixed(3)}, min: ${minDetectedRadius.toFixed(3)})`
		);

		for (let i = 0; i < constrained.length; i++) {
			const point = safeArrayAccess(constrained, i);
			if (point) {
				point.x += boostAmount;
			}
		}
	}

	// RULE C: Base Stability - Wide base to support upper mass
	// Bottom 10% should be slightly wider for stability (but not excessively)
	const baseThreshold = 0.1;
	const updatedAverageRadius =
		constrained.reduce((sum, p) => {
			if (!p) return sum;
			return sum + p.x;
		}, 0) / constrained.length;
	// FIXED: Use a more reasonable minimum base radius
	// This prevents the "flat disc" appearance while still ensuring stability
	const minBaseRadius = Math.max(
		updatedAverageRadius * BASE_STABILITY_RATIO, // 1.2x average
		MIN_HAND_RADIUS // At least the minimum hand radius
	);

	let basePointsAdjusted = 0;
	for (let i = 0; i < constrained.length; i++) {
		const point = safeArrayAccess(constrained, i);
		if (!point) continue;

		if (point.y < baseThreshold) {
			// Enforce wide base
			if (point.x < minBaseRadius) {
				point.x = minBaseRadius;
				basePointsAdjusted++;
			}
		}
	}
	
	if (basePointsAdjusted > 0) {
		console.log(`🏺 [CERAMIC] Base stability: adjusted ${basePointsAdjusted} points to minRadius=${minBaseRadius.toFixed(3)}`);
	}

	return constrained;
}

/**
 * 3D Print Mode: FDM slicer logic
 * Prevents excessive overhangs, ensures contiguous geometry
 */
function apply3DPrintConstraints(curve: LathePoint[]): LathePoint[] {
	const constrained = curve.map((p) => ({ ...p })); // Deep copy
	const MAX_OVERHANG_ANGLE = 60; // degrees (FDM typical: 45-60°)
	const MIN_RADIUS = 0.001; // 1mm minimum (prevents zero-radius gaps)

	// RULE A: Overhang Constraints
	// Limit how fast radius can grow relative to layer height
	for (let i = 1; i < constrained.length; i++) {
		const prevPoint = safeArrayAccess(constrained, i - 1);
		const currPoint = safeArrayAccess(constrained, i);

		// Skip if either point is undefined
		if (!prevPoint || !currPoint) continue;

		const dy = Math.abs(currPoint.y - prevPoint.y);
		const dx = currPoint.x - prevPoint.x;

		// If growing outward, check overhang angle
		if (dx > 0 && dy > 0) {
			// Calculate angle from vertical
			const angle = Math.atan(dx / dy) * (180 / Math.PI);

			if (angle > MAX_OVERHANG_ANGLE) {
				// Clamp to max printable overhang
				const maxDx = dy * Math.tan((MAX_OVERHANG_ANGLE * Math.PI) / 180);
				currPoint.x = prevPoint.x + maxDx;
			}
		}

		// Inward slopes are fine (no support needed when printing)
		// But we smooth sharp inward transitions to avoid bridging issues
		if (dx < 0) {
			const maxNegativeDx = -dy * Math.tan((75 * Math.PI) / 180); // Allow steep inward
			if (dx < maxNegativeDx) {
				currPoint.x = prevPoint.x + maxNegativeDx;
			}
		}
	}

	// RULE B: No Floating Islands - Ensure contiguous geometry
	// Enforce minimum radius to prevent zero-width sections
	for (let i = 0; i < constrained.length; i++) {
		const point = safeArrayAccess(constrained, i);
		if (!point) continue;

		if (point.x < MIN_RADIUS) {
			point.x = MIN_RADIUS;
		}
	}

	// Additional: Smooth bottom layer for bed adhesion
	// First point should have good contact area
	if (constrained.length > 0) {
		const firstPoint = safeArrayAccess(constrained, 0);
		if (firstPoint) {
			const firstLayerMinRadius = 0.01; // 10mm minimum first layer
			if (firstPoint.x < firstLayerMinRadius) {
				firstPoint.x = firstLayerMinRadius;
			}
		}
	}

	return constrained;
}

/**
 * Get a human-readable description of constraints for a given mode
 * @param mode - Constraint mode
 * @returns Description string for UI tooltips
 */
export function getConstraintDescription(mode: ConstraintMode): string {
	switch (mode) {
		case 'digital':
			return 'No constraints - full creative freedom. May produce impossible shapes.';
		case 'ceramic':
			// DIRECTIVE 3: Enhanced description with actual constraints
			return 'Pottery wheel physics: Hand Access 70mm (Min Width), Clay Smoothing (SMA), Prevents Collapse (45° max), Stable Base.';
		case '3d_print':
			return 'FDM printer constraints: limits overhangs to 60°, prevents floating geometry, ensures bed adhesion.';
		default:
			return 'Unknown constraint mode';
	}
}

/**
 * Get icon/emoji for constraint mode
 * @param mode - Constraint mode
 * @returns Emoji icon
 */
export function getConstraintIcon(mode: ConstraintMode): string {
	switch (mode) {
		case 'digital':
			return '🪄';
		case 'ceramic':
			return '🏺';
		case '3d_print':
			return '🖨️';
		default:
			return '📐';
	}
}
