/**
 * Fabrication Constraint Engine
 * Applies physical manufacturing constraints to ensure producibility
 *
 * @module constraints
 */

import type { LathePoint } from '$lib/types';
import { safeArrayAccess } from '$lib/utils/arrayHelpers';
import {
	CONSTRAINT_DIFF_THRESHOLD,
	CERAMIC_MIN_HAND_RADIUS,
	CERAMIC_MIN_HAND_ACCESS_MM,
	CERAMIC_MAX_OVERHANG_ANGLE,
	CERAMIC_BASE_STABILITY_RATIO,
	CERAMIC_TOP_EXEMPT_THRESHOLD,
	CERAMIC_CRITICAL_MIN_RADIUS,
	CERAMIC_SMOOTH_WINDOW,
	CERAMIC_BASE_HEIGHT_THRESHOLD,
	PRINT_3D_MIN_RADIUS,
	PRINT_3D_FIRST_LAYER_MIN_RADIUS,
	PRINT_3D_MIN_WALL_MM,
	DEFAULT_HEIGHT_MM
} from '$lib/config/constants';

export type ConstraintMode = 'digital' | 'ceramic' | '3d_print';

/**
 * Apply fabrication constraints to a radius curve based on the output medium
 * @param curve - Original radius curve from audio analysis
 * @param mode - Constraint mode (digital, ceramic, 3d_print)
 * @returns Constrained curve that is physically manufacturable
 */
