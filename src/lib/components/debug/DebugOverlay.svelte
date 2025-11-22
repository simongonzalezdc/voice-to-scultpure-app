<script lang="ts">
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { appSettings } from '$lib/stores/appSettingsStore.svelte';
	import { getAudioContext } from '$lib/audio/audioContext';

	let audioContextState = $state<string>('unknown');
	let vertexCount = $state<number>(0);

	// Poll audio context state
	$effect(() => {
		const interval = setInterval(() => {
			const ctx = getAudioContext();
			audioContextState = ctx?.state || 'not-initialized';
		}, 100);

		return () => clearInterval(interval);
	});

	// Calculate vertex count from current sculpture
	$effect(() => {
		const sculpture = sculptureStore.currentSculpture;
		if (sculpture) {
			// LatheGeometry with 32 segments: vertices = (points.length * 32) + (points.length * 2)
			// Simplified: each point creates a ring of 32 vertices, plus top/bottom caps
			const points = sculpture.radiusCurve.length;
			vertexCount = points * 32 + points * 2; // Approximate
		} else {
			vertexCount = 0;
		}
	});

	// Get calibration status - FIX: Use $derived.by() for function-based derived values
	let calibrationStatus = $derived.by(() => {
		const profile = appSettings.userProfile;
		if (!profile || !profile.calibrated) {
			return 'Not Calibrated';
		}
		return `Pitch: ${profile.pitchRange.min.toFixed(0)}-${profile.pitchRange.max.toFixed(0)}Hz | Energy: ${profile.energyRange.min.toFixed(2)}-${profile.energyRange.max.toFixed(2)}`;
	});

	// Get detected pitch - FIX: Use $derived.by() for function-based derived values
	let detectedPitch = $derived.by(() => {
		const frame = analysisStore.latestFrame;
		if (!frame || frame.pitch === 0) {
			return 'None';
		}
		return `${frame.pitch.toFixed(1)} Hz`;
	});

	// Get mic level - FIX: Use direct expression for simple derived values
	let micLevel = $derived((analysisStore.micLevel * 100).toFixed(1));

	// Audio context state badge color - FIX: Use $derived.by() for function-based derived values
	let audioContextColor = $derived.by(() => {
		switch (audioContextState) {
			case 'running':
				return 'bg-green-500/20 text-green-400 border-green-500/50';
			case 'suspended':
				return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
			case 'closed':
				return 'bg-red-500/20 text-red-400 border-red-500/50';
			default:
				return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
		}
	});
</script>

<div
	class="fixed bottom-4 right-4 z-50 surface-panel p-3 rounded-lg border border-subtle text-xs font-mono max-w-xs"
>
	<div class="font-semibold mb-2 text-primary border-b border-subtle pb-1">Telemetry HUD</div>
	<div class="space-y-1.5">
		<!-- Audio Context State -->
		<div class="flex items-center justify-between gap-2">
			<span class="text-secondary">AudioContext:</span>
			<span class="px-2 py-0.5 rounded border {audioContextColor}">
				{audioContextState}
			</span>
		</div>

		<!-- Mic Level -->
		<div class="flex items-center justify-between gap-2">
			<span class="text-secondary">Mic Level:</span>
			<span class="text-primary font-semibold">{micLevel}%</span>
		</div>
		<div class="h-1 bg-bg-panel-alt rounded-full overflow-hidden">
			<div
				class="h-full bg-brand-primary transition-all duration-100"
				style="width: {analysisStore.micLevel * 100}%"
			></div>
		</div>

		<!-- Detected Pitch -->
		<div class="flex items-center justify-between gap-2">
			<span class="text-secondary">Pitch:</span>
			<span class="text-primary font-semibold">{detectedPitch}</span>
		</div>

		<!-- Calibration Status -->
		<div class="flex flex-col gap-1">
			<span class="text-secondary">Calibration:</span>
			<span class="text-primary text-[10px] leading-tight break-words">
				{calibrationStatus}
			</span>
		</div>

		<!-- Sculpture Vertex Count -->
		<div class="flex items-center justify-between gap-2">
			<span class="text-secondary">Vertices:</span>
			<span class="text-primary font-semibold">{vertexCount.toLocaleString()}</span>
		</div>
	</div>
</div>

<style>
	.surface-panel {
		background: var(--bg-panel, rgba(20, 20, 25, 0.9));
		backdrop-filter: blur(8px);
	}

	.text-secondary {
		color: var(--text-secondary, rgba(255, 255, 255, 0.6));
	}

	.text-primary {
		color: var(--text-primary, rgba(255, 255, 255, 0.9));
	}

	.border-subtle {
		border-color: var(--border-subtle, rgba(255, 255, 255, 0.1));
	}

	.bg-bg-panel-alt {
		background: var(--bg-panel-alt, rgba(30, 30, 35, 0.8));
	}

	.bg-brand-primary {
		background: var(--brand-primary, #8f3e48);
	}
</style>

