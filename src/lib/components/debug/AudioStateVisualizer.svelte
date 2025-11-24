<script lang="ts">
	/**
	 * Audio State Visualizer Component
	 * PHASE 3: Radical Observability - "No Silent Failures"
	 *
	 * Displays a visual indicator (traffic light) for AudioWorklet health.
	 * Users see immediately if audio is working or broken.
	 *
	 * ARCHITECTURAL PRINCIPLE:
	 * - If audio fails, the user MUST be informed visually
	 * - Never hide errors in console logs
	 * - Status changes are animated for better UX
	 */

	import { onMount } from 'svelte';
	import { getAudioContext, getWorkletNode } from '$lib/audio/audioContext';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';

	type AudioStatus = 'running' | 'suspended' | 'disconnected' | 'error' | 'silent';

	let audioStatus = $state<AudioStatus>('disconnected');
	let statusMessage = $state('Audio Not Initialized');
	let silenceCounter = 0;
	const SILENCE_THRESHOLD = 30; // 30 * 100ms = 3 seconds

	// Poll audio context state at 10Hz (every 100ms) for responsiveness
	// Using setInterval instead of useTask since this component is outside Canvas
	onMount(() => {
		const pollAudioState = () => {
			try {
				const audioContext = getAudioContext();
				const workletNode = getWorkletNode();

				if (!audioContext || !workletNode) {
					audioStatus = 'disconnected';
					statusMessage = 'No Audio Context';
					silenceCounter = 0;
					return;
				}

				// Check AudioContext state
				switch (audioContext.state) {
					case 'running': {
						// Check if we're getting actual audio signal
						const micLevel = analysisStore.micLevel ?? 0;
						if (micLevel < 0.001) {
							silenceCounter++;
							if (silenceCounter >= SILENCE_THRESHOLD) {
								audioStatus = 'silent';
								statusMessage = 'No Signal - Check Mic';
							} else {
								audioStatus = 'running';
								statusMessage = `Audio Running (${audioContext.sampleRate}Hz)`;
							}
						} else {
							silenceCounter = 0;
							audioStatus = 'running';
							statusMessage = `Audio Running (${audioContext.sampleRate}Hz)`;
						}
						break;
					}

					case 'suspended':
						audioStatus = 'suspended';
						statusMessage = 'Audio Suspended - Waiting for User Gesture';
						silenceCounter = 0;
						// Attempt auto-resume
						audioContext.resume().catch(() => {
							// Suppress error, will retry next interval
						});
						break;

					case 'closed':
						audioStatus = 'disconnected';
						statusMessage = 'Audio Context Closed';
						silenceCounter = 0;
						break;

					default:
						audioStatus = 'error';
						statusMessage = `Unknown State: ${audioContext.state}`;
						silenceCounter = 0;
				}
			} catch (err) {
				audioStatus = 'error';
				statusMessage = `Error: ${err instanceof Error ? err.message : 'Unknown'}`;
				silenceCounter = 0;
			}
		};

		// Initial poll
		pollAudioState();
		
		// Set up interval for continuous polling (10Hz)
		const intervalId = setInterval(pollAudioState, 100);
		
		// Cleanup on component destroy
		return () => clearInterval(intervalId);
	});

	// Status light colors and descriptions
	const statusConfig: Record<
		AudioStatus,
		{
			bgColor: string;
			textColor: string;
			animationClass: string;
			icon: string;
		}
	> = {
		running: {
			bgColor: '#10b981', // Green
			textColor: '#ffffff',
			animationClass: 'pulse-subtle',
			icon: '●'
		},
		suspended: {
			bgColor: '#f59e0b', // Amber
			textColor: '#ffffff',
			animationClass: 'pulse-warning',
			icon: '●'
		},
		disconnected: {
			bgColor: '#6b7280', // Gray
			textColor: '#d1d5db',
			animationClass: '',
			icon: '○'
		},
		silent: {
			bgColor: '#f97316', // Orange - warning but not error
			textColor: '#ffffff',
			animationClass: 'pulse-warning',
			icon: '🎤'
		},
		error: {
			bgColor: '#ef4444', // Red
			textColor: '#ffffff',
			animationClass: 'pulse-error',
			icon: '⚠'
		}
	};

	const config = statusConfig[audioStatus];
</script>

<div
	class="audio-state-indicator"
	style="--bg-color: {config.bgColor}; --text-color: {config.textColor};"
>
	<div class="status-light {config.animationClass}">
		<span class="icon">{config.icon}</span>
	</div>
	<div class="status-info">
		<div class="status-title">{audioStatus.toUpperCase()}</div>
		<div class="status-message">{statusMessage}</div>
	</div>
</div>

<style>
	.audio-state-indicator {
		--bg-color: #6b7280;
		--text-color: #d1d5db;

		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		background-color: rgba(var(--bg-rgb, 107, 114, 128), 0.1);
		border: 1px solid rgba(var(--bg-rgb, 107, 114, 128), 0.3);
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
		font-size: 0.875rem;
	}

	.status-light {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		background-color: var(--bg-color);
		flex-shrink: 0;
	}

	.icon {
		font-size: 0.5rem;
		color: var(--text-color);
		font-weight: bold;
	}

	.status-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.status-title {
		font-weight: 600;
		color: var(--text-color);
		letter-spacing: 0.025em;
	}

	.status-message {
		font-size: 0.75rem;
		color: var(--text-color);
		opacity: 0.85;
		font-family: 'Monaco', 'Courier New', monospace;
	}

	/* Animations */
	@keyframes pulse-subtle {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.8;
		}
	}

	@keyframes pulse-warning {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}

	@keyframes pulse-error {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
		}
		50% {
			box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2);
		}
	}

	.pulse-subtle {
		animation: pulse-subtle 2s ease-in-out infinite;
	}

	.pulse-warning {
		animation: pulse-warning 1s ease-in-out infinite;
	}

	.pulse-error {
		animation: pulse-error 1.5s ease-in-out infinite;
	}
</style>
