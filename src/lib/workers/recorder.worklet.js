// AudioWorklet processor for capturing microphone input into SharedArrayBuffer ring buffer
// @ts-check

const WRITE_PTR_INDEX = 0;
const READ_PTR_INDEX = 1;
const DATA_START_INDEX = 2;

class RecorderProcessor extends AudioWorkletProcessor {
	/**
	 * @param {AudioWorkletNodeOptions} options
	 */
	constructor(options) {
		super();
		const opts = options.processorOptions;
		this.ringBuffer = opts.ringBuffer;
		this.capacity = opts.capacity;
		this.view = new Float32Array(this.ringBuffer);
		this.intView = new Int32Array(this.ringBuffer);
	}

	/**
	 * @param {Float32Array} samples
	 */
	writeSamples(samples) {
		const writePtr = Atomics.load(this.intView, WRITE_PTR_INDEX);
		const readPtr = Atomics.load(this.intView, READ_PTR_INDEX);

		for (let i = 0; i < samples.length; i++) {
			const nextWrite =
				((writePtr - DATA_START_INDEX + i) % this.capacity) + DATA_START_INDEX;
			const nextRead = readPtr;

			// Check if buffer is full
			if (
				nextWrite === nextRead &&
				(writePtr - DATA_START_INDEX + i) % this.capacity !==
					(readPtr - DATA_START_INDEX) % this.capacity
			) {
				break;
			}

			this.view[nextWrite] = samples[i];
		}

		const written = Math.min(samples.length, this.capacity);
		if (written > 0) {
			const newWritePtr =
				((writePtr - DATA_START_INDEX + written) % this.capacity) + DATA_START_INDEX;
			Atomics.store(this.intView, WRITE_PTR_INDEX, newWritePtr);
		}
	}

	/**
	 * @param {Float32Array[][]} inputs
	 * @param {Float32Array[][]} outputs
	 */
	process(inputs, outputs) {
		const input = inputs[0];
		if (!input || input.length === 0) {
			return true;
		}

		const inputChannel = input[0];
		if (!inputChannel || inputChannel.length === 0) {
			return true;
		}

		// Convert to mono if stereo
		const mono = inputChannel;

		// Write directly to ring buffer
		this.writeSamples(mono);

		// Pass through audio (optional)
		const output = outputs[0];
		if (output && output.length > 0 && output[0]) {
			output[0].set(mono);
		}

		return true;
	}
}

registerProcessor('recorder-processor', RecorderProcessor);

