import type { SculptureDefinition } from '$lib/types';
import { generateFinalProfile, type ExportOptions } from './exportUtils';
import type { RibbonPoint } from '$lib/engine/RibbonGeometryManager';

// ============================================================================
// RIBBON EXPORT WITH WALL THICKENING
// ============================================================================

/**
 * Export ribbon geometry to STL with wall thickness for 3D printing
 * Ribbon is inherently a 2D surface - we extrude inner/outer walls
 */
export function ribbonToSTL(
	ribbonPoints: RibbonPoint[],
	wallThickness: number = 2 // mm
): string {
	if (ribbonPoints.length < 2) {
		throw new Error('Not enough ribbon points for STL export');
	}

	const triangles: string[] = [];
	const n = 8; // Cross-section vertices (octagon)
	const halfThickness = wallThickness / 2;

	// For each segment, create inner and outer surfaces
	for (let i = 0; i < ribbonPoints.length - 1; i++) {
		const p1 = ribbonPoints[i];
		const p2 = ribbonPoints[i + 1];
		if (!p1 || !p2) continue;

		// Calculate direction for extrusion
		const dx = p2.position.x - p1.position.x;
		const dy = p2.position.y - p1.position.y;
		const dz = p2.position.z - p1.position.z;
		const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

		// Normalize direction
		const dirX = dx / len;
		const dirY = dy / len;
		const dirZ = dz / len;

		// Create perpendicular vectors for cross-section
		// We use the ribbon's width/depth plus wall thickness
		for (let j = 0; j < n; j++) {
			const angle1 = (j / n) * Math.PI * 2;
			const angle2 = ((j + 1) % n / n) * Math.PI * 2;

			// Outer surface vertices (p1)
			const outerR1 = p1.width + halfThickness;
			const x1_o = p1.position.x + Math.cos(angle1) * outerR1;
			const y1_o = p1.position.y;
			const z1_o = p1.position.z + Math.sin(angle1) * outerR1;

			const x2_o = p1.position.x + Math.cos(angle2) * outerR1;
			const y2_o = p1.position.y;
			const z2_o = p1.position.z + Math.sin(angle2) * outerR1;

			// Outer surface vertices (p2)
			const outerR2 = p2.width + halfThickness;
			const x3_o = p2.position.x + Math.cos(angle1) * outerR2;
			const y3_o = p2.position.y;
			const z3_o = p2.position.z + Math.sin(angle1) * outerR2;

			const x4_o = p2.position.x + Math.cos(angle2) * outerR2;
			const y4_o = p2.position.y;
			const z4_o = p2.position.z + Math.sin(angle2) * outerR2;

			// Inner surface vertices (p1)
			const innerR1 = Math.max(0.1, p1.width - halfThickness);
			const x1_i = p1.position.x + Math.cos(angle1) * innerR1;
			const y1_i = p1.position.y;
			const z1_i = p1.position.z + Math.sin(angle1) * innerR1;

			const x2_i = p1.position.x + Math.cos(angle2) * innerR1;
			const y2_i = p1.position.y;
			const z2_i = p1.position.z + Math.sin(angle2) * innerR1;

			// Inner surface vertices (p2)
			const innerR2 = Math.max(0.1, p2.width - halfThickness);
			const x3_i = p2.position.x + Math.cos(angle1) * innerR2;
			const y3_i = p2.position.y;
			const z3_i = p2.position.z + Math.sin(angle1) * innerR2;

			const x4_i = p2.position.x + Math.cos(angle2) * innerR2;
			const y4_i = p2.position.y;
			const z4_i = p2.position.z + Math.sin(angle2) * innerR2;

			// Outer surface triangles (facing outward)
			triangles.push(
				createTriangle(
					{ x: x1_o, y: y1_o, z: z1_o },
					{ x: x3_o, y: y3_o, z: z3_o },
					{ x: x2_o, y: y2_o, z: z2_o }
				)
			);
			triangles.push(
				createTriangle(
					{ x: x2_o, y: y2_o, z: z2_o },
					{ x: x3_o, y: y3_o, z: z3_o },
					{ x: x4_o, y: y4_o, z: z4_o }
				)
			);

			// Inner surface triangles (facing inward - reversed winding)
			triangles.push(
				createTriangle(
					{ x: x1_i, y: y1_i, z: z1_i },
					{ x: x2_i, y: y2_i, z: z2_i },
					{ x: x3_i, y: y3_i, z: z3_i }
				)
			);
			triangles.push(
				createTriangle(
					{ x: x2_i, y: y2_i, z: z2_i },
					{ x: x4_i, y: y4_i, z: z4_i },
					{ x: x3_i, y: y3_i, z: z3_i }
				)
			);
		}
	}

	// Add end caps (first and last rings)
	const firstPoint = ribbonPoints[0];
	const lastPoint = ribbonPoints[ribbonPoints.length - 1];

	if (firstPoint && lastPoint) {
		// Start cap
		for (let j = 0; j < n; j++) {
			const angle1 = (j / n) * Math.PI * 2;
			const angle2 = ((j + 1) % n / n) * Math.PI * 2;

			const outerR = firstPoint.width + halfThickness;
			const innerR = Math.max(0.1, firstPoint.width - halfThickness);

			const xo1 = firstPoint.position.x + Math.cos(angle1) * outerR;
			const zo1 = firstPoint.position.z + Math.sin(angle1) * outerR;
			const xo2 = firstPoint.position.x + Math.cos(angle2) * outerR;
			const zo2 = firstPoint.position.z + Math.sin(angle2) * outerR;
			const xi1 = firstPoint.position.x + Math.cos(angle1) * innerR;
			const zi1 = firstPoint.position.z + Math.sin(angle1) * innerR;
			const xi2 = firstPoint.position.x + Math.cos(angle2) * innerR;
			const zi2 = firstPoint.position.z + Math.sin(angle2) * innerR;
			const y = firstPoint.position.y;

			// Cap quad (outer to inner)
			triangles.push(
				createTriangle(
					{ x: xo1, y, z: zo1 },
					{ x: xi1, y, z: zi1 },
					{ x: xo2, y, z: zo2 }
				)
			);
			triangles.push(
				createTriangle(
					{ x: xo2, y, z: zo2 },
					{ x: xi1, y, z: zi1 },
					{ x: xi2, y, z: zi2 }
				)
			);
		}

		// End cap
		for (let j = 0; j < n; j++) {
			const angle1 = (j / n) * Math.PI * 2;
			const angle2 = ((j + 1) % n / n) * Math.PI * 2;

			const outerR = lastPoint.width + halfThickness;
			const innerR = Math.max(0.1, lastPoint.width - halfThickness);

			const xo1 = lastPoint.position.x + Math.cos(angle1) * outerR;
			const zo1 = lastPoint.position.z + Math.sin(angle1) * outerR;
			const xo2 = lastPoint.position.x + Math.cos(angle2) * outerR;
			const zo2 = lastPoint.position.z + Math.sin(angle2) * outerR;
			const xi1 = lastPoint.position.x + Math.cos(angle1) * innerR;
			const zi1 = lastPoint.position.z + Math.sin(angle1) * innerR;
			const xi2 = lastPoint.position.x + Math.cos(angle2) * innerR;
			const zi2 = lastPoint.position.z + Math.sin(angle2) * innerR;
			const y = lastPoint.position.y;

			// Cap quad (reversed winding)
			triangles.push(
				createTriangle(
					{ x: xo1, y, z: zo1 },
					{ x: xo2, y, z: zo2 },
					{ x: xi1, y, z: zi1 }
				)
			);
			triangles.push(
				createTriangle(
					{ x: xi1, y, z: zi1 },
					{ x: xo2, y, z: zo2 },
					{ x: xi2, y, z: zi2 }
				)
			);
		}
	}

	const stlContent = `solid ribbon_sculpture
${triangles.join('\n')}
endsolid ribbon_sculpture`;

	return stlContent;
}

