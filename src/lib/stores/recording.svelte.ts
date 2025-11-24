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
import { quantizePitch } from '$lib/audio/audioTheory';
import { getAudioContext } from '$lib/audio/audioContext';
import { playResonance } from '$lib/audio/sonification';
import { getRadiusMetrics } from '$lib/engine/metrics';
import { DEFAULT_HEIGHT_MM } from '$lib/config/constants';
import type { SculptureLayer } from '$lib/types';

// ============================================================================
// CONSOLIDATED RECORDING STATE (Single Source of Truth)
// Merged from recordingStore.svelte.ts to eliminate dual-store confusion
// ============================================================================

export type RecordingState = 'idle' | 'recording' | 'processing' | 'complete';

export const recordingStore = $state<{
	state: RecordingState;
	startTime: number | null;
	duration: number;
	historyPosition: number; // 0-1 slider for time travel
}>({
	state: 'idle',
	startTime: null,
	duration: 0,
	historyPosition: 1
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
	const sliceIndex = Math.floor(capturedFrames.length * Math.max(0, Math.min(1, recordingStore.historyPosition)));
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
	const isGlazeMode = uiStore.workspace === 'glaze';

	// Clear frames array (prepare for new recording)
	capturedFrames = [];
	recordingStateSetTimings(Date.now(), 0);
	setRecordingState('recording');
	recordingStore.historyPosition = 1;

	if (isGlazeMode) {
		console.log('🎨 [RECORDING] Started painting - frames reset, sculpture preserved');
	} else {
		console.log('🎙️ [RECORDING] Started - frames reset to 0');
	}
}

/**
 * Stop recording and process captured frames into a sculpture
 * CRITICAL FIX: Capture vertex colors before setting state to 'complete' or 'idle'
 */
export async function stopRecording(): Promise<void> {
	if (recordingStore.state !== 'recording') {
		console.warn('⚠️ [RECORDING] Stop called but not in recording state');
		return;
	}

	// Mark as processing (prevents further frame capture)
	const duration = recordingStore.startTime ? Date.now() - recordingStore.startTime : 0;
	recordingStateSetTimings(null, duration);
	setRecordingState('processing');
	console.log(`🛑 [RECORDING] Stopped - Total frames captured: ${capturedFrames.length}`);

	// RESCUE PATH: Worker failed or frames empty -> generate minimal fallback
	if (capturedFrames.length === 0) {
		const fallback: import('$lib/types').AnalysisFrame = {
			time: Date.now(),
			pitch: analysisStore.latestFrame?.pitch ?? 0,
			energy: analysisStore.micLevel ?? 0,
			timbre:
				analysisStore.latestFrame?.timbre ?? ({
					spectralCentroid: 0,
					zcr: 0,
					spectralFlux: 0
				} as any)
		};
		capturedFrames = [fallback];
		console.log(
			`🔧 [RESCUE] Generated 1 fallback frames from micLevel: ${analysisStore.micLevel.toFixed?.(3) ?? analysisStore.micLevel}`
		);
		window.alert?.('⚠️ Audio Worker Failed - using fallback frame for save.');
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
				console.warn(
					'⚠️ [RECORDING] Cannot paint: no sculpture exists. Create a sculpture first.'
				);
			} else {
				console.log(`🎨 [RECORDING] Glaze recording stopped - colors captured and saved`);
			}
		} else {
			// SCULPT MODE: Add a new layer from recorded frames
			console.log(`✨ [RECORDING] Processing ${capturedFrames.length} frames into new layer...`);
			
			if (!sculptureStore.currentSculpture) {
				// First recording ever - create initial sculpture with base layer
				const mode = uiStore.sculptMode ?? 'additive';
				const zone =
					uiStore.sculptZone.min > 0 || uiStore.sculptZone.max < 1 ? uiStore.sculptZone : undefined;

				const sculpture = createSculptureFromFrames(
					capturedFrames,
					appSettings.userProfile,
					undefined,
					mode,
					zone,
					uiStore.constraintMode
				);
				
				setCurrentSculpture(sculpture);
				const pointCount = sculpture.radiusCurve?.length || sculpture?.layers?.length || 0;
				console.log(`🗿 [RECORDING] Initial sculpture created with ${pointCount} points`);
			} else {
				// Subsequent recordings - add as new layer
				const mode = sculptureStore.currentSculpture.physical.sculptMode ?? 'additive';
				const zone =
					uiStore.sculptZone.min > 0 || uiStore.sculptZone.max < 1 ? uiStore.sculptZone : undefined;
				
				// Generate geometry from frames
				const radiusCurve = generateLathe(
					capturedFrames,
					appSettings.userProfile,
					mode,
					zone,
					uiStore.constraintMode
				);
				
				// Convert to layer data (just radius values)
				const resolution = 128;
				const layerData = new Float32Array(resolution);
				const curveLen = radiusCurve?.length ?? 1;
				for (let i = 0; i < resolution; i++) {
					const normalizedY = i / (resolution - 1);
					const targetIndex = Math.round(normalizedY * (curveLen - 1));
					const clampedIndex = Math.min(targetIndex, curveLen - 1);
					const point = radiusCurve?.[clampedIndex];
					layerData[i] = point?.x ?? 0.5;
				}
				
				// Create new layer
				const newLayer: SculptureLayer = {
					id: crypto.randomUUID(),
					name: `Recording ${sculptureStore.currentSculpture.layers.length + 1}`,
					type: sculptureStore.currentSculpture.layers.length === 0 ? 'base' : 'distortion',
					visible: true,
					locked: false,
					blendMode: sculptureStore.currentSculpture.layers.length === 0 ? 'overwrite' : 'add',
					opacity: 1.0,
					data: layerData,
					mask: new Float32Array(resolution).fill(1.0),
					sourceFrameCount: capturedFrames.length
				};
				
				// Add layer using the store function (already imported at top)
				addLayer(newLayer);
				
				console.log(
					`🎨 [RECORDING] Added layer "${newLayer.name}" (${mode} mode, ${capturedFrames.length} frames)`
				);
			}
		}
		
		triggerResonanceFeedback();
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
	capturedFrames = [];
	recordingStateSetTimings(null, 0);
	setRecordingState('idle');
	recordingStore.historyPosition = 1;
	resetAnalysis();
	// Don't nullify sculpture, just reset recording state
	console.log(`✅ [RECORDING] Reset complete, new state: ${recordingStore.state}`);
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
