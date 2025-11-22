import toWav from 'audiobuffer-to-wav';

export function convertFloat32ArrayToWav(
	audioData: Float32Array,
	sampleRate: number = 44100
): Blob {
	const audioBuffer = new AudioBuffer({
		length: audioData.length,
		sampleRate,
		numberOfChannels: 1
	});

	// Create a new Float32Array from the input to ensure it's not a SharedArrayBuffer
	const channelData = new Float32Array(audioData.length);
	channelData.set(audioData);
	audioBuffer.copyToChannel(channelData, 0);

	const wav = toWav(audioBuffer);
	return new Blob([wav], { type: 'audio/wav' });
}

export function downloadWav(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
