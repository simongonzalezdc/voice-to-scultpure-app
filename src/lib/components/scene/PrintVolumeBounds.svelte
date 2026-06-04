<script lang="ts">
	import { T } from '@threlte/core';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { DEFAULT_HEIGHT_MM } from '$lib/config/constants';
	import { BoxGeometry, EdgesGeometry, LineBasicMaterial } from 'three';

	// Convert mm to scene units
	// Scene uses normalized coordinates where base height = 1.0 = DEFAULT_HEIGHT_MM
	const mmToScene = (mm: number) => mm / DEFAULT_HEIGHT_MM;

	// Calculate box size in scene units
	let boxSize = $derived(mmToScene(uiStore.printVolumeMm));

	// Only show when in 3D print mode
	let visible = $derived(uiStore.constraintMode === '3d_print');

	// Create box edges geometry for wireframe
	let boxGeometry = $derived.by(() => {
		const geo = new BoxGeometry(boxSize, boxSize, boxSize);
		return new EdgesGeometry(geo);
	});

	// Grid helper for floor reference
	let gridSize = $derived(boxSize);
	let gridDivisions = $derived(Math.round(uiStore.printVolumeMm / 50)); // 50mm grid squares

	// Material for wireframe
	const lineMaterial = new LineBasicMaterial({
		color: 0x666666,
		opacity: 0.4,
		transparent: true
	});
</script>

{#if visible}
	<!-- Print Volume Wireframe Cube -->
	<T.Group position.y={boxSize / 2}>
		<T.LineSegments geometry={boxGeometry} material={lineMaterial} />
	</T.Group>

	<!-- Floor Grid -->
	<T.GridHelper
		args={[gridSize, gridDivisions, 0x444444, 0x333333]}
		position.y={0.001}
		rotation.x={0}
	/>

	<!-- Axis Labels (simple text sprites would go here, but for now we use ruler lines) -->
	<!-- Vertical ruler (Y-axis) -->
	<T.Group position={[-boxSize / 2 - 0.1, 0, -boxSize / 2 - 0.1]}>
		{#each Array(Math.floor(uiStore.printVolumeMm / 50) + 1) as _, i}
			{@const yPos = mmToScene(i * 50)}
			{@const tickLength = i % 2 === 0 ? 0.08 : 0.04}
			<!-- Tick mark -->
			<T.Mesh position={[0, yPos, 0]}>
				<T.BoxGeometry args={[tickLength, 0.005, 0.005]} />
				<T.MeshBasicMaterial color={0x888888} />
			</T.Mesh>
		{/each}
	</T.Group>

	<!-- Horizontal ruler (X-axis) -->
	<T.Group position={[0, 0.001, -boxSize / 2 - 0.1]}>
		{#each Array(Math.floor(uiStore.printVolumeMm / 50) + 1) as _, i}
			{@const xPos = mmToScene(i * 50) - boxSize / 2}
			{@const tickLength = i % 2 === 0 ? 0.08 : 0.04}
			<!-- Tick mark -->
			<T.Mesh position={[xPos, 0, 0]}>
				<T.BoxGeometry args={[0.005, 0.005, tickLength]} />
				<T.MeshBasicMaterial color={0x888888} />
			</T.Mesh>
		{/each}
	</T.Group>
{/if}
