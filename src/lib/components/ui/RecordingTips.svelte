<script lang="ts">
	/**
	 * RecordingTips - Contextual guidance before and during recording
	 * Shows tips based on recording mode and current state
	 */
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { recordingStore } from '$lib/stores/recording.svelte';

	// Tip content based on recording mode
	const tips = {
		standard: {
			pre: 'Sing a short phrase (10-30 seconds) to create a sculpture',
			during: [
				'💡 Higher pitch = wider shape',
				'💡 Louder volume = faster height growth',
				'💡 Steady tone = smoother form',
				'💡 Silence marks = phrase breaks (visible rings)'
			]
		},
		song: {
			pre: 'Perform a full song (1-5 minutes) for a detailed, tall sculpture',
			during: [
				'💡 Percussive sounds (Pa! Ka!) create texture ridges',
				'💡 Pitch variation = radius variation',
				'💡 Sustained notes = smooth vertical growth',
				'💡 Silence marks = new phrases (visible rings)'
			]
		}
	};

	let currentTip = $state(0);

	$effect(() => {
		// Cycle through tips every 4 seconds during recording
		if (recordingStore.state === 'recording') {
			const interval = setInterval(() => {
				const tipsLength = tips[uiStore.recordingMode].during.length;
				currentTip = (currentTip + 1) % tipsLength;
			}, 4000);
			return () => clearInterval(interval);
		}
	});

	const isRecording = $derived(recordingStore.state === 'recording');
	const currentTips = $derived(tips[uiStore.recordingMode]);
</script>

{#if isRecording}
	<!-- Floating Recording Tips -->
	<div class="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
		<div class="animate-fade-in-out bg-surface-panel/95 backdrop-blur border border-brand-primary/50 rounded-lg px-4 py-2 shadow-lg">
			<p class="text-sm text-center font-medium text-brand-primary">
				{currentTips.during[currentTip]}
			</p>
			<div class="flex gap-1 justify-center mt-2">
				{#each currentTips.during as _, i}
					<div
						class="w-1.5 h-1.5 rounded-full transition-all {i === currentTip
							? 'bg-brand-primary scale-125'
							: 'bg-brand-primary/30'}"
					/>
				{/each}
			</div>
		</div>
	</div>
{:else if recordingStore.state === 'idle'}
	<!-- Pre-Recording Info -->
	<div class="bg-surface-panel-alt border border-brand-primary/30 rounded-lg p-3 mb-3">
		<p class="text-sm text-brand-primary font-medium mb-2">✨ {uiStore.recordingMode === 'standard' ? 'Quick' : 'Full'} Recording</p>
		<p class="text-xs text-secondary leading-relaxed">
			{currentTips.pre}
		</p>
	</div>
{/if}

<style>
	@keyframes fade-in-out {
		0%, 100% {
			opacity: 0;
		}
		10%, 90% {
			opacity: 1;
		}
	}

	:global(.animate-fade-in-out) {
		animation: fade-in-out 4s ease-in-out infinite;
	}
</style>

