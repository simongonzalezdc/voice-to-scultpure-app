import type { AnalysisFrame } from '$lib/types';
import type { AudioRingBuffer } from '$lib/types';

let worker: Worker | null = null;
let configured = false;

// CRITICAL FIX: Use callback array instead of overwriting onmessage
let frameCallbacks: Array<(frame: AnalysisFrame) => void> = [];

export interface AnalysisWorkerClient {
	start: () => void;
	stop: () => void;
	onFrame: (callback: (frame: AnalysisFrame) => void) => void;
	dispose: () => void;
	isConfigured: () => boolean;
}

export function createAnalysisWorkerClient(
	ringBuffer: AudioRingBuffer,
	onFrame: (frame: AnalysisFrame) => void
): AnalysisWorkerClient {
	// Clean up existing worker if any
	if (worker) {
		console.log('🔄 [WORKER] Terminating existing worker before creating new one');
		worker.terminate();
		worker = null;
	}

	// Reset state
	frameCallbacks = [onFrame]; // Initialize with the provided callback
	configured = false;

	worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), {
		type: 'module'
	});

	let frameCount = 0;
	let configConfirmed = false;
	let lastErrorTime = 0;

	// CRITICAL FIX: Single message handler that dispatches to all callbacks
	worker.onmessage = (e) => {
		const { type, payload } = e.data;

		if (type === 'status') {
			if (payload === 'configured') {
				configConfirmed = true;
				configured = true;
				console.log('✅ [WORKER] Configuration confirmed by worker');
			} else if (payload === 'started') {
				console.log('✅ [WORKER] Worker started successfully');
			} else if (payload === 'stopped') {
				console.log('✅ [WORKER] Worker stopped');
			}
		}

		if (type === 'analysis-frame') {
			frameCount++;
			if (frameCount === 1) {
				console.log('🔊 [WORKER] First analysis frame received');
			}
			// CRITICAL FIX: Call ALL registered callbacks
			const frame = payload as AnalysisFrame;
			for (const callback of frameCallbacks) {
				try {
					callback(frame);
				} catch (err) {
					// Don't let one bad callback break others
					console.error('❌ [WORKER] Frame callback error:', err);
				}
			}
		}

		if (type === 'error') {
			const now = Date.now();
			// Rate-limit error logging to avoid spam
			if (now - lastErrorTime > 1000) {
				console.error('❌ [WORKER] Worker error:', payload);
				lastErrorTime = now;
			}
		}
	};

	worker.onerror = (error) => {
		console.error('❌ [WORKER] Analysis worker fatal error:', error.message);
		console.error('   Filename:', error.filename, 'Line:', error.lineno);
		configured = false;
		configConfirmed = false;
	};

	// Configure worker - wait for confirmation before marking as configured
	worker.postMessage({
		type: 'config',
		payload: {
			ringBuffer: ringBuffer.buffer,
			sampleRate: ringBuffer.sampleRate,
			fftSize: 2048,
			hopSize: 512
		}
	});

	// Set a timeout to mark as configured even if we don't get confirmation
	// (some browsers might not send status messages)
	setTimeout(() => {
		if (!configConfirmed) {
			console.warn('⚠️ [WORKER] Config confirmation timeout - assuming configured');
			configured = true;
		}
	}, 200); // Increased timeout for slower systems

	return {
		start: () => {
			if (!worker) {
				console.error('❌ [WORKER] Cannot start: worker is null');
				return;
			}
			if (!configured) {
				console.warn('⚠️ [WORKER] Starting before configuration confirmed - waiting 100ms...');
				// Wait a bit and try again
				setTimeout(() => {
					if (worker && configured) {
						console.log('▶️ [WORKER] Delayed start after config confirmed');
						frameCount = 0;
						worker.postMessage({ type: 'start' });
					}
				}, 100);
				return;
			}
			console.log('▶️ [WORKER] Starting analysis worker');
			frameCount = 0;
			worker.postMessage({ type: 'start' });
		},
		stop: () => {
			if (worker) {
				console.log(`⏹️ [WORKER] Stopping analysis worker (processed ${frameCount} frames)`);
				worker.postMessage({ type: 'stop' });
			}
		},
		// CRITICAL FIX: Add callback to array instead of overwriting
		onFrame: (callback: (frame: AnalysisFrame) => void) => {
			if (!frameCallbacks.includes(callback)) {
				frameCallbacks.push(callback);
			}
		},
		dispose: () => {
			if (worker) {
				worker.postMessage({ type: 'stop' });
				worker.terminate();
				worker = null;
				configured = false;
				frameCallbacks = [];
			}
		},
		isConfigured: () => configured
	};
}
