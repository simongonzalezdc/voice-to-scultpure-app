import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import {
	LatheGeometry,
	Vector2,
	Mesh,
	MeshPhysicalMaterial,
	MeshStandardMaterial,
	Color
} from 'three';
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

		// Create geometry from deformed curve
		const vectors = deformedCurve.map((p) => new Vector2(p.x, p.y));
		const geometry = new LatheGeometry(vectors, 32);

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
			const glazeColor = sculpture.surface.glazeColor || '#FFFFFF';
			// Blend base color with glaze color based on transmission
			const blendedColor = blendColors(baseColor, glazeColor, sculpture.surface.glazeTransmission);

			material = new MeshPhysicalMaterial({
				color: blendedColor,
				transmission: sculpture.surface.glazeTransmission * 0.8,
				thickness: 0.5,
				roughness: sculpture.surface.textureRoughness,
				clearcoat: Math.max(0, sculpture.surface.glazeTransmission),
				clearcoatRoughness: 0.1,
				metalness: 0.1,
				ior: 1.5
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
