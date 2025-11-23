import { describe, it, expect, beforeEach } from 'vitest';
import { recordingStore, addAnalysisFrame, resetRecording } from '../stores/recording.svelte';
import { uiStore, togglePanel, setToolMode, setSculptMode } from '../stores/uiStore.svelte';
import {
	voiceLinksStore,
	toggleVoiceLink,
	pitchToTwist,
	timbreToRoughness
} from '../stores/voiceLinksStore.svelte';
import type { AnalysisFrame } from '../types';

/**
 * Unit Tests: Store Logic
 *
 * Tests reactive state management including:
 * - Recording state transitions
 * - UI panel toggles
 * - Voice links activation
 * - Constraint mode switching
 */

describe('Recording Store', () => {
	beforeEach(() => {
		// Reset recording state before each test
		resetRecording();
	});

	it('should initialize with idle state', () => {
		expect(recordingStore.state).toBe('idle');
	});

	it('should have valid recording state', () => {
		// Verify state property exists and has valid value
		expect(recordingStore).toHaveProperty('state');
		expect(['idle', 'recording', 'processing', 'complete']).toContain(recordingStore.state);
	});

	it('should have timing properties', () => {
		expect(recordingStore).toHaveProperty('startTime');
		expect(recordingStore).toHaveProperty('duration');
		expect(typeof recordingStore.duration).toBe('number');
	});

	it('should add analysis frames without error', () => {
		const frame: AnalysisFrame = {
			time: 0,
			pitch: 200,
			energy: 0.5,
			timbre: {
				spectralCentroid: 2000,
				zcr: 0.1,
				spectralFlux: 0.05
			}
		};

		// Frame addition should succeed
		expect(() => addAnalysisFrame(frame)).not.toThrow();
	});

	it('should reset to idle state', () => {
		resetRecording();
		expect(recordingStore.state).toBe('idle');
	});
});

describe('UI Store', () => {
	beforeEach(() => {
		// Reset to defaults
		uiStore.panels.fabricationPanel = false;
		uiStore.panels.aiPanel = false;
		uiStore.panels.settings = false;
	});

	it('should initialize with default panel states', () => {
		expect(uiStore.panels).toHaveProperty('fabricationPanel');
		expect(uiStore.panels).toHaveProperty('aiPanel');
		expect(uiStore.panels).toHaveProperty('settings');
		expect(typeof uiStore.panels.fabricationPanel).toBe('boolean');
	});

	it('should toggle panels', () => {
		const initialState = uiStore.panels.fabricationPanel;
		togglePanel('fabricationPanel');
		expect(uiStore.panels.fabricationPanel).toBe(!initialState);

		togglePanel('fabricationPanel');
		expect(uiStore.panels.fabricationPanel).toBe(initialState);
	});

	it('should have orientation property', () => {
		expect(uiStore).toHaveProperty('orientation');
		expect(['vertical', 'horizontal']).toContain(uiStore.orientation);
	});

	it('should have sculpt and glaze tool modes', () => {
		expect(uiStore).toHaveProperty('toolMode');
		expect(['sculpt', 'glaze-mix', 'glaze-paint']).toContain(uiStore.toolMode);
	});

	it('should set tool mode', () => {
		setToolMode('glaze-mix');
		expect(uiStore.toolMode).toBe('glaze-mix');

		setToolMode('sculpt');
		expect(uiStore.toolMode).toBe('sculpt');

		setToolMode('glaze-paint');
		expect(uiStore.toolMode).toBe('glaze-paint');
	});

	it('should set sculpt mode (additive/subtractive)', () => {
		setSculptMode('additive');
		expect(uiStore.sculptMode).toBe('additive');

		setSculptMode('subtractive');
		expect(uiStore.sculptMode).toBe('subtractive');
	});

	it('should have constraint mode', () => {
		expect(uiStore).toHaveProperty('constraintMode');
		expect(['digital', 'ceramic', '3d_print']).toContain(uiStore.constraintMode);
	});

	it('should have viewport controls state', () => {
		expect(uiStore.view).toHaveProperty('lightingAngle');
		expect(uiStore.view).toHaveProperty('zoom');
		expect(typeof uiStore.view.lightingAngle).toBe('number');
		expect(typeof uiStore.view.zoom).toBe('number');
	});

	it('should have sculpt zone boundaries', () => {
		expect(uiStore.sculptZone).toHaveProperty('min');
		expect(uiStore.sculptZone).toHaveProperty('max');
		expect(uiStore.sculptZone.min).toBeGreaterThanOrEqual(0);
		expect(uiStore.sculptZone.max).toBeLessThanOrEqual(1);
		expect(uiStore.sculptZone.min).toBeLessThanOrEqual(uiStore.sculptZone.max);
	});
});

