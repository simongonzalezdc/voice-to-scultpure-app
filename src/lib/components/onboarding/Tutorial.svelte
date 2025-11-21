<script lang="ts">
	import { fly } from 'svelte/transition';
	import {
		uiStore,
		nextOnboardingStep,
		finishOnboarding,
		completeOnboardingStep
	} from '$lib/stores/uiStore';
	import { startOnboarding } from '$lib/stores/uiStore.svelte';

	let currentStep = $derived(uiStore.onboarding.currentStep);
	let isActive = $derived(uiStore.onboarding.active);

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
</script>

{#if isActive}
	<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
		<div class="surface-panel p-6 rounded-lg max-w-md w-full" transition:fly={{ y: 20, duration: 300 }}>
			{#if currentStep === 'welcome'}
				<div in:fly={{ y: 20, duration: 200 }}>
					<h2 class="text-2xl font-bold mb-4">Welcome to Voice-to-Sculpture Studio</h2>
					<p class="text-secondary mb-4">
						Transform your voice into beautiful 3D sculptures. This tutorial will guide you
						through the basics.
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
					<p class="text-secondary mb-4">
						We'll record 10 seconds of your voice to calibrate the system. Speak normally during
						this time.
					</p>
					<button class="button-primary px-4 py-2" type="button" onclick={handleNext}>
						Start Calibration
					</button>
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

