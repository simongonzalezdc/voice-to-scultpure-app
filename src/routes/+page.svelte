<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import MainScene from '$lib/components/scene/MainScene.svelte';
	import Transport from '$lib/components/controls/Transport.svelte';
	import { Canvas } from '@threlte/core';
	import AIPanel from '$lib/components/panels/AIPanel.svelte';
	import ProjectList from '$lib/components/library/ProjectList.svelte';
	import CapabilityGuard from '$lib/components/layout/CapabilityGuard.svelte';
	import Tutorial from '$lib/components/onboarding/Tutorial.svelte';
	import ErrorBoundary from '$lib/components/layout/ErrorBoundary.svelte';
	import SettingsPanel from '$lib/components/panels/SettingsPanel.svelte';
	import FabricationPanel from '$lib/components/panels/FabricationPanel.svelte';
	import GlazeMixer from '$lib/components/panels/GlazeMixer.svelte';
	import TabbedSidebar from '$lib/components/layout/TabbedSidebar.svelte';
	import {
		uiStore,
		startOnboarding,
		togglePanel,
		toggleOrientation,
		setOrientation,
		setToolMode
	} from '$lib/stores/uiStore.svelte';
	import { appSettings, resetCalibration } from '$lib/stores/appSettingsStore.svelte';
	import { sculptureStore, setCurrentSculpture } from '$lib/stores/sculptureStore.svelte';
	import {
		recordingStore,
		getCapturedFrames,
		hasCapturedFrames
	} from '$lib/stores/recording.svelte';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import NewProjectModal from '$lib/components/modals/NewProjectModal.svelte';
	import type { SculptureDefinition } from '$lib/types';
	import { lathePointsToSTL, downloadSTL } from '$lib/export/stl';
	import { applyDeformation, createSculptureFromFrames } from '$lib/engine/physicsMapping';
	import ViewportControls from '$lib/components/scene/ViewportControls.svelte';
	import { DEFAULT_MATERIAL_CERAMIC } from '$lib/types';

	// Gatekeeper: Check if user has completed calibration
	let isCalibrated = $derived(appSettings.userProfile?.calibrated === true);
	let showStudio = $derived(isCalibrated && !uiStore.onboarding.active);

	onMount(() => {
		if (browser) {
			// If not calibrated, force tutorial
			if (!isCalibrated) {
				startOnboarding('welcome');
			}
		}
	});

	// LIVE PREVIEW: Reactive regeneration for all generative parameters
	// Watches: constraintMode, sculptMode, sculptZone
	// This allows users to see the shape morph in real-time when toggling modes
	let lastRegenerationState: { mode: string; sculptMode: string; zone: string } | null = null;

	$effect(() => {
		// Watch for changes to generative parameters
		const currentConstraintMode = uiStore.constraintMode;
		const currentSculptMode = uiStore.sculptMode;
		const currentZone = uiStore.sculptZone;

		// CRITICAL: Skip if recording or processing (prevents infinite loop during state transitions)
		if (recordingStore.state === 'recording' || recordingStore.state === 'processing') {
			return;
		}

		// Only regenerate if:
		// 1. We have a current sculpture
		// 2. We have captured frames to regenerate from
		// 3. State has actually changed (prevent infinite loop)
		if (!sculptureStore.currentSculpture || !hasCapturedFrames()) {
			return;
		}

		// Create state signature to detect actual changes
		const currentState = {
			mode: currentConstraintMode,
			sculptMode: currentSculptMode,
			zone: `${currentZone.min}-${currentZone.max}`
		};

		// Skip if state hasn't changed (prevents regeneration loop)
		if (
			lastRegenerationState &&
			lastRegenerationState.mode === currentState.mode &&
			lastRegenerationState.sculptMode === currentState.sculptMode &&
			lastRegenerationState.zone === currentState.zone
		) {
			return;
		}

		// Skip initial render (when lastRegenerationState is null)
		if (lastRegenerationState === null) {
			lastRegenerationState = currentState;
			return;
		}

		const frames = getCapturedFrames();
		const currentSculpture = sculptureStore.currentSculpture;

		// Log what changed
		if (lastRegenerationState.sculptMode !== currentState.sculptMode) {
			console.log(`🔄 [SCULPT MODE] Changed to "${currentSculptMode}" - regenerating sculpture...`);
		} else if (lastRegenerationState.mode !== currentState.mode) {
			console.log(
				`🔄 [CONSTRAINTS] Changed to "${currentConstraintMode}" - regenerating sculpture...`
			);
		} else {
			console.log(
				`🔄 [ZONE] Changed to ${currentZone.min}-${currentZone.max} - regenerating sculpture...`
			);
		}

		const zone = currentZone.min > 0 || currentZone.max < 1 ? currentZone : undefined;

		const regenerated = createSculptureFromFrames(
			frames,
			appSettings.userProfile,
			currentSculpture.name, // Keep the same name
			currentSculptMode, // Use current UI sculpt mode
			zone,
			currentConstraintMode // Apply current constraint mode
		);

		// Preserve user-modified properties (sliders)
		regenerated.deformation = currentSculpture.deformation;
		regenerated.surface = currentSculpture.surface;
		// Update physical.sculptMode to match UI
		regenerated.physical = {
			...currentSculpture.physical,
			sculptMode: currentSculptMode
		};
		regenerated.vertexColors = currentSculpture.vertexColors;

		// Update state signature BEFORE setting sculpture (prevents loop)
		lastRegenerationState = currentState;

		setCurrentSculpture(regenerated);
		console.log(`✅ [LIVE PREVIEW] Sculpture regenerated with current settings`);
	});

	function generateTestMesh() {
		// Create a test sculpture with hardcoded hourglass shape
		const testSculpture: SculptureDefinition = {
			id: crypto.randomUUID(),
			name: 'Test Mesh (Hourglass)',
			createdAt: Date.now(),
			radiusCurve: [
				{ x: 0.1, y: 0 },
				{ x: 0.3, y: 1 },
				{ x: 0.1, y: 2 }
			],
			surface: {
				textureRoughness: 0.5,
				glazeTransmission: 0.3,
				displacementStrength: 0,
				// Default to ceramic/beige if not specified
				materialType: 'ceramic',
				baseColor: DEFAULT_MATERIAL_CERAMIC
			},
			deformation: {
				twist: 0,
				compression: 0,
				taper: 0
			},
			physical: {
				height: 150,
				units: 'mm',
				wallThickness: undefined,
				orientation: 'vertical',
				sculptMode: 'additive' // PHASE 3.2: Explicitly initialize sculptMode
			}
		};
		setCurrentSculpture(testSculpture);
	}

	function handleExportSTL() {
		const sculpture = sculptureStore.currentSculpture;
		if (!sculpture) {
			alert('No sculpture to export. Please generate a test mesh or record audio first.');
			return;
		}

		try {
			// Apply current deformation parameters before export
			const deformedCurve = applyDeformation(sculpture.radiusCurve, sculpture.deformation);

			// Create a temporary sculpture with deformed curve for export
			const exportSculpture: SculptureDefinition = {
				...sculpture,
				radiusCurve: deformedCurve
			};

			const stlContent = lathePointsToSTL(exportSculpture);
			const filename = `sculpture-${sculpture.name.replace(/\s+/g, '-')}-${Date.now()}.stl`;
			downloadSTL(stlContent, filename);
		} catch (error) {
			console.error('Export failed:', error);
			alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		// Ignore if user is typing in an input
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
			return;
		}

		switch (event.key) {
			case ' ':
				// Space: Toggle Recording (handles all states: idle -> start, recording -> stop, complete -> reset)
				event.preventDefault();
				const recordButton = document.querySelector('[data-record-button]') as HTMLButtonElement;
				recordButton?.click();
				break;
			case '1':
				// 1: Switch to Pottery (Vertical)
				event.preventDefault();
				setOrientation('vertical');
				break;
			case '2':
				// 2: Switch to Lathe (Horizontal)
				event.preventDefault();
				setOrientation('horizontal');
				break;
			case 'x':
			case 'X':
				// X: Reset Calibration
				event.preventDefault();
				if (confirm('Reset calibration? This will require recalibration.')) {
					resetCalibration();
				}
				break;
			case 'r':
			case 'R':
				// Toggle recording (will be handled by Transport component)
				break;
			case 'a':
			case 'A':
				event.preventDefault();
				togglePanel('aiPanel');
				break;
			case 'p':
			case 'P':
				event.preventDefault();
				togglePanel('projectList');
				break;
			case 's':
			case 'S':
				if (event.ctrlKey || event.metaKey) {
					// Let browser handle save
					break;
				}
				event.preventDefault();
				togglePanel('settings');
				break;
			case 'f':
			case 'F':
				event.preventDefault();
				togglePanel('fabricationPanel');
				break;
			case 'Escape':
				// Close all panels
				uiStore.panels.aiPanel = false;
				uiStore.panels.projectList = false;
				uiStore.panels.settings = false;
				uiStore.panels.fabricationPanel = false;
				break;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if browser}
	<ErrorBoundary>
		<CapabilityGuard />

		{#if showStudio}
			<!-- Pro Tool UI: CSS Grid App Shell -->
			<div class="app-shell">
				<!-- Header: Top Row, Full Width -->
				<header class="app-header">
					<div class="flex items-center gap-4">
						<h1 class="text-lg font-semibold text-white">Voice-to-Sculpture Studio</h1>
						<button
							class="px-3 py-1.5 text-sm border border-[#4a4a4a] bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white"
							type="button"
							onclick={generateTestMesh}
						>
							Generate Test Mesh
						</button>
						<button
							class="px-3 py-1.5 text-sm border border-[#4a4a4a] bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white disabled:opacity-50 disabled:cursor-not-allowed"
							type="button"
							onclick={handleExportSTL}
							disabled={!sculptureStore.currentSculpture}
						>
							Export
						</button>
						<button
							class="px-3 py-1.5 text-sm border border-[#4a4a4a] bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white"
							type="button"
							onclick={toggleOrientation}
							title={`Current: ${uiStore.orientation === 'vertical' ? 'Pottery Wheel (Vertical)' : 'Lathe (Horizontal)'}`}
						>
							{uiStore.orientation === 'vertical' ? '⊶ Pottery' : '↺ Lathe'}
						</button>
					</div>
				</header>

				<!-- Canvas: Center Area -->
				<div class="app-canvas">
					<Canvas>
						<MainScene />
					</Canvas>
					<!-- On-screen Viewport Controls -->
					<div class="absolute top-4 right-4 z-20">
						<ViewportControls />
					</div>
				</div>

				<!-- Sidebar: Right Column with Tabbed Interface -->
				<aside class="app-sidebar">
					<TabbedSidebar />
				</aside>

				<!-- Footer: Bottom Row, Full Width - Transport + Telemetry Hub -->
				<footer class="app-footer">
					<div class="flex items-center justify-between w-full gap-4">
						<!-- Transport Controls (Left) -->
						<Transport />

						<!-- Telemetry Hub (Center) - Compact Inline Display -->
						<div
							class="flex items-center gap-6 text-xs text-[#888] flex-1 px-4 border-l border-r border-[#4a4a4a]"
						>
							<!-- Mic Level Indicator -->
							<div class="flex items-center gap-1.5 whitespace-nowrap">
								<span class="text-[#666]">🎙️</span>
								<span>{Math.round(analysisStore.micLevel * 100)}%</span>
							</div>

							<!-- Orientation Badge -->
							<div class="flex items-center gap-1.5 whitespace-nowrap">
								<span class="text-[#666]">{uiStore.orientation === 'vertical' ? '⊶' : '↺'}</span>
								<span>{uiStore.orientation === 'vertical' ? 'Pottery' : 'Lathe'}</span>
							</div>

							<!-- Recording State Badge -->
							<div class="flex items-center gap-1.5 whitespace-nowrap">
								<span
									class="w-2 h-2 rounded-full {recordingStore.state === 'recording'
										? 'bg-red-500 animate-pulse'
										: recordingStore.state === 'processing'
											? 'bg-yellow-500 animate-pulse'
											: recordingStore.state === 'complete'
												? 'bg-green-500'
												: 'bg-[#666]'}"
								></span>
								<span
									>{recordingStore.state === 'idle'
										? 'Ready'
										: recordingStore.state === 'recording'
											? 'Recording'
											: recordingStore.state === 'processing'
												? 'Processing'
												: recordingStore.state === 'complete'
													? 'Complete'
													: 'Paused'}</span
								>
							</div>
						</div>

						<!-- Status Bar (Right) - Context-Aware Legend -->
						<div class="text-xs text-[#888] whitespace-nowrap">
							{#if uiStore.toolMode === 'sculpt'}
								🔨 Pitch: Twist | Vol: Thickness | Attack: Cut
							{:else if uiStore.toolMode === 'glaze-mix' || uiStore.toolMode === 'glaze-paint'}
								🎨 Pitch: Color | Vol: Opacity | Timbre: Matte/Gloss
							{:else}
								FPS: 60 | GPU: Ready
							{/if}
						</div>
					</div>
				</footer>
			</div>

			<!-- Modal Panels (Overlay) -->
			{#if uiStore.panels.aiPanel}
				<div class="fixed inset-0 flex items-center justify-center z-40 bg-black/50">
					<div class="bg-[#1a1a1a] border border-[#4a4a4a] p-6 rounded max-w-md w-full">
						<AIPanel />
					</div>
				</div>
			{/if}
			{#if uiStore.panels.projectList}
				<div class="fixed inset-0 flex items-center justify-center z-40 bg-black/50">
					<div class="bg-[#1a1a1a] border border-[#4a4a4a] p-6 rounded max-w-2xl w-full">
						<ProjectList />
					</div>
				</div>
			{/if}
			{#if uiStore.panels.settings}
				<div class="fixed inset-0 flex items-center justify-center z-40 bg-black/50">
					<div class="bg-[#1a1a1a] border border-[#4a4a4a] p-6 rounded max-w-md w-full">
						<SettingsPanel />
					</div>
				</div>
			{/if}
			{#if uiStore.panels.fabricationPanel}
				<div class="fixed inset-0 flex items-center justify-center z-40 bg-black/50">
					<div class="bg-[#1a1a1a] border border-[#4a4a4a] p-6 rounded max-w-md w-full">
						<FabricationPanel />
					</div>
				</div>
			{/if}
			{#if uiStore.panels.glazeMixer}
				<div class="fixed inset-0 flex items-center justify-center z-40 bg-black/50">
					<GlazeMixer />
				</div>
			{/if}
		{:else}
			<!-- Tutorial/Gating View (shown when not calibrated) -->
			<div class="flex-1 relative overflow-hidden bg-[#1a1a1a] flex items-center justify-center">
				<div class="text-center text-[#888]">
					<p>Please complete the calibration tutorial to access the studio.</p>
				</div>
			</div>
		{/if}

		<!-- Tutorial overlay (always rendered, but only visible when active) -->
		<Tutorial />

		<!-- DIRECTIVE 1: New Project Modal (auto-triggers when no project) -->
		<NewProjectModal />
	</ErrorBoundary>
{:else}
	<div class="min-h-screen bg-app text-primary flex items-center justify-center">
		<div class="text-center">
			<h1 class="text-2xl font-bold mb-4">Loading...</h1>
			<p class="text-secondary">Initializing application...</p>
		</div>
	</div>
{/if}

<style>
	.app-shell {
		display: grid;
		grid-template-rows: 60px 1fr 60px;
		grid-template-columns: 1fr 320px;
		height: 100vh;
		background: #1a1a1a;
	}

	/* PHASE 4.2: Z-Index Management */
	.app-header {
		grid-column: 1 / -1;
		grid-row: 1;
		border-bottom: 1px solid #4a4a4a;
		background: #1a1a1a;
		padding: 0 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		z-index: 50; /* Header always on top */
		position: relative;
	}

	.app-canvas {
		grid-column: 1;
		grid-row: 2;
		position: relative;
		overflow: hidden;
		background: #1a1a1a;
		z-index: 10; /* Canvas behind viewport controls */
	}

	.app-sidebar {
		grid-column: 2;
		grid-row: 2;
		border-left: 1px solid #4a4a4a;
		background: #1a1a1a;
		overflow-y: auto;
		z-index: 40; /* Sidebar panels above canvas */
		position: relative;
		/* padding removed to let TabbedSidebar handle it */
	}

	.app-footer {
		grid-column: 1 / -1;
		grid-row: 3;
		border-top: 1px solid #4a4a4a;
		background: #1a1a1a;
		padding: 0 16px;
		display: flex;
		align-items: center;
		z-index: 50; /* Footer always on top */
		position: relative;
	}
</style>
