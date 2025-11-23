<script lang="ts">
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { Info } from 'lucide-svelte';
	
	let damping = $state(uiStore.forceParams.damping);
	let hardness = $state(uiStore.forceParams.hardness);

	$effect(() => {
		uiStore.forceParams.damping = damping;
		uiStore.forceParams.hardness = hardness;
	});
</script>

<div class="surface-panel p-4 rounded-lg">
	<h2 class="text-lg font-semibold mb-4">Force Parameters</h2>
	<div class="space-y-4">
		<p class="text-xs text-secondary opacity-75 mb-3">
			Control how the Sonic Force interacts with the sculpture surface.
		</p>

		<!-- Damping Slider -->
		<div>
			<label
				for="damping-slider"
				class="text-sm text-secondary block mb-1 flex items-center gap-2"
				title="Controls how quickly the deformation stops"
			>
				Damping: {damping.toFixed(2)}
				<span class="text-subtle opacity-50"><Info size={12} /></span>
			</label>
			<input
				id="damping-slider"
				type="range"
				min="0"
				max="1"
				step="0.01"
				bind:value={damping}
				class="w-full"
			/>
			<div class="flex justify-between text-xs text-secondary mt-1">
				<span>Elastic</span>
				<span>Viscous</span>
			</div>
		</div>

		<!-- Hardness Slider -->
		<div>
			<label
				for="hardness-slider"
				class="text-sm text-secondary block mb-1 flex items-center gap-2"
				title="Controls resistance to deformation"
			>
				Hardness: {hardness.toFixed(2)}
				<span class="text-subtle opacity-50"><Info size={12} /></span>
			</label>
			<input
				id="hardness-slider"
				type="range"
				min="0"
				max="1"
				step="0.01"
				bind:value={hardness}
				class="w-full"
			/>
			<div class="flex justify-between text-xs text-secondary mt-1">
				<span>Soft Clay</span>
				<span>Hard Stone</span>
			</div>
		</div>
		<!-- Sculpt Mode Selection -->
		<div class="border-t border-subtle pt-4">
			<h3 class="text-sm font-semibold mb-2 text-secondary">Force Direction</h3>
			<div class="flex gap-2 mb-4">
				<button
					class="flex-1 py-2 px-3 text-sm rounded border transition-colors {uiStore.sculptMode ===
					'additive'
						? 'bg-brand-primary border-brand-primary text-white'
						: 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
					onclick={() => {
						uiStore.sculptMode = 'additive';
					}}
				>
					Pull (Green)
				</button>
				<button
					class="flex-1 py-2 px-3 text-sm rounded border transition-colors {uiStore.sculptMode ===
					'subtractive'
						? 'bg-brand-primary border-brand-primary text-white'
						: 'bg-surface-panel-alt border-subtle text-secondary hover:border-brand-primary/50'}"
					onclick={() => {
						uiStore.sculptMode = 'subtractive';
					}}
				>
					Push (Red)
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.bg-surface-panel-alt {
		background-color: var(--bg-surface-panel-alt, #222);
	}
	.border-subtle {
		border-color: var(--border-subtle, #333);
	}
	.text-secondary {
		color: var(--text-secondary, #888);
	}
	.bg-brand-primary {
		background-color: var(--brand-primary, #ff3e00);
	}
	.border-brand-primary {
		border-color: var(--brand-primary, #ff3e00);
	}
</style>
