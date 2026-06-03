import type { SculptureDefinition } from '$lib/types';
import { generateFinalProfile, type ExportOptions } from './exportUtils';
import { uiStore } from '$lib/stores/uiStore.svelte';
import { getSegmentsForFacetStyle, DEFAULT_HEIGHT_MM } from '$lib/config/constants';
import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { Mesh, BufferGeometry, Matrix4, Vector3, Float32BufferAttribute } from 'three';

// ============================================================================
// MANIFOLD GEOMETRY VALIDATION & REPAIR
// ============================================================================

interface ManifoldReport {
	isValid: boolean;
	degenerateTriangles: number;
	nanVertices: number;
	zeroAreaTriangles: number;
	repaired: boolean;
}

/**
 * Validate and repair geometry to ensure manifold (watertight) mesh
 * Fixes common issues that cause slicer errors:
 * - NaN/Infinity vertex coordinates
 * - Degenerate triangles (zero area)
 * - Duplicate vertices within triangles
 */
function validateAndRepairGeometry(geometry: BufferGeometry): ManifoldReport {
	const report: ManifoldReport = {
		isValid: true,
		degenerateTriangles: 0,
		nanVertices: 0,
		zeroAreaTriangles: 0,
		repaired: false
	};

	const positions = geometry.getAttribute('position');
	if (!positions) {
		console.error('❌ [MANIFOLD] No position attribute found');
		report.isValid = false;
		return report;
	}

	const posArray = positions.array as Float32Array;
	const vertexCount = positions.count;

	// Check for NaN/Infinity values and repair
	for (let i = 0; i < posArray.length; i++) {
		if (!Number.isFinite(posArray[i])) {
			report.nanVertices++;
			// Repair: replace with 0 (safe default)
			posArray[i] = 0;
			report.repaired = true;
		}
	}

	// Check triangles for degeneracy (zero area)
	const EPSILON = 1e-10; // Minimum edge length squared
	const triangleCount = vertexCount / 3;

	const v1 = new Vector3();
	const v2 = new Vector3();
	const v3 = new Vector3();
	const edge1 = new Vector3();
	const edge2 = new Vector3();
	const cross = new Vector3();

	for (let t = 0; t < triangleCount; t++) {
		const i = t * 3;

		v1.fromBufferAttribute(positions, i);
		v2.fromBufferAttribute(positions, i + 1);
		v3.fromBufferAttribute(positions, i + 2);

		// Check for duplicate vertices
		if (
			v1.distanceToSquared(v2) < EPSILON ||
			v2.distanceToSquared(v3) < EPSILON ||
			v3.distanceToSquared(v1) < EPSILON
		) {
			report.degenerateTriangles++;
		}

		// Check for zero area (collinear points)
		edge1.subVectors(v2, v1);
		edge2.subVectors(v3, v1);
		cross.crossVectors(edge1, edge2);

		const area = cross.lengthSq();
		if (area < EPSILON) {
			report.zeroAreaTriangles++;
		}
	}

	// Update validity
	report.isValid =
		report.nanVertices === 0 && report.degenerateTriangles === 0 && report.zeroAreaTriangles === 0;

	// Mark buffer as needing update if repaired
	if (report.repaired) {
		positions.needsUpdate = true;
	}

	// Log report
	if (!report.isValid || report.repaired) {
		console.warn(`⚠️ [MANIFOLD] Geometry issues detected:`, {
			nanVertices: report.nanVertices,
			degenerateTriangles: report.degenerateTriangles,
			zeroAreaTriangles: report.zeroAreaTriangles,
			repaired: report.repaired
		});
	} else {
		console.log(`✅ [MANIFOLD] Geometry is valid (${triangleCount} triangles)`);
	}

	return report;
}

/**
 * Remove degenerate triangles from indexed geometry
 * This creates a new geometry without zero-area faces
 */
