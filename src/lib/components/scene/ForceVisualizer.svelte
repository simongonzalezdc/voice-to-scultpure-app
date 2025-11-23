<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { DoubleSide } from 'three';

	// Visualizer for Sonic Force Mode (Targeting Reticle)
	// Mounts only when uiStore.workspace === 'force'

	let scale = $state(1);
	let opacity = $state(0.5);
	let color = $state('#ff4400'); // Default red/orange

	// Pulse variables
	let pulseTime = 0;

	useTask((delta) => {
		const micLevel = analysisStore.micLevel;
		const isSubtractive = uiStore.sculptMode === 'subtractive';

		// Update color based on mode
		if (isSubtractive) {
			// Hot Orange/Red (Burning/Pushing)
			color = `rgb(255, ${Math.floor(60 + micLevel * 100)}, 0)`;
		} else {
			// Electric Cyan (Magnetic/Pulling)
			color = `rgb(0, ${Math.floor(200 + micLevel * 55)}, 255)`;
		}

		// Pulse Animation
		pulseTime += delta * (1 + micLevel * 5); // Faster pulse with volume

		// Base scale + Pulse
		const pulse = Math.sin(pulseTime * 5) * 0.1;
		// Scale grows violently with mic level ("Voice Pressure")
		const targetScale = 1 + micLevel * 2.0 + pulse;

		// Smooth interpolation
		scale += (targetScale - scale) * 0.2;

		// Opacity surges with mic level
		opacity = 0.3 + micLevel * 0.7;
	});

	let interactionPoint = $derived(sculptureStore.interactionPoint);
	let interactionNormal = $derived(sculptureStore.interactionNormal);
</script>

{#if uiStore.workspace === 'force' && interactionPoint}
	<T.Group position={[interactionPoint.x, interactionPoint.y, interactionPoint.z]}>
		<!-- Align to normal -->
		{#if interactionNormal}
			<T.Group lookAt={[interactionNormal.x, interactionNormal.y, interactionNormal.z]}>
				<!-- Inner Ring (The Focus) -->
				<T.Mesh scale={scale * 0.5}>
					<T.RingGeometry args={[0.08, 0.1, 32]} />
					<T.MeshBasicMaterial {color} side={DoubleSide} transparent {opacity} />
				</T.Mesh>

				<!-- Middle Ring (The Pressure) -->
				<T.Mesh scale={scale * 0.8}>
					<T.RingGeometry args={[0.12, 0.13, 32]} />
					<T.MeshBasicMaterial {color} side={DoubleSide} transparent opacity={opacity * 0.6} />
				</T.Mesh>

				<!-- Outer Ring (The Shockwave) -->
				<T.Mesh {scale}>
					<T.RingGeometry args={[0.15, 0.16, 32]} />
					<T.MeshBasicMaterial {color} side={DoubleSide} transparent opacity={opacity * 0.3} />
				</T.Mesh>
			</T.Group>
		{/if}
	</T.Group>
{/if}
