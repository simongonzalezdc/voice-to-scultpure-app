<script lang="ts">
	import { T } from '@threlte/core';
	import { Grid, ContactShadows } from '@threlte/extras';
	import Sculpture from './Sculpture.svelte';
	import AnalysisVisualizer from './AnalysisVisualizer.svelte';
	import OrbitControls from './OrbitControls.svelte';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { appSettings } from '$lib/stores/appSettingsStore.svelte';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	
	// PHASE 2.1: Wire ViewportControls to Scene
	// Lighting controls - Derived from global UI store
	let lightAngle = $derived(uiStore.view.lightingAngle);
	
	// Zoom control via viewport controls - map zoom (0.5-3.0) to camera FOV (20-80)
	// Higher zoom = lower FOV (more zoomed in), Lower zoom = higher FOV (more zoomed out)
	let cameraFOV = $derived(80 - (uiStore.view.zoom - 0.5) * 30);
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

<Sculpture sculpture={sculptureStore.currentSculpture || sculptureStore.ghostSculpture} />
<AnalysisVisualizer />
