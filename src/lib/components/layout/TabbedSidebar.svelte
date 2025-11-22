<script lang="ts">
	import ParameterSliders from '$lib/components/controls/ParameterSliders.svelte';
	import FabricationPanel from '$lib/components/panels/FabricationPanel.svelte';
	import SettingsPanel from '$lib/components/panels/SettingsPanel.svelte';

	let activeTab = $state<'design' | 'fabrication' | 'settings'>('design');
</script>

<div class="tabbed-sidebar">
	<!-- Tab Headers -->
	<div class="tab-headers">
		<button
			class="tab-header {activeTab === 'design' ? 'active' : ''}"
			onclick={() => (activeTab = 'design')}
		>
			Design
		</button>
		<button
			class="tab-header {activeTab === 'fabrication' ? 'active' : ''}"
			onclick={() => (activeTab = 'fabrication')}
		>
			Fabrication
		</button>
		<button
			class="tab-header {activeTab === 'settings' ? 'active' : ''}"
			onclick={() => (activeTab = 'settings')}
		>
			Settings
		</button>
	</div>

	<!-- Tab Content -->
	<div class="tab-content">
		{#if activeTab === 'design'}
			<div class="tab-pane">
				<ParameterSliders />
			</div>
		{:else if activeTab === 'fabrication'}
			<div class="tab-pane">
				<FabricationPanel />
			</div>
		{:else if activeTab === 'settings'}
			<div class="tab-pane">
				<SettingsPanel />
			</div>
		{/if}
	</div>
</div>

<style>
	.tabbed-sidebar {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: #0a0a0a;
		border-left: 1px solid #3a3a3a;
		overflow: hidden;
	}

	.tab-headers {
		display: flex;
		gap: 0;
		border-bottom: 1px solid #3a3a3a;
		background: #1a1a1a;
		flex-shrink: 0;
	}

	.tab-header {
		flex: 1;
		padding: 12px 8px;
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		color: #888;
		font-size: 12px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover {
			color: #aaa;
		}

		&.active {
			color: #fff;
			border-bottom-color: #00d9ff;
		}
	}

	.tab-content {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		background: #0a0a0a;
	}

	.tab-pane {
		width: 100%;
	}

	/* Scrollbar styling */
	:global(.tab-content::-webkit-scrollbar) {
		width: 6px;
	}

	:global(.tab-content::-webkit-scrollbar-track) {
		background: transparent;
	}

	:global(.tab-content::-webkit-scrollbar-thumb) {
		background: #3a3a3a;
		border-radius: 3px;

		&:hover {
			background: #4a4a4a;
		}
	}
</style>

