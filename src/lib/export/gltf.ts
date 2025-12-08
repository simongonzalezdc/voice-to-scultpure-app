import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { LatheGeometry, Vector2, Mesh, MeshPhysicalMaterial, BufferAttribute, Color } from 'three';
import type { SculptureDefinition } from '$lib/types';
import { generateFinalProfile, type ExportOptions } from './exportUtils';
import { uiStore } from '$lib/stores/uiStore.svelte';
import { getSegmentsForFacetStyle } from '$lib/config/constants';
import { createCeramicMaterialProps } from '$lib/engine/materialFactory';

/**
 * Export sculpture to GLB format with vertex colors and PBR materials
 * @param sculpture - The sculpture definition to export
 * @param filename - Optional filename (defaults to sculpture name + timestamp)
 * @param options - Export options (auto-fix, constraints, modifiers)
 */
export async function exportSculptureToGLB(
	sculpture: SculptureDefinition,
	filename?: string,
	options?: Partial<ExportOptions>
): Promise<void> {
	try {
		// Generate final profile with all transformations applied
		const exportOptions: ExportOptions = {
			autoFixGeometry: options?.autoFixGeometry ?? true,
			constraintMode: options?.constraintMode ?? 'ceramic',
			modifiers: options?.modifiers,
			deformation: options?.deformation,
			scaleToMillimeters: options?.scaleToMillimeters ?? true
		};

		const finalProfile = generateFinalProfile(sculpture, exportOptions);

		// Determine segment count (match main sculpture logic)
		const segments = getSegmentsForFacetStyle(uiStore.facetStyle);

		// Create geometry from final profile
		const vectors = finalProfile.map((p) => new Vector2(p.x, p.y));
		const geometry = new LatheGeometry(vectors, segments);

		// Apply vertex colors if available
		// Check for colors in: 1) layers (glaze type), 2) legacy vertexColors property
		let vertexColors: number[] = [];

		// Extract from glaze layers
		if (sculpture.layers && sculpture.layers.length > 0) {
			const glazeLayer = sculpture.layers.find((l) => l.type === 'glaze' && l.visible);
			if (glazeLayer && glazeLayer.data && glazeLayer.data.length > 0) {
				// Glaze layer data is stored as RGB triplets
				vertexColors = Array.from(glazeLayer.data);
			}
		}

		// Fallback to legacy property
		if (vertexColors.length === 0 && sculpture.vertexColors && sculpture.vertexColors.length > 0) {
			vertexColors = sculpture.vertexColors;
		}
		if (vertexColors && vertexColors.length > 0) {
			const positions = geometry.attributes.position;
			if (!positions) {
				throw new Error('Geometry has no position attribute');
			}
			const vertexCount = positions.count;
			const colorCount = vertexColors.length / 3;

			if (colorCount === vertexCount) {
				// Perfect match - use saved colors directly
				const colors = new Float32Array(vertexColors);
				geometry.setAttribute('color', new BufferAttribute(colors, 3));
			} else if (colorCount > 0) {
				// Resample colors by height (similar to Sculpture.svelte logic)
				const colors = new Float32Array(vertexCount * 3);
				const posArray = positions.array as Float32Array;

				// Find min/max Y for height normalization
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
						const scaledIndex = normalizedHeight * (colorCount - 1);
						const lowerIdx = Math.floor(scaledIndex);
						const upperIdx = Math.min(colorCount - 1, lowerIdx + 1);
						const t = scaledIndex - lowerIdx;

						const lowerColorIdx = lowerIdx * 3;
						const upperColorIdx = upperIdx * 3;

						const lr = vertexColors[lowerColorIdx] ?? 1.0;
						const lg = vertexColors[lowerColorIdx + 1] ?? 1.0;
						const lb = vertexColors[lowerColorIdx + 2] ?? 1.0;

						const ur = vertexColors[upperColorIdx] ?? lr;
						const ug = vertexColors[upperColorIdx + 1] ?? lg;
						const ub = vertexColors[upperColorIdx + 2] ?? lb;

						colors[i * 3] = lr + (ur - lr) * t;
						colors[i * 3 + 1] = lg + (ug - lg) * t;
						colors[i * 3 + 2] = lb + (ub - lb) * t;
					}
				}

				geometry.setAttribute('color', new BufferAttribute(colors, 3));
			}
		}

		// Create material based on sculpture type
		// Read from uiStore (active glaze settings)
		const hasVertexColors = geometry.hasAttribute('color');
		const baseColor = uiStore.activeGlaze.baseColor || '#E0C9A6';
		const isPlastic = uiStore.activeGlaze.materialType === 'plastic';
		const roughnessInput = uiStore.activeGlaze.roughness ?? 0.5;
		const transmission = uiStore.activeGlaze.transmission ?? 0;

		let material: MeshPhysicalMaterial;
		if (isPlastic) {
			material = new MeshPhysicalMaterial({
				color: baseColor === '#FFFFFF' || baseColor === '#ffffff' ? '#EEEEEE' : baseColor,
				roughness: Math.max(0.3, roughnessInput),
				clearcoat: 0.5,
				clearcoatRoughness: 0.3,
				metalness: 0.1,
				vertexColors: hasVertexColors
			});
		} else {
			// Ceramic with glaze
			const ceramicProps = createCeramicMaterialProps(baseColor, roughnessInput, transmission);
			ceramicProps.vertexColors = hasVertexColors;
			// Keep emissive neutral for export; color driven by vertex colors or base color
			ceramicProps.emissive = '#000000';

			material = new MeshPhysicalMaterial({
				...ceramicProps,
				color: ceramicProps.vertexColors ? '#ffffff' : ceramicProps.color,
				sheenColor: new Color(ceramicProps.sheenColor ?? '#ffffff'),
				attenuationColor: new Color(ceramicProps.attenuationColor ?? '#ffffff')
			});
		}

		material.userData = buildMaterialExtensions(material);

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
				{ binary: true, includeCustomExtensions: true }
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

function buildMaterialExtensions(material: MeshPhysicalMaterial) {
	const colorToArray = (value: Color | string | undefined): [number, number, number] => {
		const color = new Color(value ?? '#ffffff');
		return [color.r, color.g, color.b];
	};

	return {
		gltfExtensions: {
			KHR_materials_clearcoat: {
				clearcoatFactor: material.clearcoat ?? 0,
				clearcoatRoughnessFactor: material.clearcoatRoughness ?? 0
			},
			KHR_materials_sheen: {
				sheenColorFactor: colorToArray(material.sheenColor as Color | string),
				sheenRoughnessFactor: material.sheenRoughness ?? 0
			},
			KHR_materials_transmission: {
				transmissionFactor: material.transmission ?? 0
			},
			KHR_materials_volume: {
				thicknessFactor: material.thickness ?? 0,
				attenuationColor: colorToArray(material.attenuationColor as Color | string),
				attenuationDistance: material.attenuationDistance ?? 0
			}
		}
	};
}
