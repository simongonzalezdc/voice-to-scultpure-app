import type { SculptureDefinition } from '$lib/types';

export function lathePointsToSTL(sculpture: SculptureDefinition): string {
	const points = sculpture.radiusCurve;
	if (points.length < 2) {
		throw new Error('Not enough points for STL export');
	}

	const triangles: string[] = [];
	const segments = 32; // Number of segments around the lathe

	// Generate triangles for each ring
	for (let i = 0; i < points.length - 1; i++) {
		const currentPoint = points[i];
		const nextPoint = points[i + 1];

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
			triangles.push(createTriangle(
				{x: x1, y: y1, z: z1},
				{x: x2, y: y2, z: z2},
				{x: x3, y: y3, z: z3}
			));

			// Triangle 2: current2, next2, next1
			triangles.push(createTriangle(
				{x: x2, y: y2, z: z2},
				{x: x4, y: y4, z: z4},
				{x: x3, y: y3, z: z3}
			));
		}
	}

	// Add top and bottom caps if the sculpture is closed
	if (points[0].x < 0.01) { // Bottom cap
		const bottomY = points[0].y;
		for (let j = 0; j < segments; j++) {
			const angle1 = (j / segments) * Math.PI * 2;
			const angle2 = ((j + 1) / segments) * Math.PI * 2;

			const x1 = Math.cos(angle1) * points[1].x;
			const z1 = Math.sin(angle1) * points[1].x;
			const x2 = Math.cos(angle2) * points[1].x;
			const z2 = Math.sin(angle2) * points[1].x;

			triangles.push(createTriangle(
				{x: 0, y: bottomY, z: 0},
				{x: x2, y: bottomY, z: z2},
				{x: x1, y: bottomY, z: z1}
			));
		}
	}

	const lastPoint = points[points.length - 1];
	if (lastPoint.x < 0.01) { // Top cap
		const topY = lastPoint.y;
		for (let j = 0; j < segments; j++) {
			const angle1 = (j / segments) * Math.PI * 2;
			const angle2 = ((j + 1) / segments) * Math.PI * 2;

			const x1 = Math.cos(angle1) * points[points.length - 2].x;
			const z1 = Math.sin(angle1) * points[points.length - 2].x;
			const x2 = Math.cos(angle2) * points[points.length - 2].x;
			const z2 = Math.sin(angle2) * points[points.length - 2].x;

			triangles.push(createTriangle(
				{x: 0, y: topY, z: 0},
				{x: x1, y: topY, z: z1},
				{x: x2, y: topY, z: z2}
			));
		}
	}

	const stlContent = `solid sculpture
${triangles.join('\n')}
endsolid sculpture`;

	return stlContent;
}

function createTriangle(v1: {x: number, y: number, z: number}, v2: {x: number, y: number, z: number}, v3: {x: number, y: number, z: number}): string {
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
