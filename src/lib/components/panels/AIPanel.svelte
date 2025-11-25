<script lang="ts">
	import { appSettings, updateSettings } from '$lib/stores/appSettingsStore.svelte';
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { uiStore } from '$lib/stores/uiStore.svelte';
	import { callProvider, testConnection } from '$lib/ai/MultiProviderAdapter';
	import { executeActions, buildContext } from '$lib/ai/actionExecutor';
	import { buildContextSummary, type SculptorResponse } from '$lib/ai/sculptorActions';
	import {
		PROVIDER_CONFIGS,
		LOCAL_AI_CONFIG,
		getModelsForProvider,
		getProviderName,
		validateApiKey,
		type CloudProvider,
		type AIProviderType
	} from '$lib/ai/providers';
	import {
		createBrowserSpeechToText,
		isSpeechRecognitionSupported,
		type SpeechToTextService
	} from '$lib/ai/speechToText';
	import { onMount } from 'svelte';
	import type { MultiProviderAPIKeys } from '$lib/types';

	// State
	let messages = $state<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
	let inputText = $state('');
	let status = $state<'idle' | 'generating' | 'testing' | 'error'>('idle');
	let errorMessage = $state<string | null>(null);
	let showSettings = $state(false);

	// Speech-to-text state
	let speechService = $state<SpeechToTextService | null>(null);
	let isListening = $state(false);
	let interimTranscript = $state('');

	// Provider selection
	let selectedProvider = $state<AIProviderType>(appSettings.aiProvider || 'local');
	let selectedCloudProvider = $state<CloudProvider>(appSettings.cloudProvider || 'openai');
	let selectedModel = $state<string>(appSettings.selectedModel || '');

	// API keys (one per provider)
	let apiKeys = $state<MultiProviderAPIKeys>(appSettings.apiKeys || {});

	// Connection status per provider
	let connectionStatus = $state<Record<string, 'untested' | 'testing' | 'connected' | 'failed'>>(
		{}
	);

	// Derived values
	let currentApiKey = $derived(apiKeys[selectedCloudProvider] || '');
	let availableModels = $derived(
		getModelsForProvider(selectedProvider === 'local' ? 'local' : selectedCloudProvider)
	);
	let speechSupported = $derived(isSpeechRecognitionSupported());
	let canSend = $derived(
		!!inputText.trim() &&
			status !== 'generating' &&
			(selectedProvider === 'local' || !!currentApiKey)
	);

	// Initialize on mount
	onMount(() => {
		// Initialize speech-to-text if enabled
		if (appSettings.speechToTextEnabled) {
			initSpeechToText();
		}

		// Set default model if none selected
		if (!selectedModel && availableModels.length > 0) {
			const firstModel = availableModels[0];
			if (firstModel) {
				selectedModel = firstModel.id;
			}
		}
	});

	// Initialize speech-to-text
	function initSpeechToText() {
		if (!speechSupported) return;

		speechService = createBrowserSpeechToText({
			continuous: false,
			interimResults: true,
			onResult: (text, isFinal) => {
				if (isFinal) {
					inputText = text;
					interimTranscript = '';
					isListening = false;
				} else {
					interimTranscript = text;
				}
			},
			onError: (error) => {
				console.error('[AI PANEL] Speech error:', error);
				isListening = false;
			},
			onEnd: () => {
				isListening = false;
			}
		});
	}

	// Toggle speech recognition
	function toggleSpeech() {
		if (!speechService) {
			initSpeechToText();
			if (!speechService) return;
		}

		if (isListening) {
			speechService.stop();
			isListening = false;
		} else {
			speechService.start();
			isListening = true;
			interimTranscript = '';
		}
	}

	// Test API connection
	async function testApiConnection(provider: CloudProvider) {
		const key = apiKeys[provider];
		if (!key) {
			connectionStatus[provider] = 'failed';
			return;
		}

		connectionStatus[provider] = 'testing';
		try {
			const connected = await testConnection(provider, key);
			connectionStatus[provider] = connected ? 'connected' : 'failed';
		} catch {
			connectionStatus[provider] = 'failed';
		}
	}

	// Handle sending message
	async function handleSend() {
		if (!canSend) return;

		const userMessage = inputText.trim();
		messages = [...messages, { role: 'user', content: userMessage }];
		inputText = '';
		status = 'generating';
		errorMessage = null;

		try {
			// Build context summary
			const context = buildContext();
			const contextSummary = buildContextSummary(context);

			// Add context to the conversation
			const messagesWithContext = [
				{ role: 'user' as const, content: `${contextSummary}\n\nUser request: ${userMessage}` }
			];

			let response: SculptorResponse;

			if (selectedProvider === 'local') {
				// Local AI not yet implemented in this new system
				// Fall back to a simple response
				response = {
					explanation: 'Local AI is initializing. Please try again in a moment.',
					actions: [],
					suggestions: ['Try using a cloud provider for immediate results']
				};
			} else {
				// Call cloud provider
				response = await callProvider(messagesWithContext, {
					provider: selectedCloudProvider,
					apiKey: currentApiKey,
					model: selectedModel,
					temperature: 0.7,
					maxTokens: 2000
				});
			}

			// Execute the actions
			if (response.actions.length > 0) {
				const results = executeActions(response.actions);
				const successCount = results.filter((r) => r.success).length;
				const failCount = results.length - successCount;

				console.log(`[AI PANEL] Executed ${successCount}/${results.length} actions`);
				if (failCount > 0) {
					console.warn(
						'[AI PANEL] Failed actions:',
						results.filter((r) => !r.success)
					);
				}
			}

			// Add AI response to messages
			let responseContent = response.explanation;
			if (response.suggestions?.length) {
				responseContent += `\n\n💡 ${response.suggestions.join('\n💡 ')}`;
			}

			messages = [...messages, { role: 'assistant', content: responseContent }];
			status = 'idle';
		} catch (error) {
			status = 'error';
			errorMessage = error instanceof Error ? error.message : String(error);
			console.error('[AI PANEL] Error:', error);
		}
	}

	// Handle provider change
	function handleProviderChange(provider: AIProviderType) {
		selectedProvider = provider;
		updateSettings({ aiProvider: provider });

		// Set default model for new provider
		const models = getModelsForProvider(provider === 'local' ? 'local' : selectedCloudProvider);
		if (models.length > 0) {
			const firstModel = models[0];
			if (firstModel) {
				selectedModel = firstModel.id;
				updateSettings({ selectedModel: firstModel.id });
			}
		}
	}

	// Handle cloud provider change
	function handleCloudProviderChange(provider: CloudProvider) {
		selectedCloudProvider = provider;
		updateSettings({ cloudProvider: provider });

		// Set default model for new provider
		const models = getModelsForProvider(provider);
		if (models.length > 0) {
			const firstModel = models[0];
			if (firstModel) {
				selectedModel = firstModel.id;
				updateSettings({ selectedModel: firstModel.id });
			}
		}
	}

	// Handle API key change
	function handleApiKeyChange(provider: CloudProvider, key: string) {
		apiKeys[provider] = key;
		updateSettings({ apiKeys });
		connectionStatus[provider] = 'untested';
	}

	// Handle retry
	function handleRetry() {
		const lastMsg = messages[messages.length - 1];
		if (messages.length > 0 && lastMsg?.role === 'user') {
			inputText = lastMsg.content;
			messages = messages.slice(0, -1);
			handleSend();
		}
	}

	// Clear conversation
	function clearConversation() {
		messages = [];
		errorMessage = null;
	}
