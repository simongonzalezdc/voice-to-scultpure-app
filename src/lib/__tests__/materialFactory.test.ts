/**
 * Unit Tests for materialFactory.ts
 * PHASE 4: Robustness & Testing
 */

import { describe, it, expect } from 'vitest';
import {
	deriveMaterialColor,
	deriveGhostMaterialColor,
	createBaseMaterialProps,
	updateMaterialForViewMode,
	updateMaterialForGlazeMode,
	calculateSmoothedEmission,
	deriveEmissiveIntensity,
	createGhostMaterialProps,
	validateMaterialProps
} from '$lib/engine/materialFactory';
import { DEFAULT_MATERIAL_CERAMIC } from '$lib/types';
import {
	PLASTIC_COLOR_LIGHTEN_FACTOR,
	GHOST_ROUGHNESS,
	GHOST_OPACITY
} from '$lib/config/constants';

describe('materialFactory', () => {
	describe('deriveMaterialColor', () => {
		it('should return plastic color when plastic mode is active', () => {
			const color = deriveMaterialColor(false, false, true);
			expect(color).toBe(PLASTIC_COLOR_LIGHTEN_FACTOR);
		});

		it('should return default ceramic color otherwise', () => {
			const color = deriveMaterialColor(false, false, false);
			expect(color).toBe(DEFAULT_MATERIAL_CERAMIC);
		});

		// Note: "Loud Error" logic is currently commented out in source, so we test the current behavior
		it('should return default color even in glaze mode if missing colors (per current logic)', () => {
			const color = deriveMaterialColor(true, false, false);
			expect(color).toBe(DEFAULT_MATERIAL_CERAMIC);
		});
	});

	describe('deriveGhostMaterialColor', () => {
		it('should return ceramic color if ghost exists', () => {
			const color = deriveGhostMaterialColor(true);
			expect(color).toBe(DEFAULT_MATERIAL_CERAMIC);
		});

		it('should return dark brown if no ghost exists', () => {
			const color = deriveGhostMaterialColor(false);
			expect(color).toBe('#8F3E48');
		});
	});

	describe('createBaseMaterialProps', () => {
		it('should create valid default properties', () => {
			const props = createBaseMaterialProps('#ffffff', '#000000', 0.5);

			expect(props.color).toBe('#ffffff');
			expect(props.emissive).toBe('#000000');
			expect(props.roughness).toBe(0.5);
			expect(props.metalness).toBe(0.1);
			expect(props.opacity).toBe(1.0);
			expect(props.transparent).toBe(false);
		});
	});

	describe('updateMaterialForViewMode', () => {
		const baseProps = createBaseMaterialProps('#fff', '#000', 0.5);

		it('should handle wireframe mode', () => {
			const updated = updateMaterialForViewMode(baseProps, 'wireframe');
			expect(updated.wireframe).toBe(true);
			expect(updated.transparent).toBe(false);
		});

		it('should handle xray mode', () => {
			const updated = updateMaterialForViewMode(baseProps, 'xray');
			expect(updated.wireframe).toBe(false);
			expect(updated.transparent).toBe(true);
			expect(updated.opacity).toBe(0.3);
		});

		it('should handle heatmap mode', () => {
			const updated = updateMaterialForViewMode(baseProps, 'heatmap');
			expect(updated.vertexColors).toBe(true);
			expect(updated.wireframe).toBe(false);
		});

		it('should handle normal mode', () => {
			const updated = updateMaterialForViewMode(baseProps, 'normal');
			expect(updated.wireframe).toBe(false);
			expect(updated.transparent).toBe(false);
			expect(updated.vertexColors).toBe(false);
		});
	});

	describe('updateMaterialForGlazeMode', () => {
		const baseProps = createBaseMaterialProps('#fff', '#000', 0.5);

		it('should enable vertex colors when recording in glaze mode', () => {
			const updated = updateMaterialForGlazeMode(baseProps, true, true, true);
			expect(updated.vertexColors).toBe(true);
		});

		it('should NOT enable vertex colors if not recording', () => {
			const updated = updateMaterialForGlazeMode(baseProps, false, true, true);
			expect(updated.vertexColors).toBe(false);
		});

		it('should NOT enable vertex colors if not in glaze mode', () => {
			const updated = updateMaterialForGlazeMode(baseProps, true, false, true);
			expect(updated.vertexColors).toBe(false);
		});
	});

	describe('calculateSmoothedEmission', () => {
		it('should approach target value', () => {
			const current = 0;
			const target = 1.0;
			const factor = 0.5; // Should move 50% of the way

			const result = calculateSmoothedEmission(current, target, factor);
			expect(result).toBe(0.5);
		});

		it('should handle decrease', () => {
			const current = 1.0;
			const target = 0.0;
			const factor = 0.1;

			const result = calculateSmoothedEmission(current, target, factor);
			expect(result).toBeLessThan(1.0);
			expect(result).toBeGreaterThan(0.0);
		});
	});

	describe('createGhostMaterialProps', () => {
		it('should create valid ghost properties', () => {
			const props = createGhostMaterialProps('#ff0000');

			expect(props.color).toBe('#ff0000');
			expect(props.transparent).toBe(true);
			expect(props.opacity).toBe(GHOST_OPACITY);
			expect(props.roughness).toBe(GHOST_ROUGHNESS);
			expect(props.wireframe).toBe(true);
		});
	});

	describe('validateMaterialProps', () => {
		it('should return true for valid props', () => {
			const props = createBaseMaterialProps('#fff', '#000', 0.5);
			expect(validateMaterialProps(props)).toBe(true);
		});

		it('should return false for invalid roughness', () => {
			const props = createBaseMaterialProps('#fff', '#000', 1.5); // > 1
			expect(validateMaterialProps(props)).toBe(false);
		});

		it('should return false for invalid metalness', () => {
			const props = createBaseMaterialProps('#fff', '#000', 0.5);
			props.metalness = -1;
			expect(validateMaterialProps(props)).toBe(false);
		});

		it('should return false for NaN', () => {
			const props = createBaseMaterialProps('#fff', '#000', NaN);
			expect(validateMaterialProps(props)).toBe(false);
		});
	});
});
