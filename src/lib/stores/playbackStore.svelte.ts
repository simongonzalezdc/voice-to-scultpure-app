/**
 * Audio Playback Store
 * Manages the state of audio playback synced with sculpture visualization
 */

export type PlaybackState = 'idle' | 'playing' | 'paused';

export interface PlaybackStore {
	state: PlaybackState;
	currentTime: number; // Current playback position in seconds
	duration: number; // Total duration in seconds
	audioContext: AudioContext | null;
	audioBuffer: AudioBuffer | null;
	sourceNode: AudioBufferAudioSourceNode | null;
}

export const playbackStore = $state<PlaybackStore>({
	state: 'idle',
	currentTime: 0,
	duration: 0,
	audioContext: null,
	audioBuffer: null,
	sourceNode: null
});

/**
 * Initialize audio context and load audio blob
 */
export function initAudioContext(): void {
	if (playbackStore.audioContext) return;

	try {
		const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
		playbackStore.audioContext = audioContext;
		console.log(`🎵 [PLAYBACK] Audio context initialized (${audioContext.sampleRate}Hz)`);
	} catch (err) {
		console.error(`❌ [PLAYBACK] Failed to initialize audio context:`, err);
	}
}

/**
 * Load audio blob into AudioBuffer
 */
export async function loadAudioBlob(blob: Blob): Promise<void> {
	if (!playbackStore.audioContext) {
		initAudioContext();
	}

	if (!playbackStore.audioContext) {
		throw new Error('Audio context not available');
	}

	try {
		const arrayBuffer = await blob.arrayBuffer();
		const audioBuffer = await playbackStore.audioContext.decodeAudioData(arrayBuffer);
		
		playbackStore.audioBuffer = audioBuffer;
		playbackStore.duration = audioBuffer.duration;
		
		console.log(`🎵 [PLAYBACK] Audio loaded: ${audioBuffer.duration.toFixed(2)}s @ ${audioBuffer.sampleRate}Hz`);
	} catch (err) {
		console.error(`❌ [PLAYBACK] Failed to load audio:`, err);
		throw err;
	}
}

/**
 * Play audio from current position
 */
export function play(): void {
	if (!playbackStore.audioContext || !playbackStore.audioBuffer) {
		console.warn(`⚠️ [PLAYBACK] Audio not loaded`);
		return;
	}

	if (playbackStore.state === 'playing') return; // Already playing

	try {
		// Stop any existing playback
		if (playbackStore.sourceNode) {
			playbackStore.sourceNode.stop();
		}

		// Create new source and start playback
		const source = playbackStore.audioContext.createBufferSource();
		source.buffer = playbackStore.audioBuffer;
		source.connect(playbackStore.audioContext.destination);

		// Start from current position
		source.start(0, playbackStore.currentTime);

		playbackStore.sourceNode = source;
		playbackStore.state = 'playing';

		console.log(`▶️ [PLAYBACK] Playing from ${playbackStore.currentTime.toFixed(2)}s`);
	} catch (err) {
		console.error(`❌ [PLAYBACK] Failed to play:`, err);
	}
}

/**
 * Pause audio playback
 */
export function pause(): void {
	if (playbackStore.state !== 'playing') return;

	try {
		if (playbackStore.sourceNode) {
			playbackStore.sourceNode.stop();
			playbackStore.sourceNode = null;
		}

		playbackStore.state = 'paused';
		console.log(`⏸️ [PLAYBACK] Paused at ${playbackStore.currentTime.toFixed(2)}s`);
	} catch (err) {
		console.error(`❌ [PLAYBACK] Failed to pause:`, err);
	}
}

/**
 * Stop audio playback and reset position
 */
export function stop(): void {
	try {
		if (playbackStore.sourceNode) {
			playbackStore.sourceNode.stop();
			playbackStore.sourceNode = null;
		}

		playbackStore.state = 'idle';
		playbackStore.currentTime = 0;
		console.log(`⏹️ [PLAYBACK] Stopped`);
	} catch (err) {
		console.error(`❌ [PLAYBACK] Failed to stop:`, err);
	}
}

/**
 * Seek to a specific position (0-1 normalized)
 */
export function seek(normalizedPosition: number): void {
	const newTime = normalizedPosition * playbackStore.duration;
	
	const isPlaying = playbackStore.state === 'playing';

	// Stop current playback
	if (isPlaying) {
		pause();
	}

	// Update position
	playbackStore.currentTime = Math.max(0, Math.min(newTime, playbackStore.duration));

	// Resume if was playing
	if (isPlaying) {
		play();
	}

	console.log(`🔍 [PLAYBACK] Seek to ${playbackStore.currentTime.toFixed(2)}s (${(normalizedPosition * 100).toFixed(1)}%)`);
}

/**
 * Update current playback time (called from animation loop)
 */
export function updatePlaybackTime(deltaTime: number): void {
	if (playbackStore.state === 'playing' && playbackStore.audioContext) {
		// Track time relative to audio context's current time
		// This gives accurate playback position
		playbackStore.currentTime += deltaTime;

		// Auto-stop at end
		if (playbackStore.currentTime >= playbackStore.duration) {
			stop();
		}
	}
}

/**
 * Get current playback progress (0-1)
 */
export function getPlaybackProgress(): number {
	if (playbackStore.duration === 0) return 0;
	return Math.min(1, playbackStore.currentTime / playbackStore.duration);
}

/**
 * Clean up playback resources
 */
export function cleanup(): void {
	stop();
	playbackStore.audioBuffer = null;
	playbackStore.audioContext = null;
	console.log(`🧹 [PLAYBACK] Cleaned up audio resources`);
}

