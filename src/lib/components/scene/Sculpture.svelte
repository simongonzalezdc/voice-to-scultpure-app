<script lang="ts">
	import { T } from '@threlte/core';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { recordingStore, getCapturedFrames } from '$lib/stores/recording.svelte';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { appSettings } from '$lib/stores/appSettingsStore.svelte';
	import { LatheGeometry, Vector2, Mesh } from 'three';
	import { useTask } from '@threlte/core';
	import { spring } from 'svelte/motion';
	import type { SculptureDefinition } from '$lib/types';
	import { applyDeformation, generateLathe } from '$lib/engine/physicsMapping';

	let { sculpture } = $props<{ sculpture: SculptureDefinition | null }>();

	// Raw mesh references (managed by bind:ref) to avoid Svelte 5 proxying issues
	// eslint-disable-next-line svelte/valid-compile
	let meshRef: Mesh;
	// eslint-disable-next-line svelte/valid-compile
	let ghostMeshRef: Mesh;
	// eslint-disable-next-line svelte/valid-compile
	let liveMeshRef: Mesh;

	// Helper function to create geometry from sculpture data
	// DIRECTIVE 1: NEVER destructively modify sculpture.radiusCurve
	function createGeometryFromSculpture(sculpture: SculptureDefinition): LatheGeometry | null {
		// Safety check
		if (!sculpture.radiusCurve || !Array.isArray(sculpture.radiusCurve) || sculpture.radiusCurve.length === 0) {
			return null;
		}

		// 1. START WITH BASE - Create a copy, never overwrite original
		let basePoints = sculpture.radiusCurve.map(p => ({ x: p.x, y: p.y }));

		// 2. Apply Deformations (Twist/Compression from sliders) - on the COPY
		if (sculpture.deformation && (sculpture.deformation.twist !== 0 || sculpture.deformation.compression !== 0)) {
			basePoints = applyDeformation(basePoints, sculpture.deformation);
		}

	// 3. Physics Bridge - Live Audio Modulation (BREATHING EFFECT)
	// If recording, modulate the sculpture with live audio
	if (recordingStore.state === 'recording') {
		const frame = analysisStore.latestFrame;
		
		// FALLBACK LOGIC: If worker energy is dead, use the visualizer bypass
		const rawEnergy = frame?.energy || analysisStore.micLevel || 0;
		
		// Apply sensitivity boost (match physicsMapping.ts line 74)
		const energy = rawEnergy * 2.0;
		
		// Radial "breathing" effect - modulate all points uniformly (compression is a multiplier)
		const breathScale = 1.0 + (energy * 0.3); // 0-30% radial expansion
		basePoints = basePoints.map(p => ({
			x: p.x * breathScale,
			y: p.y
		}));
	}
	
	// NOTE: Height scaling is applied at the T.Group transform level (scale={[1, heightScale, 1]})
	// NOT here in the geometry, to avoid double-scaling (heightScale²)

		// 5. Add Roughness-based Geometry Displacement
		// DIRECTIVE 2: Roughness is achieved through geometry noise, not texture maps
		// Use textureRoughness from slider (0-1) to control displacement amount
		const roughness = sculpture.surface.textureRoughness || 0;
		
		// Scale roughness effect - 0.1 is maximum noise amplitude
		const noiseScale = 0.1; 
		
		if (roughness > 0) {
			basePoints = basePoints.map((p, i) => ({
				x: p.x + (Math.random() - 0.5) * roughness * noiseScale,
				y: p.y
			}));
		}

		if (basePoints.length < 2) {
			return null;
		}

		// 6. Generate Geometry from final deformed + modulated + displaced points
		const vectors = basePoints.map(p => new Vector2(p.x, p.y));
		return new LatheGeometry(vectors, 32);
	}

	// Create geometry immediately when meshRef is bound and sculpture exists
	$effect(() => {
		if (!sculpture || !meshRef) {
			return;
		}

		const newGeom = createGeometryFromSculpture(sculpture);
		if (newGeom) {
			const oldGeom = meshRef.geometry;
			meshRef.geometry = newGeom;
			if (oldGeom) oldGeom.dispose();
		}
	});

	// Update geometry in render loop for live audio modulation
	useTask(() => {
		if (recordingStore.state === 'recording') {
			// Live Visualization: Update Live Mesh
			const frames = getCapturedFrames();
			if (frames.length > 0 && liveMeshRef) {
				// Generate geometry on the fly from current frames
				const profile = generateLathe(frames, appSettings.userProfile);
				
				// ISSUE 1 FIX: Crash Guard - Filter out undefined/invalid points before mapping
				if (!profile || profile.length === 0) return;
				const validProfile = profile.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
				if (validProfile.length < 2) return;
				
				const vectors = validProfile.map(p => new Vector2(p.x, p.y));
				const newGeom = new LatheGeometry(vectors, 32);
				
				const oldGeom = liveMeshRef.geometry;
				liveMeshRef.geometry = newGeom;
				if (oldGeom) oldGeom.dispose();
			}
		} else if (sculpture && meshRef) {
			// Modulate existing sculpture if needed (breathing effect)
			// Only need to re-run if we want the breathing effect on the *static* sculpture during playback
			// Currently createGeometryFromSculpture handles this if state is 'recording', but 
			// if we are using the separate Live Mesh, we might not need this block.
		}
	});

	// Helper function to create ghost geometry
	function createGhostGeometry(ghost: SculptureDefinition): LatheGeometry | null {
		// Safety check
		if (!ghost.radiusCurve || !Array.isArray(ghost.radiusCurve) || ghost.radiusCurve.length === 0) {
			return null;
		}

		// 1. Get Base Points
		let points = ghost.radiusCurve.map(p => ({ x: p.x, y: p.y }));

		// 2. Directive 2: Apply Deformations using consistent helper
		if (ghost.deformation && (ghost.deformation.twist !== 0 || ghost.deformation.compression !== 0)) {
			points = applyDeformation(points, ghost.deformation);
		}

		if (points.length < 2) {
			return null;
		}

		// 3. Create geometry from deformed points
		// ISSUE 1 FIX: Crash Guard - Ensure all points are valid before mapping
		const validPoints = points.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
		if (validPoints.length < 2) {
			return null;
		}
		
		const vectorPoints = validPoints.map(p => new Vector2(p.x, p.y));
		return new LatheGeometry(vectorPoints, 32);
	}

	// Create ghost geometry immediately when ghostMeshRef is bound
	$effect(() => {
		const ghost = sculptureStore.ghostSculpture;
		if (!ghost || !ghostMeshRef) {
			// Clean up ghost mesh geometry if no ghost sculpture
			if (ghostMeshRef && ghostMeshRef.geometry) {
				ghostMeshRef.geometry.dispose();
			}
			return;
		}

		const newGhostGeom = createGhostGeometry(ghost);
		if (newGhostGeom) {
			const oldGeom = ghostMeshRef.geometry;
			ghostMeshRef.geometry = newGhostGeom;
			if (oldGeom) oldGeom.dispose();
		}
	});

	// Helper to interpolate color
	function lerpColor(colorA: string, colorB: string, t: number): string {
		const c1 = parseInt(colorA.slice(1), 16);
		const c2 = parseInt(colorB.slice(1), 16);
		
		const r1 = (c1 >> 16) & 255;
		const g1 = (c1 >> 8) & 255;
		const b1 = c1 & 255;
		
		const r2 = (c2 >> 16) & 255;
		const g2 = (c2 >> 8) & 255;
		const b2 = c2 & 255;
		
		const r = Math.round(r1 + (r2 - r1) * t);
		const g = Math.round(g1 + (g2 - g1) * t);
		const b = Math.round(b1 + (b2 - b1) * t);
		
		return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
	}

	// Material Configuration
	const CLAY_COLOR_DEFAULT = '#E0C9A6';
	const PORCELAIN_COLOR = '#FFFFFF';
	
	// Derived material properties based on material type
	let isPlastic = $derived(sculpture?.surface.materialType === 'plastic');
	
	// Color Logic:
	// Ceramic: Blend between Clay and Porcelain based on Glaze Transmission
	// Plastic: Use baseColor or default to white, Glaze adds gloss
	let materialColor = $derived.by(() => {
		if (!sculpture) return PORCELAIN_COLOR;
		
		if (isPlastic) {
			return sculpture.surface.baseColor || '#3080ff'; // Default plastic blue
		}
		
		// Ceramic Logic
		const base = sculpture.surface.baseColor || CLAY_COLOR_DEFAULT;
		// If glaze is high, we see more of the glaze (white/glass) or the underlying clay?
		// Actually, glaze usually adds a layer. If clear glaze, we see clay. If colored glaze, we see glaze.
		// Current simple logic: Interpolate to White (Porcelain look) as glaze increases
		return lerpColor(base, PORCELAIN_COLOR, sculpture.surface.glazeTransmission);
	});

	let ghostMaterialColor = $derived(sculptureStore.ghostSculpture 
		? lerpColor(CLAY_COLOR_DEFAULT, PORCELAIN_COLOR, sculptureStore.ghostSculpture.surface.glazeTransmission)
		: '#8F3E48'
	);
