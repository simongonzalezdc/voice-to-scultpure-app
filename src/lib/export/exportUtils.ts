import type { SculptureDefinition, LathePoint } from '$lib/types';
import { computeProfile } from '$lib/engine/compositor';
import { applyDeformation, applyModifiers } from '$lib/engine/physicsMapping';
import { applyConstraints, type ConstraintMode } from '$lib/engine/constraints';
import { DEFAULT_HEIGHT_MM } from '$lib/config/constants';

export interface ExportOptions {
	/** Whether to apply auto-fix geometry constraints */
	autoFixGeometry: boolean;
	/** Constraint mode to apply (ceramic, 3d-print, or digital) */
	constraintMode: ConstraintMode;
	/** Modifiers to apply (quantize, symmetry) */
	modifiers?: {
		quantize: boolean;
		quantizeSteps?: number; // Optional - not used everywhere
		symmetryCount: number;
	};
	/** Deformation to apply (twist, compression, taper) */
	deformation?: {
		twist: number;
		compression: number;
		taper: number;
	};
}

/**
 * Generates the final profile for export by applying the same transformation
 * pipeline as the live renderer:
 * 1. Compose layers (if multiple layers exist)
 * 2. Apply deformations (twist, compression, taper)
 * 3. Apply fabrication constraints (if auto-fix is on)
 * 4. Apply modifiers (quantize, symmetry)
 *
 * This ensures exports match what the user sees in the viewport.
 */
export function generateFinalProfile(
	sculpture: SculptureDefinition,
	options: ExportOptions
): LathePoint[] {
	// Step 1: Compose layers or use legacy radiusCurve
	let profile: LathePoint[];

	if (sculpture?.layers && sculpture.layers.length > 0) {
		// New layer-based system: compose all visible layers
		profile = computeProfile(sculpture.layers);
	} else if (sculpture?.radiusCurve && sculpture.radiusCurve.length > 0) {
		// Legacy system: use radiusCurve directly
		profile = sculpture.radiusCurve;
	} else {
		throw new Error('Sculpture has no geometry data to export');
	}

	// Step 2: Apply deformations (twist, compression, taper)
	if (options.deformation) {
		profile = applyDeformation(profile, options.deformation);
	}

	// Step 3: Apply fabrication constraints (if auto-fix is enabled)
	// This ensures the exported geometry meets physical manufacturing limits
	if (options.autoFixGeometry && options.constraintMode !== 'digital') {
		profile = applyConstraints(profile, options.constraintMode);
	}

	// Step 4: Apply modifiers (quantize, symmetry)
	// Note: Symmetry is applied as geometry distortion in the renderer,
	// but for exports we keep the base lathe profile and let the export
	// format handle radial geometry
	if (options.modifiers) {
		const heightScale = sculpture.physical.height / DEFAULT_HEIGHT_MM;
		profile = applyModifiers(profile, heightScale, options.modifiers);
	}

	return profile;
}
