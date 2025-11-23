/**
 * Fabrication Constraint Engine
 * Applies physical manufacturing constraints to ensure producibility
 *
 * @module constraints
 */

import type { LathePoint } from '$lib/types';

export type ConstraintMode = 'digital' | 'ceramic' | '3d_print';

/**
 * Apply fabrication constraints to a radius curve based on the output medium
 * @param curve - Original radius curve from audio analysis
 * @param mode - Constraint mode (digital, ceramic, 3d_print)
 * @returns Constrained curve that is physically manufacturable
 */
export function applyConstraints(curve: LathePoint[], mode: ConstraintMode): LathePoint[] {
	if (curve.length < 2) {
		return curve;
	}

	switch (mode) {
		case 'digital':
			return applyDigitalConstraints(curve);
		case 'ceramic':
			return applyCeramicConstraints(curve);
		case '3d_print':
			return apply3DPrintConstraints(curve);
		default:
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
		const original = curve[i].x;
		const fixed = constrained[i].x;
		const diff = Math.abs(original - fixed);
		
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
 * - MIN_RADIUS_MM = 35mm for practical hand access (1.5" radius / 3" opening)
 * - Structural smoothing via SMA to turn audio jitter into clay flow
 * - Topological safe mode: if too narrow overall, boost entire shape
 */
function applyCeramicConstraints(curve: LathePoint[]): LathePoint[] {
	const constrained = curve.map((p) => ({ ...p })); // Deep copy

	// DIRECTIVE 1A: Hand Access Floor (35mm = 1.5" radius)
	const MIN_RADIUS_MM = 35;
	const MIN_HAND_RADIUS = MIN_RADIUS_MM / 1000; // Convert to normalized units (~0.035)

	const MAX_OVERHANG_ANGLE = 45; // degrees
	const BASE_STABILITY_RATIO = 1.5; // Base should be 1.5x wider than average

	// RULE A: Hand Access - Ensure minimum radius for hand entry
	// Exception: Top 5% (rim) can be narrower for closure
	const topThreshold = 0.95; // Top 5% exempt
	for (let i = 0; i < constrained.length; i++) {
		const normalizedHeight = constrained[i].y;

		// Allow rim to close (top 5%)
		if (normalizedHeight < topThreshold) {
			// HARDENED: Enforce stricter minimum radius for hand access
			if (constrained[i].x < MIN_HAND_RADIUS) {
				constrained[i].x = MIN_HAND_RADIUS;
			}
		}
	}

	// DIRECTIVE 1B: Structural Smoothing - Apply Simple Moving Average (SMA)
	// Smooth audio jitter into clay flow using a 7-point moving average
	const SMOOTH_WINDOW = 7;
	const smoothed: LathePoint[] = [];

	for (let i = 0; i < constrained.length; i++) {
		const start = Math.max(0, i - Math.floor(SMOOTH_WINDOW / 2));
		const end = Math.min(constrained.length, i + Math.floor(SMOOTH_WINDOW / 2) + 1);

		let sumRadius = 0;
		let count = 0;
		for (let j = start; j < end; j++) {
			sumRadius += constrained[j].x;
			count++;
		}

		smoothed.push({
			x: sumRadius / count, // Average radius
			y: constrained[i].y // Keep original height
		});
	}

	// Copy smoothed values back
	for (let i = 0; i < smoothed.length; i++) {
		constrained[i] = smoothed[i];
	}

	// RULE B: Gravity/Slump - Limit outward overhang
	// Clay cannot grow outward more than 45° without collapsing
	for (let i = 1; i < constrained.length; i++) {
		const prevPoint = constrained[i - 1];
		const currPoint = constrained[i];

		const dy = Math.abs(currPoint.y - prevPoint.y);
		const dx = currPoint.x - prevPoint.x;

		// If growing outward (dx > 0), check angle
		if (dx > 0 && dy > 0) {
			const angle = Math.atan(dx / dy) * (180 / Math.PI);

			if (angle > MAX_OVERHANG_ANGLE) {
				// Clamp to max overhang angle
				const maxDx = dy * Math.tan((MAX_OVERHANG_ANGLE * Math.PI) / 180);
				constrained[i].x = prevPoint.x + maxDx;
			}
		}
	}

	// DIRECTIVE 2: Topological Safe Mode
	// If shape is too narrow overall (below hand access), boost entire shape outward
	const averageRadius = constrained.reduce((sum, p) => sum + p.x, 0) / constrained.length;
	const minDetectedRadius = Math.min(...constrained.map((p) => p.x));

	if (averageRadius < MIN_HAND_RADIUS || minDetectedRadius < MIN_HAND_RADIUS / 2) {
		// Boost entire shape to ensure it forms a viable vessel
		const boostAmount = Math.max(0, MIN_HAND_RADIUS - averageRadius);
		// console.log(
		// 	`🏺 [CERAMIC] Boosting shape by ${(boostAmount * 1000).toFixed(1)}mm to ensure hand access`
		// );

		for (let i = 0; i < constrained.length; i++) {
			constrained[i].x += boostAmount;
		}
	}

	// RULE C: Base Stability - Wide base to support upper mass
	// Bottom 10% should be wider than average radius
	const baseThreshold = 0.1;
	const updatedAverageRadius = constrained.reduce((sum, p) => sum + p.x, 0) / constrained.length;
	const minBaseRadius = Math.max(
		updatedAverageRadius * BASE_STABILITY_RATIO,
		MIN_HAND_RADIUS * 1.2
	);

	for (let i = 0; i < constrained.length; i++) {
		if (constrained[i].y < baseThreshold) {
			// Enforce wide base
			if (constrained[i].x < minBaseRadius) {
				constrained[i].x = minBaseRadius;
			}
		}
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
		const prevPoint = constrained[i - 1];
		const currPoint = constrained[i];

		const dy = Math.abs(currPoint.y - prevPoint.y);
		const dx = currPoint.x - prevPoint.x;

		// If growing outward, check overhang angle
		if (dx > 0 && dy > 0) {
			// Calculate angle from vertical
			const angle = Math.atan(dx / dy) * (180 / Math.PI);

			if (angle > MAX_OVERHANG_ANGLE) {
				// Clamp to max printable overhang
				const maxDx = dy * Math.tan((MAX_OVERHANG_ANGLE * Math.PI) / 180);
				constrained[i].x = prevPoint.x + maxDx;
			}
		}

		// Inward slopes are fine (no support needed when printing)
		// But we smooth sharp inward transitions to avoid bridging issues
		if (dx < 0) {
			const maxNegativeDx = -dy * Math.tan((75 * Math.PI) / 180); // Allow steep inward
			if (dx < maxNegativeDx) {
				constrained[i].x = prevPoint.x + maxNegativeDx;
			}
		}
	}

	// RULE B: No Floating Islands - Ensure contiguous geometry
	// Enforce minimum radius to prevent zero-width sections
	for (let i = 0; i < constrained.length; i++) {
		if (constrained[i].x < MIN_RADIUS) {
			constrained[i].x = MIN_RADIUS;
		}
	}

	// Additional: Smooth bottom layer for bed adhesion
	// First point should have good contact area
	if (constrained.length > 0) {
		const firstLayerMinRadius = 0.01; // 10mm minimum first layer
		if (constrained[0].x < firstLayerMinRadius) {
			constrained[0].x = firstLayerMinRadius;
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
