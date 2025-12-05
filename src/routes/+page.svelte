<script lang="ts">
	console.log('🔴🔴🔴 [PAGE] +page.svelte LOADED at', new Date().toLocaleTimeString());
	
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
		setBaseShape,
		setRecordingMode
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
	import { X, Menu, ChevronUp } from 'lucide-svelte';

	// Mobile menu state
	let mobileMenuOpen = $state(false);

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}
	import { resetVoiceLinks } from '$lib/stores/voiceLinksStore.svelte';
	import { clearLayers } from '$lib/stores/sculptureStore.svelte';
	import GoldenGuide from '$lib/components/overlay/GoldenGuide.svelte';
	import { undo, redo, pushHistory } from '$lib/stores/historyStore.svelte';
	import { showToast } from '$lib/stores/toastStore.svelte';

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

		// Use uiStore.constraintMode to ensure consistency with recording
		const profile = generateLathe(defaultFrames, undefined, 'additive', undefined, uiStore.constraintMode);
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

			// Global keyboard shortcuts
			const handleKeydown = (e: KeyboardEvent) => {
				// Ignore if typing in input/textarea
				if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
					return;
				}

				const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
				const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

				// Undo: Cmd/Ctrl + Z
				if (cmdOrCtrl && e.key === 'z' && !e.shiftKey) {
					e.preventDefault();
					if (undo()) {
						showToast('Undo', 'info');
					}
				}
				// Redo: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y
				else if (cmdOrCtrl && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
					e.preventDefault();
					if (redo()) {
						showToast('Redo', 'info');
					}
				}
				// Save: Cmd/Ctrl + S (prevent default, show toast)
				else if (cmdOrCtrl && e.key === 's') {
					e.preventDefault();
					showToast('Auto-saved', 'success');
				}
				// Workspace shortcuts: 1-4
				else if (!cmdOrCtrl && !e.shiftKey && !e.altKey) {
					switch (e.key) {
						case '1':
							setWorkspace('sculpt');
							break;
						case '2':
							setWorkspace('force');
							break;
						case '3':
							setWorkspace('glaze');
							break;
						case '4':
							setWorkspace('export');
							break;
						case '?':
							togglePanel('shortcuts');
							break;
						case 'r':
						case 'R':
							// Toggle recording (start/stop)
							// Reserved for future use
							break;
						case 's':
						case 'S':
							// Cycle recording mode: standard → song → coil → standard
							const modes: ('standard' | 'song' | 'coil')[] = ['standard', 'song', 'coil'];
							const currentMode = uiStore.recordingMode ?? 'standard';
							const currentIdx = modes.indexOf(currentMode);
							const nextMode = modes[(currentIdx + 1) % modes.length] ?? 'standard';
							setRecordingMode(nextMode);
							showToast(`Recording: ${nextMode}`, 'info');
							break;
					}
				}
			};

			window.addEventListener('keydown', handleKeydown);
			return () => window.removeEventListener('keydown', handleKeydown);
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
		if (
			sculptureStore.currentSculpture.layers &&
			sculptureStore.currentSculpture.layers.length > 0
		) {
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

		const zone =
			state.zone !== '0-1'
				? {
						min: parseFloat(state.zone.split('-')[0]),
						max: parseFloat(state.zone.split('-')[1])
					}
				: undefined;

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
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
			return;
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
					<div class="flex items-center gap-3">
						<h1 class="text-sm font-semibold text-white/90 tracking-wide">Voice-to-Sculpture</h1>
						<WorkspaceSwitcher />
					</div>

					<div class="flex items-center gap-2">
						<button
							class="px-2 py-1 text-xs border border-[#4a4a4a] bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white/70 rounded"
							type="button"
							onclick={generateTestMesh}
						>
							Test
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
					<aside class="app-inspector" class:mobile-open={mobileMenuOpen}>
						<!-- Mobile drag handle (accessible) -->
						<button
							class="mobile-drag-handle"
							onclick={toggleMobileMenu}
							aria-label={mobileMenuOpen ? 'Close panel' : 'Open panel'}
							aria-expanded={mobileMenuOpen}
						>
							<div class="drag-pill"></div>
						</button>
						<Inspector />
					</aside>
				{/if}

				<!-- Footer - Hidden when Wizard is Active (Wizard has its own controls) -->
				{#if !uiStore.performanceWizardActive}
					<footer class="app-footer">
						<Footer />
						<!-- Mobile menu toggle -->
						<button
							class="mobile-menu-toggle"
							onclick={toggleMobileMenu}
							aria-label={mobileMenuOpen ? 'Close controls' : 'Open controls'}
						>
							{#if mobileMenuOpen}
								<X size={20} />
							{:else}
								<Menu size={20} />
							{/if}
						</button>
					</footer>
				{/if}
			</div>

		<!-- Modals & Panels -->
			{#if uiStore.panels.aiPanel}
			<!-- AI Panel as centered modal - doesn't block sidebar -->
			<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
				<div class="relative w-full max-w-lg h-[70vh] max-h-[600px] bg-surface rounded-xl shadow-2xl border border-subtle overflow-hidden flex flex-col">
					<!-- Close button -->
					<button
						class="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-surface-alt hover:bg-red-500/30 text-secondary hover:text-white transition-colors"
						onclick={() => togglePanel('aiPanel')}
						aria-label="Close AI Panel"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
					</button>
					<AIPanel />
				</div>
			</div>
			{/if}
			{#if uiStore.panels.projectList}
			<ProjectList />
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


		<DebugOverlay />
	</ErrorBoundary>
{:else}
	<div class="min-h-screen bg-app text-primary flex items-center justify-center">
		<!-- Loading -->
	</div>
{/if}

<style>
	/* Desktop Layout (default) */
	.app-shell {
		display: grid;
		grid-template-rows: 56px 1fr auto;
		grid-template-columns: 56px 1fr 300px;
		height: 100vh;
		height: 100dvh; /* Dynamic viewport height - accounts for mobile browser UI */
		background: var(--bg-body);
		overflow: hidden;
	}

	.app-header {
		grid-column: 1 / -1;
		grid-row: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 16px;
		background: var(--bg-surface);
		border-bottom: 1px solid var(--border-subtle);
		min-height: 0;
	}

	.app-toolbar {
		grid-column: 1;
		grid-row: 2;
		display: flex;
		flex-direction: column;
		background: var(--bg-surface);
		border-right: 1px solid var(--border-subtle);
		overflow-y: auto;
		min-height: 0;
	}

	.app-canvas {
		grid-column: 2;
		grid-row: 2;
		position: relative;
		min-height: 0;
		overflow: hidden;
	}

	.app-inspector {
		grid-column: 3;
		grid-row: 2;
		background: var(--bg-surface);
		border-left: 1px solid var(--border-subtle);
		overflow-y: auto;
		min-height: 0;
	}

	.app-footer {
		grid-column: 1 / -1;
		grid-row: 3;
		display: flex;
		align-items: center;
		padding: 8px 16px;
		background: var(--bg-surface);
		border-top: 1px solid var(--border-subtle);
		gap: 12px;
		flex-shrink: 0;
	}

	/* ==================== MOBILE RESPONSIVE ==================== */
	/* Tablet: Hide inspector, expand canvas */
	@media (max-width: 1024px) {
		.app-shell {
			grid-template-columns: 56px 1fr;
		}

		.app-inspector {
			position: fixed;
			right: 0;
			top: 56px;
			bottom: 0;
			width: 300px;
			z-index: 50;
			transform: translateX(100%);
			transition: transform 0.3s ease;
		}

		.app-inspector.mobile-open {
			transform: translateX(0);
		}

		.app-canvas {
			grid-column: 2;
		}
	}

	/* Phone: Full-screen canvas, bottom sheet UI */
	@media (max-width: 640px) {
		.app-shell {
			grid-template-columns: 1fr;
			grid-template-rows: 48px 1fr auto;
		}

		.app-header {
			padding: 0 12px;
		}

		.app-header h1 {
			font-size: 0.75rem;
		}

		.app-toolbar {
			display: none; /* Hide toolbar on mobile - use bottom sheet instead */
		}

		.app-canvas {
			grid-column: 1;
			grid-row: 2;
		}

		.app-inspector {
			position: fixed;
			left: 0;
			right: 0;
			bottom: 0;
			top: auto;
			width: 100%;
			height: 60vh;
			max-height: 60vh;
			border-radius: 16px 16px 0 0;
			border-left: none;
			border-top: 1px solid var(--border-subtle);
			transform: translateY(100%);
			transition: transform 0.3s ease;
			z-index: 60;
		}

		.app-inspector.mobile-open {
			transform: translateY(0);
		}

		.app-footer {
			padding: 12px 16px;
			gap: 8px;
		}

		/* Touch-friendly hit targets */
		:global(.app-footer button) {
			min-height: 44px;
			min-width: 44px;
		}
	}

	/* Landscape phone: Compact header */
	@media (max-width: 640px) and (orientation: landscape) {
		.app-shell {
			grid-template-rows: 40px 1fr auto;
		}

		.app-header {
			padding: 0 8px;
		}

		.app-footer {
			padding: 6px 12px;
		}
	}

	/* Mobile menu toggle button */
	.mobile-menu-toggle {
		display: none;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--brand-primary);
		color: white;
		border: none;
		cursor: pointer;
		justify-content: center;
		align-items: center;
		flex-shrink: 0;
		box-shadow: 0 2px 8px rgba(0,0,0,0.3);
	}

	/* Mobile drag handle for bottom sheet */
	.mobile-drag-handle {
		display: none;
		width: 100%;
		padding: 12px 0 8px;
		justify-content: center;
		align-items: center;
		cursor: grab;
		touch-action: none;
		background: transparent;
		border: none;
	}

	.mobile-drag-handle:active {
		cursor: grabbing;
	}

	.mobile-drag-handle:focus-visible {
		outline: 2px solid var(--brand-primary);
		outline-offset: -2px;
	}

	.drag-pill {
		width: 40px;
		height: 4px;
		background: var(--border-strong);
		border-radius: 2px;
		transition: background 0.2s ease;
	}

	.mobile-drag-handle:hover .drag-pill {
		background: var(--text-muted);
	}

	@media (max-width: 1024px) {
		.mobile-menu-toggle {
			display: flex;
		}

		.mobile-drag-handle {
			display: flex;
		}
	}

	/* Backdrop for mobile inspector */
	@media (max-width: 640px) {
		.app-inspector::before {
			content: '';
			position: fixed;
			inset: 0;
			background: rgba(0,0,0,0.5);
			opacity: 0;
			pointer-events: none;
			transition: opacity 0.3s ease;
			z-index: -1;
		}

		.app-inspector.mobile-open::before {
			opacity: 1;
			pointer-events: auto;
		}
	}
</style>
