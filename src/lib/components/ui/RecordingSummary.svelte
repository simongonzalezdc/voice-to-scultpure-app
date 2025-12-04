<script lang="ts">
	/**
	 * RecordingSummary - Post-recording feedback and quick actions
	 * Shows: Height, Duration, Beats, Phrases detected
	 * Offers: Add Layer, Color, Export buttons
	 */
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { recordingStore } from '$lib/stores/recording.svelte';
	import { uiStore, setWorkspace } from '$lib/stores/uiStore.svelte';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { DEFAULT_HEIGHT_MM } from '$lib/config/constants';
	import { ChevronRight } from 'lucide-svelte';

	interface SummaryStats {
		height: number;
		duration: number;
		beats: number;
		phrases: number;
	}

	let stats = $derived.by<SummaryStats>(() => {
		const sculpture = sculptureStore.currentSculpture;
		if (!sculpture) {
			return { height: 0, duration: 0, beats: 0, phrases: 0 };
		}

		const height = sculpture.physical?.height ?? DEFAULT_HEIGHT_MM;
		const frames = recordingStore.capturedFrames || [];
		const duration = frames.length > 0 ? Math.round((frames.length / 30) * 10) / 10 : 0; // ~30 fps
		
		// Count beats and phrases from analysis
		const beats = frames.filter((f) => f.beat).length;
		const phrases = frames.filter((f) => f.phraseStart).length;

		return { height, duration, beats, phrases };
	});

	function handleAddLayer() {
		// Reset for next layer
		recordingStore.resetRecording?.();
	}

	function handleColor() {
		setWorkspace('glaze');
		// Could auto-apply glaze colors here
	}

	function handleExport() {
		setWorkspace('export');
	}

	const isVisible = $derived(recordingStore.state === 'complete');
</script>

{#if isVisible}
	<!-- Post-Recording Summary Overlay -->
	<div class="fixed inset-0 z-50 flex items-end justify-center p-4 pointer-events-none">
		<div class="pointer-events-auto max-w-md w-full bg-gradient-to-b from-surface-panel to-surface-panel/95 border border-brand-primary/30 rounded-t-2xl shadow-2xl overflow-hidden">
			<!-- Header -->
			<div class="bg-gradient-to-r from-brand-primary/20 to-brand-primary/10 border-b border-brand-primary/30 px-6 py-4">
				<h3 class="text-lg font-semibold text-brand-primary flex items-center gap-2">
					✨ Sculpture Created
				</h3>
			</div>

			<!-- Stats Grid -->
			<div class="grid grid-cols-4 gap-2 px-6 py-4 border-b border-subtle/50">
				<div class="text-center">
					<p class="text-2xl font-bold text-brand-primary">{stats.height}</p>
					<p class="text-xs text-secondary">mm</p>
				</div>
				<div class="text-center">
					<p class="text-2xl font-bold text-brand-primary">{stats.duration.toFixed(1)}</p>
					<p class="text-xs text-secondary">sec</p>
				</div>
				<div class="text-center">
					<p class="text-2xl font-bold text-brand-primary">{stats.beats}</p>
					<p class="text-xs text-secondary">beats</p>
				</div>
				<div class="text-center">
					<p class="text-2xl font-bold text-brand-primary">{stats.phrases}</p>
					<p class="text-xs text-secondary">phrases</p>
				</div>
			</div>

			<!-- Action Buttons -->
			<div class="flex gap-2 p-4">
				<button
					class="flex-1 py-3 px-4 rounded-lg bg-surface-alt hover:bg-surface-panel-alt text-secondary hover:text-primary transition-colors text-sm font-medium flex items-center justify-center gap-2"
					onclick={handleAddLayer}
					title="Record another layer on top"
				>
					+ Add Layer
				</button>
				<button
					class="flex-1 py-3 px-4 rounded-lg bg-brand-primary/20 hover:bg-brand-primary/30 text-brand-primary transition-colors text-sm font-medium flex items-center justify-center gap-2"
					onclick={handleColor}
					title="Paint with pitch-based colors"
				>
					🎨 Color
				</button>
				<button
					class="flex-1 py-3 px-4 rounded-lg bg-brand-primary hover:bg-brand-primary/90 text-white transition-colors text-sm font-medium flex items-center justify-center gap-2"
					onclick={handleExport}
					title="Export as STL or GLB"
				>
					Export <ChevronRight size={16} />
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes slide-up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}

	:global(div:has(> .pointer-events-auto)) {
		animation: slide-up 0.3s ease-out;
	}
</style>

