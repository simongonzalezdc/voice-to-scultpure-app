console.log('🔴🔴🔴 [MODULE LOAD] recording.svelte.ts loaded at', new Date().toLocaleTimeString());

import {
	setCurrentSculpture,
	sculptureStore,
	updateSculptureColors,
	addLayer
} from './sculptureStore.svelte';
import { resetAnalysis, analysisStore } from './analysisStore.svelte';
import { createSculptureFromFrames, generateLathe } from '$lib/engine/physicsMapping';
import { appSettings } from './appSettingsStore.svelte';
import { uiStore } from './uiStore.svelte';
import { getAudioContext, startAudioCapture, stopAudioCapture } from '$lib/audio/audioContext';
import { playResonance } from '$lib/audio/sonification';
import { loadAudioBlob } from '$lib/stores/playbackStore.svelte';
import { getRadiusMetrics } from '$lib/engine/metrics';
import {
	DEFAULT_HEIGHT_MM,
	STANDARD_MODE_RESOLUTION,
	SONG_MODE_RESOLUTION
} from '$lib/config/constants';
import type { SculptureLayer } from '$lib/types';
import { addToGallery } from './galleryStore.svelte';
import { addHistoryEntry, setActiveSculpture } from './sessionHistoryStore.svelte';

// ============================================================================
// CONSOLIDATED RECORDING STATE (Single Source of Truth)
// Merged from recordingStore.svelte.ts to eliminate dual-store confusion
// ============================================================================

export type RecordingState = 'idle' | 'recording' | 'processing' | 'complete';

// CRITICAL FIX: Plain boolean flag for frame capture
// Svelte's $state proxy may not work correctly when read from non-reactive callbacks
// This flag is set/read synchronously and bypasses any reactivity issues
let _isCapturing = false;

export function isCapturing(): boolean {
	return _isCapturing;
}

/**
 * Get the resolution based on the current recording mode
 * Song Mode uses higher resolution for longer recordings
 */
function getResolutionForMode(): number {
	switch (uiStore.recordingMode) {
		case 'song':
			return SONG_MODE_RESOLUTION;
		default:
			return STANDARD_MODE_RESOLUTION;
	}
}

export const recordingStore = $state<{
	state: RecordingState;
	startTime: number | null;
	duration: number;
	historyPosition: number; // 0-1 slider for time travel
	frameCount: number; // Reactive frame count for height scaling
}>({
	state: 'idle',
	startTime: null,
	duration: 0,
	historyPosition: 1,
	frameCount: 0
});

// Low-level state setters (internal use)
function setRecordingState(newState: RecordingState): void {
	recordingStore.state = newState;
}

function recordingStateSetTimings(startTime: number | null, duration: number): void {
	recordingStore.startTime = startTime;
	recordingStore.duration = duration;
}

// Reactive state for live visualization
// eslint-disable-next-line svelte/valid-compile
let capturedFrames = $state<import('$lib/types').AnalysisFrame[]>([]);

// ============================================================================
// PUBLIC API: Recording lifecycle functions
// ============================================================================

export function getCapturedFrames() {
	return capturedFrames;
}

export function getPlaybackFrames() {
	if (!capturedFrames.length) return capturedFrames;
	const sliceIndex = Math.floor(
		capturedFrames.length * Math.max(0, Math.min(1, recordingStore.historyPosition))
	);
	return capturedFrames.slice(0, sliceIndex);
}

export function setHistoryPosition(t: number): void {
	recordingStore.historyPosition = Math.max(0, Math.min(1, t));
}

export function hasCapturedFrames(): boolean {
	return capturedFrames.length > 0;
}

/**
 * Start recording: Initialize frame capture and set state to 'recording'
 * DIRECTIVE 2: Non-destructive for glaze mode - only clears frames, preserves sculpture
 */
export function startRecording(): void {
	console.log('🔴🔴🔴 [RECORDING] startRecording() CALLED');
	const isGlazeMode = uiStore.workspace === 'glaze';

	// Clear frames array (prepare for new recording)
	capturedFrames = [];
	recordingStore.frameCount = 0;
	recordingStateSetTimings(Date.now(), 0);
	setRecordingState('recording');
	recordingStore.historyPosition = 1;

	// CRITICAL FIX: Set plain boolean flag for non-reactive callback contexts
	_isCapturing = true;

	// Start audio capture for playback (only in sculpt mode)
	if (!isGlazeMode) {
		startAudioCapture();
	}

	if (isGlazeMode) {
		console.log('🎨 [RECORDING] Started painting - frames reset, sculpture preserved');
	} else {
		console.log(
			'🎙️ [RECORDING] Started - frames reset to 0, audio capture started, _isCapturing = true'
		);
	}
}

