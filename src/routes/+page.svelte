<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import MainScene from '$lib/components/scene/MainScene.svelte';
	import Transport from '$lib/components/controls/Transport.svelte';
	import { Canvas } from '@threlte/core';
	import AIPanel from '$lib/components/panels/AIPanel.svelte';
	import ProjectList from '$lib/components/library/ProjectList.svelte';
	import CapabilityGuard from '$lib/components/layout/CapabilityGuard.svelte';
	import Tutorial from '$lib/components/onboarding/Tutorial.svelte';
	import ErrorBoundary from '$lib/components/layout/ErrorBoundary.svelte';
	import SettingsPanel from '$lib/components/panels/SettingsPanel.svelte';
	import Inspector from '$lib/components/layout/Inspector.svelte';
	import Toolbar from '$lib/components/layout/Toolbar.svelte';
	import WorkspaceSwitcher from '$lib/components/layout/WorkspaceSwitcher.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import KeyboardShortcutsModal from '$lib/components/modals/KeyboardShortcutsModal.svelte';
	import DebugOverlay from '$lib/components/debug/DebugOverlay.svelte';
	import {
		uiStore,
		startOnboarding,
		togglePanel,
		setOrientation,
		setWorkspace,
		openPerformanceWizard,
		closePerformanceWizard
	} from '$lib/stores/uiStore.svelte';
	import { appSettings, resetCalibration } from '$lib/stores/appSettingsStore.svelte';
	import { sculptureStore, setCurrentSculpture } from '$lib/stores/sculptureStore.svelte';
	import {
		recordingStore,
		getPlaybackFrames,
		hasCapturedFrames
	} from '$lib/stores/recording.svelte';
	import type { SculptureDefinition, SculptureLayer } from '$lib/types';
	import { createSculptureFromFrames, generateLathe } from '$lib/engine/physicsMapping';
	import ViewportControls from '$lib/components/scene/ViewportControls.svelte';
	import { DEFAULT_MATERIAL_CERAMIC } from '$lib/types';
	import { Sparkles, X } from 'lucide-svelte';
	import { resetVoiceLinks } from '$lib/stores/voiceLinksStore.svelte';
	import Wizard from '$lib/components/wizard/Wizard.svelte';
	import { clearLayers } from '$lib/stores/sculptureStore.svelte';
	import GoldenGuide from '$lib/components/overlay/GoldenGuide.svelte';

	// Gatekeeper: Check if user has calibrated
	let isCalibrated = $derived(appSettings.userProfile?.calibrated === true);
	let showStudio = $derived(isCalibrated && !uiStore.onboarding.active);

	// Auto-create default sculpture if none exists
	function createDefaultSculpture() {
		if (sculptureStore.currentSculpture) return;

		// Generate smooth default geometry
		const defaultFrames = Array.from({ length: 50 }, (_, i) => ({
			time: i * 0.05,
			pitch: 200 + Math.sin((i / 50) * Math.PI) * 50,
			energy: 0.15 + Math.sin((i / 50) * Math.PI) * 0.1,
			timbre: { spectralCentroid: 2000, zcr: 0.1, spectralFlux: 0.05 }
		}));

		const profile = generateLathe(defaultFrames, undefined, 'additive', undefined, 'ceramic');
		const resolution = 128;
		const layerData = new Float32Array(resolution);
		
		const profileLen = profile?.length ?? 1;
		for (let i = 0; i < resolution; i++) {
			const normalizedY = i / (resolution - 1);
			const targetIndex = Math.round(normalizedY * (profileLen - 1));
			const clampedIndex = Math.min(targetIndex, profileLen - 1);
			const point = profile?.[clampedIndex];
			layerData[i] = point?.x ?? 0.5;
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
			mask: new Float32Array(resolution).fill(1.0)
		};

		const defaultSculpture: SculptureDefinition = {
			id: `sculpture-${Date.now()}`,
			name: 'New Ceramic Sculpture',
			createdAt: Date.now(),
			layers: [baseLayer],
			baseShape: 'lathe',
			radiusCurve: profile,
			physical: {
				height: 150,
				units: 'mm',
				wallThickness: 3,
				orientation: 'vertical',
				sculptMode: 'additive'
			}
		};

		setCurrentSculpture(defaultSculpture);
		console.log('✨ [AUTO-CREATE] Default sculpture created');
	}

	onMount(() => {
		if (browser) {
			if (!isCalibrated) {
				startOnboarding('welcome');
			}
			// Auto-create default sculpture on mount
			createDefaultSculpture();
		}
	});

	// LIVE PREVIEW: Reactive regeneration
	// REFACTORED: Use $derived to compute regeneration key instead of $effect for state synchronization
	// According to Svelte docs: "Avoid using $effect to synchronise state. Use $derived instead."
	
	// Compute regeneration key using $derived (pure computation, no side effects)
	const regenerationKey = $derived.by(() => {
		// Skip if recording or no sculpture
		if (recordingStore.state === 'recording' || recordingStore.state === 'processing') return null;
		if (!sculptureStore.currentSculpture || !hasCapturedFrames()) return null;
		
		// Skip if using Layer System (no legacy regeneration needed)
		if (sculptureStore.currentSculpture.layers && sculptureStore.currentSculpture.layers.length > 0) {
			return null;
		}
		
		// Return regeneration key (stringified state)
		const currentConstraintMode = uiStore.constraintMode;
		const currentSculptMode = uiStore.sculptMode;
		const currentZone = uiStore.sculptZone;
		
		return JSON.stringify({
			mode: currentConstraintMode,
			sculptMode: currentSculptMode,
			zone: `${currentZone.min}-${currentZone.max}`,
			history: recordingStore.historyPosition
		});
	});
	
	// Track previous key to detect changes
	let previousRegenerationKey = $state<string | null>(null);
	
	// Use $effect only for the side effect (regenerating sculpture), not for state synchronization
	$effect(() => {
		const key = regenerationKey;
		
		// Skip if no key (recording, no sculpture, or using layers)
		if (key === null) {
			previousRegenerationKey = null;
			return;
		}
		
		// Skip if key hasn't changed (no regeneration needed)
		if (key === previousRegenerationKey) {
			return;
		}
		
		// Initialize previous key on first run
		if (previousRegenerationKey === null) {
			previousRegenerationKey = key;
			return;
		}
		
		// Key changed - regenerate sculpture (this is a valid side effect)
		previousRegenerationKey = key;
		
		// Parse key to get state values
		const state = JSON.parse(key);
		const frames = getPlaybackFrames();
		const currentSculpture = sculptureStore.currentSculpture;
		if (!currentSculpture) return;
		
		const zone = state.zone !== '0-1' ? {
			min: parseFloat(state.zone.split('-')[0]),
			max: parseFloat(state.zone.split('-')[1])
		} : undefined;

		const regenerated = createSculptureFromFrames(
			frames,
			appSettings.userProfile,
			currentSculpture.name,
			state.sculptMode,
			zone,
			state.mode
		);

		regenerated.physical = { ...currentSculpture.physical, sculptMode: state.sculptMode };

		setCurrentSculpture(regenerated);
	});

	function generateTestMesh() {
		// ... existing test mesh code ...
		const testSculpture: SculptureDefinition = {
			id: crypto.randomUUID(),
			name: 'Test Mesh (Hourglass)',
			createdAt: Date.now(),
			// NEW LAYER SYSTEM INITIALIZATION
			layers: [],
			physical: { height: 150, units: 'mm', orientation: 'vertical', sculptMode: 'additive' }
		};
		setCurrentSculpture(testSculpture);
	}

	// Keyboard Shortcuts
	let showKeyboardShortcuts = $state(false);
	function handleKeydown(event: KeyboardEvent) {
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
		if (event.key === '?' && event.shiftKey) {
			event.preventDefault();
			showKeyboardShortcuts = true;
			return;
		}
		// ... existing shortcuts ...
		if (event.key === 'Escape') {
			uiStore.panels.aiPanel = false;
			uiStore.panels.projectList = false;
			uiStore.panels.settings = false;
			resetVoiceLinks();
			// Close wizard on escape if active?
			if (uiStore.performanceWizardActive) {
				closePerformanceWizard();
			}
		}
	}

