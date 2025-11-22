<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import MainScene from '$lib/components/scene/MainScene.svelte';
	import Transport from '$lib/components/controls/Transport.svelte';
	import AIPanel from '$lib/components/panels/AIPanel.svelte';
	import ParameterSliders from '$lib/components/controls/ParameterSliders.svelte';
	import ProjectList from '$lib/components/library/ProjectList.svelte';
	import CapabilityGuard from '$lib/components/layout/CapabilityGuard.svelte';
	import Tutorial from '$lib/components/onboarding/Tutorial.svelte';
	import ErrorBoundary from '$lib/components/layout/ErrorBoundary.svelte';
	import SettingsPanel from '$lib/components/panels/SettingsPanel.svelte';
	import { uiStore, startOnboarding, togglePanel } from '$lib/stores/uiStore.svelte';

	onMount(() => {
		if (browser && !uiStore.onboarding.completed.has('welcome')) {
			startOnboarding('welcome');
		}
	});

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
			case 'Escape':
				// Close all panels
				uiStore.panels.aiPanel = false;
				uiStore.panels.projectList = false;
				uiStore.panels.settings = false;
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
			<div class="flex-1 relative overflow-hidden">
				<MainScene />
				<div class="absolute bottom-4 left-4 right-4 flex gap-4 items-end">
					<div class="flex-1 max-w-md">
						<Transport />
					</div>
					{#if uiStore.panels.aiPanel}
						<div class="w-96">
							<AIPanel />
						</div>
					{/if}
				</div>
				<div class="absolute top-4 right-4 w-64">
					<ParameterSliders />
				</div>
				{#if uiStore.panels.projectList}
					<div class="absolute top-4 left-4 w-80">
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
			</div>
			<Tutorial />

			<!-- Keyboard shortcuts help -->
			<div class="fixed bottom-4 left-4 text-xs text-muted bg-bg-panel px-3 py-2 rounded border border-subtle">
				<div class="font-semibold mb-1">Keyboard Shortcuts:</div>
				<div>A: Toggle AI Panel</div>
				<div>P: Toggle Projects</div>
				<div>S: Toggle Settings</div>
				<div>Esc: Close Panels</div>
			</div>
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
