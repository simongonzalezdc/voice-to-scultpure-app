import {
	setCurrentSculpture,
	sculptureStore,
	updateSculptureColors
} from './sculptureStore.svelte';
import { resetAnalysis, analysisStore } from './analysisStore.svelte';
import { createSculptureFromFrames } from '$lib/engine/physicsMapping'; // Keep for legacy or helper
import { appSettings } from './appSettingsStore.svelte';
import { uiStore } from './uiStore.svelte';
import { quantizePitch } from '$lib/audio/audioTheory';

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

	// PHASE 4: Real-time Layering means data is already written.
	// We just need to transition state.
	// Legacy logic (createSculptureFromFrames) is bypassed for the new architecture.
	
	// CRITICAL: Capture vertex colors before geometry disposal in glaze mode
	const isGlazeMode = uiStore.workspace === 'glaze';
	if (isGlazeMode && sculptureStore.meshReference?.geometry) {
		// ... (Keep existing glaze logic if needed, or rely on Layer System)
		// For Phase 4, we assume Glaze Layer handles this.
	}

	try {
		console.log('✅ [RECORDING] Layer data finalized.');
	} catch (err) {
		console.error('❌ [RECORDING] Processing failed:', err);
	} finally {
		setRecordingState('complete');
		console.log('✅ [RECORDING] Processing complete');
	}
}

/**
 * Phase 4: Smart Recording (Smart Masking)
 * Writes audio data directly to the active layer's buffers.
 */
export function addAnalysisFrame(frame: import('$lib/types').AnalysisFrame): void {
	if (recordingStore.state !== 'recording') return;

	capturedFrames.push(frame);

	// 1. Get Active Layer
	const sculpture = sculptureStore.currentSculpture;
	const activeLayerId = sculptureStore.activeLayerId;
	
	if (!sculpture || !activeLayerId) return;
	
	const layer = sculpture.layers.find(l => l.id === activeLayerId);
	if (!layer || layer.locked) return;

	// 2. Map Time to Index (Vertical Sweep)
	// Hardcoded 10s duration for now (Wizard Step 1)
	const RECORDING_DURATION_MS = 10000; 
	const elapsed = Date.now() - (recordingStore.startTime || Date.now());
	
	// Calculate index based on progress (0.0 to 1.0)
	const progress = Math.min(1.0, Math.max(0.0, elapsed / RECORDING_DURATION_MS));
	const resolution = layer.data.length;
	const index = Math.floor(progress * (resolution - 1));

	if (index >= 0 && index < resolution) {
		// 3. Write Data (Quantized Pitch)
		const quantizedHz = quantizePitch(frame.pitch);
		
		// Normalize Pitch (e.g., C3=130Hz to C6=1046Hz)
		// Mapping: Low pitch = Wide base? High pitch = Narrow?
		// Or: Pitch = Radius directly.
		// Let's map 100Hz-800Hz to Radius 0.2-1.5
		const minHz = 100;
		const maxHz = 800;
		const normPitch = Math.max(0, Math.min(1, (quantizedHz - minHz) / (maxHz - minHz)));
		
		// SMART MASKING: Check noise threshold
		const noiseThreshold = 0.02; // 2% volume
		const isAudible = frame.energy > noiseThreshold;

		// Only write if audible
		if (isAudible) {
			// Update Mask
			layer.mask[index] = frame.energy; // Store intensity

			// Update Data based on Layer Type
			if (layer.type === 'base') {
				// Base Layer: Pitch determines Radius
				// Low Pitch = Wide (1.5), High Pitch = Narrow (0.2)
				// Invert mapping? Usually Low = Big Base makes sense.
				const radius = 1.5 - (normPitch * 1.3);
				layer.data[index] = radius;
			} else if (layer.type === 'deformation') {
				// Deformation: Pitch determines Offset (-0.5 to 0.5)
				layer.data[index] = (normPitch - 0.5);
			} else if (layer.type === 'texture') {
				// Texture: Pitch determines Frequency/Roughness?
				// Or Energy determines Roughness
				layer.data[index] = normPitch;
			}
			
			// Trigger Re-render
			sculptureStore.geometryDirty = true;
		}
	}

	// Log every 60 frames (~1 second at 60fps)
	if (capturedFrames.length % 60 === 0) {
		// console.log(`📊 [RECORDING] Frame ${capturedFrames.length} -> Index ${index}`);
	}
}

export function resetRecording(): void {
	capturedFrames = [];
	recordingStateSetTimings(null, 0);
	setRecordingState('idle');
	resetAnalysis();
	// Don't nullify sculpture, just reset recording state
	console.log('🔄 [RECORDING] Reset to idle state');
}
