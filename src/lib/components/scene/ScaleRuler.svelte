<script lang="ts">
	/**
	 * ScaleRuler - Visual mm scale reference for 3D scene
	 * Shows actual physical dimensions so users know real-world size
	 */
	import { T } from '@threlte/core';
	import { Text } from '@threlte/extras';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { DEFAULT_HEIGHT_MM } from '$lib/config/constants';

	// Get current sculpture height in mm
	let heightMM = $derived(
		sculptureStore.currentSculpture?.physical?.height ?? DEFAULT_HEIGHT_MM
	);

	// Convert mm to 3D units (150mm = 1.0 unit)
	let heightUnits = $derived(heightMM / DEFAULT_HEIGHT_MM);

	// Generate tick marks every 50mm
	let tickInterval = 50; // mm
	let ticks = $derived.by(() => {
		const result: { mm: number; y: number; major: boolean }[] = [];
		for (let mm = 0; mm <= heightMM; mm += tickInterval) {
			const y = (mm / DEFAULT_HEIGHT_MM); // Convert to 3D units
			const major = mm % 100 === 0; // Major tick every 100mm
			result.push({ mm, y, major });
		}
		return result;
	});

	// Position ruler to the side of the sculpture
	let rulerX = 1.2; // Position to the right of typical sculpture
</script>

<!-- Scale Ruler Group - positioned beside the sculpture -->
<T.Group position={[rulerX, 0, 0]}>
	<!-- Main vertical ruler line -->
	<T.Mesh position={[0, heightUnits / 2, 0]}>
		<T.BoxGeometry args={[0.02, heightUnits, 0.02]} />
		<T.MeshBasicMaterial color="#ffffff" opacity={0.8} transparent />
	</T.Mesh>

	<!-- Tick marks and labels -->
	{#each ticks as tick}
		<!-- Tick mark -->
		<T.Mesh position={[-0.05, tick.y, 0]}>
			<T.BoxGeometry args={[tick.major ? 0.15 : 0.08, 0.01, 0.01]} />
			<T.MeshBasicMaterial color={tick.major ? '#ffffff' : '#888888'} />
		</T.Mesh>

		<!-- Label for major ticks -->
		{#if tick.major || tick.mm === heightMM}
			<Text
				text={`${tick.mm}mm`}
				position={[0.15, tick.y, 0]}
				fontSize={0.08}
				color="#ffffff"
				anchorX="left"
				anchorY="middle"
			/>
		{/if}
	{/each}

	<!-- Height indicator arrow at top -->
	<T.Group position={[0, heightUnits, 0]}>
		<!-- Arrow head -->
		<T.Mesh position={[0, 0.05, 0]} rotation={[0, 0, Math.PI]}>
			<T.ConeGeometry args={[0.04, 0.1, 4]} />
			<T.MeshBasicMaterial color="#00ff88" />
		</T.Mesh>
	</T.Group>

	<!-- Total height label -->
	<Text
		text={`Total: ${heightMM}mm`}
		position={[0.15, heightUnits + 0.15, 0]}
		fontSize={0.1}
		color="#00ff88"
		anchorX="left"
		anchorY="middle"
		fontWeight="bold"
	/>

	<!-- Inch conversion -->
	<Text
		text={`(${(heightMM / 25.4).toFixed(1)}")`}
		position={[0.15, heightUnits + 0.02, 0]}
		fontSize={0.07}
		color="#888888"
		anchorX="left"
		anchorY="middle"
	/>
</T.Group>

<!-- Base reference line (ground level = 0mm) -->
<T.Group position={[0, 0, 0]}>
	<T.Mesh position={[rulerX / 2, 0.005, 0]}>
		<T.BoxGeometry args={[rulerX, 0.01, 0.01]} />
		<T.MeshBasicMaterial color="#ffffff" opacity={0.5} transparent />
	</T.Mesh>
</T.Group>

<!-- Human hand reference silhouette (optional visual scale) -->
<T.Group position={[rulerX + 0.5, 0.4, 0]} scale={[0.3, 0.3, 0.1]}>
	<!-- Simple hand outline using boxes (stylized) -->
	<T.Mesh position={[0, 0, 0]}>
		<T.BoxGeometry args={[0.8, 1.2, 0.1]} />
		<T.MeshBasicMaterial color="#444444" opacity={0.3} transparent />
	</T.Mesh>
	<Text
		text="~hand"
		position={[0, -0.8, 0.1]}
		fontSize={0.3}
		color="#666666"
		anchorX="center"
		anchorY="top"
	/>
</T.Group>

