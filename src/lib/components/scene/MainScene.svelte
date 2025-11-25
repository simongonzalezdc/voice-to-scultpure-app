<script lang="ts">
	import { T } from '@threlte/core';
	import { Grid, ContactShadows, Environment } from '@threlte/extras';
	import Sculpture from './Sculpture.svelte';
	import AnalysisVisualizer from './AnalysisVisualizer.svelte';
	import ForceVisualizer from './ForceVisualizer.svelte';
	import ForceParticles from './ForceParticles.svelte';
	import OrbitControls from './OrbitControls.svelte';
	import GhostMachines from './GhostMachines.svelte';
	import BlueprintOverlay from './BlueprintOverlay.svelte';
	import PostProcessing from './PostProcessing.svelte';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { appSettings } from '$lib/stores/appSettingsStore.svelte';
	import { uiStore } from '$lib/stores/uiStore.svelte';

	// Post-processing enabled based on quality setting
	let enablePostProcessing = $derived(appSettings.graphicsQuality !== 'low');

	// PHASE 2.1: Wire ViewportControls to Scene
	// Lighting controls - Derived from global UI store
	let lightAngle = $derived(uiStore.view.lightingAngle);

	// Zoom control via viewport controls - map zoom (0.5-3.0) to camera FOV (20-80)
	// Higher zoom = lower FOV (more zoomed in), Lower zoom = higher FOV (more zoomed out)
	let cameraFOV = $derived(80 - (uiStore.view.zoom - 0.5) * 30);

	const ENVIRONMENTS = {
		studio: { map: 'environments/studio_small_03_1k.hdr', intensity: 1 },
		neon: { map: 'environments/royal_esplanade_1k.hdr', intensity: 0.5 },
		darkroom: { map: null, intensity: 0 }
	} as const;

	let currentEnv = $derived(ENVIRONMENTS[uiStore.view.environment] ?? ENVIRONMENTS.studio);
</script>

<!-- Pure Scene Component - Canvas wrapper is in parent -->
<T.PerspectiveCamera makeDefault position={[0, 2, 5]} fov={cameraFOV} />

<!-- Main Light - Rotatable -->
<T.Group rotation.y={lightAngle}>
	<T.DirectionalLight
		position={[5, 10, 5]}
		intensity={1}
		castShadow
		shadow-mapSize-width={appSettings.graphicsQuality === 'high' ? 2048 : 1024}
		shadow-mapSize-height={appSettings.graphicsQuality === 'high' ? 2048 : 1024}
	/>
</T.Group>

<T.AmbientLight intensity={0.3} />

{#if currentEnv.map}
	<Environment files={currentEnv.map} intensity={currentEnv.intensity} />
{/if}

<OrbitControls
	enableDamping
	dampingFactor={0.05}
	maxPolarAngle={appSettings.viewMode?.potteryMode ? Math.PI / 2.1 : Math.PI}
	minPolarAngle={appSettings.viewMode?.potteryMode ? Math.PI / 2.5 : 0}
/>

<!-- Reference Ground: Grid and Contact Shadows -->
<Grid
	infiniteGrid
	sectionColor="#4a4a4a"
	cellColor="#2a2a2a"
	sectionSize={10}
	cellSize={1}
	fadeDistance={50}
/>
<ContactShadows opacity={0.5} scale={20} blur={2} far={10} resolution={256} color="#000000" />

<!-- Ghost Machines: Contextual Rigs (Pottery Wheel / Lathe) -->
<!-- DIRECTIVE 4: Hide Machines in Force Mode (Telekinesis) -->
{#if uiStore.workspace !== 'force'}
	<GhostMachines />
{/if}

<!-- Axis Labels for Debugging - Colored lines with labels -->
<T.Group position={[-3, 0, -3]}>
	<!-- X Axis (Red) - Horizontal, left-right (parallel to floor) -->
	<T.Mesh position={[1, 0, 0]}>
		<T.BoxGeometry args={[2, 0.05, 0.05]} />
		<T.MeshBasicMaterial color="#ff0000" />
	</T.Mesh>
	<T.Mesh position={[2.5, 0, 0]}>
		<T.SphereGeometry args={[0.1, 8, 8]} />
		<T.MeshBasicMaterial color="#ff0000" />
	</T.Mesh>

	<!-- Y Axis (Green) - Vertical, up-down (perpendicular to floor) -->
	<T.Mesh position={[0, 1, 0]}>
		<T.BoxGeometry args={[0.05, 2, 0.05]} />
		<T.MeshBasicMaterial color="#00ff00" />
	</T.Mesh>
	<T.Mesh position={[0, 2.5, 0]}>
		<T.SphereGeometry args={[0.1, 8, 8]} />
		<T.MeshBasicMaterial color="#00ff00" />
	</T.Mesh>

	<!-- Z Axis (Blue) - Depth, forward-backward (parallel to floor) -->
	<T.Mesh position={[0, 0, 1]}>
		<T.BoxGeometry args={[0.05, 0.05, 2]} />
		<T.MeshBasicMaterial color="#0000ff" />
	</T.Mesh>
	<T.Mesh position={[0, 0, 2.5]}>
		<T.SphereGeometry args={[0.1, 8, 8]} />
		<T.MeshBasicMaterial color="#0000ff" />
	</T.Mesh>
</T.Group>

<Sculpture sculpture={sculptureStore.currentSculpture || sculptureStore.ghostSculpture} />

{#if uiStore.view.showBlueprint}
	<BlueprintOverlay />
{/if}

<!-- DIRECTIVE 4: Conditional Visualizers -->
{#if uiStore.workspace === 'force'}
	<ForceVisualizer />
	<ForceParticles />
{:else}
	<AnalysisVisualizer />
{/if}

<!-- Post-Processing Effects (Bloom, Vignette) -->
{#if enablePostProcessing}
	<PostProcessing />
{/if}
