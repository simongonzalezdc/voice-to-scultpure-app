<script lang="ts">
	import { T } from '@threlte/core';
	import { BufferGeometry, Vector3 } from 'three';
	import amphora from '$lib/assets/shapes/amphora.json';
	import chalice from '$lib/assets/shapes/chalice.json';
	import type { LathePoint } from '$lib/types';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { getProfilePoints } from '$lib/engine/metrics';
	import { onDestroy } from 'svelte';

	const BLUEPRINTS: Record<string, { name: string; points: LathePoint[] }> = {
		amphora: { name: 'Amphora', points: amphora as LathePoint[] },
		chalice: { name: 'Chalice', points: chalice as LathePoint[] }
	};

	// Use $state.raw for Three.js objects to track assignment but not internal properties
	let lineGeometry = $state.raw<BufferGeometry | null>(null);
	let lineRef = $state<any>(null);

	let activeBlueprint = $derived(BLUEPRINTS[uiStore.view.blueprintId || 'amphora']);
	let matchPercent = $derived.by(() => {
		if (!uiStore.view.showBlueprint || !activeBlueprint) return 0;
		const userProfile = getProfilePoints(sculptureStore.currentSculpture);
		return calculateMatch(userProfile, activeBlueprint.points);
	});

	// Recreate geometry when blueprint changes
	$effect(() => {
		if (!activeBlueprint) return;
		
		// Clean up old geometry
		if (lineGeometry) {
			lineGeometry.dispose();
		}

		// Create new geometry (non-reactive assignment)
		const newGeometry = new BufferGeometry();
		const pts = activeBlueprint.points.map((p) => new Vector3(p.x, p.y, 0));
		newGeometry.setFromPoints(pts);
		newGeometry.computeBoundingSphere();
		lineGeometry = newGeometry;

		// Update line distances after render
		queueMicrotask(() => {
			lineRef?.computeLineDistances?.();
		});
	});

	onDestroy(() => {
		lineGeometry?.dispose();
	});

	function calculateMatch(user: LathePoint[], target: LathePoint[]): number {
		if (!user.length || !target.length) return 0;
		const samples = 64;
		let totalDiff = 0;
		for (let i = 0; i < samples; i++) {
			const t = i / (samples - 1);
			const u = sampleCurve(user, t);
			const d = sampleCurve(target, t);
			totalDiff += Math.abs(u.x - d.x);
		}
		const avgDiff = totalDiff / samples;
		return Math.max(0, Math.min(100, (1 - avgDiff / 0.6) * 100));
	}

	function sampleCurve(curve: LathePoint[], t: number): LathePoint {
		if (!curve.length) return { x: 0, y: 0 };
		const idx = t * (curve.length - 1);
		const i0 = Math.floor(idx);
		const i1 = Math.min(curve.length - 1, i0 + 1);
		const lerp = idx - i0;
		const p0 = curve[i0];
		const p1 = curve[i1];
		return {
			x: p0.x + (p1.x - p0.x) * lerp,
			y: p0.y + (p1.y - p0.y) * lerp
		};
	}
</script>

{#if uiStore.view.showBlueprint && activeBlueprint && lineGeometry}
	<T.Group>
		<T.Line geometry={lineGeometry} bind:ref={lineRef} position={[0, 0, 0]}>
			<T.LineDashedMaterial color="#56b3ff" dashSize={0.05} gapSize={0.03} transparent opacity={0.75} />
		</T.Line>
	</T.Group>
{/if}
