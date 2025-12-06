/**
 * Pure Geometry Factory Module
 * Handles creation and manipulation of 3D geometries
 * Extracted from Sculpture.svelte to reduce component complexity
 *
 * ARCHITECTURAL PRINCIPLE: NO SIDE EFFECTS
 * - All functions are pure and deterministic
 * - No state mutations outside the function scope
 * - Errors are caught and reported with fallback geometries
 */

import { LatheGeometry, Vector2, BufferAttribute, BufferGeometry, CylinderGeometry } from 'three';
import type { LathePoint, SculptureDefinition } from '$lib/types';
import { applyModifiers, applyDeformation } from './physicsMapping';
import { applyConstraints, type ConstraintMode } from './constraints';
import {
	DEFAULT_CYLINDER_RADIUS,
	DEFAULT_CYLINDER_SEGMENTS,
	DEFAULT_HEIGHT_MM,
	GEOMETRY_MIN_SEGMENTS,
	getSegmentsForFacetStyle
} from '$lib/config/constants';
import { uiStore } from '$lib/stores/uiStore.svelte';

/**
 * Creates a BufferGeometry from a profile curve.
 * Pure function: No state mutations, safe to call repeatedly.
 *
 * @param profile - Array of points defining the lathe profile (radius, height)
 * @returns Object containing geometry and normalized vectors
 * @throws Never - Always returns a valid geometry (fallback on error)
 */
export function createGeometryFromProfile(profile: LathePoint[]): {
	geometry: BufferGeometry;
	vectors: Vector2[];
} {
	try {
		// Safety: Validate input
		if (!profile || profile.length === 0) {
			console.warn('⚠️ [GEOMETRY] Empty profile provided, using fallback cylinder');
			return createFallbackGeometry();
		}

		// 1. Filter out invalid points (NaN, negative radius, etc.)
		const validProfile = profile.filter((p) => {
			const safeX = Number.isFinite(p.x) && !Number.isNaN(p.x) && p.x >= 0;
			const safeY = Number.isFinite(p.y) && !Number.isNaN(p.y) && p.y >= 0;
			return safeX && safeY;
		});

		if (validProfile.length === 0) {
			console.warn('⚠️ [GEOMETRY] All profile points are invalid, using fallback');
			return createFallbackGeometry();
		}

		// 2. Convert profile points to Vector2
		const vectors = validProfile
			.map((p) => {
				if (!p) return new Vector2(0.5, 0);
				return new Vector2(p.x ?? 0.5, p.y ?? 0);
			})
			.filter((v): v is Vector2 => v !== undefined);

		// 3. Create LatheGeometry with segment count from FACET STYLE
		// This ensures all geometry (preview, final, and export) uses the same faceted aesthetic
		if (vectors.length === 0) {
			return createFallbackGeometry();
		}
		// CRITICAL: Use the SAME segment count as DynamicGeometryManager
		// This ensures the faceted "fins" aesthetic is preserved in the final sculpture
		const segments = getSegmentsForFacetStyle(uiStore.facetStyle);
		
		const geometry = new LatheGeometry(vectors, segments);

		// Compute normals for proper lighting
		geometry.computeVertexNormals();
		geometry.computeBoundingBox();

		return { geometry, vectors };
	} catch (err) {
		console.error('❌ [GEOMETRY] Failed to create geometry:', err);
		return createFallbackGeometry();
	}
}

/**
 * Applies symmetry distortion to geometry
 * Modulates the X and Z coordinates to create n-fold symmetry ripples
 *
 * @param geometry - BufferGeometry to mutate
 * @param lobes - Number of symmetry lobes (default 0 = no distortion)
 */
export function applySymmetryDistortion(geometry: BufferGeometry, lobes?: number): void {
	if (!lobes || lobes <= 0) return;

	try {
		const position = geometry.getAttribute('position');
		if (!position) return;

		for (let i = 0; i < position.count; i++) {
			const x = position.getX(i) ?? 0;
			const z = position.getZ(i) ?? 0;
			const angle = Math.atan2(z, x);
			const distortion = 1.0 + Math.sin(angle * lobes) * 0.2;
			position.setX(i, x * distortion);
			position.setZ(i, z * distortion);
		}
		position.needsUpdate = true;
	} catch (err) {
		console.warn('⚠️ [GEOMETRY] Symmetry distortion failed (non-fatal):', err);
	}
}

