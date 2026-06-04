<script lang="ts">
	import { sculptureStore, addLayer, setCurrentSculpture } from '$lib/stores/sculptureStore.svelte';
	import { recordingStore, startRecording, stopRecording } from '$lib/stores/recording.svelte';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { Mic, ChevronRight, ChevronLeft, Wand2, Activity } from 'lucide-svelte';
	import LayerPanel from './LayerPanel.svelte';
	import { generateLathe } from '$lib/engine/physicsMapping';
	import { DEFAULT_HEIGHT_MM } from '$lib/config/constants';
	import type { SculptureLayer } from '$lib/types';

	type Step = 'shape' | 'detail' | 'glaze' | 'export';

	// Wizard State
	let currentStep = $state<Step>('shape');
	let isRecording = $derived(recordingStore.state === 'recording');

	// Real-time audio feedback
	const micLevel = $derived(analysisStore.micLevel);
	const latestFrame = $derived(analysisStore.latestFrame);
	const hasBeat = $derived(latestFrame?.beat === true);
	const quantizedNote = $derived((latestFrame as any)?.quantizedPitch?.note ?? null);
	const quantizedHue = $derived((latestFrame as any)?.quantizedPitch?.hue ?? null);

	// Step Configurations
	const STEPS: Record<
		Step,
		{
			title: string;
			prompt: string;
			hint: string;
			layerType: string | null;
			action: () => void;
		}
	> = {
		shape: {
			title: 'Define Silhouette',
			prompt: 'Sing a long, steady tone to shape the vase profile.',
			hint: 'Pitch controls the radius • Volume controls the height',
			layerType: 'base',
			action: () => ensureLayer('base')
		},
		detail: {
			title: 'Add Rhythmic Texture',
			prompt: 'Make percussive sounds (Pa! Ka! Ts!) to add beat-driven ribs.',
			hint: '🥁 Beat detection active • Pulses appear on rhythm hits',
			layerType: 'deformation',
			action: () => ensureLayer('deformation')
		},
		glaze: {
			title: 'Apply Musical Glaze',
			prompt: 'Sing a melody to paint harmonious colors.',
			hint: '🎵 Pitch quantization active • Colors follow musical scale',
			layerType: 'glaze',
			action: () => {
				ensureLayer('glaze');
				uiStore.workspace = 'glaze'; // Switch visualization
			}
		},
		export: {
			title: 'Finish & Export',
			prompt: 'Your masterpiece is ready.',
			hint: 'Download as STL, GLB, or high-res render',
			layerType: null,
			action: () => {}
		}
	} as const;

	const stepOrder: Step[] = ['shape', 'detail', 'glaze', 'export'];

	function applyWorkspaceForStep(step: Step) {
		if (step === 'glaze') {
			uiStore.workspace = 'glaze';
		} else if (step === 'export') {
			uiStore.workspace = 'export';
		} else {
			uiStore.workspace = 'sculpt';
		}
	}

	function setStep(step: Step) {
		currentStep = step;
		applyWorkspaceForStep(step);
		STEPS[step].action();
	}

	// Helper: Ensure a layer of type exists, or create it
	function ensureLayer(type: string) {
		if (!sculptureStore.currentSculpture) return;

		// Check if we already have a layer of this type that is active
		// Or just always add a new one? "Non-Destructive Layering" implies stacking.
		// For the Wizard, we probably want to start with one.
		// Let's check if the *latest* layer is of this type.
		const layers = sculptureStore.currentSculpture?.layers ?? [];
		const lastLayer = layers[layers.length - 1];

		if (!lastLayer || lastLayer.type !== type) {
			// Add new layer
			addLayer(type as any);
		}
	}

	function nextStep() {
		const currentIndex = stepOrder.indexOf(currentStep);
		const next = stepOrder[currentIndex + 1];
		if (next) {
			setStep(next);
		}
	}

	// AUDIT FIX: Implement back navigation and workspace sync for Wizard
	function prevStep() {
		const currentIndex = stepOrder.indexOf(currentStep);
		if (currentIndex > 0) {
			const prevStepValue = stepOrder[currentIndex - 1];
			if (prevStepValue) {
				setStep(prevStepValue);
			}
		}
	}

	function skipToExport() {
		setStep('export');
	}

	// Auto-initialize: Create sculpture if none exists
	$effect(() => {
		if (!sculptureStore.currentSculpture) {
			// Create a default cylinder sculpture for Performance Mode
			const defaultProfile = generateLathe([], null as any, 'additive', undefined, 'ceramic');
			const resolution = 128;
			const layerData = new Float32Array(resolution);
			for (let i = 0; i < resolution; i++) {
				layerData[i] = 0.5; // Default radius (cylinder shape)
			}

			const baseLayer: SculptureLayer = {
				id: crypto.randomUUID(),
				name: 'Base Layer',
				type: 'base',
				visible: true,
				locked: false,
				blendMode: 'overwrite',
				opacity: 1.0,
				data: layerData,
				mask: new Float32Array(resolution).fill(1.0),
				sourceFrameCount: 0
			};

			const newSculpture = {
				id: `sculpture-${Date.now()}`,
				name: 'Performance Sculpture',
				createdAt: Date.now(),
				layers: [baseLayer],
				baseShape: 'lathe' as const,
				radiusCurve: defaultProfile,
				physical: {
					height: DEFAULT_HEIGHT_MM,
					units: 'mm' as const,
					wallThickness: 3,
					orientation: 'vertical' as const,
					sculptMode: 'additive' as const
				}
			};
			setCurrentSculpture(newSculpture);
			console.log('🎭 [WIZARD] Created default sculpture for Performance Mode');
		}
	});

	// Ensure workspace reflects current step on mount
	$effect(() => {
		applyWorkspaceForStep(currentStep);
	});
