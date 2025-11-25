<script lang="ts">
	import {
		songModeStore,
		enableSongMode,
		disableSongMode,
		toggleSongModeLayer,
		sentimentToColor,
		hslToHex,
		CINEMATIC_PRESETS
	} from '$lib/stores/songModeStore.svelte';
	import { Music, Mic, Palette, Sparkles, FlaskConical, Layers, Volume2 } from 'lucide-svelte';

	// Derived states
	let isEnabled = $derived(songModeStore.enabled);
	let layers = $derived(songModeStore.layers);
	let currentPhrase = $derived(songModeStore.currentPhrase);
	let currentSentiment = $derived(songModeStore.currentSentiment);
	let currentMood = $derived(songModeStore.currentMood);
	let currentFormant = $derived(songModeStore.currentFormant);
	let status = $derived(songModeStore.status);

	// Computed color from sentiment
	let sentimentColor = $derived(() => {
		if (!currentSentiment) return '#888888';
		const hsl = sentimentToColor(currentSentiment);
		return hslToHex(hsl.h, hsl.s, hsl.l);
	});
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

			<!-- Layer Toggles -->
			<div class="space-y-2">
				<p class="text-xs text-secondary uppercase tracking-wide">Layers</p>

				<!-- #3 Phonetic Geometry (Core) -->
				<button
					class="w-full p-3 rounded border text-left transition-colors {layers.phonetic
						? 'bg-brand-primary/10 border-brand-primary'
						: 'bg-surface-panel-alt border-subtle'}"
					onclick={() => toggleSongModeLayer('phonetic')}
				>
					<div class="flex items-center gap-2">
						<Volume2 size={14} class={layers.phonetic ? 'text-brand-primary' : 'text-secondary'} />
						<span class="text-sm font-medium {layers.phonetic ? 'text-primary' : 'text-secondary'}"
							>Phonetic Geometry</span
						>
						<span class="ml-auto text-xs text-secondary">CORE</span>
					</div>
					<p class="text-xs text-secondary mt-1">Vowel sounds shape the sculpture (real-time)</p>
					{#if layers.phonetic && currentFormant}
						<div class="mt-2 flex gap-4 text-xs">
							<span class="text-brand-primary">
								Open: {(currentFormant.openness * 100).toFixed(0)}%
							</span>
							<span class="text-brand-primary">
								Front: {(currentFormant.frontness * 100).toFixed(0)}%
							</span>
						</div>
					{/if}
				</button>

				<!-- #2 Narrative Strata (Core) -->
				<button
					class="w-full p-3 rounded border text-left transition-colors {layers.narrative
						? 'bg-brand-primary/10 border-brand-primary'
						: 'bg-surface-panel-alt border-subtle'}"
					onclick={() => toggleSongModeLayer('narrative')}
				>
					<div class="flex items-center gap-2">
						<Palette size={14} class={layers.narrative ? 'text-brand-primary' : 'text-secondary'} />
						<span class="text-sm font-medium {layers.narrative ? 'text-primary' : 'text-secondary'}"
							>Narrative Strata</span
						>
						<span class="ml-auto text-xs text-secondary">CORE</span>
					</div>
					<p class="text-xs text-secondary mt-1">Lyrics sentiment → glaze colors (AI)</p>
					{#if layers.narrative && currentSentiment}
						<div class="mt-2 flex items-center gap-2">
							<div
								class="w-4 h-4 rounded-full border border-white/20"
								style="background-color: {sentimentColor()}"
							></div>
							<span class="text-xs text-secondary">
								{currentSentiment.valence > 0 ? '😊' : '😢'}
								{currentSentiment.energy > 0 ? '⚡' : '💤'}
							</span>
						</div>
					{/if}
				</button>

				<!-- Divider -->
				<div class="border-t border-subtle my-2"></div>
				<p class="text-xs text-secondary uppercase tracking-wide flex items-center gap-1">
					<FlaskConical size={10} /> Beta Features
				</p>

				<!-- #5 Atmospheric Resonance (Beta) -->
				<button
					class="w-full p-3 rounded border text-left transition-colors {layers.atmosphere
						? 'bg-amber-500/10 border-amber-500'
						: 'bg-surface-panel-alt border-subtle'}"
					onclick={() => toggleSongModeLayer('atmosphere')}
				>
					<div class="flex items-center gap-2">
						<Sparkles size={14} class={layers.atmosphere ? 'text-amber-500' : 'text-secondary'} />
						<span class="text-sm font-medium {layers.atmosphere ? 'text-primary' : 'text-secondary'}"
							>Atmospheric Resonance</span
						>
						<span class="ml-auto text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500"
							>BETA</span
						>
					</div>
					<p class="text-xs text-secondary mt-1">Mood → environment & lighting (AI)</p>
					{#if layers.atmosphere && currentMood}
						<div class="mt-2 text-xs text-amber-500">
							🎭 {currentMood.mood} ({(currentMood.confidence * 100).toFixed(0)}%)
						</div>
					{/if}
				</button>

				<!-- #1 Material Metaphor (Beta) -->
				<button
					class="w-full p-3 rounded border text-left transition-colors {layers.material
						? 'bg-amber-500/10 border-amber-500'
						: 'bg-surface-panel-alt border-subtle'}"
					onclick={() => toggleSongModeLayer('material')}
				>
					<div class="flex items-center gap-2">
						<Layers size={14} class={layers.material ? 'text-amber-500' : 'text-secondary'} />
						<span class="text-sm font-medium {layers.material ? 'text-primary' : 'text-secondary'}"
							>Material Metaphor</span
						>
						<span class="ml-auto text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500"
							>BETA</span
						>
					</div>
					<p class="text-xs text-secondary mt-1">Lyrics → PBR material properties (AI)</p>
				</button>
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

