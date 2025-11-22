<script lang="ts">
	import { uiStore } from '$lib/stores/uiStore.svelte';
</script>

<!-- Visual Legends: Context-Aware User Guide -->
<div class="fixed bottom-4 left-4 z-50 bg-[#1a1a1a]/90 border border-[#4a4a4a] rounded p-3 text-xs text-[#888] max-w-xs">
	{#if uiStore.toolMode === 'sculpt'}
		<!-- Sculpt Mode Legend -->
		<div class="font-semibold text-white mb-2">Sculpt Mode</div>
		<div class="space-y-1">
			<div>🔊 Volume = Thickness</div>
			<div>🎵 Pitch = Twist/Ripples</div>
			<div>💥 Attack = Sharp Cuts</div>
		</div>
	{:else if uiStore.toolMode === 'glaze-mix'}
		<!-- Glaze Mixer Legend -->
		<div class="font-semibold text-white mb-2">Glaze Mixer</div>
		<div class="space-y-1">
			<div>🎵 Pitch = Color (Hue)</div>
			<div>🌬️ Timbre = Texture (Matte/Gloss)</div>
		</div>
	{:else if uiStore.toolMode === 'glaze-paint'}
		<!-- Glaze Paint Legend -->
		<div class="font-semibold text-white mb-2">Glaze Paint</div>
		<div class="space-y-1">
			<div>🔊 Volume = Paint Amount</div>
		</div>
	{/if}
</div>

