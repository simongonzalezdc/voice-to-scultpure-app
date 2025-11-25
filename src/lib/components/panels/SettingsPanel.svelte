<script lang="ts">
	import { appSettings, updateSettings, setReduceMotion, setFlashIntensity } from '$lib/stores/appSettingsStore.svelte';
	import { resetCalibration } from '$lib/audio/calibration';
	import { closePanel } from '$lib/stores/uiStore.svelte';
	import { setGraphicsQuality } from '$lib/stores/settings.svelte';
	import { checkOllamaAvailable, getOllamaModels } from '$lib/ai/MultiProviderAdapter';
	import { PROVIDER_CONFIGS } from '$lib/ai/providers';
	import type { CloudProvider } from '$lib/types';
	import { onMount } from 'svelte';

	let apiKeyInput = $state(appSettings.apiKey || '');
	let apiEndpointInput = $state(
		appSettings.apiEndpoint || 'https://api.openai.com/v1/chat/completions'
	);

	const graphicsQuality = $derived(appSettings.graphicsQuality);

	// Ollama state
	let ollamaAvailable = $state(false);
	let ollamaModels = $state<string[]>([]);
	let ollamaLoading = $state(false);
	let selectedOllamaModel = $state(appSettings.selectedModel || '');

	// Accessibility state
	let reduceMotion = $state(appSettings.reduceMotion ?? false);
	let flashIntensity = $state(appSettings.flashIntensity ?? 1.0);

	// Cloud provider selection
	let selectedCloudProvider = $state<CloudProvider>(appSettings.cloudProvider || 'openai');

	// Check Ollama on mount
	async function checkOllama() {
		ollamaLoading = true;
		try {
			ollamaAvailable = await checkOllamaAvailable();
			if (ollamaAvailable) {
				ollamaModels = await getOllamaModels();
				if (ollamaModels.length > 0 && !selectedOllamaModel) {
					selectedOllamaModel = ollamaModels[0];
				}
			}
		} catch (e) {
			console.warn('Ollama check failed:', e);
			ollamaAvailable = false;
		} finally {
			ollamaLoading = false;
		}
	}

	function handleSave() {
		updateSettings({
			apiKey: apiKeyInput,
			apiEndpoint: apiEndpointInput,
			cloudProvider: selectedCloudProvider,
			selectedModel: selectedOllamaModel || undefined,
			reduceMotion,
			flashIntensity
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
		// Check for Ollama
		checkOllama();
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

		<div class="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
			<!-- Graphics Quality -->
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

			<!-- AI Provider Selection -->
			<div class="border-t border-subtle pt-4">
				<h3 class="text-sm font-semibold mb-2">🤖 AI Provider</h3>
				<select
					id="ai-provider"
					class="surface-panel-alt px-3 py-2 rounded w-full mb-2"
					value={appSettings.aiProvider}
					onchange={(e) =>
						updateSettings({
							aiProvider: (e.target as HTMLSelectElement).value as 'cloud' | 'local'
						})}
				>
					<option value="cloud">Cloud AI</option>
					<option value="local">Local (WebGPU)</option>
				</select>

				{#if appSettings.aiProvider === 'cloud'}
					<!-- Cloud Provider Selection -->
					<label for="cloud-provider" class="text-sm text-secondary block mb-1">Cloud Service</label>
					<select
						id="cloud-provider"
						class="surface-panel-alt px-3 py-2 rounded w-full mb-2"
						bind:value={selectedCloudProvider}
					>
						<option value="openai">OpenAI</option>
						<option value="anthropic">Anthropic (Claude)</option>
						<option value="google">Google (Gemini)</option>
						<option value="groq">Groq</option>
						<option value="openrouter">OpenRouter</option>
						<option value="together">Together.ai</option>
						<option value="deepseek">DeepSeek</option>
						<option value="ollama">Ollama (Local Server)</option>
					</select>

					{#if selectedCloudProvider === 'ollama'}
						<!-- Ollama Model Selection -->
						<div class="bg-surface-alt p-3 rounded mb-2">
							{#if ollamaLoading}
								<p class="text-sm text-secondary">🔄 Checking Ollama...</p>
							{:else if ollamaAvailable}
								<p class="text-sm text-green-400 mb-2">✅ Ollama connected</p>
								<label for="ollama-model" class="text-sm text-secondary block mb-1">Model</label>
								<select
									id="ollama-model"
									class="surface-panel-alt px-3 py-2 rounded w-full"
									bind:value={selectedOllamaModel}
								>
									{#each ollamaModels as model}
										<option value={model}>{model}</option>
									{/each}
								</select>
								<button
									class="text-xs text-brand-primary mt-2 hover:underline"
									type="button"
									onclick={checkOllama}
								>
									Refresh Models
								</button>
							{:else}
								<p class="text-sm text-yellow-400 mb-1">⚠️ Ollama not detected</p>
								<p class="text-xs text-secondary">
									Make sure Ollama is running locally on port 11434.
									<a href="https://ollama.ai" target="_blank" class="text-brand-primary hover:underline">Install Ollama</a>
								</p>
								<button
									class="text-xs text-brand-primary mt-2 hover:underline"
									type="button"
									onclick={checkOllama}
								>
									Retry Connection
								</button>
							{/if}
						</div>
					{:else}
						<!-- API Key for other providers -->
						<div>
							<label for="api-key" class="text-sm text-secondary block mb-1">API Key</label>
							<input
								id="api-key"
								type="password"
								class="surface-panel-alt px-3 py-2 rounded w-full"
								bind:value={apiKeyInput}
								placeholder={selectedCloudProvider === 'openai' ? 'sk-...' : 'Enter API key'}
							/>
						</div>
					{/if}
				{/if}
			</div>

			<!-- Accessibility Settings -->
			<div class="border-t border-subtle pt-4">
				<h3 class="text-sm font-semibold mb-2">♿ Accessibility</h3>
				
				<label class="flex items-center justify-between mb-3 cursor-pointer">
					<span class="text-sm text-secondary">Reduce Motion</span>
					<input
						type="checkbox"
						bind:checked={reduceMotion}
						onchange={() => setReduceMotion(reduceMotion)}
						class="w-4 h-4 accent-brand-primary"
					/>
				</label>
				<p class="text-xs text-secondary mb-4">Disable wave animations and use static indicators.</p>

				<div>
					<div class="flex items-center justify-between mb-1">
						<label for="flash-intensity" class="text-sm text-secondary">Flash Intensity</label>
						<span class="text-xs text-secondary">{Math.round(flashIntensity * 100)}%</span>
					</div>
					<input
						id="flash-intensity"
						type="range"
						min="0"
						max="1"
						step="0.1"
						bind:value={flashIntensity}
						onchange={() => setFlashIntensity(flashIntensity)}
						class="w-full accent-brand-primary"
					/>
					<p class="text-xs text-secondary mt-1">Control brightness of Dazzler and beat effects.</p>
				</div>
			</div>

			<!-- Save Button -->
			<div class="pt-2">
				<button class="button-primary px-4 py-2 w-full" type="button" onclick={handleSave}>
					Save Settings
				</button>
			</div>

			<!-- Calibration -->
			<div class="border-t border-subtle pt-4">
				<h3 class="text-sm font-semibold mb-2">🎙️ Calibration</h3>
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
