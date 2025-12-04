<script lang="ts">
	import {
		songModeStore,
		enableSongMode,
		disableSongMode
	} from '$lib/stores/songModeStore.svelte';
	import { Music, Mic } from 'lucide-svelte';

	// Derived states
	let isEnabled = $derived(songModeStore.enabled);
	let currentPhrase = $derived(songModeStore.currentPhrase);
	let status = $derived(songModeStore.status);

	// TEMPORARILY DISABLED: These features are commented out
	// - Phonetic Geometry
	// - Narrative Strata
	// - Atmospheric Resonance
	// - Material Metaphor
</script>

<div class="h-full flex flex-col">
	<div class="p-4 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
		<!-- Master Toggle -->
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Music size={18} class="text-brand-primary" />
				<span class="text-sm font-semibold text-primary">Song Mode</span>
			</div>
			<button
				class="px-3 py-1.5 text-xs font-medium rounded-full transition-colors {isEnabled
					? 'bg-brand-primary text-white'
					: 'bg-surface-panel-alt text-secondary border border-subtle'}"
				onclick={() => (isEnabled ? disableSongMode() : enableSongMode())}
			>
				{isEnabled ? 'ON' : 'OFF'}
			</button>
		</div>

		{#if isEnabled}
			<!-- Current Phrase Display -->
			{#if currentPhrase}
				<div class="p-3 bg-surface-panel-alt rounded border border-subtle">
					<div class="flex items-center gap-2 mb-1">
						<Mic size={12} class="text-brand-primary animate-pulse" />
						<span class="text-xs text-secondary">Hearing:</span>
					</div>
					<p class="text-sm text-primary italic">"{currentPhrase}"</p>
				</div>
			{/if}

			<!-- Layer Toggles - TEMPORARILY DISABLED
			     These features are disabled until re-enabled:
			     - Phonetic Geometry
			     - Narrative Strata  
			     - Atmospheric Resonance
			     - Material Metaphor
			-->
			<div class="p-3 bg-surface-panel-alt rounded border border-subtle text-center">
				<p class="text-sm text-secondary">
					Song Mode layers temporarily disabled for maintenance.
				</p>
			</div>

			<!-- Status Indicators -->
			<div class="mt-4 p-3 bg-surface-panel-alt rounded text-xs space-y-1">
				<p class="text-secondary font-medium mb-2">Status</p>
				<div class="flex items-center gap-2">
					<span
						class="w-2 h-2 rounded-full {status.speechToText === 'listening'
							? 'bg-green-500 animate-pulse'
							: status.speechToText === 'error'
								? 'bg-red-500'
								: 'bg-gray-500'}"
					></span>
					<span class="text-secondary">Speech-to-Text: {status.speechToText}</span>
				</div>
				<div class="flex items-center gap-2">
					<span
						class="w-2 h-2 rounded-full {status.sentimentAI === 'ready'
							? 'bg-green-500'
							: status.sentimentAI === 'processing'
								? 'bg-yellow-500 animate-pulse'
								: status.sentimentAI === 'error'
									? 'bg-red-500'
									: 'bg-gray-500'}"
					></span>
					<span class="text-secondary">Sentiment AI: {status.sentimentAI}</span>
				</div>
			</div>

			<!-- Help Text -->
			<div class="mt-4 p-3 bg-surface-panel-alt rounded border border-subtle">
				<p class="text-xs text-secondary">
					<strong class="text-primary">How it works:</strong><br />
					• Sing or speak into the mic<br />
					• Your words are transcribed<br />
					• AI analyzes the emotional content<br />
					• Sculpture colors & shape respond to your lyrics
				</p>
			</div>
		{:else}
			<!-- Disabled State -->
			<div class="p-4 bg-surface-panel-alt rounded border border-subtle text-center">
				<Music size={32} class="mx-auto text-secondary opacity-50 mb-2" />
				<p class="text-sm text-secondary">
					Enable Song Mode to sculpt with your lyrics
				</p>
				<p class="text-xs text-secondary mt-2">
					Your voice shapes the form, your words color the soul
				</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #444;
		border-radius: 3px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: #555;
	}
</style>

