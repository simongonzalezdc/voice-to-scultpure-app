import type { SculptureDefinition } from '$lib/types';
import { generateFinalProfile, type ExportOptions } from './exportUtils';
import { uiStore } from '$lib/stores/uiStore.svelte';
import { getSegmentsForFacetStyle, DEFAULT_HEIGHT_MM } from '$lib/config/constants';
import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { Mesh, BufferGeometry, Matrix4 } from 'three';

// ============================================================================
// DIRECT MESH EXPORT (Guaranteed to match app view)
// ============================================================================

/**
 * Export the ACTUAL rendered mesh to STL format.
 * This guarantees 100% match with what the user sees because we export
 * the exact same geometry that Three.js is rendering.
 * 
 * @param sculpture - The sculpture definition (for height/scaling info)
 * @returns STL content as string
 */
export function exportMeshToSTL(sculpture: SculptureDefinition): string {
	const mesh = sculptureStore.meshReference;
	
	if (!mesh || !mesh.geometry) {
		throw new Error('No mesh reference available. Please ensure a sculpture is rendered.');
	}
	
	console.log(`📦 [STL DIRECT] Exporting actual rendered mesh geometry`);
	
	// Clone the geometry to avoid modifying the original
	const geometry = mesh.geometry.clone();
	
	// Apply the mesh's world matrix to bake in all transforms (including heightScale)
	mesh.updateMatrixWorld(true);
	geometry.applyMatrix4(mesh.matrixWorld);
	
	// Get the sculpture's target height in mm
	const targetHeightMM = sculpture.physical?.height || DEFAULT_HEIGHT_MM;
	
	// Compute current bounding box to determine scale
	geometry.computeBoundingBox();
	const bbox = geometry.boundingBox;
	if (!bbox) {
		throw new Error('Could not compute bounding box');
	}
	
	const currentHeight = bbox.max.y - bbox.min.y;
	
	// Scale to target height in mm
	// The mesh is in normalized units (height ~1.0 * heightScale)
	// We need to scale to actual millimeters
	const scaleFactor = targetHeightMM / currentHeight;
	
	console.log(`📦 [STL DIRECT] Current height: ${currentHeight.toFixed(3)}, Target: ${targetHeightMM}mm, Scale: ${scaleFactor.toFixed(2)}x`);
	
	// Apply scaling to convert to millimeters
	const scaleMatrix = new Matrix4().makeScale(scaleFactor, scaleFactor, scaleFactor);
	geometry.applyMatrix4(scaleMatrix);
	
	// Create a temporary mesh for the exporter
	const exportMesh = new Mesh(geometry);
	
	// Use Three.js STLExporter
	const exporter = new STLExporter();
	const stlContent = exporter.parse(exportMesh, { binary: false }) as string;
	
	// Cleanup
	geometry.dispose();
	
	console.log(`📦 [STL DIRECT] Export complete - geometry matches app view exactly`);
	
	return stlContent;
}

// ============================================================================
// LATHE EXPORT (Legacy - generates from data)
// ============================================================================

export function lathePointsToSTL(
	sculpture: SculptureDefinition,
	options?: Partial<ExportOptions>
): string {
	// AUDIT FIX: Generate final profile with all transformations applied
	// Now includes scaling to real millimeters for 3D printing
	const exportOptions: ExportOptions = {
		autoFixGeometry: options?.autoFixGeometry ?? true,
		constraintMode: options?.constraintMode ?? 'digital', // FIX: Default to digital (no constraints)
		modifiers: options?.modifiers,
		deformation: options?.deformation,
		scaleToMillimeters: options?.scaleToMillimeters ?? true // Default ON for STL
	};
	
	console.log(`📦 [STL EXPORT] Options:`, {
		autoFix: exportOptions.autoFixGeometry,
		constraints: exportOptions.constraintMode,
		scaleToMM: exportOptions.scaleToMillimeters,
		sculptureHeight: sculpture.physical?.height
	});

	const points = generateFinalProfile(sculpture, exportOptions);

	if (points.length < 2) {
		throw new Error('Not enough points for STL export');
	}

	// DEBUG: Log export profile stats
	const minY = Math.min(...points.map(p => p.y));
	const maxY = Math.max(...points.map(p => p.y));
	const minX = Math.min(...points.map(p => p.x));
	const maxX = Math.max(...points.map(p => p.x));
	console.log(`📦 [STL EXPORT] Profile: ${points.length} points`);
	console.log(`📦 [STL EXPORT] Y range: ${minY.toFixed(1)} - ${maxY.toFixed(1)} (height in mm)`);
	console.log(`📦 [STL EXPORT] X range: ${minX.toFixed(1)} - ${maxX.toFixed(1)} (radius in mm)`);
	console.log(`📦 [STL EXPORT] First 3 points:`, points.slice(0, 3).map(p => `(r=${p.x.toFixed(1)}, h=${p.y.toFixed(1)})`));
	console.log(`📦 [STL EXPORT] Last 3 points:`, points.slice(-3).map(p => `(r=${p.x.toFixed(1)}, h=${p.y.toFixed(1)})`));

	const triangles: string[] = [];
	// CRITICAL: Use the SAME segment count as the renderer (facet style)
	// This ensures the STL matches the app view exactly (including the "fins" aesthetic)
	const segments = getSegmentsForFacetStyle(uiStore.facetStyle);
	console.log(`📦 [STL EXPORT] Using ${segments} segments for "${uiStore.facetStyle}" facet style`);

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
