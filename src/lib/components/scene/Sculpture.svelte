<script lang="ts">
	import { Canvas, T } from '@threlte/core';
	import OrbitControls from './OrbitControls.svelte';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { appSettings } from '$lib/stores/appSettingsStore.svelte';
	import { LatheGeometry, MeshPhysicalMaterial, Vector2 } from 'three';
	import { useTask } from '@threlte/core';
	import type { SculptureDefinition } from '$lib/types';

	let { sculpture } = $props<{ sculpture: SculptureDefinition | null }>();

	let latheGeometry = $state<LatheGeometry | null>(null);

	useTask(() => {
		if (!sculpture) {
			if (latheGeometry) {
				latheGeometry.dispose();
				latheGeometry = null;
			}
			return;
		}

		const points = sculpture.radiusCurve.map((p: { x: number; y: number }) => new Vector2(p.x, p.y));
		if (points.length < 2) {
			return;
		}

		if (latheGeometry) {
			latheGeometry.dispose();
		}

		latheGeometry = new LatheGeometry(points, 32);
	});
</script>

<Canvas>
	<T.PerspectiveCamera makeDefault position={[0, 2, 5]} fov={50} />
	<T.DirectionalLight
		position={[5, 10, 5]}
		intensity={1}
		castShadow
		shadow-mapSize-width={appSettings.graphicsQuality === 'high' ? 2048 : 1024}
		shadow-mapSize-height={appSettings.graphicsQuality === 'high' ? 2048 : 1024}
	/>
	<T.AmbientLight intensity={0.3} />
	<OrbitControls enableDamping dampingFactor={0.05} />

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
	{#if sculptureStore.ghostSculpture}
		{@const ghostPoints = sculptureStore.ghostSculpture.radiusCurve.map((p: { x: number; y: number }) => new Vector2(p.x, p.y))}
		{#if ghostPoints.length >= 2}
			{@const ghostGeometry = new LatheGeometry(ghostPoints, 32)}
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
	{/if}
</Canvas>