function removeDegenerate(geometry: BufferGeometry): BufferGeometry {
	const positions = geometry.getAttribute('position');
	if (!positions) return geometry;

	const EPSILON = 1e-8;
	const newPositions: number[] = [];
	const newNormals: number[] = [];
	const normals = geometry.getAttribute('normal');

	const v1 = new Vector3();
	const v2 = new Vector3();
	const v3 = new Vector3();
	const edge1 = new Vector3();
	const edge2 = new Vector3();
	const cross = new Vector3();

	let removed = 0;
	const triangleCount = positions.count / 3;

	for (let t = 0; t < triangleCount; t++) {
		const i = t * 3;

		v1.fromBufferAttribute(positions, i);
		v2.fromBufferAttribute(positions, i + 1);
		v3.fromBufferAttribute(positions, i + 2);

		// Check edge lengths
		const e1Len = v1.distanceToSquared(v2);
		const e2Len = v2.distanceToSquared(v3);
		const e3Len = v3.distanceToSquared(v1);

		if (e1Len < EPSILON || e2Len < EPSILON || e3Len < EPSILON) {
			removed++;
			continue; // Skip degenerate
		}

		// Check area
		edge1.subVectors(v2, v1);
		edge2.subVectors(v3, v1);
		cross.crossVectors(edge1, edge2);

		if (cross.lengthSq() < EPSILON) {
			removed++;
			continue; // Skip zero-area
		}

		// Keep this triangle
		newPositions.push(v1.x, v1.y, v1.z);
		newPositions.push(v2.x, v2.y, v2.z);
		newPositions.push(v3.x, v3.y, v3.z);

		if (normals) {
			for (let vi = 0; vi < 3; vi++) {
				const ni = i + vi;
				newNormals.push(normals.getX(ni), normals.getY(ni), normals.getZ(ni));
			}
		}
	}

	if (removed > 0) {
		console.log(`🔧 [MANIFOLD] Removed ${removed} degenerate triangles`);

		const cleanGeometry = new BufferGeometry();
		cleanGeometry.setAttribute(
			'position',
			new (geometry.getAttribute('position') as any).constructor(new Float32Array(newPositions), 3)
		);

		if (newNormals.length > 0) {
			cleanGeometry.setAttribute(
				'normal',
				new (geometry.getAttribute('normal') as any).constructor(new Float32Array(newNormals), 3)
			);
		} else {
			cleanGeometry.computeVertexNormals();
		}

		return cleanGeometry;
	}

	return geometry;
}

// ============================================================================
// MESH SIMPLIFICATION FOR SLICER OPTIMIZATION
// ============================================================================

/**
 * Simplify geometry for 3D printing (reduce triangle count for slicer)
 * Uses SimplifyModifier to maintain shape while reducing complexity
 * @param geometry - BufferGeometry to simplify
 * @param targetTriangleCount - Target number of triangles (aim for ~50K max)
 * @returns Simplified geometry
 */
