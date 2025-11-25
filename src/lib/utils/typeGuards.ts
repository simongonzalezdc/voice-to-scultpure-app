/**
 * Runtime Type Guards
 * Provides type-safe runtime checks for TypeScript narrowing
 */

import type { SculptureDefinition, LathePoint } from '$lib/types';
import type { BufferGeometry, BufferAttribute, Mesh } from 'three';

/**
 * Check if sculpture has layers
 */
export function hasLayers(
	sculpture: SculptureDefinition
): sculpture is SculptureDefinition & { layers: NonNullable<SculptureDefinition['layers']> } {
	return sculpture.layers !== undefined && sculpture.layers.length > 0;
}

/**
 * Check if sculpture has radiusCurve (legacy)
 */
export function hasRadiusCurve(
	sculpture: SculptureDefinition
): sculpture is SculptureDefinition & { radiusCurve: LathePoint[] } {
	return sculpture.radiusCurve !== undefined && sculpture.radiusCurve.length > 0;
}

/**
 * Check if geometry has position attribute
 */
export function hasPositionAttribute(geometry: BufferGeometry): boolean {
	return geometry.getAttribute('position') !== undefined;
}

/**
 * Check if geometry attribute exists and is BufferAttribute
 */
export function isBufferAttribute(
	attr: BufferAttribute | undefined | null
): attr is BufferAttribute {
	return attr !== undefined && attr !== null && 'array' in attr;
}

/**
 * Check if mesh has geometry
 */
export function isMeshWithGeometry(mesh: unknown): mesh is Mesh & { geometry: BufferGeometry } {
	return (
		typeof mesh === 'object' && mesh !== null && 'geometry' in mesh && mesh.geometry !== undefined
	);
}

/**
 * Type guard for non-empty array
 */
export function isNonEmptyArray<T>(arr: T[] | undefined | null): arr is T[] {
	return arr !== undefined && arr !== null && arr.length > 0;
}
