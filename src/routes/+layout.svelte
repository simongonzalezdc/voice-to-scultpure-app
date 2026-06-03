<script lang="ts">
	import '../app.postcss';
	import Toast from '$lib/components/overlay/Toast.svelte';
	import AudioStateVisualizer from '$lib/components/debug/AudioStateVisualizer.svelte';
</script>

<div class="min-h-screen bg-app text-primary relative">
	<!-- Radical Observability: Always-on Status Indicators -->
	<div class="fixed top-4 left-4 z-50">
		<AudioStateVisualizer />
	</div>

	<!-- Global Toast Notifications -->
	<Toast />

	<slot />
</div>
