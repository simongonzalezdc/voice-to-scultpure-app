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
	/** AUDIT FIX: Whether to scale output to real-world millimeters (for STL/3D printing) */
	scaleToMillimeters?: boolean;
}

/**
 * Generates the final profile for export by applying the same transformation
 * pipeline as the live renderer:
 * 1. Compose layers using computeProfile (SAME as app view)
 * 2. Apply deformations (twist, compression, taper)
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
		console.log(`📦 [EXPORT] Using computeProfile (${sculpture.layers.length} layers) - matches app view`);
		profile = computeProfile(sculpture.layers);
	} else if (sculpture?.radiusCurve && sculpture.radiusCurve.length > 0) {
		// Fallback: Use stored radiusCurve for legacy sculptures
		console.log(`📦 [EXPORT] Using radiusCurve (${sculpture.radiusCurve.length} points)`);
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
	//   - Y scales to sculpture.height (mm)
	//   - X scales to DEFAULT_HEIGHT_MM (mm) - matching the unscaled render
	if (options.scaleToMillimeters) {
		const heightMM = sculpture.physical.height || DEFAULT_HEIGHT_MM;
		
		profile = profile.map(point => ({
			// Scale radius: multiply by DEFAULT_HEIGHT_MM to match live render aspect ratio
			// In live render, radius is NOT scaled by heightScale, only Y is
			x: point.x * DEFAULT_HEIGHT_MM,
			// Scale height: normalized Y (0-1) to actual millimeters
			y: point.y * heightMM
		}));
	}

	return profile;
}
