<script lang="ts">
	import { recordingStore } from '$lib/stores/recording.svelte';
	import { sculptureStore, addLayer, createLayerFromFrames, removeLayer } from '$lib/stores/sculptureStore.svelte';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import type { LayerType } from '$lib/types';
	import { generateLathe } from '$lib/engine/physicsMapping';

	// Props
	let { onComplete, onCancel }: { onComplete?: () => void; onCancel?: () => void } = $props();

	// Wizard state
	let currentStep = $state(0);
	let isRecording = $state(false);
	let recordedFrames = $state<any[]>([]);

	const steps: Array<{
		title: string;
		description: string;
		instruction: string;
		layerType: LayerType;
		icon: string;
	}> = [
		{
			title: 'Step 1: The Body',
			description: 'Define the base shape with a steady note',
			instruction: 'Sing a long, steady note (like "Ahhhhh") to create the foundation of your sculpture.',
			layerType: 'base',
			icon: '🏺'
		},
		{
			title: 'Step 2: The Pulse',
			description: 'Add rhythmic variations',
			instruction: 'Make percussive sounds (like "Ka-Ka-Ka" or beat-box) to create ribs and pulses.',
			layerType: 'distortion',
			icon: '🥁'
		},
		{
			title: 'Step 3: The Surface',
			description: 'Add texture and detail',
			instruction: 'Whisper, growl, or make gritty sounds to add surface texture and roughness.',
			layerType: 'texture',
			icon: '🌊'
		},
		{
			title: 'Step 4: The Glaze',
			description: 'Paint with your voice',
			instruction: 'Sing a melody to add color. Higher notes = different colors. Louder = brighter.',
			layerType: 'color',
			icon: '🎨'
		}
	];

	const currentStepData = $derived(steps[currentStep]);

	async function startRecording() {
		if (recordingStore.isRecording) return;

		isRecording = true;
		recordedFrames = [];
		console.log(`🎙️ [WIZARD] Starting ${currentStepData.layerType} layer recording`);

		// TODO: Connect to actual recording system
		// For now, we'll simulate by collecting frames from analysisStore
	}

	function stopRecording() {
		if (!recordingStore.isRecording) {
			isRecording = false;
			return;
		}

		isRecording = false;
		console.log(`⏹️ [WIZARD] Stopped recording, ${recordedFrames.length} frames captured`);

		// Process recorded frames into a layer
		if (recordedFrames.length > 0) {
			processRecordingIntoLayer();
		}
	}

	function processRecordingIntoLayer() {
		const stepData = currentStepData;

		// Convert frames to radius data using generateLathe
		// This creates a Float32Array of x,y pairs (radius, height)
		const lathePoints = generateLathe(recordedFrames);

		// Flatten to Float32Array
		const data = new Float32Array(lathePoints.length * 2);
		for (let i = 0; i < lathePoints.length; i++) {
			data[i * 2] = lathePoints[i].x;
			data[i * 2 + 1] = lathePoints[i].y;
		}

		// Create and add layer
		const layer = createLayerFromFrames(stepData.layerType, stepData.title, data);

		addLayer(layer);

		console.log(`✨ [WIZARD] Created ${stepData.layerType} layer with ${lathePoints.length} points`);
	}

	function nextStep() {
		if (isRecording) {
			stopRecording();
		}

		if (currentStep < steps.length - 1) {
			currentStep++;
		} else {
			// Wizard complete
			console.log('🎉 [WIZARD] Performance complete!');
			onComplete?.();
		}
	}

	function previousStep() {
		if (isRecording) {
			stopRecording();
		}

		if (currentStep > 0) {
			currentStep--;
		}
	}

	function undoCurrentLayer() {
		// Remove the most recent layer of the current type
		const layerType = currentStepData.layerType;
		const layer = sculptureStore.layers.findLast((l) => l.type === layerType);

		if (layer) {
			removeLayer(layer.id);
			console.log(`🔙 [WIZARD] Undid ${layerType} layer`);
		}
	}

	function cancel() {
		if (isRecording) {
			stopRecording();
		}
		onCancel?.();
	}

	// Real-time mic level visualization
	const micLevel = $derived(analysisStore.micLevel);
	const pitch = $derived(analysisStore.latestFrame?.pitch || 0);
</script>

