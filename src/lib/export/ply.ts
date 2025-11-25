import type { SculptureDefinition } from '$lib/types';
import { LatheGeometry, Vector2 } from 'three';
import { generateFinalProfile, type ExportOptions } from './exportUtils';
import { uiStore } from '$lib/stores/uiStore.svelte';

/**
 * Export sculpture to PLY format with vertex colors
 * PLY format supports vertex colors natively, making it ideal for colored 3D prints
 * @param sculpture - The sculpture definition to export
 * @param options - Export options (auto-fix, constraints, modifiers)
 */
export function exportSculptureToPLY(
	sculpture: SculptureDefinition,
	options?: Partial<ExportOptions>
): string {
	// Generate final profile with all transformations applied
	const exportOptions: ExportOptions = {
		autoFixGeometry: options?.autoFixGeometry ?? true,
		constraintMode: options?.constraintMode ?? 'ceramic',
		modifiers: options?.modifiers
	};

	const finalProfile = generateFinalProfile(sculpture, exportOptions);

	if (finalProfile.length < 2) {
		throw new Error('Not enough points for PLY export');
	}

	// Determine segment count (match main sculpture logic)
	// Read from uiStore (legacy property moved there)
	const roughnessInput = uiStore.activeGlaze.roughness ?? 0.5;
	const segments = Math.floor(6 + roughnessInput * 58);

	// Generate geometry to get vertex positions
	const vectors = finalProfile.map((p) => new Vector2(p.x, p.y));
	const geometry = new LatheGeometry(vectors, segments);

	const positions = geometry.attributes.position;
	if (!positions) {
		throw new Error('Geometry has no position attribute');
	}
	const vertexCount = positions.count;
	const posArray = positions.array as Float32Array;

	// Build vertex list with colors
	const vertices: string[] = [];

	// Extract vertex colors from layers or legacy property
	let vertexColors: number[] = [];

	// Check glaze layers first
	if (sculpture.layers && sculpture.layers.length > 0) {
		const glazeLayer = sculpture.layers.find((l) => l.type === 'glaze' && l.visible);
		if (glazeLayer && glazeLayer.data && glazeLayer.data.length > 0) {
			vertexColors = Array.from(glazeLayer.data);
		}
	}

	// Fallback to legacy property
	if (vertexColors.length === 0 && sculpture.vertexColors && sculpture.vertexColors.length > 0) {
		vertexColors = sculpture.vertexColors;
	}

	// Resample colors if needed (similar to Sculpture.svelte logic)
	const colorCount = vertexColors.length / 3;
	let colors: Float32Array;

	if (colorCount === vertexCount && vertexColors.length > 0) {
		// Perfect match
		colors = new Float32Array(vertexColors);
	} else if (colorCount > 0) {
		// Resample by height
		colors = new Float32Array(vertexCount * 3);
		let minY = Infinity;
		let maxY = -Infinity;
		for (let i = 0; i < vertexCount; i++) {
			const y = posArray[i * 3 + 1] ?? 0;
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		}
		const totalHeight = maxY - minY;

		if (totalHeight > 0) {
			for (let i = 0; i < vertexCount; i++) {
				const y = posArray[i * 3 + 1] ?? 0;
				const normalizedHeight = (y - minY) / totalHeight;
				const oldVertexIdx = Math.floor(normalizedHeight * (colorCount - 1));
				const clampedIdx = Math.max(0, Math.min(colorCount - 1, oldVertexIdx));

				const colorIdx = clampedIdx * 3;
				colors[i * 3] = vertexColors[colorIdx] ?? 1.0;
				colors[i * 3 + 1] = vertexColors[colorIdx + 1] ?? 1.0;
				colors[i * 3 + 2] = vertexColors[colorIdx + 2] ?? 1.0;
			}
		} else {
			// No height variation - use first color for all vertices
			for (let i = 0; i < vertexCount; i++) {
				colors[i * 3] = vertexColors[0] ?? 1.0;
				colors[i * 3 + 1] = vertexColors[1] ?? 1.0;
				colors[i * 3 + 2] = vertexColors[2] ?? 1.0;
			}
		}
	} else {
		// No colors - use white
		colors = new Float32Array(vertexCount * 3);
		colors.fill(1.0);
	}

	// Write vertices with colors (PLY format: x y z r g b)
	for (let i = 0; i < vertexCount; i++) {
		const x = posArray[i * 3] ?? 0;
		const y = posArray[i * 3 + 1] ?? 0;
		const z = posArray[i * 3 + 2] ?? 0;
		const r = Math.round((colors[i * 3] ?? 1) * 255);
		const g = Math.round((colors[i * 3 + 1] ?? 1) * 255);
		const b = Math.round((colors[i * 3 + 2] ?? 1) * 255);
		vertices.push(`${x} ${y} ${z} ${r} ${g} ${b}`);
	}

	// Build face list (triangles from LatheGeometry)
	const faces: string[] = [];
	const index = geometry.index;
	if (index) {
		const indexArray = index.array;
		for (let i = 0; i < indexArray.length; i += 3) {
			const v1 = indexArray[i];
			const v2 = indexArray[i + 1];
			const v3 = indexArray[i + 2];
			faces.push(`3 ${v1} ${v2} ${v3}`);
		}
	} else {
		// No index - generate faces manually (shouldn't happen with LatheGeometry, but fallback)
		for (let i = 0; i < vertexCount - segments; i++) {
			const ring = Math.floor(i / segments);
			const seg = i % segments;
			const nextSeg = (seg + 1) % segments;
			const nextRing = ring + 1;

			const v1 = ring * segments + seg;
			const v2 = ring * segments + nextSeg;
			const v3 = nextRing * segments + seg;
			const v4 = nextRing * segments + nextSeg;

			faces.push(`3 ${v1} ${v2} ${v3}`);
			faces.push(`3 ${v2} ${v4} ${v3}`);
		}
	}

	// Build PLY file
	const plyContent = `ply
format ascii 1.0
comment Exported from Voice-to-Sculpture Studio
comment Sculpture: ${sculpture.name}
element vertex ${vertexCount}
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
element face ${faces.length}
property list uchar int vertex_indices
end_header
${vertices.join('\n')}
${faces.join('\n')}
`;

	geometry.dispose();
	return plyContent;
}

export function downloadPLY(plyContent: string, filename: string): void {
	const blob = new Blob([plyContent], { type: 'model/ply' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
