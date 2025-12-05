<script lang="ts">
	import { T } from '@threlte/core';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';

	// Dark UI Geometry styling
	const DARK_UI_COLOR = '#333333';
	const DARK_UI_OPACITY = 0.8;
</script>

<!-- Ghost Machines: Pottery Wheel Base (Dark UI Geometry) -->
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
