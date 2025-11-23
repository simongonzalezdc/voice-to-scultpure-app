import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { LatheGeometry, Vector2, Mesh, MeshPhysicalMaterial, BufferAttribute } from 'three';
import type { SculptureDefinition } from '$lib/types';
import { applyDeformation } from '$lib/engine/physicsMapping';

/**
 * Export sculpture to GLB format with vertex colors and PBR materials
 * @param sculpture - The sculpture definition to export
 * @param filename - Optional filename (defaults to sculpture name + timestamp)
 */
export async function exportSculptureToGLB(
	sculpture: SculptureDefinition,
	filename?: string
): Promise<void> {
	try {
		// Apply current deformation parameters before export
		const deformedCurve = applyDeformation(sculpture.radiusCurve, sculpture.deformation);

		// Determine segment count (match main sculpture logic)
		const roughnessInput = sculpture.surface.textureRoughness ?? 0.5;
		const segments = Math.floor(6 + roughnessInput * 58);

		// Create geometry from deformed curve
		const vectors = deformedCurve.map((p) => new Vector2(p.x, p.y));
		const geometry = new LatheGeometry(vectors, segments);

		// Apply vertex colors if available
		if (sculpture.vertexColors && sculpture.vertexColors.length > 0) {
			const positions = geometry.attributes.position;
			const vertexCount = positions.count;
			const colorCount = sculpture.vertexColors.length / 3;

			if (colorCount === vertexCount) {
				// Perfect match - use saved colors directly
				const colors = new Float32Array(sculpture.vertexColors);
				geometry.setAttribute('color', new BufferAttribute(colors, 3));
			} else if (colorCount > 0) {
				// Resample colors by height (similar to Sculpture.svelte logic)
				const colors = new Float32Array(vertexCount * 3);
				const posArray = positions.array as Float32Array;

				// Find min/max Y for height normalization
				let minY = Infinity;
				let maxY = -Infinity;
				for (let i = 0; i < vertexCount; i++) {
					const y = posArray[i * 3 + 1];
					if (y < minY) minY = y;
					if (y > maxY) maxY = y;
				}
				const totalHeight = maxY - minY;

				if (totalHeight > 0) {
					for (let i = 0; i < vertexCount; i++) {
						const y = posArray[i * 3 + 1];
						const normalizedHeight = (y - minY) / totalHeight;
						const oldVertexIdx = Math.floor(normalizedHeight * (colorCount - 1));
						const clampedIdx = Math.max(0, Math.min(colorCount - 1, oldVertexIdx));

						const colorIdx = clampedIdx * 3;
						colors[i * 3] = sculpture.vertexColors[colorIdx] ?? 1.0;
						colors[i * 3 + 1] = sculpture.vertexColors[colorIdx + 1] ?? 1.0;
						colors[i * 3 + 2] = sculpture.vertexColors[colorIdx + 2] ?? 1.0;
					}
				}

				geometry.setAttribute('color', new BufferAttribute(colors, 3));
			}
		}

		// Create material based on sculpture type
		const isPlastic = sculpture.surface.materialType === 'plastic';
		const baseColor = sculpture.surface.baseColor || (isPlastic ? '#3080ff' : '#E0C9A6');

		let material;
		if (isPlastic) {
			material = new MeshPhysicalMaterial({
				color: baseColor === '#FFFFFF' || baseColor === '#ffffff' ? '#EEEEEE' : baseColor,
				roughness: Math.max(0.3, sculpture.surface.textureRoughness),
				clearcoat: 0.5,
				clearcoatRoughness: 0.3,
				metalness: 0.1
			});
		} else {
			// Ceramic with glaze
			const glazeColor = sculpture.surface.baseColor || '#FFFFFF';
			// Blend base color with glaze color based on transmission
			const blendedColor = blendColors(baseColor, glazeColor, sculpture.surface.glazeTransmission);

			// Check if vertex colors are available
			const hasVertexColors =
				sculpture.vertexColors && sculpture.vertexColors.length > 0 && !!geometry.attributes.color;

			material = new MeshPhysicalMaterial({
				color: hasVertexColors ? 'white' : blendedColor,
				transmission: sculpture.surface.glazeTransmission * 0.8,
				thickness: 0.5,
				roughness: sculpture.surface.textureRoughness,
				clearcoat: Math.max(0, sculpture.surface.glazeTransmission),
				clearcoatRoughness: 0.1,
				metalness: 0.1,
				ior: 1.5,
				vertexColors: hasVertexColors
			});
		}

		// Create mesh
		const mesh = new Mesh(geometry, material);
		mesh.castShadow = true;
		mesh.receiveShadow = true;

		// Export to GLB
		const exporter = new GLTFExporter();
		const gltfData = await new Promise<ArrayBuffer>((resolve, reject) => {
			exporter.parse(
				mesh,
				(result) => {
					if (result instanceof ArrayBuffer) {
						resolve(result);
					} else {
						reject(new Error('GLTF export failed: Invalid result type'));
					}
				},
				(error) => {
					reject(error instanceof Error ? error : new Error(String(error)));
				},
				{ binary: true, includeCustomExtensions: false }
			);
		});

		// Download the GLB file
		const blob = new Blob([gltfData], { type: 'model/gltf-binary' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download =
			filename || `sculpture-${sculpture.name.replace(/\s+/g, '-')}-${Date.now()}.glb`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);

		// Cleanup
		geometry.dispose();
		material.dispose();
	} catch (error) {
		console.error('GLB export failed:', error);
		throw error;
	}
}

/**
 * Blend two hex colors
 */
function blendColors(colorA: string, colorB: string, t: number): string {
	const c1 = parseInt(colorA.slice(1), 16);
	const c2 = parseInt(colorB.slice(1), 16);

	const r1 = (c1 >> 16) & 255;
	const g1 = (c1 >> 8) & 255;
	const b1 = c1 & 255;

	const r2 = (c2 >> 16) & 255;
	const g2 = (c2 >> 8) & 255;
	const b2 = c2 & 255;

	const r = Math.round(r1 + (r2 - r1) * t);
	const g = Math.round(g1 + (g2 - g1) * t);
	const b = Math.round(b1 + (b2 - b1) * t);

	return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
