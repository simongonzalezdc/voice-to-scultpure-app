<script lang="ts">
	/**
	 * Feedback Mode Selector
	 * P1: Switch between Breath/Pulse/Flow/Mirror modes for real-time feedback
	 */
	import {
		feedbackModeStore,
		setFeedbackMode,
		toggleFeedback,
		setBreathConfig,
		setPulseConfig,
		setFlowConfig,
		type FeedbackMode
	} from '$lib/stores/feedbackModeStore.svelte';
	
	let { compact = false } = $props<{ compact?: boolean }>();
	
	let showAdvanced = $state(false);
	
	const MODES: { id: FeedbackMode; icon: string; label: string; description: string }[] = [
		{
			id: 'none',
			icon: '⏸️',
			label: 'Off',
			description: 'No real-time feedback'
		},
		{
			id: 'breath',
			icon: '🌬️',
			label: 'Breath',
			description: 'Sculpture breathes with your volume'
		},
		{
			id: 'pulse',
			icon: '💓',
			label: 'Pulse',
			description: 'Pulses on beat detection'
		},
		{
			id: 'flow',
			icon: '🌊',
			label: 'Flow',
			description: 'Shape morphs with pitch'
		},
		{
			id: 'mirror',
			icon: '🪞',
			label: 'Mirror',
			description: 'Full real-time preview'
		}
	];
	
	let currentMode = $derived(feedbackModeStore.config.mode);
	let isEnabled = $derived(feedbackModeStore.enabled);
</script>

