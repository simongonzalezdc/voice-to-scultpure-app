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
	import { applyModifiers } from '$lib/engine/physicsMapping';
	import { calculateStressColors } from '$lib/engine/analysis';
	import { trackError } from '$lib/stores/metricsStore.svelte';
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
	let lastProfileVectors = $state<Vector2[]>([]);

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
				const { geometry, vectors } = createGeometryFromProfile(sculpture.radiusCurve);
				lastProfileVectors = vectors;
				liveGeometry = geometry;
			}
			return;
		}

		try {
			// Check for resolution mismatches before computing (track errors here, not in pure function)
			const resolution = 128;
			for (const layer of sculpture.layers) {
				if (layer.visible && layer.data.length !== resolution) {
					trackError('compositorResolutionMismatch');
				}
			}
			
			// 1. COMPUTE PROFILE (pure function, no side effects)
			const profile = computeProfile(sculpture.layers);
			
			// 2. GENERATE GEOMETRY (pure function, no side effects)
			const { geometry, vectors } = createGeometryFromProfile(profile);
			
			// 3. Update state outside of derived context
			lastProfileVectors = vectors;

			// 4. UPDATE MESH
			if (liveGeometry) liveGeometry.dispose();
			liveGeometry = geometry;
			
			sculptureStore.geometryDirty = false; // Mark clean
		} catch (err) {
			console.error("❌ [COMPOSITOR] Failed to compute profile:", err);
			trackError('geometryComputation');
			// Check if it's a state mutation error
			if (err instanceof Error && err.message.includes('state_unsafe_mutation')) {
				trackError('stateUnsafeMutation');
			}
		}
	});

	/**
	 * Pure function: Creates geometry from profile without side effects
	 * Returns both geometry and vectors for use by callers
	 */
	function createGeometryFromProfile(profile: LathePoint[]): { geometry: BufferGeometry; vectors: Vector2[] } {
		const modifiedProfile = applyModifiers(profile, heightScale, uiStore.modifiers);
		const vectors = modifiedProfile.map((p) => new Vector2(p.x, p.y));
		// Default segments
		const segments = 64; 
		const geometry = new LatheGeometry(vectors, segments);
		// Note: Geometry mutations (symmetry, heatmap) are now handled in $effect
		geometry.computeVertexNormals();
		return { geometry, vectors };
	}

	function applySymmetryDistortion(geometry: BufferGeometry): void {
		const lobes = uiStore.modifiers.symmetryCount;
		if (!lobes) return;

		const position = geometry.getAttribute('position');
		for (let i = 0; i < position.count; i++) {
			const x = position.getX(i);
			const z = position.getZ(i);
			const angle = Math.atan2(z, x);
			const distortion = 1.0 + Math.sin(angle * lobes) * 0.2;
			position.setX(i, x * distortion);
			position.setZ(i, z * distortion);
		}
		position.needsUpdate = true;
	}

	function applyHeatmapColors(geometry: BufferGeometry, vectors: Vector2[]): void {
		if (uiStore.view.mode !== 'heatmap') {
			if (geometry.getAttribute('color')) {
				geometry.deleteAttribute('color');
			}
			return;
		}

		const stressColors = calculateStressColors(vectors);
		if (!stressColors.length) return;

		const pointsPerRing = vectors.length;
		const segments = (geometry as any).parameters?.segments ?? 0;
		const rings = (segments || 0) + 1;

		const colors = new Float32Array(pointsPerRing * rings * 3);
		for (let ring = 0; ring < rings; ring++) {
			for (let i = 0; i < pointsPerRing; i++) {
				const stressIndex = Math.min(Math.max(i - 1, 0), stressColors.length / 3 - 1);
				const sourceIndex = stressIndex * 3;
				const target = (ring * pointsPerRing + i) * 3;
				colors[target] = stressColors[sourceIndex];
				colors[target + 1] = stressColors[sourceIndex + 1];
				colors[target + 2] = stressColors[sourceIndex + 2];
			}
		}

		geometry.setAttribute('color', new BufferAttribute(colors, 3));
	}

	// Initial geometry creation (reactive, but pure - no side effects)
	let currentGeometry = $derived.by(() => {
		if (liveGeometry) return liveGeometry;
		if (!sculpture) return null;
		
		// Fallback for initial load
		if (sculpture.layers && sculpture.layers.length > 0) {
			const profile = computeProfile(sculpture.layers);
			const { geometry } = createGeometryFromProfile(profile);
			return geometry;
		} else if (sculpture.radiusCurve) {
			const { geometry } = createGeometryFromProfile(sculpture.radiusCurve);
			return geometry;
		}
		
		return new CylinderGeometry(DEFAULT_CYLINDER_RADIUS, DEFAULT_CYLINDER_RADIUS, 1, DEFAULT_CYLINDER_SEGMENTS);
	});

	// Compute vectors for derived geometry (needed for heatmap colors)
	// This is pure - no state mutation
	let derivedVectors = $derived.by((): Vector2[] => {
		if (liveGeometry) return lastProfileVectors; // Use vectors from useTask
		if (!sculpture) return [];
		
		// Compute vectors for derived geometry
		if (sculpture.layers && sculpture.layers.length > 0) {
			const profile = computeProfile(sculpture.layers);
			const modifiedProfile = applyModifiers(profile, heightScale, uiStore.modifiers);
			return modifiedProfile.map((p) => new Vector2(p.x, p.y));
		} else if (sculpture.radiusCurve) {
			const modifiedProfile = applyModifiers(sculpture.radiusCurve, heightScale, uiStore.modifiers);
			return modifiedProfile.map((p) => new Vector2(p.x, p.y));
		}
		
		return [];
	});

	// Update lastProfileVectors when vectors change (for heatmap colors)
	// This must be in $effect, not $derived, because it mutates state
	$effect(() => {
		if (derivedVectors.length > 0) {
			lastProfileVectors = derivedVectors;
		}
	});

	// Apply geometry mutations in $effect (side effects belong here, not in $derived)
	$effect(() => {
		if (!currentGeometry) return;
		
		// Apply symmetry distortion if needed
		applySymmetryDistortion(currentGeometry);
		
		// Apply heatmap colors if we have vectors and view mode is heatmap
		// Use derivedVectors which is always up-to-date
		const vectorsToUse = liveGeometry ? lastProfileVectors : derivedVectors;
		if (vectorsToUse.length > 0) {
			applyHeatmapColors(currentGeometry, vectorsToUse);
		}
	});

	let materialProps = $state({
		color: DEFAULT_MATERIAL_CERAMIC,
		roughness: 0.5,
		metalness: 0.1,
		emissive: uiStore.activeGlaze.color,
		emissiveIntensity: 0
	});

	$effect(() => {
		materialProps.color = materialColor;
		materialProps.roughness = uiStore.activeGlaze.roughness ?? 0.5;
		materialProps.emissive = uiStore.activeGlaze.color;
	});

	// Voice-reactive emission (bioluminescence)
	useTask(() => {
		const isRecording = recordingStore.state === 'recording';
		if (isRecording) {
			const glow = Math.max(0, (analysisStore.micLevel - 0.1) * 2.0);
			materialProps.emissiveIntensity = glow * 3.0;
		} else {
			const idlePulse = 0.2 + Math.sin(Date.now() / 1000) * 0.2;
			materialProps.emissiveIntensity = Math.max(0, idlePulse);
		}
		materialProps.emissive = uiStore.activeGlaze.color;
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
				<T.MeshPhysicalMaterial
					{...materialProps}
					transparent={uiStore.view.mode === 'xray'}
					opacity={uiStore.view.mode === 'xray' ? 0.3 : 1.0}
					wireframe={uiStore.view.mode === 'wireframe'}
					vertexColors={uiStore.view.mode === 'heatmap'}
				/>
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
