<script lang="ts">
	import { T } from '@threlte/core';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { recordingStore } from '$lib/stores/recordingStore.svelte';
	import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial } from 'three';
	import { useTask } from '@threlte/core';

	let visible = $derived(recordingStore.state === 'recording');
	let frame = $derived(analysisStore.latestFrame);

	let geometry = $state<BufferGeometry | null>(null);
	const maxPoints = 512;
	const points: number[] = [];

	useTask(() => {
		if (!visible || !frame) {
			if (geometry) {
				geometry.dispose();
				geometry = null;
			}
			return;
		}

		// Add new point based on analysis frame
		const x = (frame.time % 10) / 10; // Normalize to 0-1 over 10 second window
		const y = frame.energy * 2 - 1; // Map energy to -1 to 1
		const z = (frame.pitch / 1000) * 2 - 1; // Map pitch to -1 to 1 (assuming max 1000Hz)

		points.push(x, y, z);

		// Keep only last maxPoints
		if (points.length > maxPoints * 3) {
			points.splice(0, points.length - maxPoints * 3);
		}

		if (!geometry) {
			geometry = new BufferGeometry();
		}

		geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
		geometry.setDrawRange(0, points.length / 3);
	});

	$effect(() => {
		return () => {
			if (geometry) {
				geometry.dispose();
			}
		};
	});
</script>

{#if visible && geometry}
	<T.LineSegments geometry={geometry}>
		<T.LineBasicMaterial color="#8F3E48" linewidth={2} />
	</T.LineSegments>
{/if}

