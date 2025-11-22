<script lang="ts">
	import { T } from '@threlte/core';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { recordingStore } from '$lib/stores/recordingStore.svelte';
	import { LatheGeometry, Vector2, Mesh } from 'three';
	import { useTask } from '@threlte/core';
	import type { SculptureDefinition } from '$lib/types';
	import { applyDeformation } from '$lib/engine/physicsMapping';

	let { sculpture } = $props<{ sculpture: SculptureDefinition | null }>();

	// Raw mesh references (managed by bind:ref) to avoid Svelte 5 proxying issues
	// eslint-disable-next-line svelte/valid-compile
	let meshRef: Mesh;
	// eslint-disable-next-line svelte/valid-compile
	let ghostMeshRef: Mesh;

	// Helper function to create geometry from sculpture data
	function createGeometryFromSculpture(sculpture: SculptureDefinition): LatheGeometry | null {
		// 1. Get Base Profile
		let basePoints = sculpture.radiusCurve.map(p => ({ x: p.x, y: p.y }));

		// 2. Apply Deformations (Twist/Compression from sliders)
		if (sculpture.deformation && (sculpture.deformation.twist !== 0 || sculpture.deformation.compression !== 0)) {
			basePoints = applyDeformation(basePoints, sculpture.deformation);
		}

		// 3. Directive 1: Physics Bridge - Live Audio Modulation
		// If recording, modulate the sculpture with live audio
		if (recordingStore.state === 'recording') {
			const frame = analysisStore.latestFrame;
			
			// FALLBACK LOGIC: If worker energy is dead, use the visualizer bypass
			const rawEnergy = frame?.energy || analysisStore.micLevel || 0;
			
			// Apply sensitivity boost (match physicsMapping.ts line 74)
			const energy = rawEnergy * 2.0;
			
			// Radial "breathing" effect - modulate all points uniformly
			const breathScale = 1.0 + (energy * 0.3); // 0-30% radial expansion
			basePoints = basePoints.map(p => ({
				x: p.x * breathScale,
				y: p.y
			}));
		}

		if (basePoints.length < 2) {
			return null;
		}

		// 4. Generate Geometry from deformed + modulated points
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
		if (!sculpture || !meshRef) {
			return;
		}

		// Only update if recording (for live modulation)
		if (recordingStore.state !== 'recording') {
			return;
		}

		const newGeom = createGeometryFromSculpture(sculpture);
		if (newGeom) {
			const oldGeom = meshRef.geometry;
			meshRef.geometry = newGeom;
			if (oldGeom) oldGeom.dispose();
		}
	});

	// Helper function to create ghost geometry
	function createGhostGeometry(ghost: SculptureDefinition): LatheGeometry | null {
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
		const vectorPoints = points.map(p => new Vector2(p.x, p.y));
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
</script>

{#if sculpture}
	<T.Mesh bind:ref={meshRef} castShadow receiveShadow>
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
	<T.Mesh bind:ref={ghostMeshRef}>
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
