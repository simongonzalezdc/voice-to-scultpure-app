import type { SculptureLayer, LathePoint } from '$lib/types';

/**
 * Phase 3: The Compositor (The Engine)
 * Merges layers into a final mesh profile in real-time.
 *
 * Pure function: No side effects, can be called from $derived blocks
 * 
 * CRITICAL FIX: Auto-detects resolution from first visible layer's data length.
 * This ensures Song Mode (512 points) and Coil Mode (256 points) work correctly.
 */

// Rate-limit compositor logging to avoid console spam during render loop
let lastCompositorLogTime = 0;
const COMPOSITOR_LOG_INTERVAL_MS = 2000; // Log at most once every 2 seconds

export function computeProfile(layers: SculptureLayer[], explicitResolution?: number): LathePoint[] {
	// Find the first visible layer to determine target resolution
	const firstVisibleLayer = layers.find(l => l.visible && l.data && l.data.length > 0);
	
	// Use explicit resolution if provided, otherwise auto-detect from first layer, fallback to 128
	const resolution = explicitResolution ?? firstVisibleLayer?.data.length ?? 128;
	
	// DEBUG: Log all layers being processed (rate-limited)
	const now = Date.now();
	const shouldLog = now - lastCompositorLogTime > COMPOSITOR_LOG_INTERVAL_MS;
	
	const visibleLayers = layers.filter(l => l.visible);
	if (shouldLog && visibleLayers.length > 0) {
		lastCompositorLogTime = now;
		console.log(`🎭 [COMPOSITOR] Processing ${visibleLayers.length} visible layers (resolution: ${resolution}):`);
		visibleLayers.forEach((l, idx) => {
			const avgData = l.data && l.data.length > 0 
				? Array.from(l.data).reduce((a, b) => a + b, 0) / l.data.length 
				: 0;
			console.log(`   [${idx}] "${l.name}" type=${l.type} blend=${l.blendMode} avgData=${avgData.toFixed(3)} pts=${l.data?.length ?? 0}`);
		});
	}
	
	// 1. Start with a base profile (default cylinder)
	// We use Float32Array for performance during accumulation
	const profile = new Float32Array(resolution).fill(0.5); // Base radius 0.5

	// 2. Stack Layers
	for (const layer of layers) {
		if (!layer.visible) continue;
		if (!layer.data || layer.data.length === 0) continue;

		// Get layer data, resampling if necessary
		let layerData: Float32Array;
		let layerMask: Float32Array | undefined;
		
		if (layer.data.length === resolution) {
			// Perfect match - use directly
			layerData = layer.data;
			layerMask = layer.mask;
		} else {
			// Resolution mismatch - resample the layer data
			console.log(
				`🔄 [COMPOSITOR] Resampling layer "${layer.name}" from ${layer.data.length} to ${resolution} points`
			);
			layerData = resampleData(layer.data, resolution);
			layerMask = layer.mask ? resampleData(layer.mask, resolution) : undefined;
		}

		// DEBUG: Track before/after for this layer (only if logging)
		const beforeAvg = shouldLog ? Array.from(profile).reduce((a, b) => a + b, 0) / resolution : 0;

		for (let i = 0; i < resolution; i++) {
			// SMART MASKING LOGIC:
			// Effect = Data * Mask * LayerOpacity
			// Note: Data is often additive offset, or multiplier depending on interpretation.
			// For this engine, we treat 'data' as the value to blend.

			// If mask is not fully initialized or wrong size, default to 1.0
			const maskVal: number =
				layerMask && layerMask.length === resolution && layerMask[i] !== undefined
					? (layerMask[i] ?? 1.0)
					: 1.0;

			const dataVal = layerData[i] ?? 0;
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
		
		// DEBUG: Log the effect of this layer (only if logging)
		if (shouldLog) {
			const afterAvg = Array.from(profile).reduce((a, b) => a + b, 0) / resolution;
			console.log(`   ➡️ "${layer.name}": before=${beforeAvg.toFixed(3)} → after=${afterAvg.toFixed(3)} (diff=${(afterAvg - beforeAvg).toFixed(3)})`);
		}
	}

	// 3. Return as LathePoints for Three.js
	// Clamp values to ensure valid geometry (radius > 0)
	const result = Array.from(profile).map((r, i) => ({
		x: Math.max(0.01, r), // Minimum radius constraint
		y: i / (resolution - 1) // Normalized height 0 to 1
	}));
	
	// DEBUG: Log profile statistics
	if (result.length > 0) {
		const minY = Math.min(...result.map(p => p.y));
		const maxY = Math.max(...result.map(p => p.y));
		const minX = Math.min(...result.map(p => p.x));
		const maxX = Math.max(...result.map(p => p.x));
		const avgX = result.reduce((sum, p) => sum + p.x, 0) / result.length;
		console.log(`📊 [COMPOSITOR OUT] ${result.length} pts, X=[${minX.toFixed(3)}-${maxX.toFixed(3)}] avg=${avgX.toFixed(3)}, Y=[${minY.toFixed(3)}-${maxY.toFixed(3)}]`);
	}
	
	return result;
}

/**
 * Resample a Float32Array to a new length using linear interpolation.
 * This ensures layers with different resolutions can be composited together.
 */
function resampleData(source: Float32Array, targetLength: number): Float32Array {
	const result = new Float32Array(targetLength);
	const sourceLength = source.length;
	
	if (sourceLength === 0) {
		result.fill(0.5);
		return result;
	}
	
	if (sourceLength === 1) {
		result.fill(source[0] ?? 0.5);
		return result;
	}
	
	for (let i = 0; i < targetLength; i++) {
		// Map target index to source index
		const sourcePos = (i / (targetLength - 1)) * (sourceLength - 1);
		const sourceLow = Math.floor(sourcePos);
		const sourceHigh = Math.min(sourceLow + 1, sourceLength - 1);
		const t = sourcePos - sourceLow;
		
		// Linear interpolation
		const valLow = source[sourceLow] ?? 0;
		const valHigh = source[sourceHigh] ?? 0;
		result[i] = valLow * (1 - t) + valHigh * t;
	}
	
	return result;
}

/**
 * Get the resolution that would be used for a set of layers.
 * Useful for pre-checking or debugging.
 */
export function getEffectiveResolution(layers: SculptureLayer[]): number {
	const firstVisibleLayer = layers.find(l => l.visible && l.data && l.data.length > 0);
	return firstVisibleLayer?.data.length ?? 128;
}