// ============================================================================
// LATHE EXPORT
// ============================================================================

export function lathePointsToSTL(
	sculpture: SculptureDefinition,
	options?: Partial<ExportOptions>
): string {
	// Generate final profile with all transformations applied
	const exportOptions: ExportOptions = {
		autoFixGeometry: options?.autoFixGeometry ?? true,
		constraintMode: options?.constraintMode ?? 'ceramic',
		modifiers: options?.modifiers
	};

	const points = generateFinalProfile(sculpture, exportOptions);

	if (points.length < 2) {
		throw new Error('Not enough points for STL export');
	}

	const triangles: string[] = [];
	const segments = 64; // Number of segments around the lathe (match renderer)

	// Generate triangles for each ring
	for (let i = 0; i < points.length - 1; i++) {
		const currentPoint = points[i];
		const nextPoint = points[i + 1];

		// Skip if either point is undefined
		if (!currentPoint || !nextPoint) continue;

		// Create triangles between this ring and the next
		for (let j = 0; j < segments; j++) {
			const angle1 = (j / segments) * Math.PI * 2;
			const angle2 = ((j + 1) / segments) * Math.PI * 2;

			// Current ring vertices
			const x1 = Math.cos(angle1) * currentPoint.x;
			const z1 = Math.sin(angle1) * currentPoint.x;
			const y1 = currentPoint.y;

			const x2 = Math.cos(angle2) * currentPoint.x;
			const z2 = Math.sin(angle2) * currentPoint.x;
			const y2 = currentPoint.y;

			// Next ring vertices
			const x3 = Math.cos(angle1) * nextPoint.x;
			const z3 = Math.sin(angle1) * nextPoint.x;
			const y3 = nextPoint.y;

			const x4 = Math.cos(angle2) * nextPoint.x;
			const z4 = Math.sin(angle2) * nextPoint.x;
			const y4 = nextPoint.y;

			// Two triangles per segment
			// Triangle 1: current1, current2, next1
			triangles.push(
				createTriangle({ x: x1, y: y1, z: z1 }, { x: x2, y: y2, z: z2 }, { x: x3, y: y3, z: z3 })
			);

			// Triangle 2: current2, next2, next1
			triangles.push(
				createTriangle({ x: x2, y: y2, z: z2 }, { x: x4, y: y4, z: z4 }, { x: x3, y: y3, z: z3 })
			);
		}
	}

	// Add top and bottom caps if the sculpture is closed
	const firstPoint = points[0];
	const secondPoint = points[1];
	if (firstPoint && firstPoint.x < 0.01 && secondPoint) {
		// Bottom cap
		const bottomY = firstPoint.y;
		for (let j = 0; j < segments; j++) {
			const angle1 = (j / segments) * Math.PI * 2;
			const angle2 = ((j + 1) / segments) * Math.PI * 2;

			const x1 = Math.cos(angle1) * secondPoint.x;
			const z1 = Math.sin(angle1) * secondPoint.x;
			const x2 = Math.cos(angle2) * secondPoint.x;
			const z2 = Math.sin(angle2) * secondPoint.x;

			triangles.push(
				createTriangle(
					{ x: 0, y: bottomY, z: 0 },
					{ x: x2, y: bottomY, z: z2 },
					{ x: x1, y: bottomY, z: z1 }
				)
			);
		}
	}

	const lastPoint = points[points.length - 1];
	const secondLastPoint = points[points.length - 2];
	if (lastPoint && lastPoint.x < 0.01 && secondLastPoint) {
		// Top cap
		const topY = lastPoint.y;
		for (let j = 0; j < segments; j++) {
			const angle1 = (j / segments) * Math.PI * 2;
			const angle2 = ((j + 1) / segments) * Math.PI * 2;

			const x1 = Math.cos(angle1) * secondLastPoint.x;
			const z1 = Math.sin(angle1) * secondLastPoint.x;
			const x2 = Math.cos(angle2) * secondLastPoint.x;
			const z2 = Math.sin(angle2) * secondLastPoint.x;

			triangles.push(
				createTriangle(
					{ x: 0, y: topY, z: 0 },
					{ x: x1, y: topY, z: z1 },
					{ x: x2, y: topY, z: z2 }
				)
			);
		}
	}

	const stlContent = `solid sculpture
${triangles.join('\n')}
endsolid sculpture`;

	return stlContent;
}

function createTriangle(
	v1: { x: number; y: number; z: number },
	v2: { x: number; y: number; z: number },
	v3: { x: number; y: number; z: number }
): string {
	// Calculate normal vector
	const u = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z };
	const v = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z };
	const normal = {
		x: u.y * v.z - u.z * v.y,
		y: u.z * v.x - u.x * v.z,
		z: u.x * v.y - u.y * v.x
	};

	// Normalize
	const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
	if (length > 0) {
		normal.x /= length;
		normal.y /= length;
		normal.z /= length;
	}

	return `facet normal ${normal.x} ${normal.y} ${normal.z}
  outer loop
    vertex ${v1.x} ${v1.y} ${v1.z}
    vertex ${v2.x} ${v2.y} ${v2.z}
    vertex ${v3.x} ${v3.y} ${v3.z}
  endloop
endfacet`;
}

export function downloadSTL(stlContent: string, filename: string): void {
	const blob = new Blob([stlContent], { type: 'model/stl' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
