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
		PlaneGeometry,
		CylinderGeometry,
		Color
	} from 'three';
	import { useTask } from '@threlte/core';
	import { spring } from 'svelte/motion';
	import type { SculptureDefinition, LathePoint } from '$lib/types';
	import { computeProfile } from '$lib/engine/compositor';
	import { generateLathe, generateGlaze, applyModifiers } from '$lib/engine/physicsMapping';
	import { applyGlazeColors } from '$lib/engine/geometryFactory';
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
		safeDisposeGeometry,
		createFallbackGeometry,
		deriveProfileWithTransforms
	} from '$lib/engine/geometryFactory';
import { DynamicGeometryManager } from '$lib/engine/DynamicGeometryManager';
import { RibbonGeometryManager } from '$lib/engine/RibbonGeometryManager';
import { songModeStore } from '$lib/stores/songModeStore.svelte';
import { setRibbonPoints, setRibbonRecording } from '$lib/stores/ribbonStore.svelte';
import { updateCinematicTransition } from '$lib/stores/uiStore.svelte';
import {
		deriveMaterialColor,
		deriveGhostMaterialColor,
		createBaseMaterialProps,
		createEnergyMaterialProps,
		updateMaterialForViewMode,
		updateMaterialForGlazeMode,
		calculateSmoothedEmission,
		deriveEmissiveIntensity,
		createGhostMaterialProps,
		lerpEmissiveIntensity,
		type MaterialProps,
		type EnergyMaterialConfig
	} from '$lib/engine/materialFactory';

	let { sculpture } = $props<{ sculpture: SculptureDefinition | null }>();

	// Raw mesh references (managed by bind:ref) to avoid Svelte 5 proxying issues
	let meshRef = $state<Mesh | undefined>(undefined);
	let ghostMeshRef = $state<Mesh | undefined>(undefined);

	// Buffer Pooling to prevent GC thrashing
	let colorBuffer: Float32Array | null = null;
	let heatmapBuffer: Float32Array | null = null;

	// OPTIMIZATION: Dynamic geometry manager for real-time updates
	// Uses DynamicDrawUsage for GPU-optimized buffer updates
	let dynamicGeoManager: DynamicGeometryManager | null = null;
	let useDynamicGeometry = $state(true); // Enable by default for recording

	// RIBBON GEOMETRY: For Song Mode waveform sculptures
	let ribbonGeoManager: RibbonGeometryManager | null = null;
	let ribbonGeometry = $state<BufferGeometry | null>(null);

	// Check if we're in ribbon mode
	let isRibbonMode = $derived(uiStore.baseShape === 'ribbon');

	// Initialize dynamic geometry manager on mount
	$effect(() => {
		if (!dynamicGeoManager && useDynamicGeometry) {
			dynamicGeoManager = new DynamicGeometryManager({
				radialSegments: GEOMETRY_LATHE_SEGMENTS,
				profileResolution: GEOMETRY_RESOLUTION_COMPOSITOR,
				dynamic: true
			});
			dynamicGeoManager.generateIndices(); // Enable indexed rendering
			console.log('🚀 [SCULPTURE] Dynamic geometry manager initialized');
		}

		return () => {
			if (dynamicGeoManager) {
				dynamicGeoManager.dispose();
				dynamicGeoManager = null;
			}
		};
	});

	// Initialize ribbon geometry manager when needed
	$effect(() => {
		if (isRibbonMode && !ribbonGeoManager) {
			ribbonGeoManager = new RibbonGeometryManager({
				maxSegments: 3000, // 5 min @ 10fps
				crossSectionPoints: 8,
				dynamic: true
			});
			ribbonGeometry = ribbonGeoManager.getGeometry();
			console.log('〰️ [SCULPTURE] Ribbon geometry manager initialized');
		}

		return () => {
			if (ribbonGeoManager) {
				ribbonGeoManager.dispose();
				ribbonGeoManager = null;
				ribbonGeometry = null;
			}
		};
	});

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
		// Check if sculpture has glaze layer with vertex colors
		const glazeLayer = sculpture.layers?.find((l: { type: string; visible: boolean }) => l.type === 'glaze' && l.visible);
		const hasColors = glazeLayer ? glazeLayer.data.length > 0 : false;

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
	const orientationSpring = spring(0, {
		stiffness: ORIENTATION_SPRING_STIFFNESS,
		damping: ORIENTATION_SPRING_DAMPING
	});

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
		const isGlazeMode = uiStore.workspace === 'glaze';
		const needsUpdate = isRecording || sculptureStore.geometryDirty;

		if (!needsUpdate) return;

		try {
			let profile: LathePoint[];

			// GLAZE MODE: Don't change geometry, only update colors
			// The shape stays the same, only vertex colors change
			if (isGlazeMode && isRecording) {
				// Use existing geometry - don't regenerate
				if (sculpture?.layers && sculpture.layers.length > 0) {
					profile = computeProfile(sculpture.layers);
				} else if (sculpture?.radiusCurve && sculpture.radiusCurve.length > 0) {
					profile = sculpture.radiusCurve;
				} else {
					// No existing geometry - can't paint
					return;
				}
			}
			// SCULPT/FORCE MODE: Live recording preview with geometry changes
			else if (isRecording) {
				const frames = getCapturedFrames();
				if (frames && frames.length > 5) {
					// Need at least a few frames
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
						const curveLen = radiusCurve?.length ?? 1;
						const targetIndex = Math.round(normalizedY * (curveLen - 1));
						const clampedIndex = Math.min(targetIndex, curveLen - 1);
						const point = radiusCurve?.[clampedIndex];
						tempLayerData[i] = point?.x ?? 0.5; // Default radius if point is undefined
					}

					// If we have existing layers, composite with them
					if (sculpture?.layers && sculpture.layers.length > 0) {
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
						const profileResolution = GEOMETRY_RESOLUTION_COMPOSITOR;
						profile = Array.from({ length: profileResolution }, (_, i) => ({
							x: tempLayerData[i] ?? 0.5,
							y: i / (profileResolution - 1)
						}));
					}
				} else if (sculpture?.layers && sculpture.layers.length > 0) {
					// Not enough frames yet, use existing layers
					profile = computeProfile(sculpture.layers);
				} else {
					// No frames and no layers - skip
					return;
				}
			} else {
				// NOT RECORDING: Use normal layer composition
				if (!sculpture?.layers || sculpture.layers.length === 0) {
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
			if (!profile || profile.length === 0) {
				return;
			}

			// OPTIMIZATION: Use DynamicGeometryManager during recording for better performance
			// This avoids recreating geometry every frame - just updates vertex buffers
			let geometry: BufferGeometry;
			let vectors: Vector2[];

			if (isRecording && dynamicGeoManager && useDynamicGeometry) {
				// Use optimized dynamic geometry (updates buffers in-place)
				const updated = dynamicGeoManager.updateFromProfile(profile);
				if (updated) {
					geometry = dynamicGeoManager.getGeometry();
					vectors = profile.map((p) => new Vector2(p?.x ?? 0.5, p?.y ?? 0));
				} else {
					// No change - skip update
					return;
				}
			} else {
				// Standard geometry creation (for non-recording or fallback)
				const result = createGeometryFromProfile(profile);
				geometry = result.geometry;
				vectors = result.vectors;
			}

			if (!geometry) {
				return;
			}

			// GENERATE VERTEX COLORS if in glaze mode and recording
			if (isGlazeMode && isRecording) {
				const frames = getCapturedFrames();
				if (frames && frames.length > 0) {
					const colors = generateGlaze(frames, uiStore.activeGlaze);
					// Apply colors using factory function or dynamic manager
					if (dynamicGeoManager && useDynamicGeometry) {
						dynamicGeoManager.updateColors(colors);
					} else {
						colorBuffer = applyGlazeColors(geometry, colors, colorBuffer) ?? colorBuffer;
					}
					console.log(
						`🎨 [GLAZE] Applied ${colors.length / 3} vertex colors from ${frames.length} frames`
					);
				} else {
					// No frames yet - apply base glaze color uniformly
					const positionAttr = geometry.getAttribute('position');
					if (positionAttr) {
						const vertexCount = positionAttr.count;
						const baseColor = new Color(uiStore.activeGlaze.color);
						const uniformColors = new Float32Array(vertexCount * 3);
						for (let i = 0; i < vertexCount; i++) {
							uniformColors[i * 3] = baseColor.r;
							uniformColors[i * 3 + 1] = baseColor.g;
							uniformColors[i * 3 + 2] = baseColor.b;
						}
						if (dynamicGeoManager && useDynamicGeometry) {
							dynamicGeoManager.updateColors(uniformColors);
						} else {
							colorBuffer = applyGlazeColors(geometry, uniformColors, colorBuffer) ?? colorBuffer;
						}
					}
				}
			}

			// Update state
			lastProfileVectors = vectors;

			// UPDATE MESH - Only dispose if not using dynamic geometry
			if (!isRecording || !dynamicGeoManager || !useDynamicGeometry) {
				try {
					if (liveGeometry && liveGeometry !== geometry) {
						liveGeometry.dispose();
					}
				} catch (err) {
					console.warn('⚠️ [SCULPTURE] Geometry disposal failed:', err);
				}
			}
			liveGeometry = geometry;

			sculptureStore.geometryDirty = false; // Mark clean
		} catch (err) {
			console.error('❌ [COMPOSITOR] Failed to compute profile:', err);
			trackError('geometryComputation');
			if (err instanceof Error && err.message.includes('state_unsafe_mutation')) {
				trackError('stateUnsafeMutation');
			}
		}
	});

	// RIBBON MODE: Capture frames in real-time when recording
	let lastRibbonFrameTime = 0;
	const RIBBON_FRAME_INTERVAL = 100; // 10fps sampling

	useTask(() => {
		if (!isRibbonMode || !ribbonGeoManager) return;

		const isRecording = recordingStore.state === 'recording';
		if (!isRecording) return;

		// Rate limit to 10fps
		const now = Date.now();
		if (now - lastRibbonFrameTime < RIBBON_FRAME_INTERVAL) return;
		lastRibbonFrameTime = now;

		// Get current analysis frame
		const frame = analysisStore.latestFrame;
		if (!frame) return;

		// Get sentiment color from Song Mode (if available)
		const sentimentColor = songModeStore.currentSentiment
			? (() => {
					const { valence, energy } = songModeStore.currentSentiment;
					// Map sentiment to RGB
					const h = ((valence + 1) / 2) * 0.78; // Blue to gold hue
					const s = 0.5 + ((energy + 1) / 2) * 0.5;
					const l = 0.4 + ((valence + 1) / 2) * 0.2;
					// Simple HSL to RGB
					const c = (1 - Math.abs(2 * l - 1)) * s;
					const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
					const m = l - c / 2;
					let r = 0, g = 0, b = 0;
					const hue = h * 6;
					if (hue < 1) { r = c; g = x; }
					else if (hue < 2) { r = x; g = c; }
					else if (hue < 3) { g = c; b = x; }
					else if (hue < 4) { g = x; b = c; }
					else if (hue < 5) { r = x; b = c; }
					else { r = c; b = x; }
					return { r: r + m, g: g + m, b: b + m };
			  })()
			: undefined;

		// Add frame to ribbon
		ribbonGeoManager.addFrame(frame, sentimentColor);

		// Update reference to trigger reactivity
		ribbonGeometry = ribbonGeoManager.getGeometry();

		// Update ribbon store for export (every 10 frames to reduce overhead)
		if (ribbonGeoManager.getSegmentCount() % 10 === 0) {
			setRibbonPoints(ribbonGeoManager.getRibbonPoints());
		}
	});

	// Track ribbon recording state
	$effect(() => {
		const isRecording = recordingStore.state === 'recording';
		if (isRibbonMode) {
			setRibbonRecording(isRecording);
			// Save final ribbon points when recording stops
			if (!isRecording && ribbonGeoManager) {
				setRibbonPoints(ribbonGeoManager.getRibbonPoints());
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
		} else if (sculpture.radiusCurve && sculpture.radiusCurve.length > 0) {
			const { geometry } = createGeometryFromProfile(sculpture.radiusCurve);
			if (geometry) return geometry;
		}

		return new CylinderGeometry(
			DEFAULT_CYLINDER_RADIUS,
			DEFAULT_CYLINDER_RADIUS,
			1,
			DEFAULT_CYLINDER_SEGMENTS
		);
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
			return modifiedProfile.map((p) => {
				if (!p) return new Vector2(0, 0);
				return new Vector2(p.x ?? 0, p.y ?? 0);
			});
		} else if (sculpture.radiusCurve && sculpture.radiusCurve.length > 0) {
			const modifiedProfile = applyModifiers(sculpture.radiusCurve, heightScale, uiStore.modifiers);
			return modifiedProfile.map((p) => {
				if (!p) return new Vector2(0, 0);
				return new Vector2(p.x ?? 0, p.y ?? 0);
			});
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
					heatmapBuffer =
						applyHeatmapColors(geometry, vectorsToUse, stressColors, heatmapBuffer) ??
						heatmapBuffer;
				}
			} else {
				const colorAttr = geometry.getAttribute('color');
				if (colorAttr) {
					geometry.deleteAttribute('color');
				}
			}
		} catch (err) {
			console.warn('⚠️ [SCULPTURE] Geometry mutation failed (non-fatal):', err);
		}

		return () => {
			// Cleanup: Reset geometry attributes if geometry changes
		};
	});

	let materialProps = $state<MaterialProps>(
		createBaseMaterialProps(
			DEFAULT_MATERIAL_CERAMIC,
			uiStore.activeGlaze.color,
			uiStore.activeGlaze.roughness ?? 0.5
		)
	);

	$effect(() => {
		// Update base properties
		materialProps.color = materialColor;
		materialProps.roughness = uiStore.activeGlaze.roughness ?? 0.5;
		materialProps.emissive = uiStore.activeGlaze.color;

		// Apply view mode transformations
		const viewUpdated = updateMaterialForViewMode(materialProps, uiStore.view.mode);

		// Apply glaze mode transformations
		// Check if current geometry has vertex colors
		const hasVertexColors = liveGeometry?.hasAttribute('color') ?? false;
		const glazeUpdated = updateMaterialForGlazeMode(
			viewUpdated,
			recordingStore.state === 'recording',
			uiStore.workspace === 'glaze',
			hasVertexColors
		);

		Object.assign(materialProps, glazeUpdated);
	});

	// Voice-reactive emission (bioluminescence) with smoothing
	// Supports both standard recording glow AND Dazzler Effect (Energy material)
	// SYNERGY: Dazzler + Beat Detection = Pulse on beat
	let smoothedEmission = $state(0);
	let smoothedDazzlerIntensity = $state(0);
	let beatFlashIntensity = $state(0); // Beat-triggered flash

	useTask((delta) => {
		// Update cinematic transitions (Song Mode atmosphere changes)
		updateCinematicTransition();

		const isRecording = recordingStore.state === 'recording';
		const isEnergyMaterial = uiStore.activeGlaze.materialType === 'energy';
		const { emissiveEnabled, emissiveBase, emissiveReactivity, emissiveColor } = uiStore.activeGlaze;

		// SYNERGY: Beat detection flash (decays over time)
		const isBeat = analysisStore.latestFrame?.beat ?? false;
		if (isBeat) {
			beatFlashIntensity = 0.8; // Flash intensity on beat
		} else {
			// Decay the flash (fast decay ~100ms)
			beatFlashIntensity = Math.max(0, beatFlashIntensity - delta * 8);
		}

		// DAZZLER EFFECT: Energy material with voice-reactive glow
		if (isEnergyMaterial && emissiveEnabled) {
			// Calculate target intensity from base + voice reactivity
			const voiceContribution = analysisStore.micLevel * emissiveReactivity;
			const baseTargetIntensity = Math.min(2.0, emissiveBase + voiceContribution * 1.5);

			// SYNERGY: Add beat flash to dazzler
			const targetIntensity = Math.min(3.0, baseTargetIntensity + beatFlashIntensity);

			// Smooth the intensity to prevent flickering
			smoothedDazzlerIntensity = lerpEmissiveIntensity(smoothedDazzlerIntensity, targetIntensity, 0.15);

			// Apply energy material properties
			materialProps.color = '#111111'; // Dark base
			materialProps.roughness = 0.8; // Matte
			materialProps.emissive = emissiveColor;
			materialProps.emissiveIntensity = smoothedDazzlerIntensity;
			return;
		}

		// STANDARD: Recording glow (bioluminescence)
		if (isRecording) {
			const targetGlow =
				Math.max(
					0,
					(analysisStore.micLevel - VOICE_REACTION_GLOW_BASE) * VOICE_REACTION_GLOW_MULTIPLIER
				) * VOICE_REACTION_GLOW_MULTIPLIER;
			// SYNERGY: Add beat flash to standard glow too
			const targetWithBeat = targetGlow + beatFlashIntensity * 0.5;
			smoothedEmission = calculateSmoothedEmission(
				smoothedEmission,
				targetWithBeat,
				EMISSION_SMOOTHING_FACTOR
			);
			materialProps.emissiveIntensity = smoothedEmission;
		} else {
			materialProps.emissiveIntensity = deriveEmissiveIntensity(false, 0);
		}
		materialProps.emissive = uiStore.activeGlaze.color;
	});

	// Force Mode: Update interaction point AND apply deformation based on voice
	// BRUSH: Pitch = WHERE (height), Volume = HOW MUCH (intensity)
	// LANCE: Volume = TRIGGER, Pitch = DEPTH, Always precise point
	// Additive mode = push outward (expand), Subtractive mode = push inward (compress)
	useTask((delta) => {
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

		// Map pitch to height (WHERE on the sculpture)
		const normalizedPitch = Math.max(
			0,
			Math.min(
				1,
				(pitch - FORCE_MODE_PITCH_MIN_HZ) / (FORCE_MODE_PITCH_MAX_HZ - FORCE_MODE_PITCH_MIN_HZ)
			)
		);

		// Map to actual geometry Y range (accounting for transforms)
		const minY = (bbox.min.y ?? 0) * heightScale;
		const maxY = (bbox.max.y ?? 1) * heightScale;
		const targetY = minY + normalizedPitch * (maxY - minY);

		// Get force parameters from UI
		const { damping, hardness: uiHardness, radius: uiFocusRadius, strength, toolType } = uiStore.forceParams;
		const isLanceMode = toolType.startsWith('lance');

		// SONIC LANCE: Override parameters for precision mode
		let hardness = uiHardness;
		let focusRadius = uiFocusRadius;
		let isAdditive = uiStore.sculptMode === 'additive';

		if (isLanceMode) {
			// Lance: Always precise, hard edges
			hardness = 1.0;
			focusRadius = 0.05; // Very small focus

			// Lance-carve: Always subtractive (drilling)
			// Lance-engrave: Always additive (embossing)
			isAdditive = toolType === 'lance-engrave';
		}

		// Calculate force intensity from mic level
		// Higher volume = stronger force
		const forceIntensity = micLevel * strength * 0.5; // Scale down for subtlety
		const forceDirection = isAdditive ? 1 : -1; // Push out or push in

		// Get geometry positions for deformation
		const positions = meshRef.geometry.getAttribute('position');
		if (!positions) {
			return;
		}

		let closestRadius = FORCE_MODE_FALLBACK_RADIUS;
		let minYDiff = Infinity;
		let closestIndex = 0;

		// Find closest vertex and apply force to nearby vertices
		for (let i = 0; i < positions.count; i++) {
			const y = positions.getY(i);
			if (y === undefined) continue;
			const scaledY = y * heightScale;
			const yDiff = Math.abs(scaledY - targetY);

			if (yDiff < minYDiff) {
				minYDiff = yDiff;
				const x = positions.getX(i) ?? 0;
				const z = positions.getZ(i) ?? 0;
				closestRadius = Math.sqrt(x * x + z * z);
				closestIndex = i;
			}

			// Apply force to vertices within the focus radius
			// The force falls off with distance from the target height
			const influenceRadius = focusRadius * 0.5; // Normalized to geometry scale
			const normalizedYDiff = yDiff / (maxY - minY);

			if (normalizedYDiff < influenceRadius) {
				// Calculate falloff (smooth falloff at edges)
				const falloff = 1 - normalizedYDiff / influenceRadius;
				const smoothFalloff = falloff * falloff * (3 - 2 * falloff); // Smoothstep

				// Apply hardness (harder = more localized effect)
				const hardnessFactor = Math.pow(smoothFalloff, 1 + hardness * 3);

				// Calculate displacement
				const displacement = forceIntensity * forceDirection * hardnessFactor * delta * 60; // Normalize to 60fps

				// Apply damping (reduces jitter)
				const dampedDisplacement = displacement * (1 - damping * 0.8);

				// Get current position
				const x = positions.getX(i) ?? 0;
				const z = positions.getZ(i) ?? 0;
				const currentRadius = Math.sqrt(x * x + z * z);

				if (currentRadius > 0.01) {
					// Avoid division by zero
					// Push radially outward/inward
					const newRadius = Math.max(0.05, Math.min(2, currentRadius + dampedDisplacement));
					const scale = newRadius / currentRadius;

					positions.setX(i, x * scale);
					positions.setZ(i, z * scale);
				}
			}
		}

		// Mark geometry as needing update
		positions.needsUpdate = true;
		meshRef.geometry.computeVertexNormals();
		meshRef.geometry.computeBoundingBox();

		// Place reticle point on the front of the sculpture
		const point = new Vector3(closestRadius, targetY, 0);
		const normal = new Vector3(1, 0, 0); // Normal pointing outward

		setInteractionPoint(point, normal);
	});
