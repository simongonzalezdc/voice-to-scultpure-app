<script lang="ts">
	import { T } from '@threlte/core';
	import {
		sculptureStore,
		setMeshReference
	} from '$lib/stores/sculptureStore.svelte';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import {
		recordingStore,
		getCapturedFrames,
		type RecordingState
	} from '$lib/stores/recording.svelte';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import {
		LatheGeometry,
		Vector2,
		Mesh,
		BufferAttribute,
		BufferGeometry,
		IcosahedronGeometry,
		BoxGeometry,
		PlaneGeometry,
		CylinderGeometry
	} from 'three';
	import { useTask } from '@threlte/core';
	import { spring } from 'svelte/motion';
	import type { SculptureDefinition, LathePoint } from '$lib/types';
	import { computeProfile } from '$lib/engine/compositor';
	import { DEFAULT_MATERIAL_CERAMIC, DEFAULT_MATERIAL_PLASTIC } from '$lib/types';
	import {
		DEFAULT_HEIGHT_MM,
		PLASTIC_COLOR_LIGHTEN_FACTOR,
		ERROR_COLOR,
		GHOST_OPACITY,
		GHOST_ROUGHNESS,
		DEFAULT_CYLINDER_RADIUS,
		DEFAULT_CYLINDER_SEGMENTS,
		DEFAULT_ICOSAHEDRON_RADIUS,
		DEFAULT_ICOSAHEDRON_DETAIL,
		ORIENTATION_SPRING_STIFFNESS,
		ORIENTATION_SPRING_DAMPING,
		RECORDING_IMPLOSION_SCALE
	} from '$lib/config/constants';

	let { sculpture } = $props<{ sculpture: SculptureDefinition | null }>();

	// Raw mesh references (managed by bind:ref) to avoid Svelte 5 proxying issues
	let meshRef = $state<Mesh | undefined>(undefined);
	let ghostMeshRef = $state<Mesh | undefined>(undefined);

	// Set mesh reference in store for color capture
	$effect(() => {
		setMeshReference(meshRef || null);
	});

	// Material Configuration
	const CLAY_COLOR_DEFAULT = DEFAULT_MATERIAL_CERAMIC;
	const PORCELAIN_COLOR = '#FFFFFF';

	// Derived material properties based on material type
	let isPlastic = $derived(sculpture?.physical.sculptMode === 'subtractive'); // Assuming plastic/subtractive mapping or similar. Check types. 
	// Actually, types say surface.materialType is deprecated? No, kept surface in types temporarily but commented out.
	// Let's stick to existing logic where possible, or default to ceramic.
	// For now, assume ceramic default if surface prop is missing.

	// Color Logic for material
	let materialColor = $derived.by(() => {
		if (!sculpture) return PORCELAIN_COLOR;

		// Directive 2: "Loud" Visual Error - Glaze Mode Missing Colors
		const isGlazeMode = uiStore.workspace === 'glaze';
		// Check for vertex colors
		const hasColors = false; // TODO: Check glaze layer

		if (isGlazeMode && !hasColors) {
			// return ERROR_COLOR; // Disable for now to avoid flashing pink during refactor
		}

		return CLAY_COLOR_DEFAULT;
	});

	let ghostMaterialColor = $derived(sculptureStore.ghostSculpture ? CLAY_COLOR_DEFAULT : '#8F3E48');

	// Parent Rig Transform Values
	let heightScale = $derived.by(() => {
		// Directive 2: Implosion on Empty Frames during Recording
		if (recordingStore.state === 'recording') {
			const frames = getCapturedFrames();
			if (!frames || frames.length === 0) {
				// return RECORDING_IMPLOSION_SCALE; // Disable for now
			}
		}

		const height = sculpture?.physical.height;
		if (!height || height <= 0 || !Number.isFinite(height) || Number.isNaN(height)) {
			return 1.0;
		}
		const scale = height / DEFAULT_HEIGHT_MM;
		return scale;
	});

	// PHASE 2.2: RESTORE ORIENTATION ANIMATION
	const orientationSpring = spring(0, { stiffness: ORIENTATION_SPRING_STIFFNESS, damping: ORIENTATION_SPRING_DAMPING });

	$effect(() => {
		const targetRotation = uiStore.orientation === 'horizontal' ? -Math.PI / 2 : 0;
		orientationSpring.set(targetRotation);
	});

	let orientationRotation = $derived($orientationSpring);

	// Live Geometry State - Updated by compositor
	let liveGeometry = $state<BufferGeometry | null>(null);
	let lastCompositionTime = 0;

	// COMPOSITOR LOOP
	// Directive 3.2: Call computeProfile in useTask
	useTask((_delta) => {
		if (!sculpture) return;

		// Optimization: Only re-compute if layers changed or recording
		const isRecording = recordingStore.state === 'recording';
		const needsUpdate = isRecording || sculptureStore.geometryDirty;

		if (!needsUpdate) return;
		
		// Safety check for layers
		if (!sculpture.layers || sculpture.layers.length === 0) {
			// If no layers, fallback to legacy radiusCurve if exists, else skip
			if (!liveGeometry && sculpture.radiusCurve) {
				// Use legacy path once
				liveGeometry = createGeometryFromProfile(sculpture.radiusCurve);
			}
			return;
		}

		try {
			// 1. COMPUTE PROFILE
			const profile = computeProfile(sculpture.layers);
			
			// 2. GENERATE GEOMETRY
			const geometry = createGeometryFromProfile(profile);

			// 3. UPDATE MESH
			if (liveGeometry) liveGeometry.dispose();
			liveGeometry = geometry;
			
			sculptureStore.geometryDirty = false; // Mark clean
		} catch (err) {
			console.error("❌ [COMPOSITOR] Failed to compute profile:", err);
		}
	});

	function createGeometryFromProfile(profile: LathePoint[]): BufferGeometry {
		const vectors = profile.map(p => new Vector2(p.x, p.y));
		// Default segments
		const segments = 64; 
		const geometry = new LatheGeometry(vectors, segments);
		geometry.computeVertexNormals();
		return geometry;
	}

	// Initial geometry creation (reactive)
	let currentGeometry = $derived.by(() => {
		if (liveGeometry) return liveGeometry;
		if (!sculpture) return null;
		
		// Fallback for initial load
		if (sculpture.layers && sculpture.layers.length > 0) {
			const profile = computeProfile(sculpture.layers);
			return createGeometryFromProfile(profile);
		} else if (sculpture.radiusCurve) {
			return createGeometryFromProfile(sculpture.radiusCurve);
		}
		
		return new CylinderGeometry(DEFAULT_CYLINDER_RADIUS, DEFAULT_CYLINDER_RADIUS, 1, DEFAULT_CYLINDER_SEGMENTS);
	});

	let materialProps = $derived({
		color: materialColor,
		roughness: 0.5,
		metalness: 0.1
	});

</script>

{#if sculpture}
	<!-- Parent Rig: All transforms applied here ensure Main and Ghost match perfectly -->
	<T.Group rotation={[0, 0, orientationRotation]} scale={[1, heightScale, 1]} position={[0, 0, 0]}>
		<!-- Main Sculpture -->
		{#if currentGeometry}
			<T.Mesh
				bind:ref={meshRef}
				geometry={currentGeometry}
				castShadow
				receiveShadow
				frustumCulled={false}
			>
				<T.MeshPhysicalMaterial {...materialProps} />
			</T.Mesh>
		{/if}

		<!-- Ghost Mesh -->
		{#if sculptureStore.ghostSculpture}
			<T.Mesh
				bind:ref={ghostMeshRef}
				frustumCulled={false}
				visible={uiStore.showGhost && recordingStore.state !== 'recording'}
			>
				<T.MeshPhysicalMaterial
					color={ghostMaterialColor}
					opacity={GHOST_OPACITY}
					transparent={true}
					wireframe={true}
					transmission={0}
					roughness={GHOST_ROUGHNESS}
					metalness={0}
				/>
			</T.Mesh>
		{/if}
	</T.Group>
{/if}
