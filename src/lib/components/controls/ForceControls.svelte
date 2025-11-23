<script lang="ts">
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { Activity, Zap, Crosshair, Feather, Target } from 'lucide-svelte';

	// Parameters
	// Radius (Focus)
	let radius = $state(uiStore.forceParams.radius);
	// Strength (Power)
	let strength = $state(uiStore.forceParams.strength);
	// Hardness (Falloff)
	let hardness = $state(uiStore.forceParams.hardness);
	// Damping (already in UI but let's expose it if needed, directive didn't ask for it explicitly but we can keep it)

	$effect(() => {
		uiStore.forceParams.radius = radius;
		uiStore.forceParams.strength = strength;
		uiStore.forceParams.hardness = hardness;
	});
</script>

<div class="surface-panel p-4 rounded-lg h-full flex flex-col gap-6">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-subtle pb-2">
		<h2 class="text-lg font-bold flex items-center gap-2 text-brand-primary">
			<Activity size={20} />
			FORCE PHYSICS
		</h2>
		<span class="text-xs font-mono text-secondary surface-panel-alt px-2 py-1 rounded"> v2.0 </span>
	</div>

	<!-- Focus / Radius -->
	<div class="space-y-2">
		<label class="flex items-center justify-between text-sm font-semibold text-secondary">
			<span class="flex items-center gap-2"><Target size={16} /> BEAM RADIUS</span>
			<span class="font-mono text-xs">{(radius * 100).toFixed(0)}%</span>
		</label>
		<input
			type="range"
			min="0"
			max="1"
			step="0.01"
			bind:value={radius}
			class="w-full accent-brand-primary"
		/>
		<div class="flex justify-between text-[10px] text-subtle uppercase font-mono">
			<span>Pinpoint</span>
			<span>Wide</span>
		</div>
	</div>

	<!-- Power / Strength -->
	<div class="space-y-2">
		<label class="flex items-center justify-between text-sm font-semibold text-secondary">
			<span class="flex items-center gap-2"><Zap size={16} /> IMPACT FORCE</span>
			<span class="font-mono text-xs">{(strength * 100).toFixed(0)}%</span>
		</label>
		<input
			type="range"
			min="0"
			max="1"
			step="0.01"
			bind:value={strength}
			class="w-full accent-brand-primary"
		/>
		<div class="flex justify-between text-[10px] text-subtle uppercase font-mono">
			<span>Gentle</span>
			<span>Extreme</span>
		</div>
	</div>

	<!-- Hardness / Falloff -->
	<div class="space-y-2">
		<label class="flex items-center justify-between text-sm font-semibold text-secondary">
			<span class="flex items-center gap-2"><Feather size={16} /> EDGE HARDNESS</span>
			<span class="font-mono text-xs">{(hardness * 100).toFixed(0)}%</span>
		</label>
		<input
			type="range"
			min="0"
			max="1"
			step="0.01"
			bind:value={hardness}
			class="w-full accent-brand-primary"
		/>
		<div class="flex justify-between text-[10px] text-subtle uppercase font-mono">
			<span>Soft Brush</span>
			<span>Hard Chisel</span>
		</div>
	</div>

	<!-- Mode Info Box -->
	<div class="mt-auto surface-panel-alt p-3 rounded">
		<div class="flex items-center gap-2 text-xs font-bold text-brand-primary mb-2">
			<Crosshair size={14} />
			TARGETING SYSTEM ACTIVE
		</div>
		<p class="text-xs text-secondary leading-relaxed">
			Aim at the surface and use your voice to apply force. Louder input creates stronger
			deformation.
		</p>

		<div class="mt-3 grid grid-cols-2 gap-2">
			<div class="text-[10px] text-secondary bg-panel p-1 rounded text-center">PUSH: RED</div>
			<div class="text-[10px] text-secondary bg-panel p-1 rounded text-center">PULL: CYAN</div>
		</div>
	</div>
</div>

<style>
	input[type='range'] {
		@apply h-1 rounded-lg appearance-none cursor-pointer;
		background-color: var(--bg-panel-alt);
	}

	/* Custom Range Slider Styling would go here or via Tailwind plugins */
</style>
