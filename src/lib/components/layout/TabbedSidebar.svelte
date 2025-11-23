<script lang="ts">
	import { uiStore, setToolMode } from '$lib/stores/uiStore.svelte';
	import ParameterSliders from '$lib/components/controls/ParameterSliders.svelte';
	import FabricationPanel from '$lib/components/panels/FabricationPanel.svelte';
	import SettingsPanel from '$lib/components/panels/SettingsPanel.svelte';
	import GlazeMixer from '$lib/components/panels/GlazeMixer.svelte';

	let activeTab = $state<'design' | 'fabrication' | 'settings'>('design');
</script>

<div class="h-full flex flex-col">
	<!-- Sculpt/Glaze Switch (Above Tabs) -->
	<div class="p-3 border-b border-[#4a4a4a]">
		<div class="flex gap-1 bg-[#2a2a2a] rounded p-1">
			<button
				class="flex-1 py-2 px-3 text-xs font-medium rounded transition-colors {uiStore.toolMode ===
				'sculpt'
					? 'bg-[#8f3e48] text-white'
					: 'text-[#888] hover:text-white'}"
				onclick={() => setToolMode('sculpt')}
			>
				🗿 SCULPT
			</button>
			<button
				class="flex-1 py-2 px-3 text-xs font-medium rounded transition-colors {uiStore.toolMode ===
					'glaze-mix' || uiStore.toolMode === 'glaze-paint'
					? 'bg-[#8f3e48] text-white'
					: 'text-[#888] hover:text-white'}"
				onclick={() => setToolMode('glaze-mix')}
			>
				🎨 GLAZE
			</button>
		</div>
	</div>

	<!-- Tab Header -->
	<div class="flex border-b border-[#4a4a4a]">
		<button
			class="flex-1 py-3 text-sm font-medium transition-colors border-b-2 {activeTab === 'design'
				? 'text-white border-[#8f3e48]'
				: 'text-[#888] border-transparent hover:text-white'}"
			onclick={() => (activeTab = 'design')}
		>
			DESIGN
		</button>
		<button
			class="flex-1 py-3 text-sm font-medium transition-colors border-b-2 {activeTab ===
			'fabrication'
				? 'text-white border-[#8f3e48]'
				: 'text-[#888] border-transparent hover:text-white'}"
			onclick={() => (activeTab = 'fabrication')}
		>
			FABRICATION
		</button>
		<button
			class="flex-1 py-3 text-sm font-medium transition-colors border-b-2 {activeTab === 'settings'
				? 'text-white border-[#8f3e48]'
				: 'text-[#888] border-transparent hover:text-white'}"
			onclick={() => (activeTab = 'settings')}
		>
			SETTINGS
		</button>
	</div>

	<!-- Tab Content -->
	<div class="flex-1 overflow-y-auto custom-scrollbar p-4">
		{#if activeTab === 'design'}
			{#if uiStore.toolMode === 'sculpt'}
				<ParameterSliders />
			{:else if uiStore.toolMode === 'glaze-mix' || uiStore.toolMode === 'glaze-paint'}
				<GlazeMixer />
			{/if}
		{:else if activeTab === 'fabrication'}
			<FabricationPanel />
		{:else if activeTab === 'settings'}
			<SettingsPanel />
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
