<script lang="ts">
	import { appSettings, updateSettings, resetSettings } from '$lib/stores/appSettingsStore';
	import { resetCalibration } from '$lib/audio/calibration';
	import { closePanel } from '$lib/stores/uiStore';
	import { graphicsQuality, setGraphicsQuality } from '$lib/stores/settings';

	let apiKeyInput = $state(appSettings.apiKey || '');
	let apiEndpointInput = $state(appSettings.apiEndpoint || 'https://api.openai.com/v1/chat/completions');

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
</script>

<div class="surface-panel p-6 rounded-lg max-w-md">
	<h2 class="text-2xl font-bold mb-4">Settings</h2>

	<div class="space-y-4">
		<div>
			<label class="text-sm text-secondary block mb-1">Graphics Quality</label>
			<select
				class="surface-panel-alt px-3 py-2 rounded w-full"
				value={graphicsQuality}
				onchange={(e) => setGraphicsQuality((e.target as HTMLSelectElement).value as 'low' | 'high')}
			>
				<option value="low">Low</option>
				<option value="high">High</option>
			</select>
		</div>

		<div>
			<label class="text-sm text-secondary block mb-1">AI Provider</label>
			<select
				class="surface-panel-alt px-3 py-2 rounded w-full"
				value={appSettings.aiProvider}
				onchange={(e) => updateSettings({ aiProvider: (e.target as HTMLSelectElement).value as 'cloud' | 'local' })}
			>
				<option value="cloud">Cloud (OpenAI)</option>
				<option value="local">Local (WebGPU)</option>
			</select>
		</div>

		{#if appSettings.aiProvider === 'cloud'}
			<div>
				<label class="text-sm text-secondary block mb-1">API Key</label>
				<input
					type="password"
					class="surface-panel-alt px-3 py-2 rounded w-full"
					bind:value={apiKeyInput}
					placeholder="sk-..."
				/>
			</div>
			<div>
				<label class="text-sm text-secondary block mb-1">API Endpoint</label>
				<input
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

