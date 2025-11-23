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
	worker.onmessage = (e) => {
		const { type, payload } = e.data;
		if (type === 'analysis-frame') {
			frameCount++;
			if (frameCount === 1) {
				console.log('🔊 [WORKER] First analysis frame received');
			}
			onFrame(payload as AnalysisFrame);
		}
	};

	worker.onerror = (error) => {
		console.error('Analysis worker error:', error);
	};

	// Configure worker
	worker.postMessage({
		type: 'config',
		payload: {
		ringBuffer: ringBuffer.buffer,
		sampleRate: ringBuffer.sampleRate,
		fftSize: 2048,
		hopSize: 512 // REVERT: 2048 caused Meyda buffer size error. Improved pitch detection in autocorrelation instead.
		}
	});

	configured = true;

	return {
		start: () => {
			if (worker && configured) {
				console.log('▶️ [WORKER] Starting analysis worker');
				frameCount = 0;
				worker.postMessage({ type: 'start' });
			}
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
