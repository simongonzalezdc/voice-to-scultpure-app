import type { SculptureLayer, LathePoint } from '$lib/types';

/**
 * Phase 3: The Compositor (The Engine)
 * Merges layers into a final mesh profile in real-time.
 *
 * Pure function: No side effects, can be called from $derived blocks
 */
export function computeProfile(layers: SculptureLayer[], resolution: number = 128): LathePoint[] {
	// 1. Start with a base profile (default cylinder)
	// We use Float32Array for performance during accumulation
	const profile = new Float32Array(resolution).fill(0.5); // Base radius 0.5

	// 2. Stack Layers
	for (const layer of layers) {
		if (!layer.visible) continue;

		// Check resolution match
		if (layer.data.length !== resolution) {
			console.warn(
				`⚠️ [COMPOSITOR] Layer ${layer.name} resolution mismatch (${layer.data.length} vs ${resolution})`
			);
			// Note: Error tracking moved to caller to avoid state mutation in $derived
			continue;
		}

		for (let i = 0; i < resolution; i++) {
			// SMART MASKING LOGIC:
			// Effect = Data * Mask * LayerOpacity
			// Note: Data is often additive offset, or multiplier depending on interpretation.
			// For this engine, we treat 'data' as the value to blend.

			// If mask is not fully initialized or wrong size, default to 1.0
			const maskVal: number =
				layer.mask && layer.mask.length === resolution && layer.mask[i] !== undefined
					? (layer.mask[i] ?? 1.0)
					: 1.0;

			const dataVal = layer.data[i] ?? 0;
			const effect = dataVal * maskVal * layer.opacity;

			const currentVal = profile[i] ?? 0.5;
			if (layer.type === 'base') {
				// Base layer typically overwrites or provides the foundation
				// If it's the first visible base layer, it sets the shape.
				// If blendMode is overwrite, it replaces.
				if (layer.blendMode === 'overwrite') {
					profile[i] = effect;
				} else {
					profile[i] = currentVal + effect; // Fallback
				}
			} else {
				// Apply blend modes
				if (layer.blendMode === 'add') {
					profile[i] = currentVal + effect;
				} else if (layer.blendMode === 'subtract') {
					profile[i] = currentVal - effect;
				} else if (layer.blendMode === 'multiply') {
					profile[i] = currentVal * effect;
				} else if (layer.blendMode === 'overwrite') {
					profile[i] = effect;
				}
			}
		}
	}

	// 3. Return as LathePoints for Three.js
	// Clamp values to ensure valid geometry (radius > 0)
	return Array.from(profile).map((r, i) => ({
		x: Math.max(0.01, r), // Minimum radius constraint
		y: i / (resolution - 1) // Normalized height 0 to 1
	}));
}
