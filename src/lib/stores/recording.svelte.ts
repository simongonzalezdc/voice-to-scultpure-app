import { setCurrentSculpture, sculptureStore, updateSculptureColors } from './sculptureStore.svelte';
import { resetAnalysis } from './analysisStore.svelte';
import { createSculptureFromFrames } from '$lib/engine/physicsMapping';
import { appSettings } from './appSettingsStore.svelte';
import { uiStore } from './uiStore.svelte';

// ============================================================================
// CONSOLIDATED RECORDING STATE (Single Source of Truth)
// Merged from recordingStore.svelte.ts to eliminate dual-store confusion
// ============================================================================

export type RecordingState = 'idle' | 'recording' | 'processing' | 'complete';

export const recordingStore = $state<{
	state: RecordingState;
	startTime: number | null;
	duration: number;
}>({
	state: 'idle',
	startTime: null,
	duration: 0
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
export function stopRecording(): void {
	if (recordingStore.state !== 'recording') {
		console.warn('⚠️ [RECORDING] Stop called but not in recording state');
		return;
	}

	// Mark as processing (prevents further frame capture)
	const duration = recordingStore.startTime ? Date.now() - recordingStore.startTime : 0;
	recordingStateSetTimings(null, duration);
	setRecordingState('processing');
	console.log(`🛑 [RECORDING] Stopped - Total frames captured: ${capturedFrames.length}`);

	// CRITICAL: Capture vertex colors before geometry disposal in glaze mode
	const isGlazeMode = uiStore.workspace === 'glaze';
	if (isGlazeMode && sculptureStore.meshReference?.geometry) {
		const geometry = sculptureStore.meshReference.geometry;
		const colorAttribute = geometry.attributes.color;
		
		if (colorAttribute && colorAttribute.array && colorAttribute.array instanceof Float32Array) {
			// Extract the painted colors from the geometry BEFORE disposal
			const colors = Array.from(colorAttribute.array);
			// Save them to the sculpture store for persistence
			updateSculptureColors(new Float32Array(colors));
			console.log(
				`🎨 [RECORDING] Captured ${colors.length / 3} vertex colors before processing`
			);
		}
	}

	// Process frames immediately when stopping
	// DEAD LOCK GUARD: use try/finally to guarantee state transition
	try {
		if (capturedFrames.length > 0) {
			if (isGlazeMode) {
				// GLAZE MODE: Colors are now captured above
				// The mesh geometry will be regenerated with the saved colors
				if (!sculptureStore.currentSculpture) {
					console.warn(
						'⚠️ [RECORDING] Cannot paint: no sculpture exists. Create a sculpture first.'
					);
				} else {
					console.log(
						`🎨 [RECORDING] Glaze recording stopped - colors captured and saved`
					);
					// Colors are already saved above, mesh will use them when regenerated
				}
			} else {
				// SCULPT MODE: Create new sculpture from frames
				console.log(`✨ [RECORDING] Processing ${capturedFrames.length} frames into sculpture...`);
				// Create a deep copy to avoid reactivity issues during processing
				const frames = JSON.parse(JSON.stringify(capturedFrames));
				// Use current sculpture's mode if it exists, otherwise use uiStore preference, then default to 'additive'
				const mode =
					sculptureStore.currentSculpture?.physical.sculptMode ?? uiStore.sculptMode ?? 'additive';

				// DIRECTIVE 4: Pass zone parameter if zone is restricted
				const zone =
					uiStore.sculptZone.min > 0 || uiStore.sculptZone.max < 1 ? uiStore.sculptZone : undefined;

				// Pass constraint mode for fabrication constraints
				const sculpture = createSculptureFromFrames(
					frames,
					appSettings.userProfile,
					undefined,
					mode,
					zone,
					uiStore.constraintMode
				);
				setCurrentSculpture(sculpture);
				console.log(
					`🗿 [RECORDING] Sculpture created with ${sculpture.radiusCurve.length} points in ${mode} mode${zone ? ` (zone: ${(zone.min * 100).toFixed(0)}%-${(zone.max * 100).toFixed(0)}%)` : ''} [constraints: ${uiStore.constraintMode}]`
				);
			}
		} else {
			console.warn('⚠️ [RECORDING] No frames captured! Sculpture will be empty.');
		}
	} catch (err) {
		console.error('❌ [RECORDING] Processing failed:', err);
	} finally {
		// CRITICAL: Always transition to 'complete', even if processing failed
		setRecordingState('complete');
		console.log('✅ [RECORDING] Processing complete (or failed gracefully)');
	}
}

export function addAnalysisFrame(frame: import('$lib/types').AnalysisFrame): void {
	if (recordingStore.state === 'recording') {
		capturedFrames.push(frame);
		// Log every 60 frames (~1 second at 60fps)
		if (capturedFrames.length % 60 === 0) {
			console.log(
				`📊 [RECORDING] Captured ${capturedFrames.length} frames (${(capturedFrames.length / 60).toFixed(1)}s)`
			);
		}
	}
}

export function resetRecording(): void {
	capturedFrames = [];
	recordingStateSetTimings(null, 0);
	setRecordingState('idle');
	resetAnalysis();
	setCurrentSculpture(null);
	console.log('🔄 [RECORDING] Reset to idle state');
}
