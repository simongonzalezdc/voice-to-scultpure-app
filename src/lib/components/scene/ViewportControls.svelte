<script lang="ts">
	import { uiStore, setLightingAngle, setZoom } from '$lib/stores/uiStore.svelte';

	function handleZoomIn() {
		setZoom(uiStore.view.zoom + 0.1);
	}

	function handleZoomOut() {
		setZoom(uiStore.view.zoom - 0.1);
	}

	function handleLightRotate() {
		// Rotate by 45 degrees
		setLightingAngle(uiStore.view.lightingAngle + Math.PI / 4);
	}
</script>

<div class="flex flex-col gap-2">
	<!-- Lighting Control -->
	<button
		class="w-10 h-10 rounded-full bg-[#1a1a1a] border border-[#4a4a4a] text-white flex items-center justify-center hover:bg-[#2a2a2a] transition-colors"
		onclick={handleLightRotate}
		title="Rotate Light"
	>
		💡
	</button>

	<!-- Zoom Controls -->
	<div class="flex flex-col rounded-full bg-[#1a1a1a] border border-[#4a4a4a] overflow-hidden">
		<button
			class="w-10 h-10 text-white flex items-center justify-center hover:bg-[#2a2a2a] transition-colors border-b border-[#4a4a4a]"
			onclick={handleZoomIn}
			title="Zoom In"
		>
			+
		</button>
		<button
			class="w-10 h-10 text-white flex items-center justify-center hover:bg-[#2a2a2a] transition-colors"
			onclick={handleZoomOut}
			title="Zoom Out"
		>
			-
		</button>
	</div>
</div>