<div class="wizard-overlay">
	<!-- Progress Bar -->
	<div class="progress-bar">
		{#each steps as step, i}
			<div class="progress-step" class:active={i === currentStep} class:completed={i < currentStep}>
				<div class="step-icon">{step.icon}</div>
				<div class="step-label">{step.title.split(':')[0]}</div>
			</div>
		{/each}
	</div>

	<!-- Main Content -->
	<div class="wizard-content">
		<h1>{currentStepData.title}</h1>
		<p class="description">{currentStepData.description}</p>

		<!-- Instruction Card -->
		<div class="instruction-card">
			<div class="instruction-icon">{currentStepData.icon}</div>
			<p class="instruction">{currentStepData.instruction}</p>
		</div>

		<!-- Mic Level Meter -->
		<div class="mic-meter">
			<div class="meter-label">Mic Input</div>
			<div class="meter-bar">
				<div class="meter-fill" style="width: {micLevel * 100}%"></div>
			</div>
			{#if pitch > 0}
				<div class="pitch-display">{Math.round(pitch)} Hz</div>
			{/if}
		</div>

		<!-- Recording Status -->
		{#if isRecording}
			<div class="recording-status">
				<div class="recording-pulse"></div>
				<span>Recording... ({recordedFrames.length} frames)</span>
			</div>
		{/if}
	</div>

	<!-- Controls -->
	<div class="wizard-controls">
		<button class="btn-secondary" onclick={cancel}>Cancel</button>

		<div class="main-controls">
			{#if currentStep > 0}
				<button class="btn-secondary" onclick={previousStep}>← Previous</button>
			{/if}

			{#if !isRecording}
				<button class="btn-primary btn-record" onclick={startRecording}>
					🎙️ Start Recording
				</button>
			{:else}
				<button class="btn-danger" onclick={stopRecording}>⏹️ Stop Recording</button>
			{/if}

			<button class="btn-secondary" onclick={undoCurrentLayer}>↩️ Undo Layer</button>
		</div>

		<button class="btn-primary" onclick={nextStep}>
			{currentStep === steps.length - 1 ? 'Complete ✓' : 'Next Step →'}
		</button>
	</div>
</div>

<style>
	.wizard-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.95);
		backdrop-filter: blur(10px);
		z-index: 1000;
		display: flex;
		flex-direction: column;
		padding: 2rem;
		color: white;
	}

	.progress-bar {
		display: flex;
		justify-content: center;
		gap: 2rem;
		margin-bottom: 3rem;
	}

	.progress-step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		opacity: 0.4;
		transition: opacity 0.3s;
	}

	.progress-step.active {
		opacity: 1;
		transform: scale(1.1);
	}

	.progress-step.completed {
		opacity: 0.7;
	}

	.step-icon {
		font-size: 2rem;
		width: 3rem;
		height: 3rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		border: 2px solid rgba(255, 255, 255, 0.2);
	}

	.progress-step.active .step-icon {
		background: rgba(255, 255, 255, 0.2);
		border-color: var(--jewel-garnet);
		box-shadow: 0 0 20px rgba(219, 112, 147, 0.5);
	}

	.progress-step.completed .step-icon {
		background: rgba(46, 213, 115, 0.2);
		border-color: #2ed573;
	}

	.step-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.wizard-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		max-width: 800px;
		margin: 0 auto;
		text-align: center;
	}

	h1 {
		font-size: 2.5rem;
		margin-bottom: 1rem;
		background: linear-gradient(135deg, var(--jewel-garnet), var(--jewel-topaz));
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.description {
		font-size: 1.2rem;
		opacity: 0.8;
		margin-bottom: 2rem;
	}

	.instruction-card {
		background: rgba(255, 255, 255, 0.05);
		border: 2px solid rgba(255, 255, 255, 0.1);
		border-radius: 1rem;
		padding: 2rem;
		margin-bottom: 2rem;
		max-width: 600px;
	}

	.instruction-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.instruction {
		font-size: 1.1rem;
		line-height: 1.6;
		color: rgba(255, 255, 255, 0.9);
	}

	.mic-meter {
		width: 100%;
		max-width: 400px;
		margin: 2rem 0;
	}

	.meter-label {
		font-size: 0.9rem;
		margin-bottom: 0.5rem;
		opacity: 0.7;
	}

	.meter-bar {
		height: 2rem;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 1rem;
		overflow: hidden;
		position: relative;
	}

	.meter-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--jewel-garnet), var(--jewel-topaz));
		transition: width 0.1s ease-out;
		border-radius: 1rem;
	}

	.pitch-display {
		margin-top: 0.5rem;
		font-size: 0.9rem;
		opacity: 0.8;
	}

	.recording-status {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 2rem;
		background: rgba(255, 0, 0, 0.2);
		border: 2px solid rgba(255, 0, 0, 0.5);
		border-radius: 2rem;
		margin-top: 1rem;
		animation: pulse 2s infinite;
	}

	.recording-pulse {
		width: 0.75rem;
		height: 0.75rem;
		background: #ff4757;
		border-radius: 50%;
		animation: pulse-dot 1s infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}

	@keyframes pulse-dot {
		0%,
		100% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: scale(1.3);
			opacity: 0.7;
		}
	}

	.wizard-controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-top: 2rem;
	}

	.main-controls {
		display: flex;
		gap: 1rem;
	}

	.btn-primary,
	.btn-secondary,
	.btn-danger {
		padding: 1rem 2rem;
		font-size: 1rem;
		font-weight: 600;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary {
		background: linear-gradient(135deg, var(--jewel-garnet), var(--jewel-topaz));
		color: white;
	}

	.btn-primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(219, 112, 147, 0.4);
	}

	.btn-secondary {
		background: rgba(255, 255, 255, 0.1);
		color: white;
		border: 2px solid rgba(255, 255, 255, 0.2);
	}

	.btn-secondary:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	.btn-danger {
		background: rgba(255, 71, 87, 0.2);
		color: #ff4757;
		border: 2px solid #ff4757;
	}

	.btn-danger:hover {
		background: rgba(255, 71, 87, 0.3);
	}

	.btn-record {
		font-size: 1.1rem;
		padding: 1.2rem 2.5rem;
	}
</style>

