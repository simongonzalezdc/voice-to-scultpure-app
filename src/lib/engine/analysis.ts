import { Color, Vector2 } from 'three';

/**
 * Calculate curvature-based stress colors for a 2D profile.
 * Higher curvature (sharper angles) are mapped toward red, straighter segments stay blue.
 */
export function calculateStressColors(points: Vector2[]): Float32Array {
	if (points.length < 3) return new Float32Array();

	const colors: number[] = [];
	for (let i = 1; i < points.length - 1; i++) {
		const prev = points[i - 1];
		const curr = points[i];
		const next = points[i + 1];

		if (!prev || !curr || !next) continue;

		const v1 = curr.clone().sub(prev).normalize();
		const v2 = next.clone().sub(curr).normalize();
		const dot = v1.dot(v2); // 1.0 = Straight, < 0.5 = Sharp Angle

		const stress = 1.0 - dot;
		const color = new Color().setHSL(0.6 - stress * 0.6, 1.0, 0.5);
		colors.push(color.r, color.g, color.b);
	}
	return new Float32Array(colors);
}
