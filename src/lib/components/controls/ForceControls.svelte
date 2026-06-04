<script lang="ts">
	import {
		uiStore,
		setSculptMode,
		setForceToolType,
		type ForceToolType
	} from '$lib/stores/uiStore.svelte';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import {
		Activity,
		Zap,
		Feather,
		Target,
		Plus,
		Minus,
		Volume2,
		Paintbrush,
		Sword,
		Pencil
	} from 'lucide-svelte';

	// Parameters
	// Radius (Focus)
	let radius = $state(uiStore.forceParams.radius);
	// Strength (Power)
	let strength = $state(uiStore.forceParams.strength);
	// Hardness (Falloff)
	let hardness = $state(uiStore.forceParams.hardness);
	// Damping
	let damping = $state(uiStore.forceParams.damping);

	// Sonic Lance: Tool Type
	let toolType = $derived(uiStore.forceParams.toolType);
	let isLanceMode = $derived(toolType.startsWith('lance'));

	$effect(() => {
		uiStore.forceParams.radius = radius;
		uiStore.forceParams.strength = strength;
		uiStore.forceParams.hardness = hardness;
		uiStore.forceParams.damping = damping;
	});

	// Live voice feedback
	let micLevel = $derived(analysisStore.micLevel);
	let pitch = $derived(analysisStore.latestFrame?.pitch || 0);
	let isAdditive = $derived(uiStore.sculptMode === 'additive');

	// Handle tool type change
	function handleToolTypeChange(type: ForceToolType): void {
		setForceToolType(type);
		// Update local state to match locked values
		if (type.startsWith('lance')) {
			hardness = 1.0;
			radius = 0.1;
		}
	}
</script>

