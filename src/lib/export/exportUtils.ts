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
	/** Deformation to apply (twist, verticalStretch, taper) */
	deformation?: {
		twist: number;
		verticalStretch: number;
		taper: number;
	};
	/** AUDIT FIX: Whether to scale output to real-world millimeters (for STL/3D printing) */
	scaleToMillimeters?: boolean;
}

/**
 * Generates the final profile for export by applying the same transformation
 * pipeline as the live renderer:
 * 1. Compose layers using computeProfile (SAME as app view)
 * 2. Apply deformations (twist, verticalStretch, taper)
 * 3. Apply fabrication constraints (if auto-fix is on)
 * 4. Apply modifiers (quantize, symmetry)
 *
 * CRITICAL: Uses computeProfile() to ensure export EXACTLY matches app view.
 */
export function generateFinalProfile(
	sculpture: SculptureDefinition,
	options: ExportOptions
): LathePoint[] {
	// Step 1: Get profile using SAME method as app view
	// CRITICAL: The app uses computeProfile(layers) after recording stops.
	// We MUST use the same function to ensure the export matches exactly.
	let profile: LathePoint[];

	if (sculpture?.layers && sculpture.layers.length > 0) {
		// PRIMARY: Use computeProfile - SAME as the app's Sculpture.svelte
		// This ensures the export matches what the user sees on screen
		console.log(
			`📦 [EXPORT] Using computeProfile (${sculpture.layers.length} layers) - matches app view`
		);
		profile = computeProfile(sculpture.layers);
	} else if (sculpture?.radiusCurve && sculpture.radiusCurve.length > 0) {
		// Fallback: Use stored radiusCurve for legacy sculptures
		console.log(`📦 [EXPORT] Using radiusCurve (${sculpture.radiusCurve.length} points)`);
		profile = sculpture.radiusCurve;
	} else {
		throw new Error('Sculpture has no geometry data to export');
	}

	// Step 2: Apply deformations (twist, verticalStretch, taper)
	if (options.deformation) {
		profile = applyDeformation(profile, options.deformation);
	}

	// Step 3: Apply fabrication constraints (if auto-fix is enabled)
	// This ensures the exported geometry meets physical manufacturing limits
	if (options.autoFixGeometry && options.constraintMode !== 'digital') {
		profile = applyConstraints(
			profile,
			options.constraintMode,
			sculpture.physical.height || DEFAULT_HEIGHT_MM
		);
	}

	// Step 4: Apply modifiers (quantize, symmetry)
	// Note: Symmetry is applied as geometry distortion in the renderer,
	// but for exports we keep the base lathe profile and let the export
	// format handle radial geometry
	// CRITICAL: Pass heightScale=1.0 to avoid double-scaling Y
	// (applyModifiers scales Y by heightScale, but we do mm scaling separately below)
	if (options.modifiers?.quantize) {
		profile = applyModifiers(profile, 1.0, options.modifiers);
	}

	// AUDIT FIX: Step 5: Scale to real-world millimeters for 3D printing
	// Profile points are in normalized units (Y: 0-1, X: radius ratio)
	// For STL export, we need actual millimeters
	//
	// CRITICAL: In the live render:
	//   - Y is scaled by heightScale (sculpture.height / DEFAULT_HEIGHT_MM)
	//   - X (radius) is NOT scaled - stays at normalized values
	//
	// To preserve the same aspect ratio in the export:
	//   - Both X and Y scale to the physical sculpture height (mm) so exports
	//     match the real-world dimensions shown in the UI ruler
	if (options.scaleToMillimeters) {
		const heightMM = sculpture.physical.height || DEFAULT_HEIGHT_MM;

		profile = profile.map((point) => ({
			// Scale radius and height into millimeters using the requested height
			x: point.x * heightMM,
			y: point.y * heightMM
		}));
	}

	return profile;
}
