<script lang="ts">
	import { appSettings, updateSettings } from '$lib/stores/appSettingsStore.svelte';
	import { sculptureStore, setCurrentSculpture } from '$lib/stores/sculptureStore.svelte';
	import { createAISculptor, mergeSculpture } from '$lib/ai';
	import type { AISculptor } from '$lib/ai';
	import { AISculptorErrorImpl } from '$lib/ai/types';

	let sculptor = $state<AISculptor | null>(null);
	let messages = $state<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
	let inputText = $state('');
	let status = $state<'idle' | 'generating' | 'error'>('idle');
	let errorMessage = $state<string | null>(null);
	let progress = $state(0);

	$effect(() => {
		initializeSculptor();
	});

	async function initializeSculptor() {
		try {
			status = 'idle';
			errorMessage = null;
			sculptor = await createAISculptor(appSettings.aiProvider, {
				apiKey: appSettings.apiKey,
				apiEndpoint: appSettings.apiEndpoint,
				model: 'desktop',
				progressCallback: (p) => {
					progress = p;
				}
			});
			await sculptor.initialize();
		} catch (error) {
			status = 'error';
			errorMessage = error instanceof Error ? error.message : String(error);
		}
	}

	async function handleSend() {
		if (!inputText.trim() || !sculptor || !sculptureStore.currentSculpture) {
			return;
		}

		const userMessage = inputText.trim();
		messages = [...messages, { role: 'user', content: userMessage }];
		inputText = '';
		status = 'generating';
		errorMessage = null;

		try {
			const mutation = await sculptor.generateVariation(
				sculptureStore.currentSculpture,
				userMessage,
				messages
			);

			const updated = mergeSculpture(sculptureStore.currentSculpture, mutation);
			setCurrentSculpture(updated);

			messages = [
				...messages,
				{ role: 'assistant', content: `Applied: ${JSON.stringify(mutation)}` }
			];
			status = 'idle';
		} catch (error) {
			status = 'error';
			if (error instanceof AISculptorErrorImpl) {
				errorMessage = `Error (${error.code}): ${error.message}`;
			} else {
				errorMessage = error instanceof Error ? error.message : String(error);
			}
		}
	}

	function handleProviderChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		updateSettings({ aiProvider: target.value as 'cloud' | 'local' });
		initializeSculptor();
	}

	function handleRetry() {
		const lastMsg = messages[messages.length - 1];
		if (messages.length > 0 && lastMsg?.role === 'user') {
			const lastMessage = lastMsg.content;
			messages = messages.slice(0, -1);
			inputText = lastMessage;
			handleSend();
		} else {
			initializeSculptor();
		}
	}
</script>

<div class="surface-panel p-4 rounded-lg flex flex-col h-full max-h-96">
	<h2 class="text-lg font-semibold mb-4">AI Assistant</h2>

	<div class="mb-4">
		<label for="ai-provider-select" class="text-sm text-secondary block mb-1">Provider</label>
		<select
			id="ai-provider-select"
			class="surface-panel-alt px-3 py-2 rounded w-full"
			value={appSettings.aiProvider}
			onchange={handleProviderChange}
		>
			<option value="cloud">Cloud (OpenAI)</option>
			<option value="local">Local (WebGPU)</option>
		</select>
	</div>

	<div class="flex-1 overflow-y-auto mb-4 space-y-2">
		{#each messages as message}
			<div class="text-sm {message.role === 'user' ? 'text-primary' : 'text-secondary'}">
				<span class="font-semibold">{message.role === 'user' ? 'You' : 'AI'}:</span>
				{message.content}
			</div>
		{/each}
		{#if status === 'generating'}
			<div class="text-sm text-secondary">
				Generating sculpture modification...
				{#if progress > 0 && progress < 1}
					<span class="ml-2">({(progress * 100).toFixed(0)}%)</span>
				{/if}
			</div>
		{/if}
		{#if errorMessage}
			<div class="text-sm badge badge-danger p-2">{errorMessage}</div>
		{/if}
	</div>

	<div class="flex gap-2">
		<input
			type="text"
			class="flex-1 surface-panel-alt px-3 py-2 rounded"
			placeholder="Describe changes..."
			bind:value={inputText}
			disabled={status === 'generating' || !sculptureStore.currentSculpture}
			onkeydown={(e) => {
				if (e.key === 'Enter' && !e.shiftKey) {
					e.preventDefault();
					handleSend();
				}
			}}
		/>
		<button
			class="button-primary px-4 py-2 disabled:opacity-50"
			type="button"
			onclick={handleSend}
			disabled={status === 'generating' || !sculptureStore.currentSculpture}
		>
			Send
		</button>
		{#if status === 'error'}
			<button class="button-secondary px-4 py-2" type="button" onclick={handleRetry}>
				Retry
			</button>
		{/if}
	</div>

	{#if sculptor}
		<div class="mt-2 text-xs text-muted">
			Status: {sculptor.getStatus()}
			{#if progress > 0 && progress < 1}
				- Loading: {(progress * 100).toFixed(0)}%
			{/if}
		</div>
	{/if}
</div>
