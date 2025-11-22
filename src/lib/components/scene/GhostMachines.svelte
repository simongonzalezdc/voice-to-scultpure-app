<script lang="ts">
	import { T } from '@threlte/core';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';

	// Dark UI Geometry styling
	const DARK_UI_COLOR = '#333333';
	const DARK_UI_OPACITY = 0.8;

	// Get sculpture height for lathe positioning
	let sculptureHeight = $derived(
		sculptureStore.currentSculpture?.physical.height 
			? sculptureStore.currentSculpture.physical.height / 150 // Normalize to scene units
			: 1.0 // Default 1 unit if no sculpture
	);
</script>

<!-- Ghost Machines: Contextual Rigs (Dark UI Geometry) -->
{#if uiStore.orientation === 'vertical'}
	<!-- Pottery Mode: Cylinder Base -->
	<T.Group position={[0, 0, 0]}>
		<T.Mesh rotation={[-Math.PI / 2, 0, 0]}>
			<T.CylinderGeometry args={[1.5, 1.5, 0.1, 32]} />
			<T.MeshStandardMaterial
				color={DARK_UI_COLOR}
				flatShading={true}
				transparent={true}
				opacity={DARK_UI_OPACITY}
			/>
		</T.Mesh>
	</T.Group>
{:else if uiStore.orientation === 'horizontal'}
	<!-- Lathe Mode: Two-Ended Rotisserie Design -->
	<T.Group position={[0, 0, 0]}>
		{@const halfHeight = sculptureHeight / 2}
		
		<!-- Left End: Headstock (Cylinder + Cone) -->
		<T.Group position={[-halfHeight, 0, 0]}>
			<!-- Base Cylinder -->
			<T.Mesh>
				<T.CylinderGeometry args={[0.15, 0.15, 0.3, 16]} />
				<T.MeshStandardMaterial
					color={DARK_UI_COLOR}
					flatShading={true}
					transparent={true}
					opacity={DARK_UI_OPACITY}
				/>
			</T.Mesh>
			<!-- Cone Top -->
			<T.Mesh position={[0, 0.2, 0]}>
				<T.ConeGeometry args={[0.1, 0.2, 16]} />
				<T.MeshStandardMaterial
					color={DARK_UI_COLOR}
					flatShading={true}
					transparent={true}
					opacity={DARK_UI_OPACITY}
				/>
			</T.Mesh>
		</T.Group>

		<!-- Right End: Tailstock (Cone Point) -->
		<T.Group position={[halfHeight, 0, 0]}>
			<T.Mesh>
				<T.ConeGeometry args={[0.1, 0.3, 16]} />
				<T.MeshStandardMaterial
					color={DARK_UI_COLOR}
					flatShading={true}
					transparent={true}
					opacity={DARK_UI_OPACITY}
				/>
			</T.Mesh>
		</T.Group>

		<!-- Horizontal Axis Rod (Spinning Axis) -->
		<T.Mesh rotation={[0, 0, Math.PI / 2]}>
			<T.CylinderGeometry args={[0.02, 0.02, sculptureHeight, 8]} />
			<T.MeshStandardMaterial
				color={DARK_UI_COLOR}
				flatShading={true}
				transparent={true}
				opacity={DARK_UI_OPACITY}
			/>
		</T.Mesh>
	</T.Group>
{/if}