<div class="feedback-selector rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm overflow-hidden"
	class:compact>
	
	<!-- Header -->
	<div class="flex items-center justify-between px-3 py-2 bg-black/40 border-b border-white/5">
		<div class="flex items-center gap-2">
			<span class="text-xs text-white/50 font-medium">Real-time Feedback</span>
		</div>
		
		<!-- Enable toggle -->
		<button
			onclick={toggleFeedback}
			class="relative w-10 h-5 rounded-full transition-all duration-200
				{isEnabled ? 'bg-indigo-500' : 'bg-white/20'}"
			aria-label={isEnabled ? 'Disable real-time feedback' : 'Enable real-time feedback'}
			aria-pressed={isEnabled}
		>
			<div 
				class="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200
					{isEnabled ? 'translate-x-5' : 'translate-x-0.5'}"
			></div>
		</button>
	</div>
	
	<!-- Mode buttons -->
	<div class="p-2 grid grid-cols-5 gap-1" class:opacity-50={!isEnabled} class:pointer-events-none={!isEnabled}>
		{#each MODES as mode (mode.id)}
			<button
				onclick={() => setFeedbackMode(mode.id)}
				class="flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-150
					{currentMode === mode.id 
						? 'bg-indigo-500/30 border border-indigo-500/50' 
						: 'hover:bg-white/10 border border-transparent'}"
				title={mode.description}
			>
				<span class="text-lg">{mode.icon}</span>
				<span class="text-[10px] text-white/60">{mode.label}</span>
			</button>
		{/each}
	</div>
	
	<!-- Current mode description -->
	<div class="px-3 py-2 bg-black/20 border-t border-white/5">
		<p class="text-xs text-white/40 text-center">
			{MODES.find(m => m.id === currentMode)?.description ?? ''}
		</p>
	</div>
	
	<!-- Advanced settings toggle -->
	{#if !compact}
		<button
			onclick={() => showAdvanced = !showAdvanced}
			class="w-full px-3 py-2 text-xs text-white/30 hover:text-white/50 border-t border-white/5 flex items-center justify-center gap-1 transition-colors"
		>
			<span>{showAdvanced ? '▼' : '▶'}</span>
			<span>Advanced Settings</span>
		</button>
		
		<!-- Advanced settings panel -->
		{#if showAdvanced}
			<div class="px-3 pb-3 space-y-3 border-t border-white/5 pt-3">
				
				<!-- Breath settings -->
				{#if currentMode === 'breath' || currentMode === 'mirror'}
					<div class="space-y-2">
						<span class="text-xs text-white/50 font-medium">🌬️ Breath Settings</span>
						
						<div class="flex items-center gap-2">
							<span class="text-xs text-white/40 w-20">Min Scale</span>
							<input
								type="range"
								min="0.5"
								max="1"
								step="0.05"
								value={feedbackModeStore.config.breath.minScale}
								oninput={(e) => setBreathConfig({ minScale: parseFloat(e.currentTarget.value) })}
								class="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
							/>
							<span class="text-xs text-white/40 w-8 text-right">
								{feedbackModeStore.config.breath.minScale.toFixed(2)}
							</span>
						</div>
						
						<div class="flex items-center gap-2">
							<span class="text-xs text-white/40 w-20">Max Scale</span>
							<input
								type="range"
								min="1"
								max="2"
								step="0.05"
								value={feedbackModeStore.config.breath.maxScale}
								oninput={(e) => setBreathConfig({ maxScale: parseFloat(e.currentTarget.value) })}
								class="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
							/>
							<span class="text-xs text-white/40 w-8 text-right">
								{feedbackModeStore.config.breath.maxScale.toFixed(2)}
							</span>
						</div>
						
						<div class="flex items-center gap-2">
							<span class="text-xs text-white/40 w-20">Smoothing</span>
							<input
								type="range"
								min="0.05"
								max="0.5"
								step="0.01"
								value={feedbackModeStore.config.breath.smoothing}
								oninput={(e) => setBreathConfig({ smoothing: parseFloat(e.currentTarget.value) })}
								class="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
							/>
							<span class="text-xs text-white/40 w-8 text-right">
								{feedbackModeStore.config.breath.smoothing.toFixed(2)}
							</span>
						</div>
					</div>
				{/if}
				
				<!-- Pulse settings -->
				{#if currentMode === 'pulse' || currentMode === 'mirror'}
					<div class="space-y-2">
						<span class="text-xs text-white/50 font-medium">💓 Pulse Settings</span>
						
						<div class="flex items-center gap-2">
							<span class="text-xs text-white/40 w-20">Intensity</span>
							<input
								type="range"
								min="0.1"
								max="1"
								step="0.05"
								value={feedbackModeStore.config.pulse.intensity}
								oninput={(e) => setPulseConfig({ intensity: parseFloat(e.currentTarget.value) })}
								class="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
							/>
							<span class="text-xs text-white/40 w-8 text-right">
								{feedbackModeStore.config.pulse.intensity.toFixed(2)}
							</span>
						</div>
						
						<div class="flex items-center gap-2">
							<span class="text-xs text-white/40 w-20">Duration</span>
							<input
								type="range"
								min="100"
								max="1000"
								step="50"
								value={feedbackModeStore.config.pulse.duration}
								oninput={(e) => setPulseConfig({ duration: parseInt(e.currentTarget.value) })}
								class="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
							/>
							<span class="text-xs text-white/40 w-8 text-right">
								{feedbackModeStore.config.pulse.duration}ms
							</span>
						</div>
					</div>
				{/if}
				
				<!-- Flow settings -->
				{#if currentMode === 'flow' || currentMode === 'mirror'}
					<div class="space-y-2">
						<span class="text-xs text-white/50 font-medium">🌊 Flow Settings</span>
						
						<div class="flex items-center gap-2">
							<span class="text-xs text-white/40 w-20">Pitch Influence</span>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={feedbackModeStore.config.flow.pitchInfluence}
								oninput={(e) => setFlowConfig({ pitchInfluence: parseFloat(e.currentTarget.value) })}
								class="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
							/>
							<span class="text-xs text-white/40 w-8 text-right">
								{feedbackModeStore.config.flow.pitchInfluence.toFixed(2)}
							</span>
						</div>
						
						<div class="flex items-center gap-2">
							<span class="text-xs text-white/40 w-20">Energy Influence</span>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={feedbackModeStore.config.flow.energyInfluence}
								oninput={(e) => setFlowConfig({ energyInfluence: parseFloat(e.currentTarget.value) })}
								class="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
							/>
							<span class="text-xs text-white/40 w-8 text-right">
								{feedbackModeStore.config.flow.energyInfluence.toFixed(2)}
							</span>
						</div>
						
						<label class="flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								checked={feedbackModeStore.config.flow.twistOnPitch}
								onchange={(e) => setFlowConfig({ twistOnPitch: e.currentTarget.checked })}
								class="w-4 h-4 rounded border-white/20 bg-white/10 text-indigo-500 focus:ring-0"
							/>
							<span class="text-xs text-white/40">Twist on pitch changes</span>
						</label>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.feedback-selector {
		min-width: 220px;
	}
	
	.feedback-selector.compact {
		min-width: 180px;
	}
	
	/* Custom range slider */
	input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 12px;
		height: 12px;
		background: #6366f1;
		border-radius: 50%;
		cursor: pointer;
	}
	
	input[type="range"]::-moz-range-thumb {
		width: 12px;
		height: 12px;
		background: #6366f1;
		border-radius: 50%;
		cursor: pointer;
		border: none;
	}
</style>