/**
 * Applies heatmap vertex colors based on stress analysis
 * Maps profile points to vertex colors for visualization
 *
 * @param geometry - BufferGeometry to colorize
 * @param vectors - LathePoint vectors used to compute stress colors
 * @param stressColors - Pre-computed stress color array (Float32Array RGB values)
 * @param existingColorBuffer - Optional pre-allocated buffer to reuse
 * @returns Updated (or new) color buffer for reuse
 */
export function applyHeatmapColors(
	geometry: BufferGeometry,
	vectors: Vector2[],
	stressColors: Float32Array,
	existingColorBuffer: Float32Array | null = null
): Float32Array | null {
	try {
		if (vectors.length === 0 || stressColors.length === 0) {
			// Remove color attribute if present
			if (geometry.getAttribute('color')) {
				geometry.deleteAttribute('color');
			}
			return null;
		}

		const position = geometry.getAttribute('position');
		if (!position) return null;

		const vertexCount = position.count;
		const pointsPerRing = vectors.length;
		const segments = (geometry as any).parameters?.segments ?? 0;
		const rings = (segments || 0) + 1;

		// Validate dimensions
		if (pointsPerRing * rings !== vertexCount) {
			console.warn(
				`⚠️ [GEOMETRY] Vertex count mismatch: expected ${pointsPerRing * rings}, got ${vertexCount}`
			);
			return null;
		}

		const requiredSize = vertexCount * 3;

		// Buffer Pooling: Reuse buffer if size matches
		let colors = existingColorBuffer;
		if (!colors || colors.length !== requiredSize) {
			colors = new Float32Array(requiredSize);
		}

		const colorCount = stressColors.length / 3;

		// Map stress colors to vertices by ring
		for (let ring = 0; ring < rings; ring++) {
			for (let i = 0; i < pointsPerRing; i++) {
				const stressIndex = Math.min(Math.max(i - 1, 0), colorCount - 1);
				const sourceIndex = stressIndex * 3;
				const target = (ring * pointsPerRing + i) * 3;

				colors[target] = stressColors[sourceIndex] ?? 0;
				colors[target + 1] = stressColors[sourceIndex + 1] ?? 0;
				colors[target + 2] = stressColors[sourceIndex + 2] ?? 0;
			}
		}

		geometry.setAttribute('color', new BufferAttribute(colors, 3));
		return colors;
	} catch (err) {
		console.warn('⚠️ [GEOMETRY] Heatmap coloring failed (non-fatal):', err);
		return null;
	}
}

/**
 * Applies glaze vertex colors from audio analysis
 * Maps audio frames to vertex colors for visual representation
 *
 * @param geometry - BufferGeometry to colorize
 * @param colors - Pre-computed color array (Float32Array RGB values)
 * @param existingColorBuffer - Optional pre-allocated buffer to reuse
 * @returns Updated (or new) color buffer for reuse
 */
export function applyGlazeColors(
	geometry: BufferGeometry,
	colors: Float32Array,
	existingColorBuffer: Float32Array | null = null
): Float32Array | null {
	try {
		if (colors.length === 0) return null;

		const position = geometry.getAttribute('position');
		if (!position) return null;

		const vertexCount = position.count;
		const requiredSize = vertexCount * 3;

		// Buffer Pooling
		let colorBuffer = existingColorBuffer;
		if (!colorBuffer || colorBuffer.length !== requiredSize) {
			colorBuffer = new Float32Array(requiredSize);
		}

		// Resample colors to match vertex count
		const colorCount = colors.length / 3;
		for (let i = 0; i < vertexCount; i++) {
			// Map vertex to color by height (Y coordinate)
			const y = position.getY(i) ?? 0;
			const normalizedHeight = (y + 1) / 2; // Normalize 0-1
			const colorIndex = Math.floor(normalizedHeight * (colorCount - 1));
			const clampedIndex = Math.max(0, Math.min(colorCount - 1, colorIndex));

			colorBuffer[i * 3] = colors[clampedIndex * 3] ?? 0;
			colorBuffer[i * 3 + 1] = colors[clampedIndex * 3 + 1] ?? 0;
			colorBuffer[i * 3 + 2] = colors[clampedIndex * 3 + 2] ?? 0;
		}

		geometry.setAttribute('color', new BufferAttribute(colorBuffer, 3));
		return colorBuffer;
	} catch (err) {
		console.warn('⚠️ [GEOMETRY] Glaze coloring failed (non-fatal):', err);
		return null;
	}
}

