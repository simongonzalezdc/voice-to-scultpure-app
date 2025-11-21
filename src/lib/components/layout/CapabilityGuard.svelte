<script lang="ts">
	import { onMount } from 'svelte';
	import { analysisStore } from '$lib/stores/analysisStore';

	let hasSharedArrayBuffer = $state(false);
	let hasWebGPU = $state(false);
	let hasMicrophone = $state(false);
	let microphoneError = $state<string | null>(null);
	let mounted = $state(false);

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
</script>

{#if mounted}

{#if !hasSharedArrayBuffer}
	<div class="badge badge-warning p-4 mb-4">
		⚠️ SharedArrayBuffer not available. Audio recording may not work. Ensure COOP/COEP headers are
		set.
	</div>
{/if}

{#if !hasWebGPU}
	<div class="badge badge-info p-4 mb-4">
		ℹ️ WebGPU not available. Falling back to WebGL. Local AI will be disabled.
	</div>
{/if}

{#if !hasMicrophone}
	<div class="badge badge-danger p-4 mb-4">
		❌ Microphone access denied: {microphoneError || 'Unknown error'}. Please grant microphone
		permissions.
	</div>
{/if}
{/if}