export function applyConstraints(
	curve: LathePoint[],
	mode: ConstraintMode,
	physicalHeightMm: number = DEFAULT_HEIGHT_MM
): LathePoint[] {
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
			return applyCeramicConstraints(curve, physicalHeightMm);
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
export function analyzeConstraints(
	curve: LathePoint[],
	mode: ConstraintMode,
	physicalHeightMm: number = DEFAULT_HEIGHT_MM
): number[] {
	const risks = new Array(curve.length).fill(0);

	if (curve.length < 2 || mode === 'digital') return risks;

	const constrained = applyConstraints(curve, mode, physicalHeightMm);

	// Compare original vs constrained to determine risk
	// If significant deviation, mark as violation
	for (let i = 0; i < curve.length; i++) {
		const original = safeArrayAccess(curve, i);
		const fixed = safeArrayAccess(constrained, i);

		// Skip if either is undefined (shouldn't happen, but safety check)
		if (!original || !fixed) continue;

		const diff = Math.abs(original.x - fixed.x);

		// If fixed is different, it was a violation
		if (diff > CONSTRAINT_DIFF_THRESHOLD) {
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
function applyCeramicConstraints(curve: LathePoint[], physicalHeightMm: number): LathePoint[] {
	const constrained = curve.map((p) => ({ ...p })); // Deep copy

	const heightMm = Math.max(1, physicalHeightMm || DEFAULT_HEIGHT_MM);
	const minHandRadius = Math.max(
		CERAMIC_MIN_HAND_RADIUS,
		CERAMIC_MIN_HAND_ACCESS_MM / heightMm / 2
	);

	// RULE A: Hand Access - Ensure minimum radius for hand entry
	// Exception: Top 5% (rim) can be narrower for closure
	for (let i = 0; i < constrained.length; i++) {
		const point = safeArrayAccess(constrained, i);
		if (!point) {
			constrained[i] = { x: minHandRadius, y: i / constrained.length };
			continue;
		}

		const normalizedHeight = point.y;

		// Allow rim to close (top 5%)
		if (normalizedHeight < CERAMIC_TOP_EXEMPT_THRESHOLD) {
			// HARDENED: Enforce stricter minimum radius for hand access
			if (point.x < minHandRadius) {
				point.x = minHandRadius;
			}
		}
	}

	// DIRECTIVE 1B: Structural Smoothing - Apply Simple Moving Average (SMA)
	// Smooth audio jitter into clay flow using a 7-point moving average
	const smoothed: LathePoint[] = [];

	for (let i = 0; i < constrained.length; i++) {
		const currentPoint = safeArrayAccess(constrained, i);
		if (!currentPoint) continue;

		const start = Math.max(0, i - Math.floor(CERAMIC_SMOOTH_WINDOW / 2));
		const end = Math.min(constrained.length, i + Math.floor(CERAMIC_SMOOTH_WINDOW / 2) + 1);

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

			if (angle > CERAMIC_MAX_OVERHANG_ANGLE) {
				// Clamp to max overhang angle
				const maxDx = dy * Math.tan((CERAMIC_MAX_OVERHANG_ANGLE * Math.PI) / 180);
				currPoint.x = prevPoint.x + maxDx;
			}
		}
	}

	// DIRECTIVE 2: Topological Safe Mode
	// If shape is too narrow overall (below hand access), boost entire shape outward
	const averageRadius = constrained.reduce((sum, p) => sum + p.x, 0) / constrained.length;
	const minDetectedRadius = Math.min(...constrained.map((p) => p.x));
	// Only boost if the shape is dangerously narrow (would collapse)
	if (
		averageRadius < CERAMIC_CRITICAL_MIN_RADIUS ||
		minDetectedRadius < CERAMIC_CRITICAL_MIN_RADIUS / 2
	) {
		// Boost entire shape to ensure it forms a viable vessel
		const boostAmount = Math.max(0, CERAMIC_CRITICAL_MIN_RADIUS - minDetectedRadius);
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
	const updatedAverageRadius =
		constrained.reduce((sum, p) => {
			if (!p) return sum;
			return sum + p.x;
		}, 0) / constrained.length;
	// FIXED: Use a more reasonable minimum base radius
	// This prevents the "flat disc" appearance while still ensuring stability
	const minBaseRadius = Math.max(
		updatedAverageRadius * CERAMIC_BASE_STABILITY_RATIO, // 1.2x average
		minHandRadius // At least the minimum hand radius derived from physical height
	);

	let basePointsAdjusted = 0;
	for (let i = 0; i < constrained.length; i++) {
		const point = safeArrayAccess(constrained, i);
		if (!point) continue;

		if (point.y < CERAMIC_BASE_HEIGHT_THRESHOLD) {
			// Enforce wide base
			if (point.x < minBaseRadius) {
				point.x = minBaseRadius;
				basePointsAdjusted++;
			}
		}
	}

	if (basePointsAdjusted > 0) {
		console.log(
			`🏺 [CERAMIC] Base stability: adjusted ${basePointsAdjusted} points to minRadius=${minBaseRadius.toFixed(3)}`
		);
	}

	return constrained;
}

/**
 * 3D Print Mode: Minimal FDM constraints
 * Only enforces wall thickness and bed adhesion
 * Overhangs are handled by slicer-generated supports
 */
function apply3DPrintConstraints(curve: LathePoint[]): LathePoint[] {
	const constrained = curve.map((p) => ({ ...p })); // Deep copy

	// RULE A: No Floating Islands - Ensure contiguous geometry
	// Enforce minimum radius to prevent zero-width sections
	for (let i = 0; i < constrained.length; i++) {
		const point = safeArrayAccess(constrained, i);
		if (!point) continue;

		if (point.x < PRINT_3D_MIN_RADIUS) {
			point.x = PRINT_3D_MIN_RADIUS;
		}
	}

	// RULE B: First Layer Adhesion
	// Bottom should have good contact area
	if (constrained.length > 0) {
		const firstPoint = safeArrayAccess(constrained, 0);
		if (firstPoint) {
			if (firstPoint.x < PRINT_3D_FIRST_LAYER_MIN_RADIUS) {
				firstPoint.x = PRINT_3D_FIRST_LAYER_MIN_RADIUS;
			}
		}
	}

	// RULE C: Minimum Wall Thickness (NEW)
	// Convert minimum wall thickness from mm to normalized units
	// Wall thickness = 2 * radius (diameter)
	// PRINT_3D_MIN_WALL_MM = 1.2mm (3x nozzle width for 0.4mm nozzle)
	// For 150mm tall sculpture: normalized units = sculpture height
	const minWallRadiusNormalized = PRINT_3D_MIN_WALL_MM / 2.0 / DEFAULT_HEIGHT_MM;
	const wallThicknessMinRadius = Math.max(PRINT_3D_MIN_RADIUS, minWallRadiusNormalized);

	for (let i = 0; i < constrained.length; i++) {
		const point = safeArrayAccess(constrained, i);
		if (!point) continue;

		if (point.x < wallThicknessMinRadius) {
			point.x = wallThicknessMinRadius;
		}
	}

	// RULE D: Smooth sharp radius transitions
	// Prevent abrupt changes that create thin walls or weak points
	// Use 5-point moving average to smooth transitions
	const smoothedRadii: number[] = [];
	const windowSize = 5;

	for (let i = 0; i < constrained.length; i++) {
		const start = Math.max(0, i - Math.floor(windowSize / 2));
		const end = Math.min(constrained.length, i + Math.floor(windowSize / 2) + 1);

		let sum = 0;
		let count = 0;
		for (let j = start; j < end; j++) {
			const p = safeArrayAccess(constrained, j);
			if (p) {
				sum += p.x;
				count++;
			}
		}

		smoothedRadii.push(count > 0 ? sum / count : 0.5);
	}

	// Apply smoothed radii, taking max to prevent shrinkage
	for (let i = 0; i < constrained.length; i++) {
		const point = safeArrayAccess(constrained, i);
		if (point) {
			point.x = Math.max(point.x, smoothedRadii[i]);
		}
	}

	if (wallThicknessMinRadius > PRINT_3D_MIN_RADIUS) {
		console.log(
			`🖨️ [3D PRINT] Enforced minimum wall thickness: ${PRINT_3D_MIN_WALL_MM.toFixed(2)}mm (radius=${wallThicknessMinRadius.toFixed(3)})`
		);
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
			return 'Minimal FDM constraints: ensures wall thickness and bed adhesion. Add supports in slicer for overhangs.';
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
