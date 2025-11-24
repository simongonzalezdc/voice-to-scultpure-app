<script lang="ts">
	import { sculptureStore, setCurrentSculpture } from '$lib/stores/sculptureStore.svelte';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { DEFAULT_MATERIAL_CERAMIC, DEFAULT_MATERIAL_PLASTIC } from '$lib/types';
	import type { ConstraintMode } from '$lib/engine/constraints';
	import { generateLathe } from '$lib/engine/physicsMapping';
	import type { AnalysisFrame, SculptureLayer, LathePoint } from '$lib/types';

	// Modal state
	let isOpen = $derived(!sculptureStore.currentSculpture); // Show when no project active

	// Focus trap
	let modalElement = $state<HTMLDivElement | null>(null);
	let firstFocusableElement = $state<HTMLElement | null>(null);
	let lastFocusableElement = $state<HTMLElement | null>(null);

	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen) return;

		if (event.key === 'Tab') {
			if (event.shiftKey) {
				// Shift + Tab
				if (document.activeElement === firstFocusableElement) {
					event.preventDefault();
					lastFocusableElement?.focus();
				}
			} else {
				// Tab
				if (document.activeElement === lastFocusableElement) {
					event.preventDefault();
					firstFocusableElement?.focus();
				}
			}
		}
	}

	// Setup focus trap on open
	$effect(() => {
		if (isOpen && modalElement) {
			const focusableElements = modalElement.querySelectorAll(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			if (focusableElements.length > 0) {
				firstFocusableElement = focusableElements[0] as HTMLElement;
				lastFocusableElement = focusableElements[focusableElements.length - 1] as HTMLElement;
				firstFocusableElement.focus();
			}
		}
	});

	// Form state
	let height = $state(150); // Default 150mm
	let materialType = $state<'ceramic' | 'plastic'>('ceramic');
	let baseColor = $state(DEFAULT_MATERIAL_CERAMIC);
	let constraintMode = $state<ConstraintMode>('ceramic');

	// Color picker reference
	let colorInput = $state<HTMLInputElement | null>(null);

	// DIRECTIVE: Generate initial placeholder geometry
	// Creates a smooth bell curve from silence to represent a basic vase
	function createDefaultGeometry() {
		// Create 50 analysis frames of silence (quiet hum) to generate a smooth base shape
		const frames: AnalysisFrame[] = Array.from({ length: 50 }, (_, i) => ({
			time: i * 0.05,
			pitch: 200 + Math.sin((i / 50) * Math.PI) * 50, // Slight pitch variation
			energy: 0.15 + Math.sin((i / 50) * Math.PI) * 0.1, // Quiet breathing
			timbre: {
				spectralCentroid: 2000,
				zcr: 0.1,
				spectralFlux: 0.05
			}
		}));

		// Generate lathe profile from these frames
		const profile = generateLathe(frames, undefined, 'additive', undefined, constraintMode);
		return profile;
	}

	function handleCreateProject() {
		// Create new sculpture with initial settings
		const initialGeometry = createDefaultGeometry();

		// Convert LathePoint[] to Float32Array format [x, y, x, y, ...] for layer data
		const layerData = new Float32Array(initialGeometry.length * 2);
		for (let i = 0; i < initialGeometry.length; i++) {
			layerData[i * 2] = initialGeometry[i].x;
			layerData[i * 2 + 1] = initialGeometry[i].y;
		}

		// Create base layer from initial geometry
		const baseLayer: SculptureLayer = {
			id: crypto.randomUUID(),
			name: 'Base Layer',
			type: 'base',
			visible: true,
			locked: false,
			blendMode: 'overwrite',
			opacity: 1.0,
			data: layerData,
			mask: new Float32Array(initialGeometry.length).fill(1.0)
		};

		const newSculpture = {
			id: `sculpture-${Date.now()}`,
			name: `New ${materialType === 'ceramic' ? 'Ceramic' : 'Plastic'} Sculpture`,
			createdAt: Date.now(),
			layers: [baseLayer], // Required: Initialize with base layer
			baseShape: 'lathe' as const, // Default to lathe for new projects
			radiusCurve: initialGeometry,
			surface: {
				textureRoughness: 0.5,
				glazeTransmission: 0.3,
				displacementStrength: 0.1,
				materialType: materialType,
				baseColor: baseColor
			},
			deformation: {
				twist: 0,
				compression: 0,
				taper: 0
			},
			physical: {
				height: height,
				units: 'mm' as const,
				wallThickness: 3,
				orientation: 'vertical' as const,
				sculptMode: 'additive' as const
			}
		};

		// Update stores
		setCurrentSculpture(newSculpture);
		uiStore.constraintMode = constraintMode;

		console.log(
			'✨ [NEW PROJECT] Created with height:',
			height,
			'mm, material:',
			materialType,
			'constraints:',
			constraintMode
		);
	}

	function handleMaterialSelect(type: 'ceramic' | 'plastic') {
		materialType = type;
		baseColor = type === 'ceramic' ? DEFAULT_MATERIAL_CERAMIC : DEFAULT_MATERIAL_PLASTIC;
	}

	function handleConstraintSelect(mode: ConstraintMode) {
		constraintMode = mode;
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
		onkeydown={handleKeydown}
	>
		<div
			bind:this={modalElement}
			class="bg-surface-panel rounded-lg shadow-2xl max-w-md w-full p-6 border border-subtle"
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
		>
			<!-- Header -->
			<h1 id="modal-title" class="text-2xl font-bold text-primary mb-2">
				🏺 New Sculpture Project
			</h1>
			<p class="text-sm text-secondary mb-6">
				Start with a canvas. Customize your initial parameters, then refine with the sliders.
			</p>

			<!-- Form Content -->
			<div class="space-y-5">
				<!-- Target Height -->
				<div>
					<label for="new-project-height" class="block text-sm font-semibold text-secondary mb-2">
						📏 Target Height
					</label>
					<div class="flex gap-2 items-center">
						<input
							id="new-project-height"
							type="range"
							min="50"
							max="300"
							step="10"
							bind:value={height}
							class="flex-1 h-2 bg-subtle rounded cursor-pointer"
						/>
						<span class="text-sm font-medium text-primary min-w-[50px] text-right">
							{height}mm
						</span>
					</div>
					<p class="text-xs text-secondary opacity-75 mt-1">
						Typical mug: 100-150mm | Large vase: 200-300mm
					</p>
				</div>

				<!-- Material Selection -->
				<div>
					<p class="block text-sm font-semibold text-secondary mb-2">🎨 Material</p>
					<div class="flex gap-2">
						<button
							class="flex-1 py-3 px-4 rounded border-2 transition-all text-center {materialType ===
							'ceramic'
								? 'bg-brand-primary/20 border-brand-primary text-brand-primary'
								: 'bg-surface-alt border-subtle text-secondary hover:border-brand-primary/50'}"
							onclick={() => handleMaterialSelect('ceramic')}
						>
							<span class="text-lg">🏺</span>
							<div class="text-xs font-medium mt-1">Ceramic</div>
						</button>
						<button
							class="flex-1 py-3 px-4 rounded border-2 transition-all text-center {materialType ===
							'plastic'
								? 'bg-brand-primary/20 border-brand-primary text-brand-primary'
								: 'bg-surface-alt border-subtle text-secondary hover:border-brand-primary/50'}"
							onclick={() => handleMaterialSelect('plastic')}
						>
							<span class="text-lg">💠</span>
							<div class="text-xs font-medium mt-1">Plastic</div>
						</button>
					</div>
				</div>

				<!-- Base Color -->
				<div>
					<label
						for="new-project-base-color"
						class="block text-sm font-semibold text-secondary mb-2"
					>
						🎨 Base Color
					</label>
					<div class="flex gap-2 items-center">
						<input
							id="new-project-base-color"
							bind:this={colorInput}
							type="color"
							bind:value={baseColor}
							class="w-12 h-10 rounded cursor-pointer border border-subtle"
						/>
						<div class="flex-1">
							<p class="text-xs font-mono text-secondary">{baseColor.toUpperCase()}</p>
						</div>
						<button
							class="px-3 py-1.5 text-xs rounded border border-subtle text-secondary hover:bg-subtle transition"
							onclick={() => handleMaterialSelect(materialType)}
						>
							Reset
						</button>
					</div>
				</div>

				<!-- Fabrication Constraints -->
				<div>
					<p class="block text-sm font-semibold text-secondary mb-2">🔒 Fabrication Constraints</p>
					<div class="flex gap-2 flex-wrap">
						<button
							class="flex-1 min-w-[120px] py-2 px-3 text-xs rounded border transition-all {constraintMode ===
							'digital'
								? 'bg-brand-primary/20 border-brand-primary text-brand-primary'
								: 'bg-surface-alt border-subtle text-secondary hover:border-brand-primary/50'}"
							onclick={() => handleConstraintSelect('digital')}
							title="Unlimited creativity - may produce impossible shapes"
						>
							🪄 Digital
						</button>
						<button
							class="flex-1 min-w-[120px] py-2 px-3 text-xs rounded border transition-all {constraintMode ===
							'ceramic'
								? 'bg-brand-primary/20 border-brand-primary text-brand-primary'
								: 'bg-surface-alt border-subtle text-secondary hover:border-brand-primary/50'}"
							onclick={() => handleConstraintSelect('ceramic')}
							title="Pottery wheel physics - recommended for ceramics"
						>
							🏺 Ceramic
						</button>
						<button
							class="flex-1 min-w-[120px] py-2 px-3 text-xs rounded border transition-all {constraintMode ===
							'3d_print'
								? 'bg-brand-primary/20 border-brand-primary text-brand-primary'
								: 'bg-surface-alt border-subtle text-secondary hover:border-brand-primary/50'}"
							onclick={() => handleConstraintSelect('3d_print')}
							title="FDM printer constraints - solid geometry"
						>
							🖨️ 3D Print
						</button>
					</div>
					<p class="text-xs text-secondary opacity-75 mt-2">
						{#if constraintMode === 'digital'}
							Full creative freedom. May produce impossible or unmakeable shapes.
						{:else if constraintMode === 'ceramic'}
							Pottery wheel physics: hand access, smooth clay, stable base. Recommended!
						{:else}
							FDM printer constraints: 60° overhangs, solid geometry, bed adhesion.
						{/if}
					</p>
				</div>
			</div>

			<!-- Action Buttons -->
			<div class="flex gap-3 mt-7">
				<button
					class="flex-1 py-3 px-4 bg-brand-primary text-white rounded font-semibold hover:bg-brand-primary/90 transition"
					onclick={handleCreateProject}
				>
					✨ Create Project
				</button>
			</div>

			<!-- Info -->
			<p class="text-xs text-secondary opacity-50 mt-4 text-center">
				💡 Customize all parameters anytime in the Design tab
			</p>
		</div>
	</div>
{/if}

<style>
	input[type='range'] {
		accent-color: var(--color-brand-primary);
	}
</style>
