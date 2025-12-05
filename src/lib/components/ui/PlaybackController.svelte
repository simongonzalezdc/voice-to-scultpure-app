<script lang="ts">
	import { playbackStore, play, pause, stop, seek, getPlaybackProgress } from '$lib/stores/playbackStore.svelte';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';

	let currentTimeDisplay = $state('0:00');
	let durationDisplay = $state('0:00');
	let progress = $state(0);
	let isDragging = $state(false);
	let slider: HTMLInputElement;

	// Format time in MM:SS
	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	// Update display values
	$effect(() => {
		currentTimeDisplay = formatTime(playbackStore.currentTime);
		durationDisplay = formatTime(playbackStore.duration);
		progress = getPlaybackProgress();
	});

	// Handle play/pause button
	function handlePlayPause() {
		if (playbackStore.state === 'playing') {
			pause();
		} else {
			play();
		}
	}

	// Handle stop button
	function handleStop() {
		stop();
	}

	// Handle slider input
	function handleSliderInput(event: Event) {
		const input = event.target as HTMLInputElement;
		const newProgress = parseFloat(input.value);
		seek(newProgress);
	}

	// Check if audio is available
	$effect(() => {
		if (!sculptureStore.currentSculpture?.audioBlob) {
			// Audio not available - component should not be rendered or disabled
		}
	});
</script>

<!-- Playback Controller -->
{#if sculptureStore.currentSculpture?.audioBlob}
	<div class="playback-controller surface-panel p-4 rounded-lg space-y-3">
		<!-- Title -->
		<div class="flex items-center gap-2">
			<span class="text-sm font-semibold text-primary">🎵 Playback</span>
			<span class="text-xs text-secondary">
				{#if playbackStore.state === 'playing'}
					<span class="inline-block animate-pulse">▶ Playing</span>
				{:else if playbackStore.state === 'paused'}
					<span>⏸ Paused</span>
				{:else}
					<span>⏹ Stopped</span>
				{/if}
			</span>
		</div>

		<!-- Timeline Slider -->
		<div class="flex items-center gap-2">
			<input
				bind:this={slider}
				type="range"
				min="0"
				max="1"
				step="0.001"
				value={progress}
				oninput={handleSliderInput}
				onmousedown={() => (isDragging = true)}
				onmouseup={() => (isDragging = false)}
				class="flex-1 h-1 bg-surface-darker rounded cursor-pointer appearance-none
				         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
				         [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
				         [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer
				         [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3
				         [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent
				         [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
			/>
			<span class="text-xs font-mono text-secondary w-10 text-right">{currentTimeDisplay}</span>
		</div>

		<!-- Duration Display -->
		<div class="flex justify-between text-xs text-secondary px-1">
			<span>Total: {durationDisplay}</span>
			<span>{(progress * 100).toFixed(0)}%</span>
		</div>

		<!-- Playback Controls -->
		<div class="flex gap-2">
			<!-- Stop Button -->
			<button
				type="button"
				title="Stop playback and reset"
				onclick={handleStop}
				class="flex-1 py-2 px-3 rounded text-sm font-semibold
				         bg-surface-darker hover:bg-surface-dark text-secondary hover:text-primary
				         transition-colors duration-150"
			>
				⏹
			</button>

			<!-- Play/Pause Button (Primary) -->
			<button
				type="button"
				title={playbackStore.state === 'playing' ? 'Pause' : 'Play'}
				onclick={handlePlayPause}
				class="flex-1 py-2 px-3 rounded text-sm font-semibold
				         {playbackStore.state === 'playing'
					? 'bg-accent text-primary'
					: 'bg-accent/60 hover:bg-accent text-secondary hover:text-primary'}
				         transition-colors duration-150"
			>
				{playbackStore.state === 'playing' ? '⏸ Pause' : '▶ Play'}
			</button>
		</div>

		<!-- Info -->
		<div class="text-xs text-secondary bg-surface-darker/50 p-2 rounded">
			<p>🎵 Sculpture highlights as your original recording plays back</p>
		</div>
	</div>
{/if}

<style>
	.playback-controller {
		background: rgba(40, 40, 50, 0.8);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(100, 100, 150, 0.2);
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.animate-pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
</style>