/**
 * Stop recording and process captured frames into a sculpture
 * CRITICAL FIX: Capture vertex colors before setting state to 'complete' or 'idle'
 */
export async function stopRecording(): Promise<void> {
	console.log(
		'🔴🔴🔴 [RECORDING] stopRecording() CALLED, state:',
		recordingStore.state,
		'frames:',
		capturedFrames.length
	);

	// CRITICAL FIX: Immediately stop frame capture via plain boolean
	_isCapturing = false;

	if (recordingStore.state !== 'recording') {
		console.warn('⚠️ [RECORDING] Stop called but not in recording state');
		return;
	}

	// Mark as processing (prevents further frame capture)
	const duration = recordingStore.startTime ? Date.now() - recordingStore.startTime : 0;
	recordingStateSetTimings(null, duration);
	setRecordingState('processing');
	console.log('🔴🔴🔴 [RECORDING] Processing... duration:', duration, 'ms');
	console.log(
		`🛑 [RECORDING] Stopped - Total frames captured: ${capturedFrames.length}, _isCapturing = false`
	);

	// RESCUE PATH: Worker failed or frames empty -> generate minimal fallback
	if (capturedFrames.length === 0) {
		const micLevel = analysisStore.micLevel ?? 0;
		const latestFrame = analysisStore.latestFrame;

		const fallback: import('$lib/types').AnalysisFrame = {
			time: Date.now(),
			pitch: latestFrame?.pitch ?? 0,
			energy: micLevel,
			timbre:
				latestFrame?.timbre ??
				({
					spectralCentroid: 0,
					zcr: 0,
					spectralFlux: 0
				} as any)
		};
		capturedFrames = [fallback];

		// Detailed diagnostic logging
		console.warn('🔧 [RESCUE] No frames captured during recording. Diagnostics:');
		console.warn(
			`   - Mic Level: ${micLevel.toFixed?.(3) ?? micLevel} (should be > 0.001 if audio is flowing)`
		);
		console.warn(
			`   - Latest Frame: ${latestFrame ? 'EXISTS' : 'NULL'} (should exist if worker is running)`
		);
		console.warn(`   - Duration: ${duration}ms`);
		console.warn('   Possible causes:');
		console.warn('   1. Microphone is muted or volume too low');
		console.warn('   2. Wrong microphone device selected');
		console.warn('   3. Audio worklet failed to connect');
		console.warn('   4. Analysis worker failed to start');

		// Show user-friendly alert with actionable info
		const alertMsg =
			micLevel < 0.001
				? '⚠️ No audio detected. Check:\n• Microphone not muted\n• Correct mic selected\n• Mic volume > 0'
				: '⚠️ Audio detected but worker failed. Try refreshing the page.';
		window.alert?.(alertMsg);
	}

	// CRITICAL: Capture vertex colors before geometry disposal in glaze mode
	const isGlazeMode = uiStore.workspace === 'glaze';
	if (isGlazeMode && sculptureStore.meshReference?.geometry) {
		const geometry = sculptureStore.meshReference.geometry;
		const colorAttribute = geometry.attributes.color;

		if (colorAttribute && colorAttribute.array && colorAttribute.array instanceof Float32Array) {
			// Extract the painted colors from the geometry BEFORE disposal
			const colorArray = colorAttribute.array as Float32Array;
			const colors = Array.from(colorArray);
			// Save them to the sculpture store for persistence
			updateSculptureColors(new Float32Array(colors));
			console.log(`🎨 [RECORDING] Captured ${colors.length / 3} vertex colors before processing`);
		}
	}

	// DEAD LOCK GUARD: use try/finally to guarantee state transition
	try {
		if (isGlazeMode) {
			// GLAZE MODE: Colors are now captured above
			if (!sculptureStore.currentSculpture) {
				console.warn('⚠️ [RECORDING] Cannot paint: no sculpture exists. Create a sculpture first.');
			} else {
				console.log(`🎨 [RECORDING] Glaze recording stopped - colors captured and saved`);
			}
		} else {
			// SCULPT MODE: Add a new layer from recorded frames
			console.log(`✨ [RECORDING] Processing ${capturedFrames.length} frames into new layer...`);

			// Check if we should CREATE a new sculpture or ADD to existing
			// KEY INSIGHT: If the only layer is the default "Base Layer", we should REPLACE it
			// This ensures preview matches final result
			const existingLayers = sculptureStore.currentSculpture?.layers ?? [];
			const hasOnlyDefaultBase =
				existingLayers.length === 1 && existingLayers[0]?.name === 'Base Layer';
			const shouldCreateNew = !sculptureStore.currentSculpture || hasOnlyDefaultBase;

			if (shouldCreateNew) {
				// First meaningful recording - create/replace with user's recording as base layer
				const mode = uiStore.sculptMode ?? 'additive';
				const zone =
					uiStore.sculptZone.min > 0 || uiStore.sculptZone.max < 1 ? uiStore.sculptZone : undefined;

				// Get resolution based on recording mode (Song Mode uses 512 for 4x detail)
				const resolution = getResolutionForMode();

				// NON-DESTRUCTIVE CONSTRAINTS: Store RAW data, apply constraints at RENDER time
				// This allows users to toggle between Digital/Ceramic/3D Print without re-recording
				console.log(
					`📦 [RECORDING] Creating sculpture from recording (${resolution} pts) - replacing default template`
				);

				const sculpture = createSculptureFromFrames(
					capturedFrames,
					appSettings.userProfile,
					undefined,
					mode,
					zone,
					'digital', // Always store raw data - constraints applied at render time
					'lathe', // baseShape
					resolution, // Pass recording mode resolution
					uiStore.controlMode // FIX: Use actual control mode (melodic = pitch->radius)
				);

				// FIX: Store height using SAME formula as Sculpture.svelte preview
				// Must match: MIN_HEIGHT_RATIO + (seconds * growthRate)
				const seconds = capturedFrames.length / 30; // ~30 fps
				const isSongMode = uiStore.recordingMode === 'song';

				// MUST MATCH Sculpture.svelte constants exactly:
				const MIN_HEIGHT_RATIO = 0.3; // Start at 30% height
				const growthRate = isSongMode ? 0.25 : 0.5; // 25%/sec song, 50%/sec standard
				const maxRatio = isSongMode ? 10.0 : 6.0; // 10x song, 6x standard

				// Same formula as Sculpture.svelte heightScale derived
				const heightRatio = Math.min(maxRatio, MIN_HEIGHT_RATIO + seconds * growthRate);
				sculpture.physical.height = DEFAULT_HEIGHT_MM * heightRatio;

				console.log(
					`📐 [RECORDING] Final height: ${seconds.toFixed(1)}s → ${heightRatio.toFixed(2)}x (${DEFAULT_HEIGHT_MM * heightRatio}mm)`
				);

				// Stop audio capture and attach blob to sculpture for playback
				const audioBlob = await stopAudioCapture();
				if (audioBlob) {
					sculpture.audioBlob = audioBlob;
					// Load audio into playback store for immediate availability
					await loadAudioBlob(audioBlob);
					console.log(
						`🎵 [RECORDING] Audio blob attached (${(audioBlob.size / 1024).toFixed(1)} KB)`
					);
				}

				setCurrentSculpture(sculpture);
				const pointCount = sculpture.radiusCurve?.length || sculpture?.layers?.length || 0;
				console.log(
					`🗿 [RECORDING] Sculpture created with ${pointCount} points (resolution: ${resolution})`
				);
			} else {
				// Subsequent recordings - add as new layer ON TOP of user's base
				const mode = sculptureStore.currentSculpture?.physical.sculptMode ?? 'additive';
				const zone =
					uiStore.sculptZone.min > 0 || uiStore.sculptZone.max < 1 ? uiStore.sculptZone : undefined;

				// NON-DESTRUCTIVE: Generate RAW geometry - constraints applied at render time
				console.log(`📦 [RECORDING] Adding layer to existing ${existingLayers.length} layers`);

				// Generate geometry from frames (no constraints - raw data)
				const radiusCurve = generateLathe(
					capturedFrames,
					appSettings.userProfile,
					mode,
					zone,
					'digital', // Always raw - constraints at render time
					uiStore.controlMode, // FIX: Use actual control mode (melodic = pitch->radius)
					'lathe'
				);

				// Convert to layer data (radius values)
				const resolution = getResolutionForMode();
				const layerData = new Float32Array(resolution);
				const curveLen = radiusCurve?.length ?? 1;

				const layerIndex = existingLayers.length;

				// First USER layer (after replacing default) should be base with full radius
				// Subsequent layers are distortions with delta values
				const isFirstUserLayer =
					layerIndex === 0 || (layerIndex === 1 && existingLayers[0]?.name === 'Base Layer');
				const isFirstLayer = isFirstUserLayer;

				// For subsequent layers: compute delta relative to existing profile
				// This ensures additive blending produces expected results
				// Delta = newRadius - existingBaselineRadius
				const BASELINE_RADIUS = 0.5; // Used as fallback

				for (let i = 0; i < resolution; i++) {
					const normalizedY = i / (resolution - 1);
					const targetIndex = Math.round(normalizedY * (curveLen - 1));
					const clampedIndex = Math.min(targetIndex, curveLen - 1);
					const point = radiusCurve?.[clampedIndex];
					const fullRadius = point?.x ?? 0.5;

					if (isFirstLayer) {
						// Base layer: Store full radius (used with 'overwrite' blend mode)
						layerData[i] = fullRadius;
					} else {
						// Distortion layer: Store DELTA from baseline
						// 'add' blend mode adds deviation, not full value
						layerData[i] = fullRadius - BASELINE_RADIUS;
					}
				}

				const avgData = layerData.reduce((a, b) => a + b, 0) / layerData.length;
				console.log(
					`📊 [LAYER DATA] ${isFirstLayer ? 'Base' : 'Distortion'}: ${resolution} pts, avg=${avgData.toFixed(3)}`
				);

				const layerMask = new Float32Array(resolution).fill(1.0);
				const layerName = `Recording ${layerIndex + 1}`;

				const newLayer: SculptureLayer = {
					id: crypto.randomUUID(),
					name: layerName,
					type: isFirstLayer ? 'base' : 'distortion',
					visible: true,
					locked: false,
					blendMode: isFirstLayer ? 'overwrite' : 'add',
					opacity: 1.0,
					data: layerData,
					mask: layerMask,
					sourceFrameCount: capturedFrames.length,
					sourceFrames: capturedFrames // Store raw frames for lossless quality
				};

				// Add layer using the store function (already imported at top)
				addLayer(newLayer);

				// P1: Add to session history for undo/redo
				const sculptureId = sculptureStore.currentSculpture?.id ?? 'unknown';
				const durationSec = capturedFrames.length / 30;
				addHistoryEntry('recording', newLayer.name, newLayer, sculptureId, {
					duration: durationSec,
					frameCount: capturedFrames.length
				});

				console.log(
					`🎨 [RECORDING] Added layer "${newLayer.name}" (${mode} mode, ${capturedFrames.length} frames)`
				);
			}
		}

		triggerResonanceFeedback();

		// AUTO-SAVE to gallery
		if (sculptureStore.currentSculpture) {
			const durationSec = capturedFrames.length / 30; // ~30 fps
			addToGallery(
				sculptureStore.currentSculpture,
				undefined, // Auto-generate name
				durationSec
			);

			// P1: Track active sculpture for history
			setActiveSculpture(sculptureStore.currentSculpture.id);
		}
	} catch (err) {
		console.error('❌ [RECORDING] Processing failed:', err);
	} finally {
		// CRITICAL: Always transition to 'complete', even if processing failed
		setRecordingState('complete');
		recordingStore.historyPosition = 1;
		console.log('✅ [RECORDING] Processing complete');
	}
}

