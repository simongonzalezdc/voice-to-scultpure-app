<script lang="ts">
	import { fly } from 'svelte/transition';
	import {
		uiStore,
		nextOnboardingStep,
		finishOnboarding
	} from '$lib/stores/uiStore.svelte';
	import { computeCalibration, saveCalibration } from '$lib/audio/calibration';
	import { createAudioRingBuffer } from '$lib/audio/ringBuffer';
	import {
		initializeAudioContext,
		startMicrophoneCapture,
		connectMicrophoneToWorklet,
		getAudioContext,
		stopMicrophoneCapture
	} from '$lib/audio/audioContext';
	import { createAnalysisWorkerClient } from '$lib/audio/analysisWorkerClient';
	import { updateAnalysisFrame } from '$lib/stores/analysisStore.svelte';
	import type { AnalysisFrame } from '$lib/types';

	let currentStep = $derived(uiStore.onboarding.currentStep);
	let isActive = $derived(uiStore.onboarding.active);

	// Calibration state
	let calibrationState = $state<'idle' | 'recording' | 'processing' | 'complete'>('idle');
	let calibrationCountdown = $state(0);
	let calibrationFrames = $state<AnalysisFrame[]>([]);
	let calibrationWorkerClient: ReturnType<typeof createAnalysisWorkerClient> | null = $state(null);
	let calibrationRingBuffer: ReturnType<typeof createAudioRingBuffer> | null = $state(null);

	async function handleCalibrationStart() {
		if (calibrationState !== 'idle') return;

		try {
			calibrationState = 'recording';
			calibrationFrames = [];
			calibrationCountdown = 5; // 5 seconds as per directive

			// Initialize audio pipeline
			if (typeof SharedArrayBuffer === 'undefined') {
				alert('SharedArrayBuffer not available. Please ensure COOP/COEP headers are set.');
				calibrationState = 'idle';
				return;
			}

			// Create ring buffer for 10 seconds capacity
			calibrationRingBuffer = createAudioRingBuffer(44100 * 10, 44100);
			if (!calibrationRingBuffer) {
				throw new Error('Failed to create ring buffer');
			}

			// Initialize audio context and worklet
			await initializeAudioContext(calibrationRingBuffer.buffer, 44100);
			
			// Resume audio context (required for browser autoplay policy)
			const audioContext = getAudioContext();
			if (audioContext && audioContext.state === 'suspended') {
				await audioContext.resume();
			}

			// Start microphone capture
			const stream = await startMicrophoneCapture();
			connectMicrophoneToWorklet(stream);

			// Create analysis worker client
			calibrationWorkerClient = createAnalysisWorkerClient(calibrationRingBuffer, (frame) => {
				updateAnalysisFrame(frame);
				calibrationFrames.push(frame);
			});

			// Start recording
			calibrationWorkerClient.start();

			// Countdown timer
			const countdownInterval = setInterval(() => {
				calibrationCountdown--;
				if (calibrationCountdown <= 0) {
					clearInterval(countdownInterval);
					handleCalibrationComplete();
				}
			}, 1000);
		} catch (error) {
			console.error('Calibration failed:', error);
			alert(`Calibration failed: ${error instanceof Error ? error.message : String(error)}`);
			calibrationState = 'idle';
			cleanupCalibration();
		}
	}

	async function handleCalibrationComplete() {
		if (calibrationState !== 'recording') return;

		calibrationState = 'processing';

		// Stop recording
		calibrationWorkerClient?.stop();
		stopMicrophoneCapture();
		cleanupCalibration();

		// Process captured frames
		if (calibrationFrames.length === 0) {
			alert('No audio frames captured. Please try again.');
			calibrationState = 'idle';
			return;
		}

		// Compute calibration
		const calibrationResult = computeCalibration(calibrationFrames);
		
		// Save calibration to store
		saveCalibration(calibrationResult);

		calibrationState = 'complete';
		
		// Move to next step after a brief delay
		setTimeout(() => {
			nextOnboardingStep();
			calibrationState = 'idle';
			calibrationFrames = [];
		}, 1000);
	}

	function cleanupCalibration() {
		if (calibrationWorkerClient) {
			calibrationWorkerClient.dispose();
			calibrationWorkerClient = null;
		}
		calibrationRingBuffer = null;
	}

	function handleNext() {
		if (currentStep === 'ai-tutorial') {
			finishOnboarding();
		} else {
			nextOnboardingStep();
		}
	}

	function handleSkip() {
		finishOnboarding();
	}

	// Cleanup on unmount
	$effect(() => {
		return () => {
			cleanupCalibration();
		};
	});