</script>

{#if sculpture}
	<!-- Parent Rig: All transforms applied here ensure Main and Ghost match perfectly -->
	<T.Group rotation={[0, 0, orientationRotation]} scale={[1, heightScale, 1]} position={[0, 0, 0]}>
		<!-- RIBBON MODE: 3D waveform sculpture -->
		{#if isRibbonMode && ribbonGeometry}
			<T.Mesh
				bind:ref={meshRef}
				geometry={ribbonGeometry}
				castShadow
				receiveShadow
				frustumCulled={false}
				position.y={-0.5}
			>
				<T.MeshPhysicalMaterial
					{...materialProps}
					transparent={uiStore.view.mode === 'xray'}
					opacity={uiStore.view.mode === 'xray' ? 0.3 : 1.0}
					wireframe={uiStore.view.mode === 'wireframe'}
					vertexColors={true}
					side={2}
				/>
			</T.Mesh>
		<!-- LATHE MODE: Pottery wheel sculpture (default) -->
		{:else if currentGeometry}
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
		{#if sculptureStore.ghostSculpture && !isRibbonMode}
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

		<!-- COIL MODE: Visual band indicators -->
		{#if uiStore.recordingMode === 'coil' && sculpture?.layers}
			{@const layerCount = sculpture.layers.filter(l => l.type === 'distortion').length}
			{@const nextBandStart = layerCount / (layerCount + 1)}
			{@const nextBandEnd = (layerCount + 1) / (layerCount + 2)}
			{@const bandCenter = (nextBandStart + nextBandEnd) / 2}
			
			<!-- Show existing coil layers as colored bands -->
			{#each sculpture.layers.filter(l => l.type === 'distortion') as layer, i}
				{@const bandY = (i + 0.5) / (layerCount + 1)}
				{@const hue = (i / Math.max(1, layerCount)) * 0.7}
				<T.Mesh position.y={bandY - 0.5} rotation.x={Math.PI / 2}>
					<T.TorusGeometry args={[0.52, 0.01, 8, 32]} />
					<T.MeshBasicMaterial 
						color={`hsl(${hue * 360}, 70%, 50%)`}
						transparent={true}
						opacity={0.6}
					/>
				</T.Mesh>
			{/each}
			
			<!-- Show next coil position (preview) -->
			{#if recordingStore.state !== 'recording'}
				<T.Mesh position.y={bandCenter - 0.5} rotation.x={Math.PI / 2}>
					<T.TorusGeometry args={[0.55, 0.015, 8, 32]} />
					<T.MeshBasicMaterial 
						color="#00ff88"
						transparent={true}
						opacity={0.4 + Math.sin(Date.now() * 0.003) * 0.2}
					/>
				</T.Mesh>
			{/if}
		{/if}
	</T.Group>
{/if}
