<script lang="ts">
	import { T } from '@threlte/core';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { LatheGeometry, Vector2 } from 'three';
	import { useTask } from '@threlte/core';
	import type { SculptureDefinition } from '$lib/types';

	let { sculpture } = $props<{ sculpture: SculptureDefinition | null }>();

	let latheGeometry = $state<LatheGeometry | null>(null);
	let ghostGeometry = $state<LatheGeometry | null>(null);

	useTask(() => {
		if (!sculpture) {
			if (latheGeometry) {
				latheGeometry.dispose();
				latheGeometry = null;
			}
			return;
		}

		const points = sculpture.radiusCurve.map(
			(p: { x: number; y: number }) => new Vector2(p.x, p.y)
		);
		if (points.length < 2) {
			return;
		}

		if (latheGeometry) {
			latheGeometry.dispose();
		}

		latheGeometry = new LatheGeometry(points, 32);
	});

	$effect(() => {
		const ghost = sculptureStore.ghostSculpture;
		if (!ghost) {
			if (ghostGeometry) {
				ghostGeometry.dispose();
				ghostGeometry = null;
			}
			return;
		}

		const ghostPoints = ghost.radiusCurve.map(
			(p: { x: number; y: number }) => new Vector2(p.x, p.y)
		);
		if (ghostPoints.length < 2) {
			if (ghostGeometry) {
				ghostGeometry.dispose();
				ghostGeometry = null;
			}
			return;
		}

		// Dispose old geometry before creating new one
		if (ghostGeometry) {
			ghostGeometry.dispose();
		}

		ghostGeometry = new LatheGeometry(ghostPoints, 32);

		// Cleanup function
		return () => {
			if (ghostGeometry) {
				ghostGeometry.dispose();
				ghostGeometry = null;
			}
		};
	});
</script>

{#if latheGeometry && sculpture}
	<T.Mesh geometry={latheGeometry} castShadow receiveShadow>
		<T.MeshPhysicalMaterial
			transmission={sculpture.surface.glazeTransmission}
			thickness={0.5}
			roughness={sculpture.surface.textureRoughness}
			clearcoat={0.8}
			clearcoatRoughness={0.2}
			color="#ffffff"
		/>
	</T.Mesh>
{/if}
{#if ghostGeometry && sculptureStore.ghostSculpture}
	<T.Mesh geometry={ghostGeometry}>
		<T.MeshPhysicalMaterial
			transmission={sculptureStore.ghostSculpture.surface.glazeTransmission}
			thickness={0.5}
			roughness={sculptureStore.ghostSculpture.surface.textureRoughness}
			clearcoat={0.8}
			clearcoatRoughness={0.2}
			color="#8F3E48"
			opacity={0.5}
			transparent
			wireframe
		/>
	</T.Mesh>
{/if}