<div class="surface-panel p-4 rounded-lg h-full flex flex-col gap-4">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-subtle pb-2">
		<h2 class="text-lg font-bold flex items-center gap-2 text-brand-primary">
			<Activity size={20} />
			SONIC FORCE
		</h2>
	</div>

	<!-- SONIC LANCE: Tool Type Toggle -->
	<div class="space-y-2" role="group" aria-labelledby="tool-type-label">
		<span id="tool-type-label" class="text-xs font-bold text-secondary">TOOL TYPE</span>
		<div class="grid grid-cols-3 gap-1">
			<button
				class="p-2 rounded flex flex-col items-center gap-1 transition-colors {toolType === 'brush'
					? 'bg-cyan-600 text-white'
					: 'surface-panel-alt text-secondary hover:bg-cyan-600/20'}"
				onclick={() => handleToolTypeChange('brush')}
				title="Soft, wide brush for shaping"
			>
				<Paintbrush size={16} />
				<span class="text-[10px] font-bold">BRUSH</span>
			</button>
			<button
				class="p-2 rounded flex flex-col items-center gap-1 transition-colors {toolType ===
				'lance-carve'
					? 'bg-orange-500 text-white'
					: 'surface-panel-alt text-secondary hover:bg-orange-500/20'}"
				onclick={() => handleToolTypeChange('lance-carve')}
				title="Precision carving beam (subtractive)"
			>
				<Sword size={16} />
				<span class="text-[10px] font-bold">CARVE</span>
			</button>
			<button
				class="p-2 rounded flex flex-col items-center gap-1 transition-colors {toolType ===
				'lance-engrave'
					? 'bg-purple-500 text-white'
					: 'surface-panel-alt text-secondary hover:bg-purple-500/20'}"
				onclick={() => handleToolTypeChange('lance-engrave')}
				title="Precision embossing beam (additive)"
			>
				<Pencil size={16} />
				<span class="text-[10px] font-bold">ENGRAVE</span>
			</button>
		</div>
		{#if isLanceMode}
			<div
				class="surface-panel-alt p-2 rounded text-[10px] text-cyan-300 border border-cyan-500/30"
			>
				🗡️ <strong>LANCE MODE:</strong> Precision tool active. Pitch controls cut depth, volume triggers.
			</div>
		{/if}
	</div>

	<!-- HOW IT WORKS - Clear Instructions -->
	<div class="surface-panel-alt p-3 rounded text-xs space-y-2">
		<div class="font-bold text-white flex items-center gap-2">
			<Volume2 size={14} />
			HOW TO USE
		</div>
		<ul class="text-secondary space-y-1 list-disc list-inside">
			{#if isLanceMode}
				<li><strong>Pitch</strong> controls CUT DEPTH (low=deep, high=shallow)</li>
				<li><strong>Volume</strong> triggers the cut (threshold gate)</li>
				<li>Lance mode uses precision beam with sharp edges</li>
			{:else}
				<li><strong>Pitch</strong> controls WHERE (low=bottom, high=top)</li>
				<li><strong>Volume</strong> controls HOW MUCH force</li>
				<li>Toggle <strong>Push/Pull</strong> below to expand or compress</li>
			{/if}
		</ul>
	</div>

	<!-- Live Voice Indicator -->
	<div class="surface-panel-alt p-3 rounded">
		<div class="flex items-center justify-between mb-2">
			<span class="text-xs font-bold text-secondary">VOICE INPUT</span>
			<span class="text-xs font-mono {micLevel > 0.05 ? 'text-green-400' : 'text-red-400'}">
				{micLevel > 0.05 ? '● ACTIVE' : '○ SILENT'}
			</span>
		</div>
		<div class="grid grid-cols-2 gap-2 text-xs">
			<div class="flex justify-between">
				<span class="text-secondary">Pitch:</span>
				<span class="font-mono text-white">{pitch > 0 ? `${pitch.toFixed(0)}Hz` : '—'}</span>
			</div>
			<div class="flex justify-between">
				<span class="text-secondary">Volume:</span>
				<span class="font-mono text-white">{(micLevel * 100).toFixed(0)}%</span>
			</div>
		</div>
		<!-- Volume bar -->
		<div class="mt-2 h-2 bg-black/50 rounded overflow-hidden">
			<div
				class="h-full transition-all duration-75 {isAdditive ? 'bg-cyan-500' : 'bg-orange-500'}"
				style="width: {Math.min(100, micLevel * 100)}%"
			></div>
		</div>
	</div>

	<!-- Push/Pull Toggle -->
	<div class="space-y-2" role="group" aria-labelledby="force-direction-label">
		<span id="force-direction-label" class="text-xs font-bold text-secondary">FORCE DIRECTION</span>
		<div class="grid grid-cols-2 gap-2">
			<button
				class="p-3 rounded flex flex-col items-center gap-1 transition-colors {isAdditive
					? 'bg-cyan-600 text-white'
					: 'surface-panel-alt text-secondary hover:bg-cyan-600/20'}"
				onclick={() => setSculptMode('additive')}
			>
				<Plus size={20} />
				<span class="text-xs font-bold">PUSH OUT</span>
				<span class="text-[10px] opacity-70">Expand</span>
			</button>
			<button
				class="p-3 rounded flex flex-col items-center gap-1 transition-colors {!isAdditive
					? 'bg-orange-600 text-white'
					: 'surface-panel-alt text-secondary hover:bg-orange-600/20'}"
				onclick={() => setSculptMode('subtractive')}
			>
				<Minus size={20} />
				<span class="text-xs font-bold">PULL IN</span>
				<span class="text-[10px] opacity-70">Compress</span>
			</button>
		</div>
	</div>

	<!-- Focus / Radius -->
	<div class="space-y-1 {isLanceMode ? 'opacity-50' : ''}">
		<label class="flex items-center justify-between text-xs font-bold text-secondary">
			<span class="flex items-center gap-1">
				<Target size={14} /> BEAM RADIUS
				{#if isLanceMode}<span class="text-[10px] text-orange-400 ml-1">🔒 LOCKED</span>{/if}
			</span>
			<span class="font-mono">{(radius * 100).toFixed(0)}%</span>
		</label>
		<input
			type="range"
			min="0.1"
			max="1"
			step="0.01"
			bind:value={radius}
			disabled={isLanceMode}
			class="w-full accent-brand-primary h-1 rounded-lg appearance-none cursor-pointer bg-surface-panel-alt {isLanceMode
				? 'cursor-not-allowed'
				: ''}"
		/>
		<div class="flex justify-between text-[10px] text-subtle">
			<span>Pinpoint</span>
			<span>Wide</span>
		</div>
	</div>

	<!-- Power / Strength -->
	<div class="space-y-1">
		<label class="flex items-center justify-between text-xs font-bold text-secondary">
			<span class="flex items-center gap-1"><Zap size={14} /> STRENGTH</span>
			<span class="font-mono">{(strength * 100).toFixed(0)}%</span>
		</label>
		<input
			type="range"
			min="0.1"
			max="1"
			step="0.01"
			bind:value={strength}
			class="w-full accent-brand-primary h-1 rounded-lg appearance-none cursor-pointer bg-surface-panel-alt"
		/>
		<div class="flex justify-between text-[10px] text-subtle">
			<span>Gentle</span>
			<span>Extreme</span>
		</div>
	</div>

	<!-- Hardness / Falloff -->
	<div class="space-y-1 {isLanceMode ? 'opacity-50' : ''}">
		<label class="flex items-center justify-between text-xs font-bold text-secondary">
			<span class="flex items-center gap-1">
				<Feather size={14} /> HARDNESS
				{#if isLanceMode}<span class="text-[10px] text-orange-400 ml-1">🔒 MAX</span>{/if}
			</span>
			<span class="font-mono">{(hardness * 100).toFixed(0)}%</span>
		</label>
		<input
			type="range"
			min="0"
			max="1"
			step="0.01"
			bind:value={hardness}
			disabled={isLanceMode}
			class="w-full accent-brand-primary h-1 rounded-lg appearance-none cursor-pointer bg-surface-panel-alt {isLanceMode
				? 'cursor-not-allowed'
				: ''}"
		/>
		<div class="flex justify-between text-[10px] text-subtle">
			<span>Soft</span>
			<span>Sharp</span>
		</div>
	</div>

	<!-- Damping -->
	<div class="space-y-1">
		<label
			for="smoothing-slider"
			class="flex items-center justify-between text-xs font-bold text-secondary"
		>
			<span class="flex items-center gap-1">SMOOTHING</span>
			<span class="font-mono">{(damping * 100).toFixed(0)}%</span>
		</label>
		<input
			id="smoothing-slider"
			type="range"
			min="0"
			max="0.9"
			step="0.01"
			bind:value={damping}
			class="w-full accent-brand-primary h-1 rounded-lg appearance-none cursor-pointer bg-surface-panel-alt"
		/>
		<div class="flex justify-between text-[10px] text-subtle">
			<span>Responsive</span>
			<span>Smooth</span>
		</div>
	</div>
</div>
