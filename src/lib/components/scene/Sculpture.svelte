	<script lang="ts">
	import { T } from '@threlte/core';
	import {
		sculptureStore,
		setCurrentSculpture,
		updateSculptureColors,
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
		Vector3,
		Mesh,
		Color,
		BufferAttribute,
		DynamicDrawUsage,
		BufferGeometry,
		IcosahedronGeometry,
		BoxGeometry,
		PlaneGeometry,
		CylinderGeometry,
		Raycaster
	} from 'three';
	import { useTask } from '@threlte/core';
	import { spring } from 'svelte/motion';
	import type { SculptureDefinition, LathePoint } from '$lib/types';
	import { DEFAULT_MATERIAL_CERAMIC, DEFAULT_MATERIAL_PLASTIC } from '$lib/types';
	import { applyDeformation, generateGlaze } from '$lib/engine/physicsMapping';
	import { applyConstraints, analyzeConstraints } from '$lib/engine/constraints';
	import {
		voiceLinksStore,
		pitchToTwist,
		timbreToRoughness
	} from '$lib/stores/voiceLinksStore.svelte';
	import { DEFAULT_HEIGHT_MM } from '$lib/config/constants';

	let { sculpture } = $props<{ sculpture: SculptureDefinition | null }>();

	// Raw mesh references (managed by bind:ref) to avoid Svelte 5 proxying issues
	let meshRef = $state<Mesh | undefined>(undefined);
	let ghostMeshRef = $state<Mesh | undefined>(undefined);

	// State tracking for recording transitions
	let previousRecordingState = $state<RecordingState>('idle');

	// Raycaster for force interactions
	const raycaster = new Raycaster();
	const pointer = $state({ x: 0, y: 0 });

	// Set mesh reference in store for color capture
	$effect(() => {
		setMeshReference(meshRef || null);
	});

	// Material Configuration
	const CLAY_COLOR_DEFAULT = DEFAULT_MATERIAL_CERAMIC;
	const PORCELAIN_COLOR = '#FFFFFF';

	// Derived material properties based on material type
	let isPlastic = $derived(sculpture?.surface.materialType === 'plastic');

	// Color Logic for material
	let materialColor = $derived.by(() => {
		if (!sculpture) return PORCELAIN_COLOR;

		if (isPlastic) {
			const baseColor = sculpture.surface.baseColor || DEFAULT_MATERIAL_PLASTIC;
			return baseColor === '#FFFFFF' || baseColor === '#ffffff' ? '#EEEEEE' : baseColor;
		}

		// Ceramic Logic
		const base = sculpture.surface.baseColor || DEFAULT_MATERIAL_CERAMIC;
		return base;
	});

	let ghostMaterialColor = $derived(
		sculptureStore.ghostSculpture
			? CLAY_COLOR_DEFAULT
			: '#8F3E48'
	);

	// Optimized Material Properties - All reactive, no conditional rendering
	let materialProps = $derived.by(() => {
		if (!sculpture) return {};

		const hasVertexColors =
			(sculpture.vertexColors && sculpture.vertexColors.length > 0) ||
			uiStore.workspace === 'glaze' ||
			(recordingStore.state === 'recording' &&
				(uiStore.sculptZone.min > 0 || uiStore.sculptZone.max < 1));

		if (isPlastic) {
			// Plastic material properties
			return {
				color: materialColor,
				roughness: Math.max(0.3, sculpture.surface.textureRoughness),
				clearcoat: 0.5,
				clearcoatRoughness: 0.3,
				metalness: 0.1,
				flatShading: false,
				// Ensure consistent material type
				transmission: 0,
				thickness: 0,
				ior: 1.0,
				envMapIntensity: 1.0,
				vertexColors: hasVertexColors,
				opacity: 1.0,
				transparent: false
			};
		} else {
			// Ceramic material properties
			return {
				transmission: recordingStore.state === 'recording'
					? 0
					: sculpture.surface.glazeTransmission * 0.8,
				thickness: 0.5,
				roughness: sculpture.surface.textureRoughness,
				clearcoat: Math.max(0, sculpture.surface.glazeTransmission),
				clearcoatRoughness: 0.1,
				color: hasVertexColors ? 'white' : materialColor,
				metalness: 0.1,
				ior: 1.5,
				envMapIntensity: 1.0,
				vertexColors: hasVertexColors,
				opacity: 1.0,
				transparent: false
			};
		}
	});

	// Parent Rig Transform Values
	let heightScale = $derived.by(() => {
		const height = sculpture?.physical.height;
		if (!height || height <= 0 || !Number.isFinite(height) || Number.isNaN(height)) {
			return 1.0;
		}
		const scale = height / DEFAULT_HEIGHT_MM;
		if (!Number.isFinite(scale) || Number.isNaN(scale) || scale <= 0 || scale > 10) {
			return 1.0;
		}
		return scale;
	});

	// PHASE 2.2: RESTORE ORIENTATION ANIMATION
	const orientationSpring = spring(0, { stiffness: 0.05, damping: 0.25 });

	$effect(() => {
		const targetRotation = uiStore.orientation === 'horizontal' ? -Math.PI / 2 : 0;
		orientationSpring.set(targetRotation);
	});

	let orientationRotation = $derived($orientationSpring);

	// Geometry Creation Function
	function createGeometryFromSculpture(sculpture: SculptureDefinition): BufferGeometry {
		try {
			// Base shape selection - default to lathe for complex sculptures
			const shape = (sculpture as any).surface.shape || 'lathe';
			
			let geometry: BufferGeometry;
			
			if (shape === 'lathe') {
				// Generate lathe geometry from profile points
				const basePoints = (sculpture as any).surface.profile?.points || [];
				
				if (basePoints.length < 2) {
					// Fallback to cylinder if insufficient points
					geometry = new CylinderGeometry(0.5, 0.5, 1, 32);
				} else {
					// Convert profile points to Vector2 array for LatheGeometry
					const vectors = basePoints.map((p: any) => new Vector2(p.x, p.y));
					
					// Calculate segments based on texture roughness
					const segments = Math.max(
						6,
						Math.min(64, Math.floor(sculpture.surface.textureRoughness * 32))
					);
					
					geometry = new LatheGeometry(vectors, segments);
					
					// Apply vertex-level deformations if specified
					if (sculpture.deformation) {
						// Apply twist deformation
						if (Math.abs(sculpture.deformation.twist) > 0.001) {
							applyVertexTwist(geometry, sculpture.deformation.twist);
						}
						
						// Apply compression/taper if needed
						if (sculpture.deformation.compression !== 1.0) {
							applyCompression(geometry, sculpture.deformation.compression);
						}
					}
					
					// CRITICAL: Color hydration - restore vertex colors if they exist
					if (sculpture.vertexColors && sculpture.vertexColors.length > 0) {
						const vertexCount = geometry.attributes.position.count;
						const expectedColorCount = vertexCount * 3; // RGB per vertex
						
						// Check if color array length matches vertex count
						if (sculpture.vertexColors.length >= expectedColorCount) {
							// Create Float32BufferAttribute from stored colors
							const colorArray = new Float32Array(sculpture.vertexColors.slice(0, expectedColorCount));
							const colorAttribute = new BufferAttribute(colorArray, 3);
							geometry.setAttribute('color', colorAttribute);
							
							console.log(`🎨 [SCULPTURE] Hydrated ${vertexCount} vertices with colors`);
						} else {
							console.warn(`⚠️ [SCULPTURE] Color array length mismatch: have ${sculpture.vertexColors.length}, need ${expectedColorCount}`);
						}
					}
					
					// Recalculate normals after geometry modifications
					geometry.computeVertexNormals();
				}
			} else {
				// Handle other basic shapes as fallbacks
				switch (shape) {
					case 'sphere':
						geometry = new IcosahedronGeometry(0.5, 2);
						break;
					case 'cube':
						geometry = new BoxGeometry(1, 1, 1);
						break;
					case 'plane':
						geometry = new PlaneGeometry(1, 1);
						break;
					default:
						geometry = new CylinderGeometry(0.5, 0.5, 1, 32);
				}
			}
			
			return geometry;
			
		} catch (error) {
			console.error('❌ [SCULPTURE] Geometry creation failed:', error);
			// Return fallback cylinder geometry on error
			return new CylinderGeometry(0.5, 0.5, 1, 32);
		}
	}

	// Helper function to apply vertex twist deformation
	function applyVertexTwist(geometry: BufferGeometry, twistAmount: number): void {
		const positionAttribute = geometry.attributes.position;
		const positions = positionAttribute.array as Float32Array;
		
		// Get bounding box to determine height range
		geometry.computeBoundingBox();
		const boundingBox = geometry.boundingBox;
		const height = boundingBox ? boundingBox.max.y - boundingBox.min.y : 2;
		
		for (let i = 0; i < positions.length; i += 3) {
			const x = positions[i];
			const y = positions[i + 1];
			const z = positions[i + 2];
			
			// Normalize Y position to 0-1 range
			const normalizedY = boundingBox ? (y - boundingBox.min.y) / height : (y + 1) / 2;
			
			// Apply twist based on height position
			const twistAngle = twistAmount * normalizedY * Math.PI;
			const cosTwist = Math.cos(twistAngle);
			const sinTwist = Math.sin(twistAngle);
			
			// Rotate X and Z around Y axis
			positions[i] = x * cosTwist - z * sinTwist;
			positions[i + 2] = x * sinTwist + z * cosTwist;
		}
		
		positionAttribute.needsUpdate = true;
	}

	// Helper function to apply compression deformation
	function applyCompression(geometry: BufferGeometry, compression: number): void {
		const positionAttribute = geometry.attributes.position;
		const positions = positionAttribute.array as Float32Array;
		
		for (let i = 0; i < positions.length; i += 3) {
			// Compress Y coordinate (height)
			positions[i + 1] *= compression;
		}
		
		positionAttribute.needsUpdate = true;
	}

	// Reactive geometry creation
	let currentGeometry = $derived.by(() => {
		if (!sculpture) return null;
		return createGeometryFromSculpture(sculpture);
	});
</script>

{#if sculpture || recordingStore.state === 'recording'}
	<!-- Parent Rig: All transforms applied here ensure Main and Ghost match perfectly -->
	<T.Group rotation={[0, 0, orientationRotation]} scale={[1, heightScale, 1]} position={[0, 0, 0]}>
		<!-- Main Sculpture (Always visible when sculpture exists) -->
		{#if sculpture && currentGeometry}
			<T.Mesh bind:ref={meshRef} geometry={currentGeometry} castShadow receiveShadow frustumCulled={false}>
				<!-- Single Material Component with Reactive Props - No Conditional Rendering -->
				<T.MeshPhysicalMaterial {...materialProps} />
			</T.Mesh>
		{/if}

		<!-- Ghost Mesh - Visible when enabled and not during recording -->
		{#if sculptureStore.ghostSculpture}
			<T.Mesh
				bind:ref={ghostMeshRef}
				frustumCulled={false}
				visible={uiStore.showGhost && recordingStore.state !== 'recording'}
			>
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
{/if}
