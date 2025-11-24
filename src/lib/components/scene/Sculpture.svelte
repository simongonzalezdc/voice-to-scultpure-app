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
	import { generateLathe, generateGlaze } from '$lib/engine/physicsMapping';
	import { appSettings } from '$lib/stores/appSettingsStore.svelte';
	import { calculateStressColors } from '$lib/engine/analysis';
	import { trackError } from '$lib/stores/metricsStore.svelte';
	import { DEFAULT_MATERIAL_CERAMIC, DEFAULT_MATERIAL_PLASTIC } from '$lib/types';
	import {
		DEFAULT_HEIGHT_MM,
		GHOST_OPACITY,
		GHOST_ROUGHNESS,
		DEFAULT_CYLINDER_RADIUS,
		DEFAULT_CYLINDER_SEGMENTS,
		DEFAULT_ICOSAHEDRON_RADIUS,
		DEFAULT_ICOSAHEDRON_DETAIL,
		ORIENTATION_SPRING_STIFFNESS,
		ORIENTATION_SPRING_DAMPING,
		RECORDING_IMPLOSION_SCALE,
		COMPOSITOR_TARGET_FPS,
		COMPOSITOR_FRAME_TIME_MS,
		GEOMETRY_LATHE_SEGMENTS,
		GEOMETRY_RESOLUTION_COMPOSITOR,
		VOICE_REACTION_GLOW_BASE,
		VOICE_REACTION_GLOW_MULTIPLIER,
		EMISSION_SMOOTHING_FACTOR,
		VOICE_REACTION_IDLE_PULSE_BASE,
		VOICE_REACTION_IDLE_PULSE_AMPLITUDE,
		FORCE_MODE_PITCH_MIN_HZ,
		FORCE_MODE_PITCH_MAX_HZ,
		FORCE_MODE_MIC_LEVEL_THRESHOLD,
		FORCE_MODE_FALLBACK_RADIUS
	} from '$lib/config/constants';
	import {
		createGeometryFromProfile,
		applySymmetryDistortion,
		applyHeatmapColors,
		applyGlazeColors,
		safeDisposeGeometry,
		createFallbackGeometry,
		deriveProfileWithTransforms
	} from '$lib/engine/geometryFactory';
	import {
		deriveMaterialColor,
		deriveGhostMaterialColor,
		createBaseMaterialProps,
		updateMaterialForViewMode,
		updateMaterialForGlazeMode,
		calculateSmoothedEmission,
		deriveEmissiveIntensity,
		createGhostMaterialProps,
		type MaterialProps
	} from '$lib/engine/materialFactory';

	let { sculpture } = $props<{ sculpture: SculptureDefinition | null }>();

	// Raw mesh references (managed by bind:ref) to avoid Svelte 5 proxying issues
	let meshRef = $state<Mesh | undefined>(undefined);
	let ghostMeshRef = $state<Mesh | undefined>(undefined);

	// Buffer Pooling to prevent GC thrashing
	let colorBuffer: Float32Array | null = null;
	let heatmapBuffer: Float32Array | null = null;

	// Set mesh reference in store for color capture
	$effect(() => {
		setMeshReference(meshRef || null);
	});

	// Material Configuration
	const CLAY_COLOR_DEFAULT = DEFAULT_MATERIAL_CERAMIC;

	// Derived material properties based on material type
	let isPlastic = $derived(sculpture?.physical.sculptMode === 'subtractive');

	// Color Logic for material
	let materialColor = $derived.by(() => {
		if (!sculpture) return CLAY_COLOR_DEFAULT;

		const isGlazeMode = uiStore.workspace === 'glaze';
		const hasColors = false; // TODO: Check glaze layer (non-empty glaze vertices)

		return deriveMaterialColor(isGlazeMode, hasColors, isPlastic);
	});

	let ghostMaterialColor = $derived(deriveGhostMaterialColor(!!sculptureStore.ghostSculpture));

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

	// COMPOSITOR LOOP
	// Directive 3.2: Call computeProfile in useTask
	useTask((_delta) => {
		if (!sculpture) {
			console.log('⚠️ [SCULPTURE] No sculpture prop provided');
			return;
		}

		// Frame rate limiting - skip frames to maintain target FPS
		const now = Date.now();
		if (now - lastUpdateTime < COMPOSITOR_FRAME_TIME_MS) {
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
					const tempLayerData = new Float32Array(GEOMETRY_RESOLUTION_COMPOSITOR);
					for (let i = 0; i < GEOMETRY_RESOLUTION_COMPOSITOR; i++) {
						const normalizedY = i / (GEOMETRY_RESOLUTION_COMPOSITOR - 1);
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
								mask: new Float32Array(GEOMETRY_RESOLUTION_COMPOSITOR).fill(1.0),
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
				for (const layer of sculpture.layers) {
					if (layer.visible && layer.data.length !== GEOMETRY_RESOLUTION_COMPOSITOR) {
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
					const requiredSize = vertexCount * 3;
					
					// Buffer Pooling: Reuse buffer if size matches
					if (!colorBuffer || colorBuffer.length !== requiredSize) {
						colorBuffer = new Float32Array(requiredSize);
					}
					const colorArray = colorBuffer;
					
					// Resample colors to match vertex count
					const colorCount = colors.length / 3;
					if (colorCount > 0) {
						for (let i = 0; i < vertexCount; i++) {
							// Map vertex to color by height (Y coordinate)
							const y = positions.getY(i);
							const normalizedHeight = (y + 1) / 2; // Normalize 0-1
							const colorIndex = Math.floor(normalizedHeight * (colorCount - 1));
							const clampedIndex = Math.max(0, Math.min(colorCount - 1, colorIndex));
							
							colorArray[i * 3] = colors[clampedIndex * 3] ?? 0;
							colorArray[i * 3 + 1] = colors[clampedIndex * 3 + 1] ?? 0;
							colorArray[i * 3 + 2] = colors[clampedIndex * 3 + 2] ?? 0;
						}
						geometry.setAttribute('color', new BufferAttribute(colorArray, 3));
					}
				}
			}
			
			// Update state
			lastProfileVectors = vectors;

			// UPDATE MESH
			try {
				if (liveGeometry) liveGeometry.dispose();
			} catch (err) {
				console.warn('⚠️ [SCULPTURE] Geometry disposal failed:', err);
			}
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

		try {
			const geometry = currentGeometry;

			// Apply symmetry distortion if needed
			applySymmetryDistortion(geometry, uiStore.modifiers.symmetryCount);

			// Apply heatmap colors if we have vectors and view mode is heatmap
			const vectorsToUse = liveGeometry ? lastProfileVectors : derivedVectors;
			if (vectorsToUse.length > 0 && uiStore.view.mode === 'heatmap') {
				const stressColors = calculateStressColors(vectorsToUse);
				if (stressColors && stressColors.length > 0) {
					heatmapBuffer = applyHeatmapColors(geometry, vectorsToUse, stressColors, heatmapBuffer) ?? heatmapBuffer;
				}
			} else if (geometry.getAttribute('color')) {
				geometry.deleteAttribute('color');
			}
		} catch (err) {
			console.warn('⚠️ [SCULPTURE] Geometry mutation failed (non-fatal):', err);
		}

		return () => {
			// Cleanup: Reset geometry attributes if geometry changes
		};
	});

	let materialProps = $state<MaterialProps>(
		createBaseMaterialProps(DEFAULT_MATERIAL_CERAMIC, uiStore.activeGlaze.color, uiStore.activeGlaze.roughness ?? 0.5)
	);

	$effect(() => {
		// Update base properties
		materialProps.color = materialColor;
		materialProps.roughness = uiStore.activeGlaze.roughness ?? 0.5;
		materialProps.emissive = uiStore.activeGlaze.color;

		// Apply view mode transformations
		const viewUpdated = updateMaterialForViewMode(materialProps, uiStore.view.mode);

		// Apply glaze mode transformations
		const glazeUpdated = updateMaterialForGlazeMode(
			viewUpdated,
			recordingStore.state === 'recording',
			uiStore.workspace === 'glaze',
			false // TODO: Check if geometry has vertex colors
		);

		Object.assign(materialProps, glazeUpdated);
	});

	// Voice-reactive emission (bioluminescence) with smoothing
	let smoothedEmission = $state(0);
	useTask(() => {
		const isRecording = recordingStore.state === 'recording';
		if (isRecording) {
			const targetGlow = Math.max(0, (analysisStore.micLevel - VOICE_REACTION_GLOW_BASE) * VOICE_REACTION_GLOW_MULTIPLIER) * VOICE_REACTION_GLOW_MULTIPLIER;
			smoothedEmission = calculateSmoothedEmission(smoothedEmission, targetGlow, EMISSION_SMOOTHING_FACTOR);
			materialProps.emissiveIntensity = smoothedEmission;
		} else {
			materialProps.emissiveIntensity = deriveEmissiveIntensity(false, 0);
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
		if (pitch === 0 || micLevel < FORCE_MODE_MIC_LEVEL_THRESHOLD) {
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

		// Map pitch to height
		const normalizedPitch = Math.max(0, Math.min(1, (pitch - FORCE_MODE_PITCH_MIN_HZ) / (FORCE_MODE_PITCH_MAX_HZ - FORCE_MODE_PITCH_MIN_HZ)));
		
		// Map to actual geometry Y range (accounting for transforms)
		const minY = bbox.min.y * heightScale;
		const maxY = bbox.max.y * heightScale;
		const targetY = minY + normalizedPitch * (maxY - minY);
		
		// Find the radius at this height by sampling the geometry
		// Get a ring of vertices at approximately this Y position
		const positions = meshRef.geometry.getAttribute('position');
		let closestRadius = FORCE_MODE_FALLBACK_RADIUS;
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