/**
 * Add an analysis frame to the captured frames array.
 * Classic approach: frames are processed after recording stops.
 */
export function addAnalysisFrame(frame: import('$lib/types').AnalysisFrame): void {
	if (recordingStore.state !== 'recording') {
		return; // Silently ignore if not recording
	}

	capturedFrames.push(frame);
	recordingStore.frameCount = capturedFrames.length; // Reactive for height scaling
	recordingStore.historyPosition = 1;

	// Mark geometry as dirty to trigger live preview update
	// Update every 15 frames for smoother, less jittery updates (~2 updates per second at 30fps)
	// This makes the sculpting feel more intentional and easier to control
	if (capturedFrames.length % 15 === 0) {
		sculptureStore.geometryDirty = true;
	}

	// Log first frame and periodic updates
	if (capturedFrames.length === 1) {
		console.log('✅ [RECORDING] First frame added to capturedFrames');
	} else if (capturedFrames.length % 30 === 0) {
		console.log(`📊 [RECORDING] ${capturedFrames.length} frames captured`);
	}
}

export function resetRecording(): void {
	console.log(`🔄 [RECORDING] Resetting from state: ${recordingStore.state}`);
	_isCapturing = false; // CRITICAL FIX: Clear capture flag
	capturedFrames = [];
	recordingStore.frameCount = 0;
	recordingStateSetTimings(null, 0);
	setRecordingState('idle');
	recordingStore.historyPosition = 1;
	resetAnalysis();
	// Don't nullify sculpture, just reset recording state
	console.log(
		`✅ [RECORDING] Reset complete, new state: ${recordingStore.state}, _isCapturing = false`
	);
}

function triggerResonanceFeedback(): void {
	const audioContext = getAudioContext();
	if (!audioContext) return;

	const sculpture = sculptureStore.currentSculpture;
	if (!sculpture) return;

	const metrics = getRadiusMetrics(sculpture);
	const averageRadius = metrics?.averageRadius ?? 0.5;
	const height = sculpture.physical?.height ?? DEFAULT_HEIGHT_MM;
	// Surface may not be present in some definitions; default to ceramic timbre
	const materialType = (sculpture as any).surface?.materialType ?? 'ceramic';

	try {
		playResonance(audioContext, averageRadius, height, materialType);
	} catch (err) {
		console.error('Failed to play resonance feedback:', err);
	}
}
