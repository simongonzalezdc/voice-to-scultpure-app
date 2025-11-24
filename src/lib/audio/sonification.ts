export function playResonance(
	audioContext: AudioContext,
	avgRadius: number,
	height: number,
	materialType: string
): void {
	const osc = audioContext.createOscillator();
	const gain = audioContext.createGain();

	// Physics-inspired mapping: larger/taller pieces resonate lower
	const frequency = 800 / (avgRadius * 5 + 1) / Math.max(0.1, height / 150);

	// Material timbre: ceramic stays pure, others get a slightly duller wave
	osc.type = materialType === 'ceramic' ? 'sine' : 'triangle';
	osc.frequency.value = frequency;
	osc.connect(gain);
	gain.connect(audioContext.destination);

	const now = audioContext.currentTime;
	gain.gain.setValueAtTime(0.1, now);
	gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

	osc.start(now);
	osc.stop(now + 2.0);
}
