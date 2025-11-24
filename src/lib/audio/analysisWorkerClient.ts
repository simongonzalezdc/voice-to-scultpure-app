import type { AnalysisFrame } from '$lib/types';
import type { AudioRingBuffer } from '$lib/types';

let worker: Worker | null = null;
let configured = false;

export interface AnalysisWorkerClient {
	start: () => void;
	stop: () => void;
	onFrame: (callback: (frame: AnalysisFrame) => void) => void;
	dispose: () => void;
}

export function createAnalysisWorkerClient(
	ringBuffer: AudioRingBuffer,
	onFrame: (frame: AnalysisFrame) => void
): AnalysisWorkerClient {
	if (worker) {
		worker.terminate();
	}

	worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), {
		type: 'module'
	});

	let frameCount = 0;
	let configConfirmed = false;
	
	worker.onmessage = (e) => {
		const { type, payload } = e.data;
		
		if (type === 'status' && payload === 'configured') {
			configConfirmed = true;
			configured = true;
			console.log('✅ [WORKER] Configuration confirmed by worker');
		}
		
		if (type === 'analysis-frame') {
			frameCount++;
			if (frameCount === 1) {
				console.log('🔊 [WORKER] First analysis frame received');
			}
			onFrame(payload as AnalysisFrame);
		}
		
		if (type === 'error') {
			console.error('❌ [WORKER] Worker error:', payload);
		}
	};

	worker.onerror = (error) => {
		console.error('❌ [WORKER] Analysis worker error:', error);
		configured = false;
		configConfirmed = false;
	};

	// Configure worker - wait for confirmation before marking as configured
	configured = false; // Reset to false
	worker.postMessage({
		type: 'config',
		payload: {
			ringBuffer: ringBuffer.buffer,
			sampleRate: ringBuffer.sampleRate,
			fftSize: 2048,
			hopSize: 512 // REVERT: 2048 caused Meyda buffer size error. Improved pitch detection in autocorrelation instead.
		}
	});
	
	// Set a timeout to mark as configured even if we don't get confirmation
	// (some browsers might not send status messages)
	setTimeout(() => {
		if (!configConfirmed) {
			console.warn('⚠️ [WORKER] Config confirmation timeout - assuming configured');
			configured = true;
		}
	}, 100);

	return {
		start: () => {
			if (!worker) {
				console.error('❌ [WORKER] Cannot start: worker is null');
				return;
			}
			if (!configured) {
				console.warn('⚠️ [WORKER] Starting before configuration confirmed - this may cause issues');
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
		onFrame: (callback: (frame: AnalysisFrame) => void) => {
			if (worker) {
				worker.onmessage = (e) => {
					const { type, payload } = e.data;
					if (type === 'analysis-frame') {
						callback(payload as AnalysisFrame);
					}
				};
			}
		},
		dispose: () => {
			if (worker) {
				worker.postMessage({ type: 'stop' });
				worker.terminate();
				worker = null;
				configured = false;
			}
		}
	};
}