/**
 * Safely disposes of a geometry
 * Wraps disposal in error handling to prevent crashes
 *
 * @param geometry - BufferGeometry to dispose
 * @returns true if successful, false if failed
 */
export function safeDisposeGeometry(geometry: BufferGeometry | null | undefined): boolean {
	if (!geometry) return false;

	try {
		geometry.dispose();
		return true;
	} catch (err) {
		console.warn('⚠️ [GEOMETRY] Disposal failed (non-fatal):', err);
		return false;
	}
}

/**
 * Creates a fallback geometry when input is invalid
 * Ensures the app NEVER shows a blank canvas
 *
 * @returns Safe default geometry with vectors
 */
export function createFallbackGeometry(): {
	geometry: BufferGeometry;
	vectors: Vector2[];
} {
	try {
		// Use facet style segments for consistent aesthetic even in fallback
		const segments = getSegmentsForFacetStyle(uiStore.facetStyle);
		const geometry = new CylinderGeometry(
			DEFAULT_CYLINDER_RADIUS,
			DEFAULT_CYLINDER_RADIUS,
			1,
			segments
		);
		geometry.computeVertexNormals();

		// Create matching vectors for consistency
		const vectors: Vector2[] = [];
		const steps = 10;
		for (let i = 0; i <= steps; i++) {
			const t = i / steps;
			vectors.push(new Vector2(DEFAULT_CYLINDER_RADIUS, t * 2));
		}

		return { geometry, vectors };
	} catch (err) {
		console.error('❌ [GEOMETRY] Fallback creation failed - CRITICAL:', err);
		// Last resort: return minimal valid geometry (use default segments as last resort)
		return {
			geometry: new CylinderGeometry(0.5, 0.5, 1, DEFAULT_CYLINDER_SEGMENTS),
			vectors: [new Vector2(0.5, 0), new Vector2(0.5, 1)]
		};
	}
}

/**
 * Derives profile from deformations with constraint safety
 * Applies transformations in order: deformation → constraints → modifiers
 *
 * @param profile - Base profile
 * @param deformation - Optional deformation config
 * @param heightScale - Height scaling factor
 * @param modifiers - Optional modifiers config
 * @param constraintMode - Fabrication constraint mode
 * @param autoFixGeometry - Whether to apply auto-fix constraints
 * @returns Processed profile safe for geometry creation
 */
export function deriveProfileWithTransforms(
	profile: LathePoint[],
	deformation: { twist: number; verticalStretch: number; taper: number } | undefined,
	heightScale: number,
	modifiers: { quantize?: boolean; symmetryCount?: number } | undefined,
	constraintMode: ConstraintMode,
	autoFixGeometry: boolean
): LathePoint[] {
	try {
		let processedProfile = profile;
		const physicalHeightMm = Math.max(1, heightScale * DEFAULT_HEIGHT_MM);

		// 1. Apply deformations (twist, vertical stretch, taper) first
		if (deformation) {
			processedProfile = applyDeformation(processedProfile, deformation);
		}

		// 2. Apply constraints if auto-fix is enabled
		if (autoFixGeometry && constraintMode !== 'digital') {
			processedProfile = applyConstraints(processedProfile, constraintMode, physicalHeightMm);
		}

		// 3. Apply modifiers (quantize, symmetry)
		const finalProfile = applyModifiers(processedProfile, heightScale, modifiers);

		// 4. Final validation pass
		return finalProfile.filter((p) => {
			if (!p) return false;
			const safeX = Number.isFinite(p.x) && !Number.isNaN(p.x) && p.x >= 0;
			const safeY = Number.isFinite(p.y) && !Number.isNaN(p.y) && p.y >= 0;
			return safeX && safeY;
		});
	} catch (err) {
		console.error('❌ [GEOMETRY] Profile derivation failed:', err);
		return profile; // Return original on error
	}
}
