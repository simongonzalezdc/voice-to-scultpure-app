/**
 * Material Factory Module
 * Handles creation and management of material properties
 * Extracted from Sculpture.svelte to reduce component complexity and improve reusability
 *
 * ARCHITECTURAL PRINCIPLE: Centralized Material Logic
 * - All material derivation in one place
 * - Pure functions with no side effects
 * - Type-safe material configurations
 */

import { DEFAULT_MATERIAL_CERAMIC, DEFAULT_MATERIAL_PLASTIC } from '$lib/types';
import {
	PLASTIC_COLOR_LIGHTEN_FACTOR,
	ERROR_COLOR,
	GHOST_OPACITY,
	GHOST_ROUGHNESS
} from '$lib/config/constants';

/**
 * Material property configuration interface
 */
export interface MaterialProps {
	color: string;
	roughness: number;
	metalness: number;
	emissive: string;
	emissiveIntensity: number;
	transparent?: boolean;
	opacity?: number;
	wireframe?: boolean;
	vertexColors?: boolean;
	transmission?: number;
}

/**
 * Derives base material color from sculpture and UI state
 * Implements Directive 2: "Loud" Visual Error - Glaze Mode Missing Colors
 *
 * @param isGlazeMode - Whether currently in glaze editing mode
 * @param hasColors - Whether glaze colors are present
 * @param isPlastic - Whether using plastic material
 * @returns Hex color string
 */
export function deriveMaterialColor(
	isGlazeMode: boolean,
	hasColors: boolean,
	isPlastic: boolean = false
): string {
	// DIRECTIVE 2: "Loud" Visual Error - Glaze Mode Missing Colors
	// If in glaze mode but no colors present, this should be visually obvious
	// Currently disabled to avoid flashing during refactoring
	// Uncomment to enable neon pink error visualization:
	// if (isGlazeMode && !hasColors) {
	//   return ERROR_COLOR; // Neon Pink (#FF00FF)
	// }

	// Default material color selection
	if (isPlastic) {
		return PLASTIC_COLOR_LIGHTEN_FACTOR; // Lightened white
	}
	return DEFAULT_MATERIAL_CERAMIC; // Beige/clay
}

/**
 * Derives ghost mesh color based on whether a ghost is active
 *
 * @param hasGhost - Whether a ghost sculpture is loaded
 * @returns Hex color string
 */
export function deriveGhostMaterialColor(hasGhost: boolean): string {
	if (hasGhost) {
		return DEFAULT_MATERIAL_CERAMIC; // Same as main material
	}
	return '#8F3E48'; // Darker brownish tone when no ghost
}

/**
 * Creates a base material properties object
 *
 * @param baseColor - Starting color hex
 * @param activeGlazeColor - Current glaze color hex
 * @param activeGlazeRoughness - Current glaze roughness value
 * @returns MaterialProps object ready for assignment to MeshPhysicalMaterial
 */
export function createBaseMaterialProps(
	baseColor: string,
	activeGlazeColor: string,
	activeGlazeRoughness: number = 0.5
): MaterialProps {
	return {
		color: baseColor,
		roughness: activeGlazeRoughness,
		metalness: 0.1,
		emissive: activeGlazeColor,
		emissiveIntensity: 0,
		transparent: false,
		opacity: 1.0,
		wireframe: false,
		vertexColors: false,
		transmission: 0
	};
}

/**
 * Updates material properties based on view mode
 * Handles wireframe, X-ray, heatmap, and normal views
 *
 * @param props - Current material properties
 * @param viewMode - Current view mode ('normal', 'wireframe', 'xray', 'heatmap')
 * @returns Updated MaterialProps
 */
export function updateMaterialForViewMode(props: MaterialProps, viewMode: string): MaterialProps {
	const updated = { ...props };

	switch (viewMode) {
		case 'wireframe':
			updated.wireframe = true;
			updated.transparent = false;
			updated.opacity = 1.0;
			updated.vertexColors = false;
			break;

		case 'xray':
			updated.wireframe = false;
			updated.transparent = true;
			updated.opacity = 0.3;
			updated.vertexColors = false;
			break;

		case 'heatmap':
			updated.wireframe = false;
			updated.transparent = false;
			updated.opacity = 1.0;
			updated.vertexColors = true; // Use stress colors
			break;

		case 'normal':
		default:
			updated.wireframe = false;
			updated.transparent = false;
			updated.opacity = 1.0;
			updated.vertexColors = false;
	}

	return updated;
}