describe('Voice Links Store', () => {
	beforeEach(() => {
		// Reset voice links
		voiceLinksStore.twist = 'none';
		voiceLinksStore.roughness = 'none';
	});

	it('should initialize with no links active', () => {
		expect(voiceLinksStore.twist).toBe('none');
		expect(voiceLinksStore.roughness).toBe('none');
	});

	it('should toggle twist link', () => {
		toggleVoiceLink('twist');
		expect(voiceLinksStore.twist).toBe('pitch');

		toggleVoiceLink('twist');
		expect(voiceLinksStore.twist).toBe('none');
	});

	it('should toggle roughness link', () => {
		toggleVoiceLink('roughness');
		expect(voiceLinksStore.roughness).toBe('timbre');

		toggleVoiceLink('roughness');
		expect(voiceLinksStore.roughness).toBe('none');
	});

	it('should map pitch to twist correctly', () => {
		// Low pitch (80 Hz) should map to negative twist
		const lowPitchTwist = pitchToTwist(80);
		expect(lowPitchTwist).toBeLessThan(0);
		expect(lowPitchTwist).toBeGreaterThanOrEqual(-1.0);

		// High pitch (400 Hz) should map to positive twist
		const highPitchTwist = pitchToTwist(400);
		expect(highPitchTwist).toBeGreaterThan(0);
		expect(highPitchTwist).toBeLessThanOrEqual(1.0);

		// Middle pitch should map near zero
		const midPitchTwist = pitchToTwist(240);
		expect(Math.abs(midPitchTwist)).toBeLessThan(0.2);
	});

	it('should clamp pitch to valid range', () => {
		const veryLowPitch = pitchToTwist(10); // Below range
		expect(veryLowPitch).toBeGreaterThanOrEqual(-1.0);

		const veryHighPitch = pitchToTwist(1000); // Above range
		expect(veryHighPitch).toBeLessThanOrEqual(1.0);
	});

	it('should map timbre to roughness correctly', () => {
		// Smooth sounds (low spectral centroid) should map to low roughness
		const smoothRoughness = timbreToRoughness(1000);
		expect(smoothRoughness).toBeGreaterThanOrEqual(0);
		expect(smoothRoughness).toBeLessThan(0.5);

		// Raspy sounds (high spectral centroid) should map to high roughness
		const raspyRoughness = timbreToRoughness(8000);
		expect(raspyRoughness).toBeGreaterThan(0.5);
		expect(raspyRoughness).toBeLessThanOrEqual(1.0);
	});

	it('should clamp timbre to valid range', () => {
		const verySmooth = timbreToRoughness(0); // Below range
		expect(verySmooth).toBeGreaterThanOrEqual(0);

		const veryRaspy = timbreToRoughness(20000); // Above range
		expect(veryRaspy).toBeLessThanOrEqual(1.0);
	});
});

describe('UI Store - Constraint Mode Switching', () => {
	it('should support all constraint modes', () => {
		const modes = ['digital', 'ceramic', '3d_print'] as const;

		for (const mode of modes) {
			uiStore.constraintMode = mode;
			expect(uiStore.constraintMode).toBe(mode);
		}
	});

	it('should have valid constraint descriptions', () => {
		expect(uiStore).toHaveProperty('constraintMode');
		// Verify we can access different constraint modes
		uiStore.constraintMode = 'digital';
		expect(uiStore.constraintMode).toBe('digital');

		uiStore.constraintMode = 'ceramic';
		expect(uiStore.constraintMode).toBe('ceramic');

		uiStore.constraintMode = '3d_print';
		expect(uiStore.constraintMode).toBe('3d_print');
	});
});

describe('UI Store - Glaze Mode', () => {
	beforeEach(() => {
		uiStore.toolMode = 'sculpt';
		uiStore.activeGlaze.color = '#FFFFFF';
		uiStore.activeGlaze.roughness = 0.5;
	});

	it('should track active glaze color', () => {
		expect(uiStore.activeGlaze).toHaveProperty('color');
		expect(typeof uiStore.activeGlaze.color).toBe('string');
	});

	it('should track active glaze roughness', () => {
		expect(uiStore.activeGlaze).toHaveProperty('roughness');
		expect(uiStore.activeGlaze.roughness).toBeGreaterThanOrEqual(0);
		expect(uiStore.activeGlaze.roughness).toBeLessThanOrEqual(1);
	});

	it('should allow glaze color changes', () => {
		const newColor = '#FF0000';
		uiStore.activeGlaze.color = newColor;
		expect(uiStore.activeGlaze.color).toBe(newColor);
	});

	it('should allow glaze roughness changes', () => {
		uiStore.activeGlaze.roughness = 0.75;
		expect(uiStore.activeGlaze.roughness).toBe(0.75);
	});
});