</script>

<div class="ai-panel surface-panel p-4 rounded-lg flex flex-col h-full">
	<!-- Header -->
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-lg font-semibold flex items-center gap-2">
			<span class="text-xl">🤖</span>
			AI Sculptor
		</h2>
		<button
			class="text-sm text-secondary hover:text-primary"
			onclick={() => (showSettings = !showSettings)}
		>
			{showSettings ? '✕ Close' : '⚙️ Settings'}
		</button>
	</div>

	<!-- Settings Panel -->
	{#if showSettings}
		<div class="settings-panel surface-panel-alt p-3 rounded mb-4 space-y-3 text-sm">
			<!-- Provider Selection -->
			<div class="flex gap-2">
				<button
					class="flex-1 px-3 py-2 rounded transition-colors {selectedProvider !== 'local'
						? 'bg-primary text-white'
						: 'surface-panel'}"
					onclick={() => handleProviderChange(selectedCloudProvider)}
				>
					☁️ Cloud
				</button>
				<button
					class="flex-1 px-3 py-2 rounded transition-colors {selectedProvider === 'local'
						? 'bg-primary text-white'
						: 'surface-panel'}"
					onclick={() => handleProviderChange('local')}
				>
					💻 Local
				</button>
			</div>

			{#if selectedProvider !== 'local'}
				<!-- Cloud Provider Selection -->
				<div>
					<label for="cloud-provider-select" class="block text-xs text-secondary mb-1"
						>Cloud Provider</label
					>
					<select
						id="cloud-provider-select"
						class="w-full surface-panel px-2 py-1.5 rounded"
						value={selectedCloudProvider}
						onchange={(e) => handleCloudProviderChange(e.currentTarget.value as CloudProvider)}
					>
						{#each Object.entries(PROVIDER_CONFIGS) as [key, config]}
							<option value={key}>{config.name}</option>
						{/each}
					</select>
				</div>

				<!-- API Key Input -->
				<div>
					<label for="api-key-input" class="block text-xs text-secondary mb-1">
						{getProviderName(selectedCloudProvider)} API Key
					</label>
					<div class="flex gap-2">
						<input
							id="api-key-input"
							type="password"
							class="flex-1 surface-panel px-2 py-1.5 rounded text-sm"
							placeholder="Enter API key..."
							value={currentApiKey}
							oninput={(e) => handleApiKeyChange(selectedCloudProvider, e.currentTarget.value)}
						/>
						<button
							class="px-2 py-1 surface-panel rounded text-xs"
							onclick={() => testApiConnection(selectedCloudProvider)}
							disabled={!currentApiKey}
						>
							{#if connectionStatus[selectedCloudProvider] === 'testing'}
								⏳
							{:else if connectionStatus[selectedCloudProvider] === 'connected'}
								✅
							{:else if connectionStatus[selectedCloudProvider] === 'failed'}
								❌
							{:else}
								Test
							{/if}
						</button>
					</div>
				</div>

				<!-- Model Selection -->
				<div>
					<label for="model-select" class="block text-xs text-secondary mb-1">Model</label>
					<select
						id="model-select"
						class="w-full surface-panel px-2 py-1.5 rounded"
						value={selectedModel}
						onchange={(e) => {
							selectedModel = e.currentTarget.value;
							updateSettings({ selectedModel: selectedModel });
						}}
					>
						{#each availableModels as model}
							<option value={model.id}>
								{model.name}
								{#if 'cost' in model}
									({model.cost})
								{/if}
							</option>
						{/each}
					</select>
				</div>
			{:else}
				<!-- Local AI Info -->
				<div class="text-xs text-secondary">
					<p class="mb-2">🔒 Local AI runs entirely in your browser using WebGPU.</p>
					<p>No data is sent to external servers.</p>
				</div>

				<!-- Local Model Selection -->
				<div>
					<label for="local-model-select" class="block text-xs text-secondary mb-1"
						>Local Model</label
					>
					<select
						id="local-model-select"
						class="w-full surface-panel px-2 py-1.5 rounded"
						value={selectedModel}
						onchange={(e) => {
							selectedModel = e.currentTarget.value;
							updateSettings({ selectedModel: selectedModel });
						}}
					>
						{#each LOCAL_AI_CONFIG.models as model}
							<option value={model.id}>
								{model.name} ({model.vramRequired}MB VRAM)
							</option>
						{/each}
					</select>
				</div>
			{/if}

			<!-- Speech-to-Text Toggle -->
			{#if speechSupported}
				<div class="flex items-center justify-between pt-2 border-t border-muted">
					<span class="text-xs">🎤 Voice Commands</span>
					<button
						class="px-2 py-1 rounded text-xs {appSettings.speechToTextEnabled
							? 'bg-primary text-white'
							: 'surface-panel'}"
						onclick={() => {
							updateSettings({ speechToTextEnabled: !appSettings.speechToTextEnabled });
							if (!appSettings.speechToTextEnabled) {
								initSpeechToText();
							}
						}}
					>
						{appSettings.speechToTextEnabled ? 'Enabled' : 'Disabled'}
					</button>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Messages Area -->
	<div class="flex-1 overflow-y-auto mb-3 space-y-2 min-h-0">
		{#if messages.length === 0}
			<div class="text-sm text-secondary text-center py-4">
				<p class="mb-2">Ask me to modify your sculpture!</p>
				<p class="text-xs opacity-70">Try: "Make it taller and add a twist"</p>
			</div>
		{/if}

		{#each messages as message}
			<div class="message {message.role === 'user' ? 'user-message' : 'assistant-message'}">
				<span class="font-semibold text-xs opacity-70">
					{message.role === 'user' ? 'You' : 'AI'}
				</span>
				<p class="text-sm whitespace-pre-wrap">{message.content}</p>
			</div>
		{/each}

		{#if status === 'generating'}
			<div class="text-sm text-secondary animate-pulse">🎨 Sculpting...</div>
		{/if}

		{#if errorMessage}
			<div class="text-sm bg-red-900/30 text-red-300 p-2 rounded">
				⚠️ {errorMessage}
			</div>
		{/if}
	</div>

	<!-- Input Area -->
	<div class="input-area">
		{#if interimTranscript}
			<div class="text-xs text-secondary mb-1 italic">
				🎤 {interimTranscript}
			</div>
		{/if}

		<div class="flex gap-2">
			{#if appSettings.speechToTextEnabled && speechSupported}
				<button
					class="speech-button {isListening ? 'listening' : ''}"
					onclick={toggleSpeech}
					title="Voice input"
				>
					{isListening ? '🔴' : '🎤'}
				</button>
			{/if}

			<input
				type="text"
				class="flex-1 surface-panel-alt px-3 py-2 rounded text-sm"
				placeholder={selectedProvider === 'local' && !sculptureStore.currentSculpture
					? 'Record a sculpture first...'
					: 'Describe changes...'}
				bind:value={inputText}
				disabled={status === 'generating'}
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						handleSend();
					}
				}}
			/>

			<button class="send-button" onclick={handleSend} disabled={!canSend}>
				{status === 'generating' ? '⏳' : '➤'}
			</button>
		</div>

		{#if messages.length > 0}
			<div class="flex gap-2 mt-2">
				{#if status === 'error'}
					<button class="text-xs text-secondary hover:text-primary" onclick={handleRetry}>
						🔄 Retry
					</button>
				{/if}
				<button class="text-xs text-secondary hover:text-primary" onclick={clearConversation}>
					🗑️ Clear
				</button>
			</div>
		{/if}
	</div>

	<!-- Status Bar -->
	<div class="status-bar mt-2 text-xs text-muted flex items-center justify-between">
		<span>
			{#if selectedProvider === 'local'}
				💻 Local AI
			{:else}
				☁️ {getProviderName(selectedCloudProvider)}
			{/if}
		</span>
		<span>
			{uiStore.workspace} mode
		</span>
	</div>
</div>

<style>
	.ai-panel {
		max-height: 100%;
		min-height: 300px;
	}

	.message {
		padding: 8px 12px;
		border-radius: 8px;
	}

	.user-message {
		background: rgba(59, 130, 246, 0.15);
		margin-left: 20px;
	}

	.assistant-message {
		background: rgba(16, 185, 129, 0.15);
		margin-right: 20px;
	}

	.send-button {
		padding: 8px 16px;
		background: var(--color-primary);
		color: white;
		border-radius: 8px;
		font-weight: bold;
		transition: opacity 0.2s;
	}

	.send-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.speech-button {
		padding: 8px 12px;
		background: var(--surface-panel);
		border-radius: 8px;
		transition: all 0.2s;
	}

	.speech-button.listening {
		background: rgba(239, 68, 68, 0.3);
		animation: pulse 1s infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.settings-panel {
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.status-bar {
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		padding-top: 8px;
	}
</style>
