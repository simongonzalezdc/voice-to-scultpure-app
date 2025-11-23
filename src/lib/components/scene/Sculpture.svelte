<script lang="ts">
	import { T } from '@threlte/core';
	import {
		sculptureStore,
		setCurrentSculpture,
		updateSculptureColors
	} from '$lib/stores/sculptureStore.svelte';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { recordingStore, getCapturedFrames, type RecordingState } from '$lib/stores/recording.svelte';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { appSettings } from '$lib/stores/appSettingsStore.svelte';
	import {
		LatheGeometry,
		Vector2,
		Vector3,
		Mesh,
		Color,
		BufferAttribute,
		DynamicDrawUsage,
		RingGeometry,
		IcosahedronGeometry,
		BoxGeometry,
		PlaneGeometry,
		CylinderGeometry,
		BufferGeometry,
		Raycaster,
		MeshBasicMaterial,
		DoubleSide
	} from 'three';
	import { useTask, useThrelte } from '@threlte/core';
	import { spring } from 'svelte/motion';
	import type { SculptureDefinition, LathePoint } from '$lib/types';
	import { DEFAULT_MATERIAL_CERAMIC, DEFAULT_MATERIAL_PLASTIC } from '$lib/types';
	import { applyDeformation, generateLathe, generateGlaze } from '$lib/engine/physicsMapping';
	import { applyConstraints } from '$lib/engine/constraints';
	import { SCULPTURE_BASE_RADIUS, SCULPTURE_MAX_RADIUS, SCULPTURE_SENSITIVITY } from '$lib/config/constants';
	import {
		voiceLinksStore,
		pitchToTwist,
		timbreToRoughness
	} from '$lib/stores/voiceLinksStore.svelte';

	let { sculpture } = $props<{ sculpture: SculptureDefinition | null }>();

	// Raw mesh references (managed by bind:ref) to avoid Svelte 5 proxying issues
	let meshRef = $state<Mesh | null>(null);
	let ghostMeshRef = $state<Mesh | null>(null);
	let liveMeshRef = $state<Mesh | null>(null);
	let reticleRef = $state<Mesh | null>(null);

	// Raycaster for Sonic Force mode
	const raycaster = new Raycaster();
	const pointer = new Vector2();
	const { camera, renderer } = useThrelte();

	// Track pointer for raycasting
	$effect(() => {
		if (!renderer?.domElement) return;
		
		const handlePointerMove = (event: MouseEvent) => {
			const rect = renderer.domElement.getBoundingClientRect();
			pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
			pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
		};

		renderer.domElement.addEventListener('mousemove', handlePointerMove);
		return () => {
			renderer.domElement.removeEventListener('mousemove', handlePointerMove);
		};
	});

	// State tracking for recording transitions
	let previousRecordingState = $state<RecordingState>('idle');

	/**
	 * DIRECTIVE 2: Apply zone-based vertex colors to visualize the sculpt zone
	 * Vertices outside the active zone are dimmed (darker) to show they're "locked"
	 * @param geometry - The LatheGeometry to colorize
	 * @param zoneMin - Bottom of active zone (0-1)
	 * @param zoneMax - Top of active zone (0-1)
	 */
	// DIRECTIVE 4: Visualize "Active Layer" when using Zone Sculpting
	// Shows the active zone at full brightness and locks dimmed/desaturated
	function applyZoneVisualization(geometry: LatheGeometry, zoneMin: number, zoneMax: number): void {
		if (zoneMin === 0 && zoneMax === 1) return; // Full zone, no need to visualize

		const positions = geometry.attributes.position;
		if (!positions) return;

		const posArray = positions.array as Float32Array;
		const vertexCount = positions.count;

		// Find min/max Y to normalize height
		let minY = Infinity;
		let maxY = -Infinity;
		for (let i = 0; i < vertexCount; i++) {
			const y = posArray[i * 3 + 1];
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		}

		const totalHeight = maxY - minY;
		if (totalHeight === 0) return;

		// Create color array (RGB per vertex)
		const colors = new Float32Array(vertexCount * 3);

		for (let i = 0; i < vertexCount; i++) {
			const y = posArray[i * 3 + 1];
			const h = (y - minY) / totalHeight; // Normalized height (0 = bottom, 1 = top)

			// Check if vertex is in active zone
			const isInZone = h >= zoneMin && h <= zoneMax;

			if (isInZone) {
				// Active zone: BRIGHT - Full white/material color at full saturation
				colors[i * 3] = 1.0; // R
				colors[i * 3 + 1] = 1.0; // G
				colors[i * 3 + 2] = 1.0; // B
			} else {
				// DIRECTIVE 4: Locked zone: DIM + DESATURATED
				// - Opacity reduced by 50% (0.5)
				// - Desaturate by converting to grayscale and tinting
				const grayScale = 0.3; // Much darker than active (0.3 instead of 1.0)
				const tint = 0.4; // Slight color tint remains (40% gray, 60% original if any)

				colors[i * 3] = grayScale * tint; // R
				colors[i * 3 + 1] = grayScale * tint; // G
				colors[i * 3 + 2] = grayScale * tint; // B
			}
		}

		// Enable vertex colors for rendering
		geometry.setAttribute('color', new BufferAttribute(colors, 3));
		const colorAttr = geometry.attributes.color;
		if (colorAttr && colorAttr instanceof BufferAttribute) {
			colorAttr.setUsage(DynamicDrawUsage);
		}
	}

	/**
	 * Resample vertex colors when vertex count changes
	 * Maps saved colors to new geometry by interpolating based on vertex height
	 */
	function resampleVertexColors(
		savedColors: number[],
		oldVertexCount: number,
		newVertexCount: number,
		newGeometry: LatheGeometry
	): Float32Array {
		const colors = new Float32Array(newVertexCount * 3);
		const positions = newGeometry.attributes.position;
		if (!positions) return colors;

		// Find min/max Y for height normalization
		const posArray = positions.array as Float32Array;
		let minY = Infinity;
		let maxY = -Infinity;
		for (let i = 0; i < newVertexCount; i++) {
			const y = posArray[i * 3 + 1];
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		}
		const totalHeight = maxY - minY;
		if (totalHeight === 0) return colors;

		// Map each new vertex to old vertex by normalized height
		for (let i = 0; i < newVertexCount; i++) {
			const y = posArray[i * 3 + 1];
			const normalizedHeight = (y - minY) / totalHeight; // 0 = bottom, 1 = top
			
			// Find corresponding old vertex index
			const oldVertexIdx = Math.floor(normalizedHeight * (oldVertexCount - 1));
			const clampedIdx = Math.max(0, Math.min(oldVertexCount - 1, oldVertexIdx));
			
			// Copy color from old vertex
			const colorIdx = clampedIdx * 3;
			colors[i * 3] = savedColors[colorIdx] ?? 1.0;
			colors[i * 3 + 1] = savedColors[colorIdx + 1] ?? 1.0;
			colors[i * 3 + 2] = savedColors[colorIdx + 2] ?? 1.0;
		}

		return colors;
	}

	/**
	 * DIRECTIVE 1: Apply TRUE vertex-level spiral twist
	 * LatheGeometry is radially symmetric, so we must twist the VERTICES directly.
	 * @param geometry - The LatheGeometry to twist
	 * @param twistAmount - Twist multiplier (0 = none, 1 = full spiral)
	 */
	function applyVertexTwist(geometry: LatheGeometry, twistAmount: number): void {
		if (Math.abs(twistAmount) < 0.001) return; // Skip if no twist

		const positions = geometry.attributes.position;
		if (!positions) return;

		const posArray = positions.array as Float32Array;
		const vertexCount = positions.count;

		// Find min/max Y to normalize height
		let minY = Infinity;
		let maxY = -Infinity;
		for (let i = 0; i < vertexCount; i++) {
			const y = posArray[i * 3 + 1];
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		}

		const totalHeight = maxY - minY;
		if (totalHeight === 0) return;

		// Apply twist to each vertex
		for (let i = 0; i < vertexCount; i++) {
			const idx = i * 3;
			const x = posArray[idx];
			const y = posArray[idx + 1];
			const z = posArray[idx + 2];

			// Calculate normalized height (0 = bottom, 1 = top)
			const h = (y - minY) / totalHeight;

			// Calculate twist angle: linear progression from bottom to top
			// twistAmount of 1.0 = 2π radians (full rotation)
			const theta = h * twistAmount * Math.PI * 2;

			// Rotate X,Z around Y-axis
			const cosTheta = Math.cos(theta);
			const sinTheta = Math.sin(theta);
			const newX = x * cosTheta - z * sinTheta;
			const newZ = x * sinTheta + z * cosTheta;

			// Update positions
			posArray[idx] = newX;
			posArray[idx + 2] = newZ;
			// Y stays the same
		}

		// Mark for update
		positions.needsUpdate = true;
		geometry.computeVertexNormals(); // Recalculate normals for proper lighting
	}

	// Helper function to create geometry from sculpture data
	// DIRECTIVE 1: NEVER destructively modify sculpture.radiusCurve
	// DIRECTIVE 2: Support multiple base shapes for Sonic Force mode
	// DIRECTIVE 2: Safe Cylinder Fallback - NEVER return null, always return valid geometry
	function createGeometryFromSculpture(sculpture: SculptureDefinition): BufferGeometry {
		const baseShape = sculpture.baseShape || 'lathe';
		
		// DIRECTIVE 2: Wrap entire function in try-catch with fallback cylinder
		try {
			// Handle non-lathe shapes
			if (baseShape !== 'lathe') {
				const height = sculpture.physical.height || 150;
				const heightInUnits = height / 150; // Normalize to 0-2 range (matching lathe)
				const roughnessInput = sculpture.surface.textureRoughness ?? 0.5;
				
				switch (baseShape) {
					case 'sphere': {
						// Sphere: IcosahedronGeometry with high detail for smooth sculpting
						const radius = heightInUnits / 2; // Sphere radius = half height
						const detail = 40; // High detail for smooth sculpting
						const geom = new IcosahedronGeometry(radius, detail);
						// Validate geometry
						if (!geom || !geom.attributes.position) throw new Error('Invalid sphere geometry');
						return geom;
					}
					case 'cube': {
						// Cube: BoxGeometry with high segments to act like a solid block
						const size = heightInUnits;
						const segments = 64; // High segments for smooth sculpting
						const geom = new BoxGeometry(size, size, size, segments, segments, segments);
						if (!geom || !geom.attributes.position) throw new Error('Invalid cube geometry');
						return geom;
					}
					case 'plane': {
						// Plane: PlaneGeometry with high segments
						const size = heightInUnits * 2; // Plane extends wider
						const geom = new PlaneGeometry(size, size, 128, 128);
						if (!geom || !geom.attributes.position) throw new Error('Invalid plane geometry');
						return geom;
					}
					default:
						throw new Error(`Unknown base shape: ${baseShape}`);
				}
			}
			
			// LATHE SHAPE: Original logic
			// Safety check
			if (
				!sculpture.radiusCurve ||
				!Array.isArray(sculpture.radiusCurve) ||
				sculpture.radiusCurve.length === 0
			) {
				throw new Error('Invalid radiusCurve');
			}

		// 1. START WITH BASE - Create a copy, never overwrite original
		// DIRECTIVE 1: NaN Guard - Sanitize all points before processing
		const safeRadius = (r: number): number => {
			if (!Number.isFinite(r) || Number.isNaN(r)) return 0.5; // Default thickness
			return Math.max(0.1, r); // Clamp minimum thickness
		};

		const safeHeight = (h: number): number => {
			if (!Number.isFinite(h) || Number.isNaN(h)) return 0;
			return Math.max(0, Math.min(2, h)); // Clamp to valid height range (0-2)
		};

		let basePoints = sculpture.radiusCurve
			.map((p) => ({ x: safeRadius(p.x), y: safeHeight(p.y) }))
			.filter((p) => p.x > 0 && p.y >= 0); // Remove any invalid points
		
		// Safety: If resulting array is empty, return default cylinder
		// DIRECTIVE 1: Ensure user always sees something, even if geometry is invalid
		if (basePoints.length < 2) {
			// Return a simple cylinder as fallback (constant radius)
			const defaultPoints: LathePoint[] = [];
			for (let i = 0; i <= 10; i++) {
				const t = i / 10;
				defaultPoints.push({ x: 0.5, y: t * 2 }); // Constant radius 0.5, height 0-2
			}
			basePoints = defaultPoints;
		}

		// 2. Apply Deformations (Twist/Compression from sliders) - on the COPY
		if (
			sculpture.deformation &&
			(sculpture.deformation.twist !== 0 || sculpture.deformation.compression !== 0)
		) {
			basePoints = applyDeformation(basePoints, sculpture.deformation);
		}

		// 3. Physics Bridge - Live Audio Modulation (BREATHING EFFECT)
		// Only applies to lathe shapes (non-lathe shapes use Sonic Force mode instead)
		if (recordingStore.state === 'recording' && baseShape === 'lathe') {
			const frame = analysisStore.latestFrame;

			// FALLBACK LOGIC: If worker energy is dead, use the visualizer bypass
			const rawEnergy = frame?.energy || analysisStore.micLevel || 0;

			// Apply sensitivity boost (match physicsMapping.ts line 74)
			const energy = rawEnergy * 2.0;

			// Radial "breathing" effect - modulate all points uniformly (compression is a multiplier)
			const breathScale = 1.0 + energy * 0.3; // 0-30% radial expansion
			basePoints = basePoints.map((p) => ({
				x: p.x * breathScale,
				y: p.y
			}));
		}

		// 3.5. PERSISTENT CONSTRAINTS: Apply fabrication constraints AFTER all deformations
		// Only applies to lathe shapes (non-lathe shapes don't use radiusCurve)
		// These constraints persist through twist, compression, height changes, etc.
		// This ensures ceramic vessels never pinch, no matter how many sliders are adjusted
		if (baseShape === 'lathe') {
			basePoints = applyConstraints(basePoints, uiStore.constraintMode);
		}

		// NOTE: Height scaling is applied at the T.Group transform level (scale={[1, heightScale, 1]})
		// NOT here in the geometry, to avoid double-scaling (heightScale²)

		// 5. Low Poly / Resolution Logic
		// DIRECTIVE 2: Resolution Slider controls Geometry Segments
		// roughness input (0-1) maps to segments:
		// 0 = Low Poly (6 segments - hexagonal/blocky)
		// 1 = High Poly (64 segments - smooth)
		const roughnessInput = sculpture.surface.textureRoughness ?? 0.5;

		// Map 0-1 to 6-64 segments
		// Use floor to get integer segments
		// Resolution 0.0 -> 6 segments
		// Resolution 1.0 -> 64 segments
		const segments = Math.floor(6 + roughnessInput * 58);

		// Apply flat shading effect if low resolution (poly look)
		// When resolution is low (< 0.3 / segments < 20), enable flat shading for style
		// Note: Material update happens in the template, geometry update happens here

		if (basePoints.length < 2) {
			throw new Error('Not enough points after processing');
		}

		// DIRECTIVE 2: Validate points for NaN before geometry creation
		const hasNaN = basePoints.some(p => isNaN(p.x) || isNaN(p.y));
		if (hasNaN) {
			throw new Error('NaN detected in points');
		}

		// 6. Generate Geometry from final deformed + modulated points
		const vectors = basePoints.map((p) => new Vector2(p.x, p.y));
		// Use dynamic segments count for Low Poly effect
		const geometry = new LatheGeometry(vectors, segments);

		// DIRECTIVE 2: Validate geometry after creation
		if (!geometry || !geometry.attributes.position) {
			throw new Error('Geometry generation returned invalid geometry');
		}

		// Check for NaN in positions
		const positions = geometry.attributes.position;
		const posArray = positions.array as Float32Array;
		const hasNaNInGeometry = Array.from(posArray).some((v) => !Number.isFinite(v) || Number.isNaN(v));
		if (hasNaNInGeometry) {
			throw new Error('NaN detected in geometry positions');
		}

		// DIRECTIVE 2B: Initialize vertex colors if saved colors exist or in glaze mode
		if (geometry.attributes.position) {
			const vertexCount = positions.count;

			// Check if sculpture has saved vertex colors
			if (sculpture.vertexColors && sculpture.vertexColors.length > 0) {
				const savedColorCount = sculpture.vertexColors.length / 3;
				
				if (savedColorCount === vertexCount) {
					// Perfect match - use saved colors directly
					const colors = new Float32Array(sculpture.vertexColors);
					const colorAttr = new BufferAttribute(colors, 3);
					colorAttr.setUsage(DynamicDrawUsage);
					geometry.setAttribute('color', colorAttr);
				} else {
					// Vertex count changed - resample colors by height
					console.log(
						`🎨 [SCULPTURE] Resampling colors: ${savedColorCount} → ${vertexCount} vertices`
					);
					const resampledColors = resampleVertexColors(
						sculpture.vertexColors,
						savedColorCount,
						vertexCount,
						geometry
					);
					const colorAttr = new BufferAttribute(resampledColors, 3);
					colorAttr.setUsage(DynamicDrawUsage);
					geometry.setAttribute('color', colorAttr);
				}
			} else if (uiStore.workspace === 'glaze') {
				// Initialize with base color if no saved colors
				const colors = new Float32Array(vertexCount * 3);
				const baseColorObj = new Color(materialColor);

				for (let i = 0; i < vertexCount; i++) {
					colors[i * 3] = baseColorObj.r;
					colors[i * 3 + 1] = baseColorObj.g;
					colors[i * 3 + 2] = baseColorObj.b;
				}

				const colorAttr = new BufferAttribute(colors, 3);
				colorAttr.setUsage(DynamicDrawUsage);
				geometry.setAttribute('color', colorAttr);
			}
		}

		// DIRECTIVE 1: Apply TRUE vertex-level twist (spiral deformation)
		if (sculpture.deformation && Math.abs(sculpture.deformation.twist) > 0.001) {
			applyVertexTwist(geometry, sculpture.deformation.twist);
		}

		// Recalculate normals for proper lighting
		geometry.computeVertexNormals();

		return geometry;
		} catch (e) {
			// DIRECTIVE 2: Safe Cylinder Fallback - ensure user always sees something
			console.warn('⚠️ [SCULPTURE] Geometry Generation Failed:', e);
			// Fallback: A simple Cylinder so we know the Renderer is alive (Red Flag)
			const fallbackCylinder = new CylinderGeometry(0.5, 0.5, 1, 32);
			fallbackCylinder.computeVertexNormals();
			return fallbackCylinder;
		}
	}

	// LIVE PREVIEW: Create geometry immediately when any relevant state changes
	// Watches: sculpture, sculptZone for real-time feedback
	// Runs only when NOT actively recording (to avoid performance issues)
	$effect(() => {
		const currentState = recordingStore.state;

		// Detect transition from 'recording' to any other state (processing/complete)
		const justStopped = previousRecordingState === 'recording' && currentState !== 'recording';
		previousRecordingState = currentState;

		if (!sculpture || !meshRef) {
			return;
		}

		// Skip during recording - let useTask handle live updates instead
		if (currentState === 'recording') {
			return;
		}

		// DIRECTIVE 1: Capture glaze colors BEFORE geometry disposal
		// When recording stops in glaze mode, extract colors from the mesh before recreating geometry
		const isGlazeMode = uiStore.workspace === 'glaze';

		if (isGlazeMode && justStopped && meshRef.geometry && meshRef.geometry.attributes.color) {
			const colorAttr = meshRef.geometry.attributes.color;
			if (colorAttr && colorAttr.array && colorAttr.array instanceof Float32Array) {
				// Extract the actual painted colors from the geometry buffer BEFORE disposal
				const savedColors = Array.from(colorAttr.array);
				// Save them to the sculpture store
				updateSculptureColors(new Float32Array(savedColors));
				console.log(
					`🎨 [SCULPTURE] Captured ${savedColors.length / 3} vertex colors before geometry recreation`
				);
			}
		}

		// Access reactive dependencies to trigger on their changes
		const currentSculpture = sculpture;
		const zoneMin = uiStore.sculptZone.min;
		const zoneMax = uiStore.sculptZone.max;

		// DIRECTIVE 2: Safe Cylinder Fallback is now handled inside createGeometryFromSculpture
		// Function now NEVER returns null - always returns valid geometry (fallback cylinder if needed)
		const geometryToRender = createGeometryFromSculpture(currentSculpture);
		
		if (geometryToRender && meshRef) {
			// DIRECTIVE 2: Apply zone visualization if zone is restricted
			// Show zone dimming when zone sliders are being adjusted
			const zoneIsRestricted = zoneMin > 0 || zoneMax < 1;

			if (zoneIsRestricted && currentSculpture.baseShape === 'lathe') {
				applyZoneVisualization(geometryToRender, zoneMin, zoneMax);
			}

			const oldGeom = meshRef.geometry;
			meshRef.geometry = geometryToRender;
			if (oldGeom) oldGeom.dispose();
			
			// Recalculate normals for lighting
			geometryToRender.computeVertexNormals();
		}
	});

	// DIRECTIVE 1: Colors are now captured in the geometry recreation effect above
	// This ensures colors are saved BEFORE geometry disposal

	// Update geometry in render loop for live audio modulation
	useTask(() => {
		// DIRECTIVE 2: Voice Links - Apply audio modulation to parameters
		if (recordingStore.state === 'recording' && sculpture) {
			const frame = analysisStore.latestFrame;
			if (frame) {
				// Apply voice link automation if any links are active
				const hasActiveLinks =
					voiceLinksStore.twist === 'pitch' || voiceLinksStore.roughness === 'timbre';

				if (hasActiveLinks) {
					// Create a copy of the sculpture with modulated parameters
					let modulated = sculpture;

					// DIRECTIVE 2A: Twist Link (Pitch) - Map pitch to twist
					if (voiceLinksStore.twist === 'pitch' && frame.pitch > 0) {
						const voiceTwist = pitchToTwist(frame.pitch);
						modulated = {
							...modulated,
							deformation: {
								...modulated.deformation,
								twist: voiceTwist
							}
						};
					}

					// DIRECTIVE 2B: Roughness Link (Timbre) - Map spectralCentroid to roughness
					if (voiceLinksStore.roughness === 'timbre') {
						const voiceRoughness = timbreToRoughness(frame.timbre.spectralCentroid);
						modulated = {
							...modulated,
							surface: {
								...modulated.surface,
								textureRoughness: voiceRoughness
							}
						};
					}

					// Update the sculpture with voice-modulated parameters
					if (modulated !== sculpture) {
						setCurrentSculpture(modulated);
					}
				}
			}
		}

		// PHASE 3: Sonic Force Mode (Raycasting & Deformation)
		if (uiStore.workspace === 'force') {
			if (meshRef && reticleRef && camera.current) {
				raycaster.setFromCamera(pointer, camera.current);
				const intersects = raycaster.intersectObject(meshRef);

				if (intersects.length > 0) {
					const intersect = intersects[0];
					const point = intersect.point;
					const normal = intersect.face?.normal?.clone().transformDirection(meshRef.matrixWorld) || new Vector3(0, 1, 0);
					
					// Update Reticle
					reticleRef.visible = true;
					reticleRef.position.copy(point);
					reticleRef.lookAt(point.clone().add(normal));
					
					// Reticle Radius (Pitch)
					// Map Pitch (50-1000Hz) to Radius (0.5 - 0.05)
					// Lower pitch = larger impact area
					const pitch = analysisStore.latestFrame?.pitch || 200;
					const normalizedPitch = Math.max(0, Math.min(1, (pitch - 50) / 950));
					const radius = 0.5 - (normalizedPitch * 0.45); // Range: 0.5 (low pitch) to 0.05 (high pitch)
					
					// Map Energy to Visual Scale pulsing
					const energy = analysisStore.latestFrame?.energy || 0;
					const pulse = 1 + energy * 0.5;
					
					// Scale reticle ring to match radius
					// RingGeometry default is inner 0.8, outer 1.0. We scale it.
					const scale = radius * pulse;
					reticleRef.scale.set(scale, scale, scale);

					// Reticle Color
					// Red = Push (Subtractive), Green = Pull (Additive)
					// Default to Push if not specified, but check sculptMode
					const isPull = uiStore.sculptMode === 'additive'; // Green
					const reticleMat = reticleRef.material as MeshBasicMaterial;
					reticleMat.color.set(isPull ? '#00ff00' : '#ff0000');

					// DEFORMATION LOGIC (Only when recording)
					if (recordingStore.state === 'recording') {
						const geometry = meshRef.geometry;
						const positions = geometry.attributes.position;
						const normals = geometry.attributes.normal;
						const localPoint = meshRef.worldToLocal(point.clone());
						
						// Parameters from Force Panel
						const damping = uiStore.forceParams.damping; // 0-1
						const hardness = uiStore.forceParams.hardness; // 0-1
						
						// Strength calculation
						// Energy (0-1) * Multiplier
						// Hardness reduces effect
						const forceStrength = (energy * 0.1) * (1 - hardness * 0.8);
						const direction = isPull ? 1 : -1;

						// DIRECTIVE: Apply damping to limit maximum displacement per frame
						// Damping (0-1): 0 = no limit (instant), 1 = very viscous (slow, smooth)
						// Higher damping = lower max displacement per frame = smoother deformation
						const maxDisplacementPerFrame = 0.05 * (1 - damping * 0.9); // Range: 0.05 (no damping) to 0.005 (max damping)

						const v = new Vector3();
						const n = new Vector3();
						let modified = false;

						for (let i = 0; i < positions.count; i++) {
							v.fromBufferAttribute(positions, i);
							const dist = v.distanceTo(localPoint);
							
							if (dist < radius) {
								// Falloff (Cosine window)
								const falloff = 0.5 * (1 + Math.cos((Math.PI * dist) / radius));
								
								// Get normal
								n.fromBufferAttribute(normals, i);
								
								// Calculate desired displacement
								const desiredDisplacement = forceStrength * falloff * direction;
								
								// Apply damping: clamp displacement to max per frame
								// This creates a viscous effect - higher damping = slower, smoother deformation
								const clampedDisplacement = Math.max(
									-maxDisplacementPerFrame,
									Math.min(maxDisplacementPerFrame, desiredDisplacement)
								);
								
								// Apply clamped displacement
								v.addScaledVector(n, clampedDisplacement);
								
								positions.setXYZ(i, v.x, v.y, v.z);
								modified = true;
							}
						}

						if (modified) {
							positions.needsUpdate = true;
							geometry.computeVertexNormals();
						}
					}

				} else {
					reticleRef.visible = false;
				}
			}
		} else if (reticleRef) {
			reticleRef.visible = false;
		}

		if (recordingStore.state === 'recording') {
			const frames = getCapturedFrames();
			const isGlazeMode = uiStore.workspace === 'glaze';

			if (isGlazeMode) {
				// GLAZE MODE: Non-destructive painting - use existing geometry, only update colors
				if (sculpture && meshRef && frames.length > 0) {
					// Use existing sculpture geometry (don't regenerate shape)
					const existingGeom = meshRef.geometry;
					if (existingGeom && existingGeom.attributes.position) {
						// Generate glaze colors from frames
						const glazeColors = generateGlaze(frames, uiStore.activeGlaze);

						// Apply colors to geometry
						// Map frame index to vertex rings (each frame corresponds to a ring of vertices)
						const positions = existingGeom.attributes.position;
						const vertexCount = positions.count;
						const ringCount = Math.floor(vertexCount / 32); // Assuming 32 segments per ring

						// Create color array matching vertex count
						const colors = new Float32Array(vertexCount * 3);
						const frameCount = Math.min(glazeColors.length / 3, ringCount);

						for (let ringIdx = 0; ringIdx < ringCount; ringIdx++) {
							const frameIdx = Math.floor((ringIdx / ringCount) * frameCount);
							const colorIdx = frameIdx * 3;

							// Get color for this ring
							const r = glazeColors[colorIdx] || 1;
							const g = glazeColors[colorIdx + 1] || 1;
							const b = glazeColors[colorIdx + 2] || 1;

							// Apply to all vertices in this ring (32 vertices per ring)
							for (let segIdx = 0; segIdx < 32; segIdx++) {
								const vertexIdx = ringIdx * 32 + segIdx;
								if (vertexIdx < vertexCount) {
									colors[vertexIdx * 3] = r;
									colors[vertexIdx * 3 + 1] = g;
									colors[vertexIdx * 3 + 2] = b;
								}
							}
						}

						const colorAttr = new BufferAttribute(colors, 3);
						colorAttr.setUsage(DynamicDrawUsage);
						existingGeom.setAttribute('color', colorAttr);
						
						// Mark for update
						const existingColorAttr = existingGeom.attributes.color;
						if (existingColorAttr) {
							existingColorAttr.needsUpdate = true;
						}
					}
				}
			} else {
				// SCULPT MODE: Update recording ring position and scale
				if (frames.length > 0 && liveMeshRef) {
					// Get the latest frame for current radius
					const latestFrame = frames[frames.length - 1];
					if (!latestFrame) return;

					// Calculate radius from latest frame energy
					const energy = latestFrame.energy || 0;
					const radius = SCULPTURE_BASE_RADIUS + energy * SCULPTURE_SENSITIVITY;
					const clampedRadius = Math.max(0.05, Math.min(SCULPTURE_MAX_RADIUS, radius));

					// Calculate Y position based on recording progress (0 to 2, matching sculpture height)
					// Progress is based on number of frames captured
					const maxFrames = 1200; // ~20 seconds at 60fps
					const progress = Math.min(1, frames.length / maxFrames);
					const yPosition = progress * 2.0; // Scale to 0-2 range

					// Update position to move up along Y-axis
					liveMeshRef.position.y = yPosition;
					
					// Update scale to change radius (RingGeometry has inner/outer radius of ~0.095-0.1, so scale to match target)
					const scale = clampedRadius * 10; // Scale up from 0.1 base radius
					liveMeshRef.scale.set(scale, scale, scale);
				}
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
		let points = ghost.radiusCurve.map((p) => ({ x: p.x, y: p.y }));

		// 2. Directive 2: Apply Deformations using consistent helper
		if (
			ghost.deformation &&
			(ghost.deformation.twist !== 0 || ghost.deformation.compression !== 0)
		) {
			points = applyDeformation(points, ghost.deformation);
		}

		if (points.length < 2) {
			return null;
		}

		// 3. Create geometry from deformed points
		// ISSUE 1 FIX: Crash Guard - Ensure all points are valid before mapping
		const validPoints = points.filter(
			(p) => p && typeof p.x === 'number' && typeof p.y === 'number'
		);
		if (validPoints.length < 2) {
			return null;
		}

		const vectorPoints = validPoints.map((p) => new Vector2(p.x, p.y));
		const geometry = new LatheGeometry(vectorPoints, 32);

		// DIRECTIVE 1: Apply vertex-level twist to ghost too
		if (ghost.deformation && Math.abs(ghost.deformation.twist) > 0.001) {
			applyVertexTwist(geometry, ghost.deformation.twist);
		}

		return geometry;
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

		return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
	}

	// Material Configuration
	const CLAY_COLOR_DEFAULT = DEFAULT_MATERIAL_CERAMIC;
	const PORCELAIN_COLOR = '#FFFFFF';

	// Derived material properties based on material type
	let isPlastic = $derived(sculpture?.surface.materialType === 'plastic');

	// Color Logic:
	// Ceramic: Blend between Clay and Porcelain based on Glaze Transmission
	// Plastic: Use baseColor or default to white, Glaze adds gloss
	let materialColor = $derived.by(() => {
		if (!sculpture) return PORCELAIN_COLOR;

		if (isPlastic) {
			const baseColor = sculpture.surface.baseColor || DEFAULT_MATERIAL_PLASTIC;
			// Dim pure white to #EEEEEE so highlights are visible
			return baseColor === '#FFFFFF' || baseColor === '#ffffff' ? '#EEEEEE' : baseColor;
		}

		// Ceramic Logic
		const base = sculpture.surface.baseColor || DEFAULT_MATERIAL_CERAMIC;
		// If glaze is high, we see more of the glaze (white/glass) or the underlying clay?
		// Actually, glaze usually adds a layer. If clear glaze, we see clay. If colored glaze, we see glaze.
		// Current simple logic: Interpolate to White (Porcelain look) as glaze increases
		return lerpColor(base, PORCELAIN_COLOR, sculpture.surface.glazeTransmission);
	});

	let ghostMaterialColor = $derived(
		sculptureStore.ghostSculpture
			? lerpColor(
					CLAY_COLOR_DEFAULT,
					PORCELAIN_COLOR,
					sculptureStore.ghostSculpture.surface.glazeTransmission
				)
			: '#8F3E48'
	);

	// Parent Rig Transform Values
	// Height scaling: Normalize to 150mm reference height
	// DIRECTIVE 3: Validate height scale to prevent NaN or 0
	let heightScale = $derived.by(() => {
		const height = sculpture?.physical.height;
		// DIRECTIVE 3: Enhanced validation - ensure height is valid and positive
		if (!height || height <= 0 || !Number.isFinite(height) || Number.isNaN(height)) {
			console.warn('⚠️ [SCULPTURE] Invalid height, using safe default:', height);
			return 1.0; // Safe default
		}
		const scale = height / 150;
		// DIRECTIVE 3: Ensure scale is valid, finite, and reasonable (prevent collapse)
		if (!Number.isFinite(scale) || Number.isNaN(scale) || scale <= 0 || scale > 10) {
			console.warn('⚠️ [SCULPTURE] Invalid height scale, using safe default:', scale);
			return 1.0; // Safe default (prevent scale collapse)
		}
		return scale;
	});

	// PHASE 2.2: RESTORE ORIENTATION ANIMATION
	// Smooth rotation animation for Pottery ↔ Lathe toggle using spring for fluidity
	const orientationSpring = spring(0, { stiffness: 0.05, damping: 0.25 });

	$effect(() => {
		const targetRotation = uiStore.orientation === 'horizontal' ? -Math.PI / 2 : 0;
		orientationSpring.set(targetRotation);
	});

	let orientationRotation = $derived($orientationSpring);
</script>

<!-- DIRECTIVE 1: Parent Rig - Unified Hierarchy for Main + Ghost
     Both meshes are siblings inside the same parent T.Group that receives scale and rotation.
     This ensures perfect 1:1 matching - no more "Matcha Whisk" artifact.
     
     DIRECTIVE 2: Axis Anchoring - Proper rotation pivot at origin (0,0,0)
     LatheGeometry generates around Y-axis with base at y=0.
     Rotating around Z-axis by -Math.PI/2 pivots at origin, laying geometry flat along X-axis.
     Pottery (Vertical): rotation [0, 0, 0] - base sits at y=0
     Lathe (Horizontal): rotation [0, 0, -Math.PI/2] - base sits at x=0, extends along X-axis
     
     Note: T.Group renders if sculpture exists OR recording is active (for Live mesh visualization)
-->
{#if sculpture || recordingStore.state === 'recording'}
	<!-- Parent Rig: All transforms applied here ensure Main and Ghost match perfectly -->
	<T.Group rotation={[0, 0, orientationRotation]} scale={[1, heightScale, 1]} position={[0, 0, 0]}>
		<!-- Main Sculpture (Always visible when sculpture exists) -->
		<!-- DIRECTIVE 1: Disable frustum culling to prevent invisible mesh when bounding box is invalid -->
		{#if sculpture}
			<T.Mesh bind:ref={meshRef} castShadow receiveShadow frustumCulled={false}>
				<!-- DIRECTIVE 3: Material Optimization
				     Threlte's <T.MeshPhysicalMaterial> uses Svelte's reactivity system.
				     Materials are NOT recreated on every frame - only props are updated when they change.
				     This prevents GPU thrashing and ensures efficient rendering.
				     The material instance persists and Three.js updates properties reactively.
				-->
				<!-- Material Switching -->
				{#if isPlastic}
					<!-- Plastic: Physical Material (tuned for visibility - semi-matte, less glare) -->
					<T.MeshPhysicalMaterial
						color={materialColor}
						roughness={Math.max(0.3, sculpture.surface.textureRoughness)}
						clearcoat={0.5}
						clearcoatRoughness={0.3}
						metalness={0.1}
						flatShading={false}
					/>
				{:else}
					<!-- Ceramic: Physical Material (transmission, clearcoat) -->
					<!-- DIRECTIVE 2: Fix Material Priority - use vertex colors if available, otherwise base color -->
					{@const hasVertexColors =
						(sculpture.vertexColors && sculpture.vertexColors.length > 0) ||
						uiStore.workspace === 'glaze' ||
						(recordingStore.state === 'recording' &&
							(uiStore.sculptZone.min > 0 || uiStore.sculptZone.max < 1))}
					<T.MeshPhysicalMaterial
						transmission={recordingStore.state === 'recording' ? 0 : sculpture.surface.glazeTransmission * 0.8}
						thickness={0.5}
						roughness={sculpture.surface.textureRoughness}
						clearcoat={Math.max(0, sculpture.surface.glazeTransmission)}
						clearcoatRoughness={0.1}
						color={hasVertexColors ? 'white' : materialColor}
						metalness={0.1}
						ior={1.5}
						envMapIntensity={1.0}
						vertexColors={hasVertexColors}
						opacity={1.0}
						transparent={false}
					/>
				{/if}
			</T.Mesh>
		{/if}

		<!-- Ghost Mesh - Now sibling to Main Mesh, shares parent scale/rotation -->
		<!-- DIRECTIVE 1 FIX: Ghost is now inside parent rig with main mesh (no more matcha whisk!) -->
		<!-- DIRECTIVE 3 FIX: Ghost material now subtle - transparent, low opacity, wireframe blueprint style -->
		<!-- DIRECTIVE 1: Disable frustum culling to prevent invisible mesh when bounding box is invalid -->
		{#if sculptureStore.ghostSculpture}
			<T.Mesh bind:ref={ghostMeshRef} frustumCulled={false}>
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

		<!-- PHASE 4.1: Subtractive Mode Visualization -->
		<!-- Show a faint block wireframe when in subtractive mode to show what's being carved from -->
		{#if sculpture?.physical.sculptMode === 'subtractive'}
			<T.Mesh position={[0.15, 1, 0]}>
				<T.BoxGeometry args={[0.3, 2, 0.3]} />
				<T.MeshBasicMaterial
					color="#888"
					opacity={0.1}
					transparent={true}
					wireframe={true}
					depthWrite={false}
				/>
			</T.Mesh>
		{/if}
	</T.Group>

	<!-- Live Sculpture (Visible ONLY during sculpt mode recording) -->
	<!-- DIRECTIVE 2: This recording ring should NOT conflict with AnalysisVisualizer -->
	<!-- AnalysisVisualizer handles lathe shapes, so this ring only shows for non-lathe shapes -->
	<!-- Recording ring is a horizontal disc (parallel to XZ floor) that moves up along Y-axis -->
	<!-- RingGeometry normal is along Z by default (XY plane), rotate -90° around X to make normal along Y (XZ plane/floor) -->
	<!-- Position and scale are updated in useTask based on recording progress and audio energy -->
	{#if recordingStore.state === 'recording' && uiStore.workspace === 'sculpt' && sculpture && (sculpture.baseShape || 'lathe') !== 'lathe'}
		<T.Mesh bind:ref={liveMeshRef} castShadow receiveShadow position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
			<!-- Fixed ring geometry: innerRadius=0.095, outerRadius=0.1, segments=32 -->
			<!-- Scale is updated in useTask to change apparent radius -->
			<T.RingGeometry args={[0.095, 0.1, 32]} />
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

	<!-- PHASE 3: Reticle for Sonic Force Mode -->
	<T.Mesh bind:ref={reticleRef} visible={false}>
		<!-- Ring geometry for reticle -->
		<T.RingGeometry args={[0.8, 1.0, 32]} />
		<T.MeshBasicMaterial color="#ff0000" side={DoubleSide} transparent opacity={0.8} />
	</T.Mesh>
{/if}
