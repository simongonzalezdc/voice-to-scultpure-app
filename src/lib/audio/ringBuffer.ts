import type { AudioRingBuffer } from '../types';

const WRITE_PTR_INDEX = 0;
const READ_PTR_INDEX = 1;
const DATA_START_INDEX = 2;

export function createAudioRingBuffer(
	capacity: number,
	sampleRate: number
): AudioRingBuffer | null {
	if (typeof SharedArrayBuffer === 'undefined') {
		return null;
	}

	// Buffer layout: [writePtr, readPtr, ...samples]
	const bufferSize = (capacity + DATA_START_INDEX) * 4; // 4 bytes per float32
	const buffer = new SharedArrayBuffer(bufferSize);

	// Initialize pointers
	Atomics.store(new Int32Array(buffer, 0, 2), WRITE_PTR_INDEX, 0);
	Atomics.store(new Int32Array(buffer, 0, 2), READ_PTR_INDEX, 0);

	return {
		buffer,
		capacity,
		sampleRate
	};
}

export function writeToRingBuffer(ringBuffer: AudioRingBuffer, samples: Float32Array): number {
	const view = new Float32Array(ringBuffer.buffer);
	const intView = new Int32Array(ringBuffer.buffer);
	const writePtr = Atomics.load(intView, WRITE_PTR_INDEX);
	const readPtr = Atomics.load(intView, READ_PTR_INDEX);

	const occupied = Math.min(ringBuffer.capacity, Math.max(0, writePtr - readPtr));
	const availableSpace = ringBuffer.capacity - occupied;
	const toWrite = Math.min(availableSpace, samples.length);

	for (let i = 0; i < toWrite; i++) {
		const writeIndex = ((writePtr + i) % ringBuffer.capacity) + DATA_START_INDEX;
		const sample = samples[i];
		if (sample !== undefined) {
			view[writeIndex] = sample;
		}
	}

	if (toWrite > 0) {
		Atomics.store(intView, WRITE_PTR_INDEX, writePtr + toWrite);
	}

	return toWrite;
}

export function readFromRingBuffer(ringBuffer: AudioRingBuffer, output: Float32Array): number {
	const view = new Float32Array(ringBuffer.buffer);
	const intView = new Int32Array(ringBuffer.buffer);
	const writePtr = Atomics.load(intView, WRITE_PTR_INDEX);
	const readPtr = Atomics.load(intView, READ_PTR_INDEX);

	const available = Math.min(ringBuffer.capacity, Math.max(0, writePtr - readPtr));
	const toRead = Math.min(available, output.length);

	if (toRead === 0) {
		return 0;
	}

	for (let i = 0; i < toRead; i++) {
		const readIndex = ((readPtr + i) % ringBuffer.capacity) + DATA_START_INDEX;
		output[i] = view[readIndex] ?? 0;
	}

	Atomics.store(intView, READ_PTR_INDEX, readPtr + toRead);

	return toRead;
}

export function availableSamples(ringBuffer: AudioRingBuffer): number {
	const intView = new Int32Array(ringBuffer.buffer);
	const writePtr = Atomics.load(intView, WRITE_PTR_INDEX);
	const readPtr = Atomics.load(intView, READ_PTR_INDEX);

	const available = writePtr - readPtr;
	return Math.min(ringBuffer.capacity, Math.max(0, available));
}
