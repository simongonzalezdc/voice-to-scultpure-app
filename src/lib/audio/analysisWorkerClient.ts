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

	worker.onmessage = (e) => {
		const { type, payload } = e.data;
		if (type === 'analysis-frame') {
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
			hopSize: 512
		}
	});

	configured = true;

	return {
		start: () => {
			if (worker && configured) {
				worker.postMessage({ type: 'start' });
			}
		},
		stop: () => {
			if (worker) {
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
