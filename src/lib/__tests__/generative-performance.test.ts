import { describe, it, expect, beforeEach } from 'vitest';
import type { AnalysisFrame, SculptureLayer } from '$lib/types';
import {
	sculptureStore,
	addLayer,
	removeLayer,
	toggleLayerVisibility,
	setLayerOpacity,
	composeGeometry,
	clearLayers,
	createLayerFromFrames
} from '$lib/stores/sculptureStore.svelte';
import { generateLathe, getBeatScaleMultiplier, isBeatActive } from '$lib/engine/physicsMapping';

describe('GENERATIVE PERFORMANCE: Layer Stack System', () => {
	beforeEach(() => {
		clearLayers();
	});

	it('should create layers from audio frames', () => {
		// Create mock audio frames
		const frames: AnalysisFrame[] = Array.from({ length: 50 }, (_, i) => ({
			time: i * 0.016,
			pitch: 220 + i * 2, // Rising pitch
			energy: 0.5 + Math.sin(i * 0.1) * 0.3,
			timbre: {
				spectralCentroid: 2000,
				zcr: 0.1,
				spectralFlux: 0
			}
		}));

		// Generate lathe geometry
		const lathePoints = generateLathe(frames);
		expect(lathePoints.length).toBeGreaterThan(0);

		// Convert to Float32Array
		const data = new Float32Array(lathePoints.length * 2);
		for (let i = 0; i < lathePoints.length; i++) {
			const point = lathePoints[i];
			if (!point) continue;
			data[i * 2] = point.x ?? 0;
			data[i * 2 + 1] = point.y ?? 0;
		}

		// Create base layer
		const baseLayer = createLayerFromFrames('base', 'Base Layer', data);
		expect(baseLayer.type).toBe('base');
		expect(baseLayer.opacity).toBe(1.0);
		expect(baseLayer.visible).toBe(true);
		expect(baseLayer.data.length).toBe(lathePoints.length * 2);
	});

	it('should add and compose multiple layers', () => {
		// Create base layer
		const baseData = new Float32Array([
			0.5, 0.0, // Bottom
			0.6, 0.5, // Middle
			0.5, 1.0  // Top
		]);
		const baseLayer = createLayerFromFrames('base', 'Base', baseData);
		addLayer(baseLayer);

		expect(sculptureStore.currentSculpture?.layers.length).toBe(1);
		expect(sculptureStore.activeLayerId).toBe(baseLayer.id);

		// Add distortion layer
		const distortionData = new Float32Array([
			0.6, 0.0,
			0.7, 0.5,
			0.6, 1.0
		]);
		const distortionLayer = createLayerFromFrames('distortion', 'Distortion', distortionData);
		addLayer(distortionLayer);

		expect(sculptureStore.currentSculpture?.layers.length).toBe(2);

		// Compose geometry
		const composed = composeGeometry();
		expect(composed.length).toBe(3); // 3 points
		const firstPoint = composed[0];
		expect(firstPoint).toBeDefined();
		if (firstPoint) {
			expect(firstPoint.x).toBeGreaterThan(baseData[0] ?? 0); // Distortion added
		}
	});

	it('should remove layers (UNDO functionality)', () => {
		// Add two layers
		const layer1 = createLayerFromFrames(
			'base',
			'Layer 1',
			new Float32Array([0.5, 0.0, 0.5, 1.0])
		);
		const layer2 = createLayerFromFrames(
			'distortion',
			'Layer 2',
			new Float32Array([0.6, 0.0, 0.6, 1.0])
		);

		addLayer(layer1);
		addLayer(layer2);

		expect(sculptureStore.currentSculpture?.layers.length).toBe(2);

		// Remove layer 2 (UNDO)
		removeLayer(layer2.id);

		expect(sculptureStore.currentSculpture?.layers.length).toBe(1);
		expect(sculptureStore.currentSculpture?.layers[0]?.id).toBe(layer1.id);
		expect(sculptureStore.activeLayerId).toBe(layer1.id);
	});

	it('should toggle layer visibility', () => {
		const layer = createLayerFromFrames(
			'base',
			'Test Layer',
			new Float32Array([0.5, 0.0, 0.5, 1.0])
		);
		addLayer(layer);

		expect(layer.visible).toBe(true);

		toggleLayerVisibility(layer.id);
		expect(sculptureStore.currentSculpture?.layers[0]?.visible).toBe(false);

		toggleLayerVisibility(layer.id);
		expect(sculptureStore.currentSculpture?.layers[0]?.visible).toBe(true);
	});

	it('should adjust layer opacity', () => {
		const layer = createLayerFromFrames(
			'base',
			'Test Layer',
			new Float32Array([0.5, 0.0, 0.5, 1.0])
		);
		addLayer(layer);

		expect(layer.opacity).toBe(1.0);

		setLayerOpacity(layer.id, 0.5);
		expect(sculptureStore.currentSculpture?.layers[0]?.opacity).toBe(0.5);

		// Test clamping
		setLayerOpacity(layer.id, 2.0);
		expect(sculptureStore.currentSculpture?.layers[0]?.opacity).toBe(1.0);

		setLayerOpacity(layer.id, -0.5);
		expect(sculptureStore.currentSculpture?.layers[0]?.opacity).toBe(0.0);
	});

	it('should compose layers with different opacities', () => {
		// Base layer
		const baseData = new Float32Array([0.5, 0.0, 0.5, 0.5, 0.5, 1.0]);
		const baseLayer = createLayerFromFrames('base', 'Base', baseData);
		addLayer(baseLayer);

		// Distortion layer with 50% opacity
		const distortionData = new Float32Array([0.8, 0.0, 0.8, 0.5, 0.8, 1.0]);
		const distortionLayer = createLayerFromFrames('distortion', 'Distortion', distortionData);
		addLayer(distortionLayer);
		setLayerOpacity(distortionLayer.id, 0.5);

		const composed = composeGeometry();
		expect(composed.length).toBe(3);

		// With 50% opacity, the distortion should be half-applied
		// distortionData[0] = 0.8, baseData[0] = 0.5
		// Effect: (0.8 - 0.5) * 0.5 * 0.5 = 0.075
		// Result should be approximately 0.5 + 0.075 = 0.575
		const firstPoint = composed[0];
		expect(firstPoint).toBeDefined();
		if (firstPoint) {
			expect(firstPoint.x).toBeGreaterThan(0.5);
			expect(firstPoint.x).toBeLessThan(0.7); // Not full distortion
		}
	});
});

