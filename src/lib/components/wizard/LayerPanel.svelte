<script lang="ts">
	import { sculptureStore, toggleLayerVisibility, removeLayer, setLayerOpacity, setActiveLayer } from '$lib/stores/sculptureStore.svelte';
	import { Eye, EyeOff, Trash2, Lock, Layers } from 'lucide-svelte';

	let layers = $derived(sculptureStore.currentSculpture?.layers || []);
	let activeId = $derived(sculptureStore.activeLayerId);

</script>

<div class="flex flex-col h-full bg-surface-panel border-l border-white/10 w-64">
	<div class="p-4 border-b border-white/10 flex items-center gap-2">
		<Layers size={16} class="text-brand-primary" />
		<h3 class="text-sm font-bold text-white uppercase tracking-wider">Layers</h3>
	</div>

	<div class="flex-1 overflow-y-auto p-2 space-y-1">
		{#if layers.length === 0}
			<div class="text-center p-4 text-white/30 text-xs">
				No active layers
			</div>
		{:else}
			<!-- Render in reverse order (Top layer first) -->
			{#each [...layers].reverse() as layer (layer.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div 
					class="group relative flex flex-col gap-2 p-2 rounded bg-white/5 hover:bg-white/10 transition-colors border border-transparent"
					class:border-brand-primary={activeId === layer.id}
					onclick={() => setActiveLayer(layer.id)}
				>
					<!-- Header Row -->
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2 overflow-hidden">
							<button 
								class="text-white/50 hover:text-white"
								onclick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
								title={layer.visible ? "Hide Layer" : "Show Layer"}
							>
								{#if layer.visible}
									<Eye size={14} />
								{:else}
									<EyeOff size={14} />
								{/if}
							</button>
							
							<span class="text-xs font-mono truncate select-none {activeId === layer.id ? 'text-brand-primary' : 'text-white/80'}">
								{layer.name}
							</span>
						</div>

						<div class="flex items-center gap-1">
							{#if layer.locked}
								<Lock size={12} class="text-white/30" />
							{:else}
								<button 
									class="text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
									onclick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}
									title="Delete Layer"
								>
									<Trash2 size={12} />
								</button>
							{/if}
						</div>
					</div>

					<!-- Opacity Slider (Only show if active or hovered) -->
					<div class="flex items-center gap-2 px-1">
						<span class="text-[10px] text-white/30 w-8">OPC</span>
						<input 
							type="range" 
							min="0" 
							max="1" 
							step="0.01"
							value={layer.opacity}
							oninput={(e) => setLayerOpacity(layer.id, parseFloat(e.currentTarget.value))}
							onclick={(e) => e.stopPropagation()}
							class="flex-1 h-1 bg-white/10 rounded-full appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-primary"
						/>
						<span class="text-[10px] text-white/50 w-6 text-right">{(layer.opacity * 100).toFixed(0)}%</span>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

