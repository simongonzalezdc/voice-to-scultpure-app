import type { LathePoint, SculptureDefinition } from '$lib/types';
import { computeProfile } from './compositor';

/**
 * Get a normalized lathe profile for a sculpture, falling back to composed layers.
 */
export function getProfilePoints(sculpture: SculptureDefinition | null | undefined): LathePoint[] {
	if (!sculpture) return [];
	if (Array.isArray((sculpture as any).radiusCurve) && (sculpture as any).radiusCurve.length > 0) {
		// Legacy path: use stored radiusCurve when available
		return (sculpture as any).radiusCurve as LathePoint[];
	}

	// Layer-driven path
	if ((sculpture as any).layers && (sculpture as any).layers.length > 0) {
		try {
			return computeProfile((sculpture as any).layers);
		} catch (err) {
			console.error('Failed to compute profile from layers:', err);
		}
	}

	return [];
}

export function getRadiusMetrics(sculpture: SculptureDefinition | null | undefined): {
	profile: LathePoint[];
	averageRadius: number;
	maxRadius: number;
} | null {
	const profile = getProfilePoints(sculpture);
	if (!profile.length) return null;

	const radii = profile.map((p) => p.x);
	const averageRadius = radii.reduce((sum, r) => sum + r, 0) / radii.length;
	const maxRadius = Math.max(...radii);

	return { profile, averageRadius, maxRadius };
}
