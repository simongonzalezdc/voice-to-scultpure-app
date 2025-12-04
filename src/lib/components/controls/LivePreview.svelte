<script lang="ts">
	/**
	 * Live Preview Strip
	 * P0: Shows real-time cross-section of what the voice is creating
	 * Reduces performance anxiety by letting users see their voice's effect
	 */
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { recordingStore } from '$lib/stores/recording.svelte';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { getCalibration } from '$lib/stores/calibrationStore.svelte';
	import { onMount } from 'svelte';
	
	let { compact = false } = $props<{ compact?: boolean }>();
	
	// Canvas refs
	let waveformCanvas: HTMLCanvasElement | null = $state(null);
	let profileCanvas: HTMLCanvasElement | null = $state(null);
	
	// Recent audio history for waveform
	const WAVEFORM_HISTORY = 90; // ~3 seconds at 30fps
	// Use plain arrays (not reactive) to avoid infinite loops in effects
	let energyHistory: number[] = [];
	let pitchHistory: number[] = [];
	
	// Current values for display
	let currentPitch = $derived(analysisStore.latestFrame?.pitch || 0);
	let currentEnergy = $derived(analysisStore.latestFrame?.energy || 0);
	let currentBeat = $derived(analysisStore.latestFrame?.beat || false);
	
	// Derived radius from pitch (using calibration)
	let previewRadius = $derived.by(() => {
		const calibration = getCalibration();
		if (currentPitch === 0 || currentEnergy < 0.02) return 0.5; // Default when silent
		
		// Use melodic mode: pitch -> radius
		if (uiStore.controlMode === 'melodic') {
			return calibration.pitchToRadius(currentPitch);
		} else {
			// Standard mode: energy -> radius
			return calibration.energyToScale(currentEnergy);
		}
	});
	
	// Note name from pitch
	let pitchNoteName = $derived.by(() => {
		if (currentPitch === 0) return '---';
		const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
		const a4 = 440;
		const semitones = 12 * Math.log2(currentPitch / a4);
		const noteIndex = Math.round(semitones) + 9; // A4 is 9th note
		const octave = Math.floor((noteIndex + 3) / 12) + 4;
		const note = noteNames[(noteIndex % 12 + 12) % 12];
		return `${note}${octave}`;
	});
	
	// Recording state
	let isRecording = $derived(recordingStore.state === 'recording');
	let frameCount = $derived(recordingStore.frameCount);
	let recordingDuration = $derived((frameCount / 30).toFixed(1));
	
	// Update history buffers - uses plain array mutation (no reactive writes)
	// This effect runs when latestFrame changes, updates the arrays, 
	// and the draw effects below will naturally re-run too
	$effect(() => {
		// Read the reactive dependencies
		const energy = currentEnergy;
		const pitch = currentPitch;
		const recording = isRecording;
		
		if (recording || energy > 0.01) {
			// Mutate non-reactive arrays directly (no infinite loop)
			energyHistory.push(energy);
			pitchHistory.push(pitch);
			
			// Trim to max length
			if (energyHistory.length > WAVEFORM_HISTORY) {
				energyHistory.shift();
			}
			if (pitchHistory.length > WAVEFORM_HISTORY) {
				pitchHistory.shift();
			}
		}
	});
	
	// Draw waveform
	$effect(() => {
		if (!waveformCanvas) return;
		const ctx = waveformCanvas.getContext('2d');
		if (!ctx) return;
		
		const w = waveformCanvas.width;
		const h = waveformCanvas.height;
		
		// Clear
		ctx.clearRect(0, 0, w, h);
		
		// Background
		ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
		ctx.fillRect(0, 0, w, h);
		
		if (energyHistory.length < 2) return;
		
		// Draw energy waveform
		ctx.beginPath();
		ctx.strokeStyle = isRecording ? '#ef4444' : '#6366f1';
		ctx.lineWidth = 2;
		
		const step = w / WAVEFORM_HISTORY;
		energyHistory.forEach((energy, i) => {
			const x = i * step;
			const y = h / 2 - energy * h * 0.4; // Center line, scale to 40% height
			if (i === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}
		});
		ctx.stroke();
		
		// Mirror waveform below center
		ctx.beginPath();
		ctx.strokeStyle = isRecording ? '#ef444480' : '#6366f180';
		energyHistory.forEach((energy, i) => {
			const x = i * step;
			const y = h / 2 + energy * h * 0.4;
			if (i === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}
		});
		ctx.stroke();
		
		// Center line
		ctx.beginPath();
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
		ctx.lineWidth = 1;
		ctx.moveTo(0, h / 2);
		ctx.lineTo(w, h / 2);
		ctx.stroke();
		
		// Beat flash
		if (currentBeat) {
			ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
			ctx.fillRect(0, 0, w, h);
		}
	});
	
	// Draw profile preview (cross-section)
	$effect(() => {
		if (!profileCanvas) return;
		const ctx = profileCanvas.getContext('2d');
		if (!ctx) return;
		
		const w = profileCanvas.width;
		const h = profileCanvas.height;
		const centerX = w / 2;
		
		// Clear
		ctx.clearRect(0, 0, w, h);
		
		// Background
		ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
		ctx.fillRect(0, 0, w, h);
		
		// Draw cross-section outline
		// Left side
		ctx.beginPath();
		ctx.strokeStyle = '#f59e0b';
		ctx.lineWidth = 3;
		
		// Simple vase shape preview based on current radius
		const radius = previewRadius;
		const maxWidth = w * 0.4;
		const currentWidth = radius * maxWidth;
		
		// Draw current "slice" shape
		const sliceHeight = h * 0.15;
		const sliceY = h * 0.4;
		
		// Left contour
		ctx.moveTo(centerX - currentWidth, sliceY);
		ctx.lineTo(centerX - currentWidth, sliceY + sliceHeight);
		
		// Bottom
		ctx.lineTo(centerX + currentWidth, sliceY + sliceHeight);
		
		// Right contour
		ctx.lineTo(centerX + currentWidth, sliceY);
		
		ctx.stroke();
		
		// Fill with gradient
		const gradient = ctx.createLinearGradient(centerX - currentWidth, 0, centerX + currentWidth, 0);
		gradient.addColorStop(0, 'rgba(245, 158, 11, 0.1)');
		gradient.addColorStop(0.5, 'rgba(245, 158, 11, 0.3)');
		gradient.addColorStop(1, 'rgba(245, 158, 11, 0.1)');
		ctx.fillStyle = gradient;
		ctx.fillRect(centerX - currentWidth, sliceY, currentWidth * 2, sliceHeight);
		
		// Draw annotation
		ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
		ctx.font = '10px system-ui';
		ctx.textAlign = 'center';
		ctx.fillText('← Your voice is creating this →', centerX, sliceY + sliceHeight + 20);
		
		// Draw reference lines showing full range
		ctx.beginPath();
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
		ctx.lineWidth = 1;
		ctx.setLineDash([4, 4]);
		
		// Max width reference
		ctx.moveTo(centerX - maxWidth, sliceY - 10);
		ctx.lineTo(centerX - maxWidth, sliceY + sliceHeight + 10);
		ctx.moveTo(centerX + maxWidth, sliceY - 10);
		ctx.lineTo(centerX + maxWidth, sliceY + sliceHeight + 10);
		
		// Center line
		ctx.moveTo(centerX, 0);
		ctx.lineTo(centerX, h);
		
		ctx.stroke();
		ctx.setLineDash([]);
	});
	
	onMount(() => {
		// Set canvas sizes
		if (waveformCanvas) {
			waveformCanvas.width = waveformCanvas.offsetWidth * 2;
			waveformCanvas.height = waveformCanvas.offsetHeight * 2;
		}
		if (profileCanvas) {
			profileCanvas.width = profileCanvas.offsetWidth * 2;
			profileCanvas.height = profileCanvas.offsetHeight * 2;
		}
	});