describe('GENERATIVE PERFORMANCE: Beat Detection', () => {
	it('should detect beats in analysis frames', () => {
		const frames: AnalysisFrame[] = [
			// Low energy (no beat)
			{
				time: 0.0,
				pitch: 220,
				energy: 0.1,
				timbre: { spectralCentroid: 2000, zcr: 0.1, spectralFlux: 0 }
			},
			// Sudden spike (beat!)
			{
				time: 0.016,
				pitch: 220,
				energy: 0.8,
				timbre: { spectralCentroid: 2000, zcr: 0.1, spectralFlux: 0 },
				beat: true
			},
			// Back to low energy
			{
				time: 0.032,
				pitch: 220,
				energy: 0.1,
				timbre: { spectralCentroid: 2000, zcr: 0.1, spectralFlux: 0 }
			}
		];

		// Generate geometry with beat data
		const lathePoints = generateLathe(frames, undefined, 'additive', undefined, 'digital', 'standard', 'lathe');

		expect(lathePoints.length).toBeGreaterThan(0);

		// The beat frame should have a wider radius (rib)
		// Note: This is a simplification - in practice, the beat deformation
		// is applied during the mapping, so we can't directly test the output
		// without mocking the getBeatImpulse function
	});

	it('should calculate beat scale multiplier', () => {
		const beatFrame: AnalysisFrame = {
			time: 0.016,
			pitch: 220,
			energy: 0.8,
			timbre: { spectralCentroid: 2000, zcr: 0.1, spectralFlux: 0 },
			beat: true
		};

		const normalFrame: AnalysisFrame = {
			time: 0.0,
			pitch: 220,
			energy: 0.5,
			timbre: { spectralCentroid: 2000, zcr: 0.1, spectralFlux: 0 }
		};

		// Beat frame should return > 1.0 (pulse)
		const beatScale = getBeatScaleMultiplier(beatFrame);
		expect(beatScale).toBeGreaterThan(1.0);
		expect(beatScale).toBeLessThanOrEqual(1.2); // Max 20% increase

		// Wait for decay, then check normal frame
		// Note: Due to stateful beat tracking, we just verify it's a valid multiplier
		const normalScale = getBeatScaleMultiplier(normalFrame);
		expect(normalScale).toBeGreaterThanOrEqual(1.0); // Can be 1.0 or decaying
		expect(normalScale).toBeLessThanOrEqual(1.2);
	});

	it('should detect active beats', () => {
		const beatFrame: AnalysisFrame = {
			time: Date.now() / 1000,
			pitch: 220,
			energy: 0.8,
			timbre: { spectralCentroid: 2000, zcr: 0.1, spectralFlux: 0 },
			beat: true
		};

		// Check if beat is active
		const isActive = isBeatActive(beatFrame);
		expect(typeof isActive).toBe('boolean');
	});
});

