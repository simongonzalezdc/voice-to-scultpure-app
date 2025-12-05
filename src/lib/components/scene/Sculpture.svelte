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
	import { playbackStore, getPlaybackProgress } from '$lib/stores/playbackStore.svelte';
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
	import type { SculptureDefinition, LathePoint } from '$lib/types';
	import { computeProfile, getEffectiveResolution } from '$lib/engine/compositor';
	import { generateLathe, generateGlaze, applyModifiers, applyProfileStyle } from '$lib/engine/physicsMapping';
	import { applyConstraints } from '$lib/engine/constraints';
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
		FORCE_MODE_FALLBACK_RADIUS,
		getSegmentsForFacetStyle
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
import { songModeStore } from '$lib/stores/songModeStore.svelte';
import { updateCinematicTransition } from '$lib/stores/uiStore.svelte';
import {
		deriveMaterialColor,
		deriveGhostMaterialColor,
		createBaseMaterialProps,
		createCeramicMaterialProps,
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

	// Initialize dynamic geometry manager on mount
	// Pre-allocate for max expected resolution to avoid runtime buffer resizing
	$effect(() => {
		if (!dynamicGeoManager && useDynamicGeometry) {
			// Get initial segment count from current facet style
			const initialSegments = getSegmentsForFacetStyle(uiStore.facetStyle);
			// Pre-allocate 512 points max (covers both standard and song mode)
			dynamicGeoManager = new DynamicGeometryManager({
				radialSegments: initialSegments,
				profileResolution: 512, // Pre-allocate for max - drawRange limits active portion
				dynamic: true
			});
			console.log(`🚀 [SCULPTURE] Dynamic geometry manager initialized (512 pts, ${initialSegments} segments for "${uiStore.facetStyle}" style)`);
		}

		// AUDIT FIX: Comprehensive cleanup to prevent memory leaks
		return () => {
			if (dynamicGeoManager) {
				dynamicGeoManager.dispose();
				dynamicGeoManager = null;
			}
			// Dispose live geometry if it exists
			if (liveGeometry) {
				liveGeometry.dispose();
				liveGeometry = null;
			}
			// Clear buffer pools
			colorBuffer = null;
			heatmapBuffer = null;
			console.log('🧹 [SCULPTURE] Cleanup: disposed geometry and cleared buffers');
		};
	});

	// FACET STYLE: Update geometry manager when facet style changes
	// This recreates buffers with the new segment count
	$effect(() => {
		if (!dynamicGeoManager) return;
		
		const targetSegments = getSegmentsForFacetStyle(uiStore.facetStyle);
		const changed = dynamicGeoManager.setRadialSegments(targetSegments);
		
		if (changed) {
			// Force geometry to re-render with new segment count
			sculptureStore.geometryDirty = true;
			console.log(`💎 [SCULPTURE] Facet style changed to "${uiStore.facetStyle}" (${targetSegments} segments)`);
		}
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
	// Height grows with recording duration - longer recordings = taller sculptures
	// DRAMATIC growth for obvious visual feedback
	const MIN_HEIGHT_RATIO = 0.3; // Start at 30% height - makes growth more visible
	
	// Mode-specific settings - AGGRESSIVE rates for obvious feedback
	const getHeightParams = () => {
		if (uiStore.recordingMode === 'song') {
			return { growthRate: 0.25, maxRatio: 10.0 }; // 25%/sec = 2x in 4 sec, 10x in ~40 sec
		}
		return { growthRate: 0.50, maxRatio: 6.0 }; // 50%/sec = 2x in 2 sec, 6x in ~12 sec
	};
	
	let heightScale = $derived.by(() => {
		// RECORDING: Height grows with duration (longer singing = taller sculpture)
		if (recordingStore.state === 'recording') {
			// Use reactive frameCount from store (getCapturedFrames() doesn't trigger reactivity)
			const frameCount = recordingStore.frameCount;
			const seconds = frameCount / 30; // ~30 fps
			const { growthRate, maxRatio } = getHeightParams();
			const growthRatio = MIN_HEIGHT_RATIO + (seconds * growthRate);
			const result = Math.min(maxRatio, growthRatio);
			// Log every 2 seconds (60 frames)
			if (frameCount > 0 && frameCount % 60 === 0) {
				console.log(`📐 [HEIGHT SCALE] ${seconds.toFixed(1)}s → ${result.toFixed(2)}x (${((result-1)*100).toFixed(0)}% growth)`);
			}
			return result;
		}
		
		// NOT RECORDING: Use stored physical height ratio
		const height = sculpture?.physical.height;
		if (!height || height <= 0 || !Number.isFinite(height) || Number.isNaN(height)) {
			return MIN_HEIGHT_RATIO;
		}
		return height / DEFAULT_HEIGHT_MM;
	});

	// Live Geometry State - Updated by compositor
	let liveGeometry = $state<BufferGeometry | null>(null);
	let lastCompositionTime = 0;
	let lastProfileVectors = $state<Vector2[]>([]);

	// Frame rate limiting for smoother, less jittery updates
	let lastUpdateTime = 0;
	let lastRenderLogTime = 0; // Rate-limit render loop logs
	const RENDER_LOG_INTERVAL_MS = 3000; // Log at most every 3 seconds
	
	// Track constraint/modifier changes for non-destructive updates
	let lastConstraintMode = $state<string>(uiStore.constraintMode);
	let lastAutoFixGeometry = $state<boolean>(uiStore.autoFixGeometry);
	let lastQuantize = $state<boolean>(uiStore.modifiers?.quantize ?? false);
	let lastProfileStyle = $state<string>(uiStore.profileStyle ?? 'natural');
	let lastMusicalDetail = $state<number>(uiStore.musicalDetailIntensity ?? 0.5);

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

		// Optimization: Only re-compute if layers changed, recording, or settings changed
		const isRecording = recordingStore.state === 'recording';
		const isGlazeMode = uiStore.workspace === 'glaze';
		const constraintChanged = uiStore.constraintMode !== lastConstraintMode || uiStore.autoFixGeometry !== lastAutoFixGeometry;
		const modifierChanged = (uiStore.modifiers?.quantize ?? false) !== lastQuantize;
		const profileStyleChanged = (uiStore.profileStyle ?? 'natural') !== lastProfileStyle;
		const musicalDetailChanged = Math.abs((uiStore.musicalDetailIntensity ?? 0.5) - lastMusicalDetail) > 0.01;
		const needsUpdate = isRecording || sculptureStore.geometryDirty || constraintChanged || modifierChanged || profileStyleChanged || musicalDetailChanged;

		if (!needsUpdate) return;
		
		// Update tracked values AFTER the needsUpdate check
		if (constraintChanged) {
			console.log(`🔄 [RENDER] Constraint changed: ${lastConstraintMode}→${uiStore.constraintMode}, autoFix: ${lastAutoFixGeometry}→${uiStore.autoFixGeometry}`);
			lastConstraintMode = uiStore.constraintMode;
			lastAutoFixGeometry = uiStore.autoFixGeometry;
		}
		if (modifierChanged) {
			console.log(`🔢 [RENDER] Modifier changed: quantize ${lastQuantize}→${uiStore.modifiers?.quantize}`);
			lastQuantize = uiStore.modifiers?.quantize ?? false;
		}
		if (profileStyleChanged) {
			console.log(`🌀 [RENDER] Profile style changed: ${lastProfileStyle}→${uiStore.profileStyle}`);
			lastProfileStyle = uiStore.profileStyle ?? 'natural';
		}
		if (musicalDetailChanged) {
			console.log(`🎵 [RENDER] Musical detail changed: ${(lastMusicalDetail * 100).toFixed(0)}%→${((uiStore.musicalDetailIntensity ?? 0.5) * 100).toFixed(0)}%`);
			lastMusicalDetail = uiStore.musicalDetailIntensity ?? 0.5;
		}

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
					// FIX 1: Use the SAME resolution for preview as will be used for final storage
					// This ensures what you see during recording matches what you get after
					const effectiveResolution = sculpture?.layers && sculpture.layers.length > 0
						? getEffectiveResolution(sculpture.layers)
						: GEOMETRY_RESOLUTION_COMPOSITOR;
					
					// Generate lathe with limited resolution to match final output
					// This prevents the "looks different after recording" problem
					const radiusCurve = generateLathe(
						frames,
						appSettings.userProfile,
						uiStore.sculptMode || 'additive',
						undefined,
						'digital', // Raw data - constraints applied at render time
						uiStore.controlMode, // FIX: Use actual control mode (melodic = pitch->radius)
						'lathe',
						effectiveResolution // FIX 1: Use same resolution as storage (was 0/unlimited)
					);

					// FIX 1: Preview now uses the SAME profile that will be stored
					// No more mismatch between preview and final result
					profile = radiusCurve;
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

				// Compute profile from layers (compositor now handles resolution auto-detection)
				profile = computeProfile(sculpture.layers);
			}

			// GENERATE GEOMETRY from profile
			if (!profile || profile.length === 0) {
				return;
			}

			// Rate-limited logging for render loop
			const shouldLogRender = now - lastRenderLogTime > RENDER_LOG_INTERVAL_MS;
			
			// NON-DESTRUCTIVE MODIFIERS: Apply quantize/symmetry at render time
			// This allows users to toggle modifiers without re-recording
			if (uiStore.modifiers?.quantize) {
				profile = applyModifiers(profile, 1.0, { quantize: true });
			}

			// NON-DESTRUCTIVE CONSTRAINTS: Apply at render time based on current uiStore settings
			// This allows users to toggle between Digital/Ceramic/3D Print without re-recording
			const effectiveConstraint = uiStore.autoFixGeometry ? uiStore.constraintMode : 'digital';
			if (effectiveConstraint !== 'digital') {
				profile = applyConstraints(profile, effectiveConstraint);
			}

			// PROFILE STYLE: Apply aesthetic transformation (terraced, spiral, rippled)
			// Applied after constraints so the artistic effect is visible
			profile = applyProfileStyle(profile);

			// OPTIMIZATION: Use DynamicGeometryManager for ALL geometry updates
			// This ensures the final sculpture looks identical to the preview
			// (Both use the same 32-segment faceted lathe)
			let geometry: BufferGeometry;
			let vectors: Vector2[];

			// DEBUG: Log profile dimensions (rate-limited)
			if (shouldLogRender && profile.length > 0) {
				lastRenderLogTime = now;
				const minY = Math.min(...profile.map(p => p.y));
				const maxY = Math.max(...profile.map(p => p.y));
				const avgX = profile.reduce((sum, p) => sum + p.x, 0) / profile.length;
				console.log(`🎨 [PROFILE] ${profile.length} pts, Y=[${minY.toFixed(3)}-${maxY.toFixed(3)}], avgRadius=${avgX.toFixed(3)}, mode=${effectiveConstraint}, quantize=${uiStore.modifiers?.quantize ?? false}`);
			}

			// FIX: Always use DynamicGeometryManager to ensure preview matches final
			if (dynamicGeoManager && useDynamicGeometry) {
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
				// Fallback only if DynamicGeometryManager unavailable
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

		// Use facet style segments for consistent aesthetic even in fallback
		return new CylinderGeometry(
			DEFAULT_CYLINDER_RADIUS,
			DEFAULT_CYLINDER_RADIUS,
			1,
			getSegmentsForFacetStyle(uiStore.facetStyle)
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

	// AUDIT FIX: Use ceramic material with full PBR properties
	let materialProps = $state<MaterialProps>(
		createCeramicMaterialProps(
			DEFAULT_MATERIAL_CERAMIC,
			uiStore.activeGlaze.roughness ?? 0.35,
			0 // Default no transmission
		)
	);

	$effect(() => {
		// AUDIT FIX: Get ceramic material base with PBR properties
		// NOTE: Build new object without reading materialProps to avoid infinite loop
		const ceramicBase = createCeramicMaterialProps(
			materialColor,
			uiStore.activeGlaze.roughness ?? 0.35,
			uiStore.activeGlaze.transmission ?? 0
		);
		
		// Set emissive from glaze (spread to avoid reading materialProps)
		const withEmissive = { ...ceramicBase, emissive: uiStore.activeGlaze.color };

		// Apply view mode transformations
		const viewUpdated = updateMaterialForViewMode(withEmissive, uiStore.view.mode);

		// Apply glaze mode transformations
		// Check if current geometry has vertex colors
		const hasVertexColors = liveGeometry?.hasAttribute('color') ?? false;
		const glazeUpdated = updateMaterialForGlazeMode(
			viewUpdated,
			recordingStore.state === 'recording',
			uiStore.workspace === 'glaze',
			hasVertexColors
		);

		// Single assignment - doesn't read materialProps, avoids infinite loop
		materialProps = glazeUpdated;
	});

	// Voice-reactive emission (bioluminescence) with smoothing
	// Supports both standard recording glow AND Dazzler Effect (Energy material)
	// SYNERGY: Dazzler + Beat Detection = Pulse on beat
	let smoothedEmission = $state(0);
	let smoothedDazzlerIntensity = $state(0);
	let beatFlashIntensity = $state(0); // Beat-triggered flash
	
	// Playback highlighting: Creates a glowing band that moves with playback position
	let playbackEmissiveBoost = $state(0); // Extra emissive during playback (0-1)

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

		// PLAYBACK HIGHLIGHTING: Add emissive boost during audio playback
		// Creates a glowing effect that highlights the sculpture as it plays back
		if (playbackStore.state === 'playing') {
			const playbackProgress = getPlaybackProgress();
			// Create a sharp pulse around the current playback position
			// This creates a moving highlight band
			playbackEmissiveBoost = 0.3 + Math.sin(playbackProgress * Math.PI * 2) * 0.2;
		} else {
			// Fade out playback boost when not playing
			playbackEmissiveBoost = Math.max(0, playbackEmissiveBoost - delta * 2);
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
			// Add playback boost on top of dazzler effect
			materialProps.emissiveIntensity = smoothedDazzlerIntensity + playbackEmissiveBoost;
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
			// Add playback boost on top of emission
			materialProps.emissiveIntensity = smoothedEmission + playbackEmissiveBoost;
		} else {
			materialProps.emissiveIntensity = deriveEmissiveIntensity(false, 0) + playbackEmissiveBoost;
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
	<T.Group 
		scale.y={heightScale} 
		position={[0, 0, 0]}
	>
		<!-- LATHE MODE: Pottery wheel sculpture -->
		{#if currentGeometry}
			<T.Mesh
				bind:ref={meshRef}
				geometry={currentGeometry}
				castShadow
				receiveShadow
				frustumCulled={false}
			>
				<!-- AUDIT FIX: Full PBR material with ceramic/glaze properties -->
				<T.MeshPhysicalMaterial
					{...materialProps}
					transparent={uiStore.view.mode === 'xray' || (materialProps.transmission ?? 0) > 0}
					opacity={uiStore.view.mode === 'xray' ? 0.3 : 1.0}
					wireframe={uiStore.view.mode === 'wireframe'}
					vertexColors={uiStore.view.mode === 'heatmap' || uiStore.workspace === 'glaze'}
					clearcoat={materialProps.clearcoat ?? 0}
					clearcoatRoughness={materialProps.clearcoatRoughness ?? 0}
					sheen={materialProps.sheen ?? 0}
					sheenRoughness={materialProps.sheenRoughness ?? 0}
					sheenColor={materialProps.sheenColor ?? '#ffffff'}
					envMapIntensity={materialProps.envMapIntensity ?? 1}
					ior={materialProps.ior ?? 1.5}
					transmission={materialProps.transmission ?? 0}
					thickness={materialProps.thickness ?? 0}
					attenuationColor={materialProps.attenuationColor ?? '#ffffff'}
					attenuationDistance={materialProps.attenuationDistance ?? 0}
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

		<!-- COIL MODE: DISABLED - needs fixing (layers don't stack correctly) -->
		{#if false && uiStore.recordingMode === 'coil' && sculpture?.layers}
			{@const layerCount = sculpture.layers.filter((l: import('$lib/types').SculptureLayer) => l.type === 'distortion').length}
			{@const nextBandStart = layerCount / (layerCount + 1)}
			{@const nextBandEnd = (layerCount + 1) / (layerCount + 2)}
			{@const bandCenter = (nextBandStart + nextBandEnd) / 2}
			
			<!-- Show existing coil layers as colored bands -->
			{#each sculpture.layers.filter((l: import('$lib/types').SculptureLayer) => l.type === 'distortion') as layer, i}
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