</script>

<div class="live-preview rounded-xl overflow-hidden border border-white/10 bg-black/20 backdrop-blur-sm"
	class:compact>
	
	<!-- Header -->
	<div class="flex items-center justify-between px-3 py-2 bg-black/30 border-b border-white/5">
		<div class="flex items-center gap-2">
			{#if isRecording}
				<span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
				<span class="text-xs text-red-400 font-medium">Recording {recordingDuration}s</span>
			{:else}
				<span class="w-2 h-2 rounded-full bg-indigo-500"></span>
				<span class="text-xs text-white/50">Live Preview</span>
			{/if}
		</div>
		
		<!-- Current pitch/energy readout -->
		<div class="flex items-center gap-3 text-xs font-mono">
			<span class="text-amber-400" title="Pitch">
				♪ {pitchNoteName}
			</span>
			<span class="text-indigo-400" title="Volume">
				◉ {(currentEnergy * 100).toFixed(0)}%
			</span>
		</div>
	</div>
	
	<!-- Visualization area -->
	<div class="flex" class:flex-col={compact}>
		<!-- Waveform (left) -->
		<div class="flex-1 relative" class:h-16={compact} class:h-24={!compact}>
			<canvas 
				bind:this={waveformCanvas}
				class="absolute inset-0 w-full h-full"
			></canvas>
			
			<!-- Beat indicator -->
			{#if currentBeat}
				<div class="absolute inset-0 bg-white/10 animate-ping pointer-events-none"></div>
			{/if}
		</div>
		
		<!-- Profile preview (right) -->
		{#if !compact}
			<div class="w-32 border-l border-white/5 relative">
				<canvas 
					bind:this={profileCanvas}
					class="absolute inset-0 w-full h-full"
				></canvas>
			</div>
		{/if}
	</div>
	
	<!-- Mapping hint -->
	<div class="px-3 py-1.5 bg-black/20 border-t border-white/5 text-xs text-white/40 text-center">
		{#if uiStore.controlMode === 'melodic'}
			Low pitch → Wide shape | High pitch → Narrow shape
		{:else}
			Quiet → Thin shape | Loud → Wide shape
		{/if}
	</div>
</div>

<style>
	.live-preview {
		min-width: 200px;
	}
	
	.live-preview.compact {
		min-width: 150px;
	}
</style>