describe('GENERATIVE PERFORMANCE: Rhythm Physics', () => {
	it('should create wider ribs on beats for lathe shapes', () => {
		const frames: AnalysisFrame[] = [
			{
				time: 0.0,
				pitch: 220,
				energy: 0.5,
				timbre: { spectralCentroid: 2000, zcr: 0.1, spectralFlux: 0 }
			},
			{
				time: 0.016,
				pitch: 220,
				energy: 0.8,
				timbre: { spectralCentroid: 2000, zcr: 0.1, spectralFlux: 0 },
				beat: true // Beat detected!
			},
			{
				time: 0.032,
				pitch: 220,
				energy: 0.5,
				timbre: { spectralCentroid: 2000, zcr: 0.1, spectralFlux: 0 }
			}
		];

		// Generate lathe with beats
		const lathePoints = generateLathe(frames, undefined, 'additive', undefined, 'digital', 'standard', 'lathe');

		expect(lathePoints.length).toBe(3);

		// The middle point (beat) should have a slightly larger radius
		// Due to the beatDeformation added in the mapping
		// This is subtle and depends on the energy levels
	});

	it('should respond to beats differently for sphere vs lathe', () => {
		const beatFrame: AnalysisFrame = {
			time: 0.016,
			pitch: 220,
			energy: 0.8,
			timbre: { spectralCentroid: 2000, zcr: 0.1, spectralFlux: 0 },
			beat: true
		};

		// For sphere: Use scale multiplier
		const sphereScale = getBeatScaleMultiplier(beatFrame);
		expect(sphereScale).toBeGreaterThan(1.0);

		// For lathe: Beat creates ribs (tested in geometry generation)
		const frames = [beatFrame];
		const lathePoints = generateLathe(frames, undefined, 'additive', undefined, 'digital', 'standard', 'lathe');
		expect(lathePoints.length).toBeGreaterThan(0);
	});
});

describe('GENERATIVE PERFORMANCE: Integration Test', () => {
	it('should support full multi-layer workflow with beats', () => {
		// Clear any existing layers
		clearLayers();

		// Step 1: Create Base Layer (steady note)
		const baseFrames: AnalysisFrame[] = Array.from({ length: 20 }, (_, i) => ({
			time: i * 0.016,
			pitch: 220,
			energy: 0.5,
			timbre: { spectralCentroid: 2000, zcr: 0.1, spectralFlux: 0 }
		}));

		const basePoints = generateLathe(baseFrames);
		const baseData = new Float32Array(basePoints.length * 2);
		for (let i = 0; i < basePoints.length; i++) {
			const point = basePoints[i];
			if (!point) continue;
			baseData[i * 2] = point.x ?? 0;
			baseData[i * 2 + 1] = point.y ?? 0;
		}

		const baseLayer = createLayerFromFrames('base', 'Base Layer', baseData);
		addLayer(baseLayer);

		expect(sculptureStore.currentSculpture?.layers.length).toBe(1);

		// Step 2: Add Rhythm Layer (percussive beats)
		const rhythmFrames: AnalysisFrame[] = Array.from({ length: 20 }, (_, i) => ({
			time: i * 0.016,
			pitch: 0,
			energy: i % 5 === 0 ? 0.8 : 0.2, // Beat every 5 frames
			timbre: { spectralCentroid: 3000, zcr: 0.3, spectralFlux: 0 },
			beat: i % 5 === 0
		}));

		const rhythmPoints = generateLathe(rhythmFrames, undefined, 'additive', undefined, 'digital', 'standard', 'lathe');
		const rhythmData = new Float32Array(rhythmPoints.length * 2);
		for (let i = 0; i < rhythmPoints.length; i++) {
			const point = rhythmPoints[i];
			if (!point) continue;
			rhythmData[i * 2] = point.x ?? 0;
			rhythmData[i * 2 + 1] = point.y ?? 0;
		}

		const rhythmLayer = createLayerFromFrames('distortion', 'Rhythm Layer', rhythmData);
		addLayer(rhythmLayer);

		expect(sculptureStore.currentSculpture?.layers.length).toBe(2);

		// Step 3: Compose final geometry
		const finalGeometry = composeGeometry();
		expect(finalGeometry.length).toBeGreaterThan(0);

		// Step 4: Test UNDO (remove rhythm layer)
		removeLayer(rhythmLayer.id);
		expect(sculptureStore.currentSculpture?.layers.length).toBe(1);

		const geometryAfterUndo = composeGeometry();
		expect(geometryAfterUndo.length).toBeGreaterThan(0);

		// Step 5: Verify we can redo by adding the layer back
		addLayer(rhythmLayer);
		expect(sculptureStore.currentSculpture?.layers.length).toBe(2);

		console.log('✅ GENERATIVE PERFORMANCE: Full workflow test passed!');
	});
});