</script>

<svelte:window onkeydown={handleKeydown} />

{#if browser}
	<ErrorBoundary>
		<CapabilityGuard />

		{#if showStudio}
			<div class="app-shell">
				<header class="app-header">
					<div class="flex items-center gap-4">
						<h1 class="text-lg font-semibold text-white mr-4">Voice-to-Sculpture Studio</h1>
						<WorkspaceSwitcher />
					</div>

					<div class="flex items-center gap-4">
						<button
							class="px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#db7093] to-[#daa520] hover:from-[#ff85ad] hover:to-[#f0b840] text-white shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
							type="button"
							onclick={() => {
								// clearLayers(); // Optional: Reset for fresh start
								openPerformanceWizard();
							}}
							title="Multi-layered recording with musical intelligence"
						>
							<Sparkles size={16} />
							<span>Performance Mode</span>
						</button>

						<button
							class="px-3 py-1.5 text-sm border border-[#4a4a4a] bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white"
							type="button"
							onclick={generateTestMesh}
						>
							Generate Test Mesh
						</button>
					</div>
				</header>

				<aside class="app-toolbar">
					<Toolbar />
				</aside>

				<div class="app-canvas relative">
					<div
						role="region"
						aria-label="3D Sculpture Canvas"
						tabindex="-1"
						class="w-full h-full focus:outline-none focus:ring-2 focus:ring-brand-primary"
					>
						<Canvas>
							<MainScene />
						</Canvas>
					</div>
					<div class="absolute top-4 right-4 z-20">
						<ViewportControls />
					</div>
					<GoldenGuide />
				</div>

				<!-- Inspector (Sidebar) - Hidden when Wizard is Active -->
				{#if !uiStore.performanceWizardActive}
					<aside class="app-inspector">
						<Inspector />
					</aside>
				{/if}

				<!-- Footer - Hidden when Wizard is Active (Wizard has its own controls) -->
				{#if !uiStore.performanceWizardActive}
					<footer class="app-footer">
						<Footer />
					</footer>
				{/if}
			</div>

			<!-- Modals -->
			{#if uiStore.panels.aiPanel}
				<!-- ... -->
			{/if}
			{#if uiStore.panels.projectList}
				<!-- ... -->
			{/if}
			{#if uiStore.panels.settings}
				<SettingsPanel />
			{/if}
		{:else}
			<div class="flex-1 relative overflow-hidden bg-app flex items-center justify-center">
				<div class="text-center text-[#888]">
					<p>Please complete the calibration tutorial to access the studio.</p>
				</div>
			</div>
		{/if}

		<Tutorial />

		<KeyboardShortcutsModal
			isOpen={showKeyboardShortcuts}
			onClose={() => (showKeyboardShortcuts = false)}
		/>

		<!-- GENERATIVE PERFORMANCE: Wizard Overlay -->
		{#if uiStore.performanceWizardActive}
			<div class="fixed inset-x-0 bottom-0 z-[100] h-[280px] shadow-2xl border-t border-white/10">
				<div class="absolute top-0 right-0 p-4 z-[110]">
					<button 
						class="p-2 bg-black/50 hover:bg-red-500/50 rounded-full text-white transition-colors"
						onclick={closePerformanceWizard}
						title="Exit Performance Mode"
					>
						<X size={20} />
					</button>
				</div>
				<Wizard />
			</div>
		{/if}

		<DebugOverlay />
	</ErrorBoundary>
{:else}
	<div class="min-h-screen bg-app text-primary flex items-center justify-center">
		<!-- Loading -->
	</div>
{/if}

<style>
	.app-shell {
		display: grid;
		grid-template-rows: 60px 1fr 60px;
		grid-template-columns: 64px 1fr 320px;
		height: 100vh;
		background: var(--bg-body);
	}
	
	/* Hide footer row if wizard is active */
	/* Adjust grid if inspector is hidden? */
	/* Actually, Svelte logic handles hiding content, grid might just have empty cells. */
	
	.app-header { grid-column: 1 / -1; grid-row: 1; /* ... */ }
	.app-toolbar { grid-column: 1; grid-row: 2; /* ... */ }
	.app-canvas { grid-column: 2; grid-row: 2; position: relative; /* ... */ }
	.app-inspector { grid-column: 3; grid-row: 2; /* ... */ }
	.app-footer { grid-column: 1 / -1; grid-row: 3; /* ... */ }
</style>
