<script lang="ts">
	import { appSettings, updateSettings } from '$lib/stores/appSettingsStore.svelte';
	import { resetCalibration } from '$lib/audio/calibration';
	import { closePanel } from '$lib/stores/uiStore.svelte';
	import { setGraphicsQuality } from '$lib/stores/settings.svelte';
	import { onMount } from 'svelte';

	let apiKeyInput = $state(appSettings.apiKey || '');
	let apiEndpointInput = $state(
		appSettings.apiEndpoint || 'https://api.openai.com/v1/chat/completions'
	);

	const graphicsQuality = $derived(appSettings.graphicsQuality);

	function handleSave() {
		updateSettings({
			apiKey: apiKeyInput,
			apiEndpoint: apiEndpointInput
		});
		closePanel('settings');
	}

	function handleResetCalibration() {
		if (confirm('Reset calibration? You will need to recalibrate.')) {
			resetCalibration();
		}
	}

	function handleClose() {
		closePanel('settings');
	}

	// Focus trap
	let panelElement = $state<HTMLDivElement | null>(null);
	let firstFocusableElement = $state<HTMLElement | null>(null);
	let lastFocusableElement = $state<HTMLElement | null>(null);

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleClose();
			return;
		}

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

	onMount(() => {
		if (panelElement) {
			const focusableElements = panelElement.querySelectorAll(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			if (focusableElements.length > 0) {
				firstFocusableElement = focusableElements[0] as HTMLElement;
				lastFocusableElement = focusableElements[focusableElements.length - 1] as HTMLElement;
				firstFocusableElement.focus();
			}
		}
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm"
	onkeydown={handleKeydown}
>
	<div
		bind:this={panelElement}
		class="surface-panel p-6 rounded-lg max-w-md w-full relative"
		role="dialog"
		aria-modal="true"
		aria-labelledby="settings-title"
	>
		<button
			onclick={handleClose}
			class="absolute top-4 right-4 text-secondary hover:text-primary transition-colors text-xl"
			title="Close settings (or press Escape)"
			aria-label="Close settings"
		>
			✕
		</button>

		<h2 id="settings-title" class="text-2xl font-bold mb-4">Settings</h2>

		<div class="space-y-4">
			<div>
				<label for="graphics-quality" class="text-sm text-secondary block mb-1"
					>Graphics Quality</label
				>
				<select
					id="graphics-quality"
					class="surface-panel-alt px-3 py-2 rounded w-full"
					value={graphicsQuality}
					onchange={(e) =>
						setGraphicsQuality((e.target as HTMLSelectElement).value as 'low' | 'high')}
				>
					<option value="low">Low</option>
					<option value="high">High</option>
				</select>
			</div>

			<div>
				<label for="ai-provider" class="text-sm text-secondary block mb-1">AI Provider</label>
				<select
					id="ai-provider"
					class="surface-panel-alt px-3 py-2 rounded w-full"
					value={appSettings.aiProvider}
					onchange={(e) =>
						updateSettings({
							aiProvider: (e.target as HTMLSelectElement).value as 'cloud' | 'local'
						})}
				>
					<option value="cloud">Cloud (OpenAI)</option>
					<option value="local">Local (WebGPU)</option>
				</select>
			</div>

			{#if appSettings.aiProvider === 'cloud'}
				<div>
					<label for="api-key" class="text-sm text-secondary block mb-1">API Key</label>
					<input
						id="api-key"
						type="password"
						class="surface-panel-alt px-3 py-2 rounded w-full"
						bind:value={apiKeyInput}
						placeholder="sk-..."
					/>
				</div>
				<div>
					<label for="api-endpoint" class="text-sm text-secondary block mb-1">API Endpoint</label>
					<input
						id="api-endpoint"
						type="text"
						class="surface-panel-alt px-3 py-2 rounded w-full"
						bind:value={apiEndpointInput}
					/>
				</div>
			{/if}

			<div>
				<button class="button-primary px-4 py-2 w-full" type="button" onclick={handleSave}>
					Save
				</button>
			</div>

			<div class="border-t border-subtle pt-4">
				<h3 class="text-sm font-semibold mb-2">Calibration</h3>
				<button
					class="button-secondary px-4 py-2 w-full"
					type="button"
					onclick={handleResetCalibration}
				>
					Reset Calibration
				</button>
			</div>
		</div>
	</div>
</div>
