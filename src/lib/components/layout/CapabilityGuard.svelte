<script lang="ts">
	import { onMount } from 'svelte';

	let hasSharedArrayBuffer = $state(false);
	let hasWebGPU = $state(false);
	let hasMicrophone = $state(false);
	let microphoneError = $state<string | null>(null);
	let mounted = $state(false);
	let forceEntry = $state(false); // Bypass switch for testing export features

	onMount(() => {
		mounted = true;
		checkCapabilities();
	});

	async function checkCapabilities() {
		if (typeof window === 'undefined') return;

		hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
		hasWebGPU = 'gpu' in navigator;

		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			hasMicrophone = true;
			stream.getTracks().forEach((track) => track.stop());
		} catch (error) {
			hasMicrophone = false;
			microphoneError = error instanceof Error ? error.message : String(error);
		}
	}

	function handleDismiss() {
		forceEntry = true;
	}
</script>

{#if mounted && !forceEntry}
	{#if !hasSharedArrayBuffer}
		<div class="badge badge-warning p-4 mb-4 flex items-center justify-between gap-4">
			<div class="flex-1">
				⚠️ SharedArrayBuffer not available. Audio recording may not work. Ensure COOP/COEP headers
				are set.
			</div>
			<button class="button-secondary px-3 py-1 text-xs" type="button" onclick={handleDismiss}>
				Continue Anyway
			</button>
		</div>
	{/if}

	{#if !hasWebGPU}
		<div class="badge badge-info p-4 mb-4">
			ℹ️ WebGPU not available. Falling back to WebGL. Local AI will be disabled.
		</div>
	{/if}

	{#if !hasMicrophone}
		<div class="badge badge-danger p-4 mb-4 flex items-center justify-between gap-4">
			<div class="flex-1">
				❌ Microphone access denied: {microphoneError || 'Unknown error'}. Please grant microphone
				permissions.
			</div>
			<button class="button-secondary px-3 py-1 text-xs" type="button" onclick={handleDismiss}>
				Continue Anyway
			</button>
		</div>
	{/if}
{/if}
