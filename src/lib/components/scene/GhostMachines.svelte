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
	<!-- Position: Sit just below the zero line -->
	<T.Group position={[0, -0.05, 0]}>
		<T.Mesh rotation={[0, 0, 0]}>
			<T.CylinderGeometry args={[2, 2, 0.1, 64]} />
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
		{@const targetX = sculptureHeight}
		<!-- Dynamic binding: tailstock slides with height -->

		<!-- Headstock (Chuck): Cylinder at origin, rotated horizontally -->
		<T.Group position={[0, 0, 0]}>
			<T.Mesh rotation={[0, 0, Math.PI / 2]}>
				<T.CylinderGeometry args={[0.2, 0.2, 0.4, 16]} />
				<T.MeshStandardMaterial
					color={DARK_UI_COLOR}
					flatShading={true}
					transparent={true}
					opacity={DARK_UI_OPACITY}
				/>
			</T.Mesh>
		</T.Group>

		<!-- Tailstock (Point): Cone at targetX, rotated to point inward -->
		<T.Group position={[targetX, 0, 0]}>
			<T.Mesh rotation={[0, 0, -Math.PI / 2]}>
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
		<T.Mesh rotation={[0, 0, Math.PI / 2]} position={[targetX / 2, 0, 0]}>
			<T.CylinderGeometry args={[0.02, 0.02, targetX, 8]} />
			<T.MeshStandardMaterial
				color={DARK_UI_COLOR}
				flatShading={true}
				transparent={true}
				opacity={DARK_UI_OPACITY}
			/>
		</T.Mesh>
	</T.Group>
{/if}
