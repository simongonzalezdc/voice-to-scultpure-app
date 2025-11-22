import { describe, it, expect } from 'vitest';
import {
	createAudioRingBuffer,
	writeToRingBuffer,
	readFromRingBuffer
} from '../audio/ringBuffer';

describe('Ring Buffer', () => {
	it('should create a ring buffer', () => {
		const buffer = createAudioRingBuffer(1000, 44100);
		expect(buffer).not.toBeNull();
		expect(buffer?.capacity).toBe(1000);
		expect(buffer?.sampleRate).toBe(44100);
	});

	it('should write and read samples', () => {
		const buffer = createAudioRingBuffer(1000, 44100);
		if (!buffer) {
			throw new Error('Buffer creation failed');
		}

		const input = new Float32Array([1, 2, 3, 4, 5]);
		const written = writeToRingBuffer(buffer, input);
		expect(written).toBe(5);

		const output = new Float32Array(5);
		const read = readFromRingBuffer(buffer, output);
		expect(read).toBe(5);
		expect(Array.from(output)).toEqual([1, 2, 3, 4, 5]);
	});

	it('should handle overflow', () => {
		const buffer = createAudioRingBuffer(10, 44100);
		if (!buffer) {
			throw new Error('Buffer creation failed');
		}

		const input = new Float32Array(20);
		input.fill(1);
		const written = writeToRingBuffer(buffer, input);
		expect(written).toBeLessThanOrEqual(10);
	});
});
