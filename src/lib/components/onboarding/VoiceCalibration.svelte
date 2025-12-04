<script lang="ts">
	import { 
		calibrationStore, 
		startCalibration, 
		nextCalibrationStep, 
		skipCalibration,
		addCalibrationSample,
		getStepInstruction,
		getStepProgress,
		getCalibration,
		type CalibrationStep
	} from '$lib/stores/calibrationStore.svelte';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { onMount } from 'svelte';
	
	let { onComplete } = $props<{ onComplete?: () => void }>();
	
	// Step configurations with visual feedback
	const STEP_CONFIG: Record<CalibrationStep, { icon: string; color: string; bgGradient: string }> = {
		'idle': { icon: '🎤', color: '#6366f1', bgGradient: 'from-indigo-900/40 to-slate-900/60' },
		'low-note': { icon: '🔊', color: '#22c55e', bgGradient: 'from-emerald-900/40 to-slate-900/60' },
		'high-note': { icon: '🎵', color: '#f59e0b', bgGradient: 'from-amber-900/40 to-slate-900/60' },
		'loud': { icon: '📢', color: '#ef4444', bgGradient: 'from-red-900/40 to-slate-900/60' },
		'soft': { icon: '🤫', color: '#8b5cf6', bgGradient: 'from-violet-900/40 to-slate-900/60' },
		'processing': { icon: '⚙️', color: '#3b82f6', bgGradient: 'from-blue-900/40 to-slate-900/60' },
		'complete': { icon: '✨', color: '#10b981', bgGradient: 'from-emerald-900/40 to-slate-900/60' }
	};
	
	let progress = $state(0);
	let pitchDisplay = $state(0);
	let energyDisplay = $state(0);
	let animationFrame: number | null = null;
	let stepTimer: ReturnType<typeof setTimeout> | null = null;
	
	// Visual feedback: Pitch meter height (inverted: low = tall, high = short)
	let pitchMeterHeight = $derived.by(() => {
		const calibration = getCalibration();
		if (!calibration || pitchDisplay === 0) return 50;
		// Map pitch to 0-100, inverted (low pitch = 100%, high pitch = 0%)
		const normalized = calibration.pitchToRadius(pitchDisplay);
		return normalized * 100;
	});
	
	// Visual feedback: Energy ring scale
	let energyRingScale = $derived.by(() => {
		const calibration = getCalibration();
		if (!calibration) return 1;
		return 1 + calibration.energyToScale(energyDisplay) * 0.5;
	});
	
	// Current step config
	let currentConfig = $derived(STEP_CONFIG[calibrationStore.step] || STEP_CONFIG['idle']);
	
	// Sample collection during calibration
	$effect(() => {
		if (calibrationStore.step !== 'idle' && 
			calibrationStore.step !== 'complete' && 
			calibrationStore.step !== 'processing') {
			
			// Collect samples from analysis store
			const pitch = analysisStore.latestFrame?.pitch || 0;
			const energy = analysisStore.latestFrame?.energy || 0;
			const timbre = analysisStore.latestFrame?.timbre?.spectralCentroid || 0;
			
			if (energy > 0.01) { // Only sample when there's audio
				addCalibrationSample(pitch, energy, timbre);
			}
			
			// Update display values
			pitchDisplay = pitch;
			energyDisplay = energy;
		}
	});
	
	// Progress animation
	$effect(() => {
		if (calibrationStore.step !== 'idle' && 
			calibrationStore.step !== 'complete' && 
			calibrationStore.step !== 'processing') {
			
			const updateProgress = () => {
				progress = getStepProgress();
				
				if (progress >= 1) {
					// Auto-advance to next step
					nextCalibrationStep();
				} else {
					animationFrame = requestAnimationFrame(updateProgress);
				}
			};
			
			animationFrame = requestAnimationFrame(updateProgress);
			
			return () => {
				if (animationFrame) {
					cancelAnimationFrame(animationFrame);
				}
			};
		} else {
			progress = 0;
		}
	});
	
	function handleStart() {
		startCalibration();
	}
	
	function handleSkip() {
		skipCalibration();
		onComplete?.();
	}
	
	function handleComplete() {
		onComplete?.();
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-lg">
	<div class="relative w-full max-w-lg mx-4 overflow-hidden rounded-3xl bg-gradient-to-br {currentConfig.bgGradient} border border-white/10 shadow-2xl">
		
		<!-- Animated background glow based on voice input -->
		<div 
			class="absolute inset-0 opacity-30 blur-3xl transition-transform duration-300"
			style="
				background: radial-gradient(circle at 50% 50%, {currentConfig.color}40, transparent 70%);
				transform: scale({energyRingScale});
			"
		></div>
		
		<!-- Content -->
		<div class="relative z-10 p-8">
			
			<!-- Header -->
			<div class="text-center mb-8">
				<div class="text-6xl mb-4 transition-transform duration-300" style="transform: scale({1 + energyDisplay * 0.3});">
					{currentConfig.icon}
				</div>
				<h2 class="text-2xl font-bold text-white mb-2 font-[system-ui]">
					{#if calibrationStore.step === 'idle'}
						Meet Your Voice
					{:else if calibrationStore.step === 'complete'}
						You're All Set!
					{:else}
						Voice Calibration
					{/if}
				</h2>
				<p class="text-white/70 text-lg">
					{getStepInstruction()}
				</p>
			</div>
			
			<!-- Visual Feedback Area -->
			{#if calibrationStore.step !== 'idle' && calibrationStore.step !== 'complete'}
				<div class="relative h-48 mb-8 rounded-2xl bg-black/30 border border-white/5 overflow-hidden">
					
					<!-- Pitch visualization (vertical bar) -->
					<div class="absolute left-4 bottom-0 w-8 bg-black/40 rounded-t-lg overflow-hidden h-full">
						<div 
							class="absolute bottom-0 left-0 right-0 transition-all duration-100 rounded-t-lg"
							style="
								height: {pitchMeterHeight}%;
								background: linear-gradient(to top, {currentConfig.color}, {currentConfig.color}80);
							"
						></div>
						<span class="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-white/50 font-mono">
							{pitchDisplay > 0 ? `${pitchDisplay.toFixed(0)}Hz` : '---'}
						</span>
					</div>
					
					<!-- Energy visualization (expanding rings) -->
					<div class="absolute inset-0 flex items-center justify-center">
						<div 
							class="rounded-full border-4 transition-all duration-100"
							style="
								width: {60 + energyDisplay * 120}px;
								height: {60 + energyDisplay * 120}px;
								border-color: {currentConfig.color};
								opacity: {0.3 + energyDisplay * 0.7};
							"
						></div>
						<div 
							class="absolute rounded-full border-2 transition-all duration-150"
							style="
								width: {40 + energyDisplay * 80}px;
								height: {40 + energyDisplay * 80}px;
								border-color: {currentConfig.color};
								opacity: {0.2 + energyDisplay * 0.5};
							"
						></div>
						<div 
							class="absolute w-4 h-4 rounded-full"
							style="background: {currentConfig.color};"
						></div>
					</div>
					
					<!-- Volume meter (horizontal bar at bottom) -->
					<div class="absolute bottom-0 left-0 right-0 h-2 bg-black/40">
						<div 
							class="h-full transition-all duration-100 rounded-r"
							style="
								width: {energyDisplay * 100}%;
								background: linear-gradient(to right, {currentConfig.color}60, {currentConfig.color});
							"
						></div>
					</div>
				</div>
				
				<!-- Progress bar -->
				<div class="mb-6">
					<div class="flex justify-between text-sm text-white/50 mb-2">
						<span>Step {['low-note', 'high-note', 'loud', 'soft'].indexOf(calibrationStore.step) + 1} of 4</span>
						<span>{Math.round(progress * 100)}%</span>
					</div>
					<div class="h-2 bg-black/40 rounded-full overflow-hidden">
						<div 
							class="h-full transition-all duration-100 rounded-full"
							style="
								width: {progress * 100}%;
								background: {currentConfig.color};
							"
						></div>
					</div>
				</div>
			{/if}
			
			<!-- Calibration Results -->
			{#if calibrationStore.step === 'complete' && calibrationStore.result}
				<div class="mb-8 p-4 rounded-xl bg-black/30 border border-white/10">
					<h3 class="text-white/80 font-semibold mb-3">Your Voice Profile</h3>
					<div class="grid grid-cols-2 gap-4 text-sm">
						<div>
							<span class="text-white/50">Pitch Range</span>
							<p class="text-white font-mono">
								{calibrationStore.result.pitchLow.toFixed(0)} - {calibrationStore.result.pitchHigh.toFixed(0)} Hz
							</p>
						</div>
						<div>
							<span class="text-white/50">Dynamics</span>
							<p class="text-white font-mono">
								{(calibrationStore.result.energyFloor * 100).toFixed(0)}% - {(calibrationStore.result.energyCeiling * 100).toFixed(0)}%
							</p>
						</div>
						<div class="col-span-2">
							<span class="text-white/50">Calibration Confidence</span>
							<div class="mt-1 h-2 bg-black/40 rounded-full overflow-hidden">
								<div 
									class="h-full bg-emerald-500 rounded-full"
									style="width: {calibrationStore.result.confidence * 100}%;"
								></div>
							</div>
						</div>
					</div>
				</div>
			{/if}
			
			<!-- Idle State - Start prompt -->
			{#if calibrationStore.step === 'idle'}
				<div class="mb-8 p-4 rounded-xl bg-black/20 border border-white/5 text-center">
					<p class="text-white/60 text-sm mb-4">
						We'll listen to your voice for about 10 seconds to create a personalized sculpture experience.
					</p>
					<div class="flex gap-2 justify-center text-xs text-white/40">
						<span class="px-2 py-1 rounded bg-white/5">🎵 Pitch Range</span>
						<span class="px-2 py-1 rounded bg-white/5">📢 Volume Range</span>
						<span class="px-2 py-1 rounded bg-white/5">🎨 Timbre</span>
					</div>
				</div>
			{/if}
			
			<!-- Actions -->
			<div class="flex gap-3">
				{#if calibrationStore.step === 'idle'}
					<button
						onclick={handleStart}
						class="flex-1 py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
						style="background: linear-gradient(135deg, {currentConfig.color}, {currentConfig.color}cc);"
					>
						🎤 Start Calibration
					</button>
					<button
						onclick={handleSkip}
						class="py-4 px-6 rounded-xl font-semibold text-white/60 bg-white/5 border border-white/10 transition-all duration-200 hover:bg-white/10"
					>
						Skip
					</button>
				{:else if calibrationStore.step === 'complete'}
					<button
						onclick={handleComplete}
						class="flex-1 py-4 px-6 rounded-xl font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
						style="background: linear-gradient(135deg, {currentConfig.color}, {currentConfig.color}cc);"
					>
						✨ Start Creating
					</button>
				{:else if calibrationStore.step === 'processing'}
					<div class="flex-1 py-4 px-6 rounded-xl font-semibold text-white/60 bg-white/5 text-center">
						<span class="animate-pulse">Processing...</span>
					</div>
				{:else}
					<button
						onclick={nextCalibrationStep}
						class="flex-1 py-4 px-6 rounded-xl font-semibold text-white/60 bg-white/5 border border-white/10 transition-all duration-200 hover:bg-white/10"
					>
						Skip This Step →
					</button>
				{/if}
			</div>
			
			<!-- Error display -->
			{#if calibrationStore.error}
				<div class="mt-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
					{calibrationStore.error}
				</div>
			{/if}
		</div>
	</div>
</div>