</script>

<div class="flex h-full pointer-events-auto">
	<!-- Wizard Controls (Main Area) -->
	<div
		class="flex-1 flex flex-col bg-black/90 backdrop-blur-xl border-t border-white/10 p-4 relative overflow-hidden"
	>
		<!-- Step Progress -->
		<div class="flex items-center gap-2 mb-3 text-xs font-mono text-white/40">
			{#each Object.keys(STEPS) as step}
				<div
					class="flex items-center gap-2 {currentStep === step
						? 'text-brand-primary font-bold'
						: ''}"
				>
					<span class="w-4 h-4 rounded-full border border-current flex items-center justify-center">
						{#if step === currentStep}
							<div class="w-2 h-2 bg-current rounded-full"></div>
						{/if}
					</span>
					<span class="uppercase">{step}</span>
				</div>
				{#if step !== 'export'}
					<div class="w-4 h-px bg-white/10"></div>
				{/if}
			{/each}
		</div>

		<!-- Active Step Content -->
		<div class="flex-1 flex flex-col justify-center items-start gap-2 z-10">
			<h2 class="text-xl font-bold text-white flex items-center gap-2">
				<Wand2 size={20} class="text-brand-primary" />
				{STEPS[currentStep].title}
			</h2>
			<p class="text-sm text-white/70 max-w-md">
				{STEPS[currentStep].prompt}
			</p>
			<p class="text-xs text-white/40 font-mono max-w-md">
				{STEPS[currentStep].hint}
			</p>

			<!-- Real-time Audio Feedback -->
			{#if isRecording}
				<div class="mt-2 flex items-center gap-6">
					<!-- Mic Level Meter -->
					<div class="flex items-center gap-2">
						<Mic size={14} class="text-brand-primary" />
						<div class="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
							<div
								class="h-full bg-gradient-to-r from-brand-primary to-brand-secondary transition-all duration-75"
								style="width: {micLevel * 100}%"
							></div>
						</div>
						<span class="text-xs text-white/50 w-10">{Math.round(micLevel * 100)}%</span>
					</div>

					<!-- Beat Indicator (Detail Step) -->
					{#if currentStep === 'detail' && hasBeat}
						<div class="flex items-center gap-2 text-red-400 animate-pulse">
							<Activity size={16} />
							<span class="text-xs font-bold">BEAT!</span>
						</div>
					{/if}

					<!-- Pitch Display (Glaze Step) -->
					{#if currentStep === 'glaze' && quantizedNote}
						<div class="flex items-center gap-2">
							<div
								class="w-6 h-6 rounded-full border-2 border-white/30"
								style="background-color: hsl({quantizedHue}, 80%, 60%)"
							></div>
							<span class="text-sm font-mono text-white/80">{quantizedNote}</span>
						</div>
					{/if}

					<!-- Pitch Display (Shape Step) -->
					{#if currentStep === 'shape' && (latestFrame?.pitch ?? 0) > 0}
						<span class="text-xs text-white/50">{(latestFrame?.pitch ?? 0).toFixed(1)} Hz</span>
					{/if}
				</div>
			{/if}

			<!-- Recording Controls -->
			{#if currentStep !== 'export'}
				<div class="mt-2 flex items-center gap-3">
					<!-- AUDIT FIX: Back button for navigation -->
					{#if currentStep !== 'shape' && !isRecording}
						<button
							class="flex items-center gap-2 px-4 py-3 rounded-full border border-white/20 text-sm text-white hover:bg-white/10 hover:border-white/40 transition-colors"
							onclick={prevStep}
						>
							<ChevronLeft size={16} />
							<span>BACK</span>
						</button>
					{/if}

					<button
						class="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-base transition-all hover:scale-105 active:scale-95
						{isRecording
							? 'bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.4)]'
							: 'bg-white text-black hover:bg-brand-primary hover:text-white'}"
						onclick={async () => {
							if (isRecording) {
								await stopRecording();
							} else {
								startRecording();
							}
						}}
					>
						{#if isRecording}
							<div class="w-3 h-3 bg-white rounded-sm animate-pulse"></div>
							STOP RECORDING
						{:else}
							<Mic size={20} />
							START RECORDING
						{/if}
					</button>

					{#if !isRecording && (sculptureStore.currentSculpture?.layers?.length ?? 0) > 0}
						<button
							class="flex items-center gap-2 px-4 py-3 rounded-full border border-white/20 text-sm text-white hover:bg-white/10 hover:border-white/40 transition-colors"
							onclick={nextStep}
						>
							<span>NEXT STEP</span>
							<ChevronRight size={16} />
						</button>
					{/if}

					{#if !isRecording}
						<button
							class="flex items-center gap-2 px-4 py-3 rounded-full border border-white/20 text-xs text-white/70 hover:bg-white/10 hover:border-white/40 transition-colors"
							onclick={skipToExport}
						>
							<span>SKIP TO EXPORT</span>
						</button>
					{/if}
				</div>
			{/if}

			{#if currentStep === 'export'}
				<div class="mt-4">
					<button class="btn-primary"> EXPORT MODEL </button>
				</div>
			{/if}
		</div>

		<!-- Decorative Background -->
		<div
			class="absolute -right-20 -bottom-20 w-64 h-64 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none"
		></div>
	</div>

	<!-- Layer Panel (Sidebar) -->
	<LayerPanel />
</div>