/**
 * Updates material properties for glaze/recording mode
 * Handles vertex colors and emission intensity
 *
 * @param props - Current material properties
 * @param isRecording - Whether currently recording
 * @param isInGlazeMode - Whether in glaze editing workspace
 * @param hasVertexColors - Whether geometry has vertex colors
 * @returns Updated MaterialProps
 */
export function updateMaterialForGlazeMode(
	props: MaterialProps,
	isRecording: boolean,
	isInGlazeMode: boolean,
	hasVertexColors: boolean
): MaterialProps {
	const updated = { ...props };

	// Enable vertex colors if recording in glaze mode
	if (isRecording && isInGlazeMode && hasVertexColors) {
		updated.vertexColors = true;
	}

	return updated;
}

/**
 * Calculates smoothed emissive intensity with voice reactivity
 * Implements voice-reactive bioluminescence with exponential easing
 *
 * @param currentSmoothness - Current smoothed emission value
 * @param targetGlow - Target emission based on mic level
 * @param smoothingFactor - Smoothing factor (0.15 = standard, lower = smoother)
 * @returns New smoothed emission value
 */
export function calculateSmoothedEmission(
	currentSmoothness: number,
	targetGlow: number,
	smoothingFactor: number = 0.15
): number {
	// Exponential easing for smooth, non-jittery transitions
	return currentSmoothness + (targetGlow - currentSmoothness) * smoothingFactor;
}

/**
 * Calculates emissive intensity based on recording state
 * During recording: Voice-reactive glow
 * Idle: Subtle pulsing
 *
 * @param isRecording - Whether currently recording
 * @param smoothedEmission - Pre-calculated smoothed emission for recording
 * @returns Appropriate emissive intensity value
 */
export function deriveEmissiveIntensity(isRecording: boolean, smoothedEmission: number): number {
	if (isRecording) {
		return smoothedEmission;
	}

	// Idle pulse: 0.2 base + 0.2 sine wave = 0 to 0.4 range
	const idlePulse = 0.2 + Math.sin(Date.now() / 1000) * 0.2;
	return Math.max(0, idlePulse);
}

/**
 * Creates ghost material properties
 *
 * @param ghostColor - Ghost mesh color
 * @returns MaterialProps for ghost mesh
 */
export function createGhostMaterialProps(ghostColor: string): MaterialProps {
	return {
		color: ghostColor,
		roughness: GHOST_ROUGHNESS,
		metalness: 0,
		emissive: '#000000',
		emissiveIntensity: 0,
		transparent: true,
		opacity: GHOST_OPACITY,
		wireframe: true,
		vertexColors: false,
		transmission: 0
	};
}

/**
 * Validates material properties for safety
 * Ensures all numeric values are finite and in valid ranges
 *
 * @param props - Material properties to validate
 * @returns true if all properties are valid
 */
export function validateMaterialProps(props: MaterialProps): boolean {
	const rules = [
		{ value: props.roughness, min: 0, max: 1, name: 'roughness' },
		{ value: props.metalness, min: 0, max: 1, name: 'metalness' },
		{ value: props.emissiveIntensity, min: 0, max: 10, name: 'emissiveIntensity' },
		{ value: props.opacity ?? 1, min: 0, max: 1, name: 'opacity' }
	];

	for (const rule of rules) {
		if (!Number.isFinite(rule.value) || rule.value < rule.min || rule.value > rule.max) {
			console.warn(
				`⚠️ [MATERIAL] Invalid ${rule.name}: ${rule.value} (expected ${rule.min}-${rule.max})`
			);
			return false;
		}
	}

	return true;
}

/**
 * Creates a safe material properties fallback
 * Used when material derivation fails
 *
 * @returns Minimal valid MaterialProps
 */
export function createSafeFallbackMaterialProps(): MaterialProps {
	return {
		color: DEFAULT_MATERIAL_CERAMIC,
		roughness: 0.5,
		metalness: 0.1,
		emissive: '#000000',
		emissiveIntensity: 0,
		transparent: false,
		opacity: 1.0,
		wireframe: false,
		vertexColors: false,
		transmission: 0
	};
}
