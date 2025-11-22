<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import MainScene from '$lib/components/scene/MainScene.svelte';
	import Transport from '$lib/components/controls/Transport.svelte';
	import { Canvas } from '@threlte/core';
	import AIPanel from '$lib/components/panels/AIPanel.svelte';
	import ParameterSliders from '$lib/components/controls/ParameterSliders.svelte';
	import ProjectList from '$lib/components/library/ProjectList.svelte';
	import CapabilityGuard from '$lib/components/layout/CapabilityGuard.svelte';
	import Tutorial from '$lib/components/onboarding/Tutorial.svelte';
	import ErrorBoundary from '$lib/components/layout/ErrorBoundary.svelte';
	import SettingsPanel from '$lib/components/panels/SettingsPanel.svelte';
	import FabricationPanel from '$lib/components/panels/FabricationPanel.svelte';
	import { uiStore, startOnboarding, togglePanel } from '$lib/stores/uiStore.svelte';
	import { appSettings } from '$lib/stores/appSettingsStore.svelte';
	import { sculptureStore, setCurrentSculpture } from '$lib/stores/sculptureStore.svelte';
	import type { SculptureDefinition } from '$lib/types';
	import { lathePointsToSTL, downloadSTL } from '$lib/export/stl';
	import { applyDeformation } from '$lib/engine/physicsMapping';

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
				displacementStrength: 0
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
				orientation: 'vertical'
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
		<div class="flex flex-col h-screen">
			<Header />
			<CapabilityGuard />
			
			{#if showStudio}
				<!-- Studio View (only shown when calibrated) -->
				<div class="flex-1 relative overflow-hidden bg-bg-elevated">
					<Canvas>
						<MainScene />
					</Canvas>
					<!-- Transport Controls - Bottom Center -->
					<div class="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
						<Transport />
					</div>

					<!-- AI Panel - Bottom Right -->
					{#if uiStore.panels.aiPanel}
						<div class="absolute bottom-4 right-4 w-96 z-10">
							<AIPanel />
						</div>
					{/if}
					<div class="absolute top-4 right-4 w-64 z-10">
						<ParameterSliders />
					</div>
					<!-- Test Mesh & Export Controls -->
					<div class="absolute top-4 left-4 flex flex-col gap-2 z-10">
						<button
							class="button-secondary px-4 py-2 text-sm"
							type="button"
							onclick={generateTestMesh}
						>
							Generate Test Mesh
						</button>
						<button
							class="button-primary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
							type="button"
							onclick={handleExportSTL}
							disabled={!sculptureStore.currentSculpture}
						>
							Export STL
						</button>
					</div>

					<!-- Project List - Only show when panel is open -->
					{#if uiStore.panels.projectList}
						<div class="absolute top-4 left-24 w-80 z-20">
							<ProjectList />
						</div>
					{/if}
					{#if uiStore.panels.settings}
						<div class="absolute inset-0 flex items-center justify-center z-40">
							<div class="surface-panel p-6 rounded-lg max-w-md w-full">
								<SettingsPanel />
							</div>
						</div>
					{/if}
					{#if uiStore.panels.fabricationPanel}
						<div class="absolute inset-0 flex items-center justify-center z-40">
							<FabricationPanel />
						</div>
					{/if}
				</div>

				<!-- Keyboard shortcuts help -->
				<div class="fixed bottom-4 left-4 text-xs text-muted bg-bg-panel px-3 py-2 rounded border border-subtle">
					<div class="font-semibold mb-1">Keyboard Shortcuts:</div>
					<div>A: Toggle AI Panel</div>
					<div>P: Toggle Projects</div>
					<div>S: Toggle Settings</div>
					<div>F: Toggle Fabrication</div>
					<div>Esc: Close Panels</div>
				</div>
			{:else}
				<!-- Tutorial/Gating View (shown when not calibrated) -->
				<div class="flex-1 relative overflow-hidden bg-app flex items-center justify-center">
					<div class="text-center text-secondary">
						<p>Please complete the calibration tutorial to access the studio.</p>
					</div>
				</div>
			{/if}
			
			<!-- Tutorial overlay (always rendered, but only visible when active) -->
			<Tutorial />
		</div>
	</ErrorBoundary>
{:else}
	<div class="min-h-screen bg-app text-primary flex items-center justify-center">
		<div class="text-center">
			<h1 class="text-2xl font-bold mb-4">Loading...</h1>
			<p class="text-secondary">Initializing application...</p>
		</div>
	</div>
{/if}
