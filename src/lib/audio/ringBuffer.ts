import type { AudioRingBuffer } from '$lib/types';

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
	const view = new Float32Array(buffer);

	// Initialize pointers
	Atomics.store(new Int32Array(buffer, 0, 2), WRITE_PTR_INDEX, DATA_START_INDEX);
	Atomics.store(new Int32Array(buffer, 0, 2), READ_PTR_INDEX, DATA_START_INDEX);

	return {
		buffer,
		capacity,
		sampleRate
	};
}

export function writeToRingBuffer(
	ringBuffer: AudioRingBuffer,
	samples: Float32Array
): number {
	const view = new Float32Array(ringBuffer.buffer);
	const intView = new Int32Array(ringBuffer.buffer);
	const writePtr = Atomics.load(intView, WRITE_PTR_INDEX);
	const readPtr = Atomics.load(intView, READ_PTR_INDEX);

	let written = 0;
	for (let i = 0; i < samples.length; i++) {
		const nextWrite = ((writePtr + i - DATA_START_INDEX) % ringBuffer.capacity) + DATA_START_INDEX;
		const nextRead = readPtr;

		// Check if buffer is full (write pointer would catch read pointer)
		if (
			nextWrite === nextRead &&
			(writePtr + i - DATA_START_INDEX) % ringBuffer.capacity !==
				(readPtr - DATA_START_INDEX) % ringBuffer.capacity
		) {
			break; // Buffer full
		}

		view[nextWrite] = samples[i];
		written++;
	}

	if (written > 0) {
		const newWritePtr =
			((writePtr - DATA_START_INDEX + written) % ringBuffer.capacity) + DATA_START_INDEX;
		Atomics.store(intView, WRITE_PTR_INDEX, newWritePtr);
	}

	return written;
}

export function readFromRingBuffer(
	ringBuffer: AudioRingBuffer,
	output: Float32Array
): number {
	const view = new Float32Array(ringBuffer.buffer);
	const intView = new Int32Array(ringBuffer.buffer);
	const writePtr = Atomics.load(intView, WRITE_PTR_INDEX);
	const readPtr = Atomics.load(intView, READ_PTR_INDEX);

	const available = availableSamples(ringBuffer);
	const toRead = Math.min(available, output.length);

	if (toRead === 0) {
		return 0;
	}

	for (let i = 0; i < toRead; i++) {
		const readIndex = ((readPtr - DATA_START_INDEX + i) % ringBuffer.capacity) + DATA_START_INDEX;
		output[i] = view[readIndex];
	}

	const newReadPtr = ((readPtr - DATA_START_INDEX + toRead) % ringBuffer.capacity) + DATA_START_INDEX;
	Atomics.store(intView, READ_PTR_INDEX, newReadPtr);

	return toRead;
}

export function availableSamples(ringBuffer: AudioRingBuffer): number {
	const intView = new Int32Array(ringBuffer.buffer);
	const writePtr = Atomics.load(intView, WRITE_PTR_INDEX);
	const readPtr = Atomics.load(intView, READ_PTR_INDEX);

	if (writePtr >= readPtr) {
		return writePtr - readPtr;
	} else {
		return ringBuffer.capacity - (readPtr - writePtr);
	}
}

