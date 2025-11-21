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
	import { uiStore, startOnboarding } from '$lib/stores/uiStore.svelte';

	onMount(() => {
		if (browser && !uiStore.onboarding.completed.has('welcome')) {
			startOnboarding('welcome');
		}
	});
</script>

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