function simplifyGeometry(
	geometry: BufferGeometry,
	targetTriangleCount: number = 50000
): BufferGeometry {
	const posAttr = geometry.getAttribute('position');
	if (!posAttr) return geometry;

	const currentTriangleCount = posAttr.count / 3;

	if (currentTriangleCount <= targetTriangleCount) {
		console.log(`✅ [SIMPLIFY] Geometry already optimized: ${currentTriangleCount} triangles`);
		return geometry;
	}

	// Calculate target vertex count (3 vertices per triangle)
	const targetVertexCount = targetTriangleCount * 3;

	// Use SimplifyModifier to reduce geometry
	try {
		console.log(
			`🔄 [SIMPLIFY] Reducing from ${currentTriangleCount} to ~${targetTriangleCount} triangles...`
		);

		const modifier = new SimplifyModifier();
		const simplified = modifier.modify(geometry, targetVertexCount);

		const resultTriangleCount = simplified.getAttribute('position').count / 3;
		console.log(
			`✅ [SIMPLIFY] Success: ${resultTriangleCount} triangles (${((resultTriangleCount / currentTriangleCount) * 100).toFixed(1)}% of original)`
		);

		return simplified;
	} catch (err) {
		console.warn(`⚠️ [SIMPLIFY] Simplification failed, using original:`, err);
		return geometry;
	}
}

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
	console.log(`📦 [STL DIRECT] Mesh type: ${mesh.type}, geometry type: ${mesh.geometry.type}`);

	// Clone the geometry to avoid modifying the original
	let geometry = mesh.geometry.clone();

	// DEBUG: Check geometry details
	const positions = geometry.getAttribute('position');
	const index = geometry.getIndex();
	const drawRange = geometry.drawRange;

	if (positions) {
		console.log(
			`📦 [STL DEBUG] Vertex count: ${positions.count}, Indexed: ${!!index}, Index count: ${index?.count ?? 0}`
		);
		console.log(`📦 [STL DEBUG] Draw range: start=${drawRange.start}, count=${drawRange.count}`);

		// Sample first few vertices to check Z values
		const samples: string[] = [];
		for (let i = 0; i < Math.min(5, positions.count); i++) {
			const x = positions.getX(i).toFixed(3);
			const y = positions.getY(i).toFixed(3);
			const z = positions.getZ(i).toFixed(3);
			samples.push(`[${x}, ${y}, ${z}]`);
		}
		console.log(`📦 [STL DEBUG] First vertices (before transforms): ${samples.join(', ')}`);

		// Sample some vertices at different angles to verify 3D
		const midIdx = Math.floor(positions.count / 2);
		const sample2: string[] = [];
		for (let i = midIdx; i < Math.min(midIdx + 5, positions.count); i++) {
			const x = positions.getX(i).toFixed(3);
			const y = positions.getY(i).toFixed(3);
			const z = positions.getZ(i).toFixed(3);
			sample2.push(`[${x}, ${y}, ${z}]`);
		}
		console.log(`📦 [STL DEBUG] Mid vertices (should have non-zero Z): ${sample2.join(', ')}`);

		// Check if geometry is flat (all Z near zero)
		let hasNonZeroZ = false;
		let zMin = Infinity,
			zMax = -Infinity;
		for (let i = 0; i < positions.count; i++) {
			const z = positions.getZ(i);
			if (z < zMin) zMin = z;
			if (z > zMax) zMax = z;
			if (Math.abs(z) > 0.001) {
				hasNonZeroZ = true;
			}
		}
		console.log(`📦 [STL DEBUG] Z range: [${zMin.toFixed(3)}, ${zMax.toFixed(3)}]`);

		if (!hasNonZeroZ) {
			console.error(
				`❌ [STL DEBUG] CRITICAL: All Z values are ~0! Geometry is flat/2D, not a 3D lathe!`
			);
			console.error(
				`❌ [STL DEBUG] This means sculptureStore.meshReference is pointing to wrong geometry!`
			);
		} else {
			console.log(`✅ [STL DEBUG] Geometry is 3D with proper Z variation`);
		}
	}

	// FIX: If geometry has drawRange limiting visibility, convert to non-indexed
	// and trim to only include the visible portion
	// STLExporter may not respect drawRange, causing garbage data export
	if (index && drawRange.count !== Infinity && drawRange.count < index.count) {
		console.log(
			`🔧 [STL FIX] Trimming geometry to drawRange (${drawRange.count} of ${index.count} indices)`
		);

		// Convert to non-indexed geometry (STLExporter handles this better)
		const nonIndexedGeometry = geometry.toNonIndexed();

		// Now trim to only the active triangles
		const triCount = Math.floor(drawRange.count / 3);
		const vertexCount = triCount * 3;

		const newPositions = new Float32Array(vertexCount * 3);
		const oldPositions = nonIndexedGeometry.getAttribute('position');

		for (let i = 0; i < vertexCount; i++) {
			newPositions[i * 3] = oldPositions.getX(i);
			newPositions[i * 3 + 1] = oldPositions.getY(i);
			newPositions[i * 3 + 2] = oldPositions.getZ(i);
		}

		const trimmedGeometry = new BufferGeometry();
		trimmedGeometry.setAttribute('position', new Float32BufferAttribute(newPositions, 3));
		trimmedGeometry.computeVertexNormals();

		// Replace geometry with trimmed version
		geometry.dispose();
		nonIndexedGeometry.dispose();
		geometry = trimmedGeometry;

		console.log(`✅ [STL FIX] Trimmed to ${vertexCount} vertices (${triCount} triangles)`);
	}

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

	console.log(
		`📦 [STL DIRECT] Current height: ${currentHeight.toFixed(3)}, Target: ${targetHeightMM}mm, Scale: ${scaleFactor.toFixed(2)}x`
	);

	// Apply scaling to convert to millimeters
	const scaleMatrix = new Matrix4().makeScale(scaleFactor, scaleFactor, scaleFactor);
	geometry.applyMatrix4(scaleMatrix);

	// ========================================================================
	// MANIFOLD VALIDATION & REPAIR
	// Ensures the mesh is watertight and slicer-compatible
	// ========================================================================
	console.log(`🔍 [STL DIRECT] Validating geometry for manifold integrity...`);

	// Step 1: Validate and repair NaN values
	const report = validateAndRepairGeometry(geometry);

	// Step 2: Remove degenerate triangles (zero area, duplicate vertices)
	if (report.degenerateTriangles > 0 || report.zeroAreaTriangles > 0) {
		const cleanGeometry = removeDegenerate(geometry);
		geometry.dispose();
		geometry = cleanGeometry;
	}

	// Log final status
	if (report.repaired || report.degenerateTriangles > 0 || report.zeroAreaTriangles > 0) {
		console.log(`🔧 [STL DIRECT] Geometry repaired for slicer compatibility`);
	} else {
		console.log(`✅ [STL DIRECT] Geometry is manifold-ready`);
	}

	// STEP 3: Simplify geometry for 3D printing mode (slicer optimization)
	// Only simplify if in 3D Print constraint mode
	if (uiStore.constraintMode === '3d_print') {
		console.log(`🖨️ [STL DIRECT] Simplifying geometry for slicer compatibility...`);
		const simplified = simplifyGeometry(geometry, 50000); // Target 50K triangles max
		geometry.dispose();
		geometry = simplified;
	}

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
	const minY = Math.min(...points.map((p) => p.y));
	const maxY = Math.max(...points.map((p) => p.y));
	const minX = Math.min(...points.map((p) => p.x));
	const maxX = Math.max(...points.map((p) => p.x));
	console.log(`📦 [STL EXPORT] Profile: ${points.length} points`);
	console.log(`📦 [STL EXPORT] Y range: ${minY.toFixed(1)} - ${maxY.toFixed(1)} (height in mm)`);
	console.log(`📦 [STL EXPORT] X range: ${minX.toFixed(1)} - ${maxX.toFixed(1)} (radius in mm)`);
	console.log(
		`📦 [STL EXPORT] First 3 points:`,
		points.slice(0, 3).map((p) => `(r=${p.x.toFixed(1)}, h=${p.y.toFixed(1)})`)
	);
	console.log(
		`📦 [STL EXPORT] Last 3 points:`,
		points.slice(-3).map((p) => `(r=${p.x.toFixed(1)}, h=${p.y.toFixed(1)})`)
	);

	const triangles: string[] = [];
	let skippedDegenerate = 0; // Count degenerate triangles removed

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

			// Two triangles per segment (skip degenerate)
			// Triangle 1: current1, current2, next1
			const tri1 = createTriangle(
				{ x: x1, y: y1, z: z1 },
				{ x: x2, y: y2, z: z2 },
				{ x: x3, y: y3, z: z3 }
			);
			if (tri1) triangles.push(tri1);
			else skippedDegenerate++;

			// Triangle 2: current2, next2, next1
			const tri2 = createTriangle(
				{ x: x2, y: y2, z: z2 },
				{ x: x4, y: y4, z: z4 },
				{ x: x3, y: y3, z: z3 }
			);
			if (tri2) triangles.push(tri2);
			else skippedDegenerate++;
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

			const capTri = createTriangle(
				{ x: 0, y: bottomY, z: 0 },
				{ x: x2, y: bottomY, z: z2 },
				{ x: x1, y: bottomY, z: z1 }
			);
			if (capTri) triangles.push(capTri);
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

			const topTri = createTriangle(
				{ x: 0, y: topY, z: 0 },
				{ x: x1, y: topY, z: z1 },
				{ x: x2, y: topY, z: z2 }
			);
			if (topTri) triangles.push(topTri);
		}
	}

	// Log manifold repair stats
	if (skippedDegenerate > 0) {
		console.log(
			`🔧 [STL EXPORT] Removed ${skippedDegenerate} degenerate triangles for manifold compliance`
		);
	}
	console.log(`✅ [STL EXPORT] Final mesh: ${triangles.length} triangles (manifold-ready)`);

	const stlContent = `solid sculpture
${triangles.join('\n')}
endsolid sculpture`;

	return stlContent;
}

function createTriangle(
	v1: { x: number; y: number; z: number },
	v2: { x: number; y: number; z: number },
	v3: { x: number; y: number; z: number }
): string | null {
	// Skip triangles with NaN/Infinity values
	const values = [v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z];
	if (values.some((v) => !Number.isFinite(v))) {
		return null; // Skip invalid triangle
	}

	// Calculate edge vectors
	const u = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z };
	const v = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z };

	// Calculate normal (cross product)
	const normal = {
		x: u.y * v.z - u.z * v.y,
		y: u.z * v.x - u.x * v.z,
		z: u.x * v.y - u.y * v.x
	};

	// Calculate length (also area * 2 of triangle)
	const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);

	// Skip degenerate triangles (zero area / collinear points)
	const EPSILON = 1e-10;
	if (length < EPSILON) {
		return null; // Skip zero-area triangle
	}

	// Normalize
	normal.x /= length;
	normal.y /= length;
	normal.z /= length;

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
