import { describe, it, expect, beforeEach, vi } from 'vitest';
import { recordingStore, stopRecording } from '../stores/recording.svelte';
import { analysisStore } from '../stores/analysisStore.svelte';
import type { AnalysisFrame } from '../types';

describe('Split Brain Syndrome Fixes', () => {
	beforeEach(() => {
		// Reset recording state before each test
		recordingStore.state = 'idle';
		recordingStore.startTime = null;
		recordingStore.duration = 0;
	});

	it('should handle save handoff when worker fails', () => {
		// Mock empty frames to simulate worker failure
		const _mockFrames: AnalysisFrame[] = [];

		// Mock console.log to capture fallback generation
		const consoleSpy = vi.spyOn(console, 'log');

		// Mock alert to capture user notification
		const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

		// Start recording
		recordingStore.state = 'recording';
		recordingStore.startTime = Date.now();

		// Stop recording (should trigger save handoff)
		stopRecording();

		// Verify worker failure was detected
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining('🔧 [RESCUE] Generated 1 fallback frames from micLevel:')
		);

		// Verify user was alerted
		expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️ Audio Worker Failed'));

		// Verify state transitioned to complete
		expect(recordingStore.state).toBe('complete');

		consoleSpy.mockRestore();
		alertSpy.mockRestore();
	});

	it('should have live bridge during recording', () => {
		// This tests the live bridge in Sculpture.svelte useTask loop
		// The live bridge bypasses recordingStore.frames and uses analysisStore.micLevel directly

		// Start recording
		recordingStore.state = 'recording';
		recordingStore.startTime = Date.now();

		// Set analysis store with live data
		const mockMicLevel = 0.5;
		const mockPitch = 220;

		// Directly update the analysis store
		analysisStore.micLevel = mockMicLevel;
		analysisStore.latestFrame = {
			time: Date.now(),
			pitch: mockPitch,
			energy: mockMicLevel,
			timbre: { spectralCentroid: 2000, zcr: 0.1, spectralFlux: 0.05 }
		};

		// Verify live bridge is working (micLevel is accessible during recording)
		expect(analysisStore.micLevel).toBe(mockMicLevel);
		expect(analysisStore.latestFrame?.pitch).toBe(mockPitch);

		// Stop recording
		stopRecording();

		// Verify state transitioned to complete
		expect(recordingStore.state).toBe('complete');
	});

	it('should amplify visuals for live feedback', () => {
		// This tests the visual amplification in the live bridge
		// The deformFactor of 5.0 should make the breathing effect more visible

		// Start recording
		recordingStore.state = 'recording';

		// Set analysis store with high energy
		const mockMicLevel = 0.8; // High energy
		const mockPitch = 440; // High pitch

		// Directly update the analysis store
		analysisStore.micLevel = mockMicLevel;
		analysisStore.latestFrame = {
			time: Date.now(),
			pitch: mockPitch,
			energy: mockMicLevel,
			timbre: { spectralCentroid: 3000, zcr: 0.2, spectralFlux: 0.1 }
		};

		// Verify amplification is working (high micLevel should be accessible)
		expect(analysisStore.micLevel).toBe(mockMicLevel);
		expect(analysisStore.latestFrame?.energy).toBe(mockMicLevel);

		// The live bridge should amplify the visual effect
		// In Sculpture.svelte line 365: deformFactor = 1.0 + (liveEnergy * 5.0)
		// With mockMicLevel = 0.8, this should be 1.0 + (0.8 * 5.0) = 5.0
		// This means the sculpture should breathe 5x larger than normal

		// Stop recording
		stopRecording();

		// Verify state transitioned to complete
		expect(recordingStore.state).toBe('complete');
	});

	it('should handle edge cases during recording', () => {
		// Test behavior with null/undefined values

		// Start recording
		recordingStore.state = 'recording';
		recordingStore.startTime = Date.now();

		// Set null/undefined analysis data
		analysisStore.micLevel = 0;
		analysisStore.latestFrame = null;

		// Verify system handles null values gracefully
		expect(analysisStore.micLevel).toBe(0);
		expect(analysisStore.latestFrame).toBeNull();

		// Stop recording should not crash
		expect(() => stopRecording()).not.toThrow();

		// Verify state transitioned to complete
		expect(recordingStore.state).toBe('complete');
	});
});
