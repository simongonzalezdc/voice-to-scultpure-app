<script lang="ts">
	import { T } from '@threlte/core';
	import {
		sculptureStore,
		setMeshReference,
		setInteractionPoint
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
		Vector3,
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
	import { applyModifiers, applyDeformation, generateLathe, generateGlaze } from '$lib/engine/physicsMapping';
	import { applyConstraints } from '$lib/engine/constraints';
	import { appSettings } from '$lib/stores/appSettingsStore.svelte';
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

	// Frame rate limiting for smoother, less jittery updates
	let lastUpdateTime = 0;
	const TARGET_FPS = 30; // 30fps is plenty for a sculpture tool
	const FRAME_TIME = 1000 / TARGET_FPS;

	// COMPOSITOR LOOP
	// Directive 3.2: Call computeProfile in useTask
	useTask((_delta) => {
		if (!sculpture) {
			console.log('⚠️ [SCULPTURE] No sculpture prop provided');
			return;
		}

		// Frame rate limiting - skip frames to maintain target FPS
		const now = Date.now();
		if (now - lastUpdateTime < FRAME_TIME) {
			return; // Skip this frame
		}
		lastUpdateTime = now;

		// Optimization: Only re-compute if layers changed or recording
		const isRecording = recordingStore.state === 'recording';
		const needsUpdate = isRecording || sculptureStore.geometryDirty;

		if (!needsUpdate) return;
		
		try {
			let profile: LathePoint[];
			
			// LIVE RECORDING PREVIEW: Generate geometry from captured frames in real-time
			// CRITICAL: Use ALL frames (no downsampling) so sculpture actually GROWS as you sing
			if (isRecording) {
				const frames = getCapturedFrames();
				if (frames && frames.length > 5) { // Need at least a few frames
					// Pass maxPoints = 0 to use EVERY frame without compression
					// This makes the sculpture grow vertically as you sing longer
					const radiusCurve = generateLathe(
						frames, 
						appSettings.userProfile, 
						uiStore.sculptMode || 'additive', 
						undefined, 
						uiStore.constraintMode,
						'standard',
						'lathe',
						0 // <-- UNLIMITED RESOLUTION: No downsampling during live recording
					);
					
					// Convert to layer data (exactly as stopRecording does)
					const resolution = 128;
					const tempLayerData = new Float32Array(resolution);
					for (let i = 0; i < resolution; i++) {
						const normalizedY = i / (resolution - 1);
						const targetIndex = Math.round(normalizedY * (radiusCurve.length - 1));
						const clampedIndex = Math.min(targetIndex, radiusCurve.length - 1);
						tempLayerData[i] = radiusCurve[clampedIndex].x;
					}
					
					// If we have existing layers, composite with them
					if (sculpture.layers && sculpture.layers.length > 0) {
						// Create temp layer and composite
						const tempLayers = [
							...sculpture.layers,
							{
								id: 'preview-temp',
								name: 'Live Preview',
								type: 'distortion' as const,
								visible: true,
								locked: false,
								blendMode: 'add' as const,
								opacity: 1.0,
								data: tempLayerData,
								mask: new Float32Array(resolution).fill(1.0),
								sourceFrameCount: frames.length
							}
						];
						profile = computeProfile(tempLayers);
					} else {
						// First recording - convert layer data back to LathePoint[]
						profile = Array.from({ length: resolution }, (_, i) => ({
							x: tempLayerData[i],
							y: i / (resolution - 1)
						}));
					}
				} else if (sculpture.layers && sculpture.layers.length > 0) {
					// Not enough frames yet, use existing layers
					profile = computeProfile(sculpture.layers);
				} else {
					// No frames and no layers - skip
					return;
				}
			} else {
				// NOT RECORDING: Use normal layer composition
				if (!sculpture.layers || sculpture.layers.length === 0) {
					// Fallback to legacy radiusCurve
					if (!liveGeometry && sculpture.radiusCurve) {
						const { geometry, vectors } = createGeometryFromProfile(sculpture.radiusCurve);
						lastProfileVectors = vectors;
						liveGeometry = geometry;
					}
					return;
				}
				
				// Check for resolution mismatches
				const resolution = 128;
				for (const layer of sculpture.layers) {
					if (layer.visible && layer.data.length !== resolution) {
						trackError('compositorResolutionMismatch');
					}
				}
				
				// Compute profile from layers
				profile = computeProfile(sculpture.layers);
			}
			
			// GENERATE GEOMETRY from profile
			const { geometry, vectors } = createGeometryFromProfile(profile);
			
			// GENERATE VERTEX COLORS if in glaze mode and recording
			if (isRecording && uiStore.workspace === 'glaze') {
				const frames = getCapturedFrames();
				if (frames && frames.length > 0) {
					const colors = generateGlaze(frames, uiStore.activeGlaze);
					// Apply colors to geometry
					const positions = geometry.getAttribute('position');
					const vertexCount = positions.count;
					const colorArray = new Float32Array(vertexCount * 3);
					
					// Resample colors to match vertex count
					const colorCount = colors.length / 3;
					if (colorCount > 0) {
						for (let i = 0; i < vertexCount; i++) {
							// Map vertex to color by height (Y coordinate)
							const y = positions.getY(i);
							const normalizedHeight = (y + 1) / 2; // Normalize 0-1
							const colorIndex = Math.floor(normalizedHeight * (colorCount - 1));
							const clampedIndex = Math.max(0, Math.min(colorCount - 1, colorIndex));
							
							colorArray[i * 3] = colors[clampedIndex * 3];
							colorArray[i * 3 + 1] = colors[clampedIndex * 3 + 1];
							colorArray[i * 3 + 2] = colors[clampedIndex * 3 + 2];
						}
						geometry.setAttribute('color', new BufferAttribute(colorArray, 3));
					}
				}
			}
			
			// Update state
			lastProfileVectors = vectors;

			// UPDATE MESH
			if (liveGeometry) liveGeometry.dispose();
			liveGeometry = geometry;
			
			sculptureStore.geometryDirty = false; // Mark clean
		} catch (err) {
			console.error("❌ [COMPOSITOR] Failed to compute profile:", err);
			trackError('geometryComputation');
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
		// 1. Apply deformations (twist, compression, taper) first
		let processedProfile = profile;
		if (sculpture?.deformation) {
			processedProfile = applyDeformation(profile, sculpture.deformation);
		}
		
		// 2. Apply constraints if auto-fix is enabled
		// This ensures deformed geometry still meets physical manufacturing limits
		if (uiStore.autoFixGeometry && uiStore.constraintMode !== 'digital') {
			processedProfile = applyConstraints(processedProfile, uiStore.constraintMode);
		}
		
		// 3. Apply modifiers (quantize, symmetry)
		const modifiedProfile = applyModifiers(processedProfile, heightScale, uiStore.modifiers);
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

	// Apply geometry mutations in $effect (side effects belong here, not in $derived)
	// According to Svelte docs: Effects that modify external objects should return cleanup functions
	$effect(() => {
		if (!currentGeometry) return;
		
		// Store reference to geometry for cleanup
		const geometry = currentGeometry;
		
		// Apply symmetry distortion if needed
		applySymmetryDistortion(geometry);
		
		// Apply heatmap colors if we have vectors and view mode is heatmap
		// For live geometry, use lastProfileVectors (updated by useTask)
		// For static geometry, use derivedVectors
		const vectorsToUse = liveGeometry ? lastProfileVectors : derivedVectors;
		if (vectorsToUse.length > 0) {
			applyHeatmapColors(geometry, vectorsToUse);
		}
		
		// Cleanup: Reset geometry attributes if geometry changes
		// This ensures old geometry doesn't retain stale color data
		return () => {
			// Note: Geometry disposal is handled by Three.js/Threlte lifecycle
			// This cleanup runs when dependencies change, ensuring fresh mutations
		};
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

	// Voice-reactive emission (bioluminescence) with smoothing
	let smoothedEmission = $state(0);
	useTask(() => {
		const isRecording = recordingStore.state === 'recording';
		if (isRecording) {
			const targetGlow = Math.max(0, (analysisStore.micLevel - 0.1) * 2.0) * 3.0;
			// Smooth transition with exponential easing (0.15 = slower, less jittery)
			smoothedEmission += (targetGlow - smoothedEmission) * 0.15;
			materialProps.emissiveIntensity = smoothedEmission;
		} else {
			const idlePulse = 0.2 + Math.sin(Date.now() / 1000) * 0.2;
			materialProps.emissiveIntensity = Math.max(0, idlePulse);
		}
		materialProps.emissive = uiStore.activeGlaze.color;
	});

	// Force Mode: Update interaction point based on pitch
	useTask(() => {
		if (uiStore.workspace !== 'force' || !sculpture || !meshRef) {
			setInteractionPoint(null, null);
			return;
		}

		const pitch = analysisStore.latestFrame?.pitch || 0;
		const micLevel = analysisStore.micLevel;

		// Only show target if there's voice input
		if (pitch === 0 || micLevel < 0.05) {
			setInteractionPoint(null, null);
			return;
		}

		// Get the mesh's actual bounding box to know the real Y range
		if (!meshRef.geometry.boundingBox) {
			meshRef.geometry.computeBoundingBox();
		}
		const bbox = meshRef.geometry.boundingBox;
		if (!bbox) {
			setInteractionPoint(null, null);
			return;
		}

		// Map pitch to height (80Hz = bottom, 800Hz = top)
		const MIN_PITCH = 80;
		const MAX_PITCH = 800;
		const normalizedPitch = Math.max(0, Math.min(1, (pitch - MIN_PITCH) / (MAX_PITCH - MIN_PITCH)));
		
		// Map to actual geometry Y range (accounting for transforms)
		const minY = bbox.min.y * heightScale;
		const maxY = bbox.max.y * heightScale;
		const targetY = minY + normalizedPitch * (maxY - minY);
		
		// Find the radius at this height by sampling the geometry
		// Get a ring of vertices at approximately this Y position
		const positions = meshRef.geometry.getAttribute('position');
		let closestRadius = 0.5; // Fallback
		let minYDiff = Infinity;
		
		for (let i = 0; i < positions.count; i++) {
			const y = positions.getY(i) * heightScale; // Apply scale transform
			const yDiff = Math.abs(y - targetY);
			if (yDiff < minYDiff) {
				minYDiff = yDiff;
				const x = positions.getX(i);
				const z = positions.getZ(i);
				closestRadius = Math.sqrt(x * x + z * z); // Radial distance from center
			}
		}
		
		// Place point on the front of the sculpture
		const point = new Vector3(closestRadius, targetY, 0);
		const normal = new Vector3(1, 0, 0); // Normal pointing outward
		
		setInteractionPoint(point, normal);
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
					vertexColors={uiStore.view.mode === 'heatmap' || uiStore.workspace === 'glaze'}
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
