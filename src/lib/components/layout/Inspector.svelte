<script lang="ts">
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { recordingStore } from '$lib/stores/recording.svelte';
	import ExportTools from '$lib/components/panels/ExportTools.svelte';

	// SIMPLIFIED INSPECTOR
	// Core workflow: Record → Sculpt → Export
	// Only show essential panels

	let isRecording = $derived(recordingStore.state === 'recording');
	let hasSculpture = $derived(!!sculptureStore.currentSculpture);
</script>

<div class="inspector-container h-full overflow-y-auto custom-scrollbar">
	<!-- Recording Status -->
	{#if isRecording}
		<div class="p-4 border-b border-green-500/30 bg-green-500/10">
			<p class="text-sm text-green-400 font-medium flex items-center gap-2">
				<span class="animate-pulse">●</span>
				Recording... Sing to sculpt!
			</p>
		</div>
	{/if}

	<!-- Getting Started -->
	{#if !isRecording && !hasSculpture}
		<div class="p-4 border-b border-brand-primary/20 bg-brand-primary/5">
			<p class="text-sm text-brand-primary font-medium mb-2">💡 Getting Started</p>
			<p class="text-xs text-secondary leading-relaxed">
				Press the <strong>record</strong> button and sing. Your voice will sculpt the form in real-time.
			</p>
			<p class="text-xs text-secondary mt-2 leading-relaxed">
				<strong>Low pitch</strong> = wide base · <strong>High pitch</strong> = narrow top
			</p>
		</div>
	{/if}

	<!-- Quick Actions (when sculpture exists) -->
	{#if hasSculpture && !isRecording}
		<div class="p-4 border-b border-subtle">
			<p class="text-sm text-secondary mb-3">Your sculpture is ready!</p>
			<div class="space-y-2">
				<button
					class="w-full py-2 px-3 text-sm rounded bg-brand-primary text-white hover:bg-brand-primary/80 transition-colors"
					onclick={() => uiStore.workspace = 'export'}
				>
					📦 Export / 3D Print
				</button>
				<button
					class="w-full py-2 px-3 text-sm rounded bg-surface-alt text-secondary hover:bg-surface-panel-alt transition-colors"
					onclick={() => recordingStore.state = 'recording'}
				>
					🎤 Record Another Layer
				</button>
			</div>
		</div>
	{/if}

	<!-- Export Panel (always visible at bottom) -->
	{#if uiStore.workspace === 'export'}
		<div class="p-4">
			<ExportTools />
		</div>
	{:else if hasSculpture}
		<div class="p-4 border-t border-subtle">
			<button
				class="w-full py-2 px-3 text-sm rounded border border-subtle text-secondary hover:bg-surface-alt transition-colors"
				onclick={() => uiStore.workspace = 'export'}
			>
				📦 Export Options
			</button>
		</div>
	{/if}
</div>

<style>
	.inspector-container {
		background: var(--glass-bg, rgba(33, 31, 38, 0.85));
		backdrop-filter: blur(var(--glass-blur, 12px));
		-webkit-backdrop-filter: blur(var(--glass-blur, 12px));
		border-left: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
	}

	.border-subtle {
		border-color: var(--border-subtle);
	}

	.bg-surface-alt {
		background-color: var(--surface-alt, rgba(255, 255, 255, 0.05));
	}

	.bg-surface-panel-alt {
		background-color: var(--surface-panel-alt, rgba(255, 255, 255, 0.08));
	}

	/* Custom scrollbar */
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: var(--border-strong, #4a424f);
		border-radius: 3px;
	}
</style>