</script>

<!-- DIRECTIVE 1: Parent Rig - Unified Hierarchy for Main + Ghost
     Both meshes are siblings inside the same parent T.Group that receives scale and rotation.
     This ensures perfect 1:1 matching - no more "Matcha Whisk" artifact.
     
     DIRECTIVE 2: Axis Anchoring - Proper rotation pivot at origin (0,0,0)
     LatheGeometry generates around Y-axis with base at y=0.
     Rotating around Z-axis by -Math.PI/2 pivots at origin, laying geometry flat along X-axis.
     Pottery (Vertical): rotation [0, 0, 0] - base sits at y=0
     Lathe (Horizontal): rotation [0, 0, -Math.PI/2] - base sits at x=0, extends along X-axis
-->
<svelte:fragment>
	{@const heightScale = sculpture?.physical.height ? sculpture.physical.height / 150 : 1}
	{@const orientationRotation = uiStore.orientation === 'horizontal' ? -Math.PI / 2 : 0}
	<!-- Parent Rig: All transforms applied here ensure Main and Ghost match perfectly -->
	<T.Group rotation={[0, 0, orientationRotation]} scale={[1, heightScale, 1]} position={[0, 0, 0]}>
	<!-- Main Sculpture (Only visible if not recording) -->
	{#if sculpture && recordingStore.state !== 'recording'}
		<T.Mesh bind:ref={meshRef} castShadow receiveShadow>
			<!-- Material Switching -->
			{#if isPlastic}
				<!-- Plastic: Standard Material (shiny, plastic look) -->
				<T.MeshStandardMaterial
					color={materialColor}
					roughness={sculpture.surface.textureRoughness}
					metalness={0.1}
					flatShading={false}
				/>
			{:else}
				<!-- Ceramic: Physical Material (transmission, clearcoat) -->
				<T.MeshPhysicalMaterial
					transmission={sculpture.surface.glazeTransmission * 0.8} 
					thickness={0.5}
					roughness={sculpture.surface.textureRoughness}
					clearcoat={Math.max(0, sculpture.surface.glazeTransmission)}
					clearcoatRoughness={0.1}
					color={materialColor}
					metalness={0.1}
					ior={1.5}
					envMapIntensity={1.0}
				/>
			{/if}
		</T.Mesh>
	{/if}

	<!-- Live Sculpture (Visible ONLY during recording) -->
	{#if recordingStore.state === 'recording'}
		<T.Mesh bind:ref={liveMeshRef} castShadow receiveShadow>
			<!-- Live Material: Ghostly/Holographic representation of the incoming voice -->
			<T.MeshPhysicalMaterial
				color="#ff4081"
				emissive="#ff4081"
				emissiveIntensity={0.2}
				transmission={0.6}
				thickness={0.2}
				roughness={0.4}
				clearcoat={0.5}
				wireframe={false}
			/>
		</T.Mesh>
	{/if}

	<!-- Ghost Mesh - Now sibling to Main Mesh, shares parent scale/rotation -->
	<!-- DIRECTIVE 1 FIX: Ghost is now inside parent rig with main mesh (no more matcha whisk!) -->
	<!-- DIRECTIVE 3 FIX: Ghost material now subtle - transparent, low opacity, wireframe blueprint style -->
	{#if sculptureStore.ghostSculpture}
		<T.Mesh bind:ref={ghostMeshRef}>
			<T.MeshPhysicalMaterial
				color={ghostMaterialColor}
				opacity={0.15}
				transparent={true}
				wireframe={true}
				transmission={0}
				roughness={0.9}
				metalness={0}
			/>
		</T.Mesh>
	{/if}
	</T.Group>
</svelte:fragment>
