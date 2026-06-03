<script lang="ts">
	import { T } from '@threlte/core';
	import { BufferGeometry, Vector3 } from 'three';
	import amphora from '$lib/assets/shapes/amphora.json';
	import chalice from '$lib/assets/shapes/chalice.json';
	import type { LathePoint } from '$lib/types';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { onDestroy } from 'svelte';

	const BLUEPRINTS: Record<string, { name: string; points: LathePoint[] }> = {
		amphora: { name: 'Amphora', points: amphora as LathePoint[] },
		chalice: { name: 'Chalice', points: chalice as LathePoint[] }
	};

	// Use $state.raw for Three.js objects to track assignment but not internal properties
	let lineGeometry = $state.raw<BufferGeometry | null>(null);
	let lineRef = $state<any>(null);

	// Track previous geometry for cleanup (avoids reading state in effect that writes it)
	let previousGeometry: BufferGeometry | null = null;

	let activeBlueprint = $derived(BLUEPRINTS[uiStore.view.blueprintId || 'amphora']);
	// Recreate geometry when blueprint changes
	// FIX: Avoid reading lineGeometry in the same effect that writes to it
	$effect(() => {
		if (!activeBlueprint) return;

		// Clean up previous geometry (using local variable, not reactive state)
		if (previousGeometry) {
			previousGeometry.dispose();
		}

		// Create new geometry
		const newGeometry = new BufferGeometry();
		const pts = activeBlueprint.points.map((p) => new Vector3(p.x, p.y, 0));
		newGeometry.setFromPoints(pts);
		newGeometry.computeBoundingSphere();

		// Track for cleanup
		previousGeometry = newGeometry;
		lineGeometry = newGeometry;

		// Update line distances after render
		queueMicrotask(() => {
			lineRef?.computeLineDistances?.();
		});
	});

	onDestroy(() => {
		previousGeometry?.dispose();
	});
</script>

{#if uiStore.view.showBlueprint && activeBlueprint && lineGeometry}
	<T.Group>
		<T.Line geometry={lineGeometry} bind:ref={lineRef} position={[0, 0, 0]}>
			<T.LineDashedMaterial
				color="#56b3ff"
				dashSize={0.05}
				gapSize={0.03}
				transparent
				opacity={0.75}
			/>
		</T.Line>
	</T.Group>
{/if}
