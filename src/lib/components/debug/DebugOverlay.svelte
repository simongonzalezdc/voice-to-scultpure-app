<script lang="ts">
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { recordingStore } from '$lib/stores/recording.svelte';
	import { Activity, Mic, Box, Palette, Save, Cpu, AlertTriangle } from 'lucide-svelte';

	// 1. Audio Input
	let audioHealth = $derived(analysisStore.micLevel > 0.001);

	// 2. Worker Brain (check if frames are arriving during recording)
	let workerHealth = $derived.by(() => {
		if (recordingStore.state !== 'recording') return true; // Assume healthy if not recording
		return analysisStore.latestFrame !== null;
	});

	// 3. Renderer (Mesh defined)
	let rendererHealth = $derived(!!sculptureStore.meshReference);

	// 4. Geometry (Vertices & NaN)
	let geometryHealth = $derived.by(() => {
		const mesh = sculptureStore.meshReference;
		if (!mesh) return false;
		const pos = mesh.geometry?.attributes.position;
		if (!pos || pos.count === 0) return false;

		// Check for NaN (sampling first few)
		const array = pos.array;
		if (array.length > 0 && (Number.isNaN(array[0]) || !Number.isFinite(array[0]))) return false;

		return true;
	});

	// 5. Glaze
	let glazeStatus = $derived.by(() => {
		const mesh = sculptureStore.meshReference;
		if (!mesh) return 'empty';
		const colors = mesh.geometry?.attributes.color;
		return colors && colors.count > 0 ? 'painted' : 'empty';
	});

	// 6. Storage (Simulated saved state based on dirty flag)
	let storageHealth = $derived(!sculptureStore.geometryDirty);

	// Helper for status color
	function statusColor(healthy: boolean) {
		return healthy ? 'text-emerald-400' : 'text-red-500 animate-pulse';
	}
</script>

<div
	class="fixed bottom-16 left-20 z-[200] bg-black/80 backdrop-blur-md border border-white/10 rounded-lg p-3 text-xs font-mono text-white/80 shadow-2xl select-none pointer-events-none"
>
	<div class="flex items-center gap-2 mb-2 border-b border-white/10 pb-1">
		<Activity size={14} />
		<span class="font-bold">SYSTEM HEALTH</span>
	</div>

	<div class="space-y-1.5">
		<!-- Audio -->
		<div class="flex items-center justify-between gap-4">
			<div class="flex items-center gap-2">
				<Mic size={12} />
				<span>AUDIO INPUT</span>
			</div>
			<span class={statusColor(audioHealth)}>{audioHealth ? 'LIVE' : 'SILENT'}</span>
		</div>

		<!-- Worker -->
		<div class="flex items-center justify-between gap-4">
			<div class="flex items-center gap-2">
				<Cpu size={12} />
				<span>WORKER BRAIN</span>
			</div>
			<span class={statusColor(workerHealth)}>{workerHealth ? 'ACTIVE' : 'FROZEN'}</span>
		</div>

		<!-- Renderer -->
		<div class="flex items-center justify-between gap-4">
			<div class="flex items-center gap-2">
				<Box size={12} />
				<span>RENDERER</span>
			</div>
			<span class={statusColor(rendererHealth)}>{rendererHealth ? 'READY' : 'MISSING'}</span>
		</div>

		<!-- Geometry -->
		<div class="flex items-center justify-between gap-4">
			<div class="flex items-center gap-2">
				<AlertTriangle size={12} />
				<span>GEOMETRY</span>
			</div>
			<span class={statusColor(geometryHealth)}>{geometryHealth ? 'VALID' : 'CORRUPT'}</span>
		</div>

		<!-- Glaze -->
		<div class="flex items-center justify-between gap-4">
			<div class="flex items-center gap-2">
				<Palette size={12} />
				<span>GLAZE</span>
			</div>
			<span class={glazeStatus === 'painted' ? 'text-blue-400' : 'text-white/30'}>
				{glazeStatus === 'painted' ? 'PAINTED' : 'EMPTY'}
			</span>
		</div>

		<!-- Storage -->
		<div class="flex items-center justify-between gap-4">
			<div class="flex items-center gap-2">
				<Save size={12} />
				<span>STORAGE</span>
			</div>
			<span class={storageHealth ? 'text-emerald-400' : 'text-yellow-400'}>
				{storageHealth ? 'SAVED' : 'UNSAVED'}
			</span>
		</div>
	</div>
</div>
