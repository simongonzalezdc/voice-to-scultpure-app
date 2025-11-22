<script lang="ts">
	import '../app.postcss';
	import DebugOverlay from '$lib/components/debug/DebugOverlay.svelte';
</script>

<div class="min-h-screen bg-app text-primary">
	<slot />
	<DebugOverlay />
</div>