</script>

{#if isActive}
	<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
		<div
			class="surface-panel p-6 rounded-lg max-w-md w-full"
			transition:fly={{ y: 20, duration: 300 }}
		>
			{#if currentStep === 'welcome'}
				<div in:fly={{ y: 20, duration: 200 }}>
					<h2 class="text-2xl font-bold mb-4">Welcome to Voice-to-Sculpture Studio</h2>
					<p class="text-secondary mb-4">
						Transform your voice into beautiful 3D sculptures. This tutorial will guide you through
						the basics.
					</p>
					<div class="flex gap-2">
						<button class="button-primary px-4 py-2" type="button" onclick={handleNext}>
							Get Started
						</button>
						<button class="button-secondary px-4 py-2" type="button" onclick={handleSkip}>
							Skip Tutorial
						</button>
					</div>
				</div>
			{:else if currentStep === 'mic-permission'}
				<div in:fly={{ y: 20, duration: 200 }}>
					<h2 class="text-2xl font-bold mb-4">Microphone Permission</h2>
					<p class="text-secondary mb-4">
						We need access to your microphone to capture your voice and create sculptures. Click
						"Allow" when prompted.
					</p>
					<button class="button-primary px-4 py-2" type="button" onclick={handleNext}>
						Next
					</button>
				</div>
			{:else if currentStep === 'calibration'}
				<div in:fly={{ y: 20, duration: 200 }}>
					<h2 class="text-2xl font-bold mb-4">Calibration</h2>
					{#if calibrationState === 'idle'}
						<p class="text-secondary mb-4">
							We'll record 5 seconds of your voice to calibrate the system. Speak normally during
							this time.
						</p>
						<button
							class="button-primary px-4 py-2"
							type="button"
							onclick={handleCalibrationStart}
						>
							Start Calibration
						</button>
					{:else if calibrationState === 'recording'}
						<p class="text-secondary mb-4">
							Recording... Please speak normally. The system is analyzing your voice characteristics.
						</p>
						<div class="text-4xl font-bold text-brand-primary mb-4 text-center">
							{calibrationCountdown}
						</div>
						<div class="h-2 bg-bg-panel-alt rounded-full overflow-hidden mb-4">
							<div
								class="h-full bg-brand-primary transition-all duration-1000"
								style="width: {((5 - calibrationCountdown) / 5) * 100}%"
							></div>
						</div>
					{:else if calibrationState === 'processing'}
						<p class="text-secondary mb-4">Processing calibration data...</p>
						<div class="animate-pulse text-brand-primary">Analyzing your voice profile...</div>
					{:else if calibrationState === 'complete'}
						<p class="text-secondary mb-4">Calibration complete! Your voice profile has been saved.</p>
					{/if}
				</div>
			{:else if currentStep === 'first-recording'}
				<div in:fly={{ y: 20, duration: 200 }}>
					<h2 class="text-2xl font-bold mb-4">Your First Recording</h2>
					<p class="text-secondary mb-4">
						Click the Record button and speak or sing. Your voice will be transformed into a 3D
						sculpture in real-time.
					</p>
					<button class="button-primary px-4 py-2" type="button" onclick={handleNext}>
						Got It
					</button>
				</div>
			{:else if currentStep === 'ai-tutorial'}
				<div in:fly={{ y: 20, duration: 200 }}>
					<h2 class="text-2xl font-bold mb-4">AI Assistant</h2>
					<p class="text-secondary mb-4">
						Use the AI panel to modify your sculptures with natural language. Try saying "make it
						taller" or "add more glaze".
					</p>
					<button class="button-primary px-4 py-2" type="button" onclick={handleNext}>
						Finish
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
