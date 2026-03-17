<script lang="ts">
	import { onMount } from 'svelte';
	import { appSettings, updateSettings, setReduceMotion, setFlashIntensity } from '$lib/stores/appSettingsStore.svelte';
	import { resetCalibration } from '$lib/audio/calibration';
	import { closePanel } from '$lib/stores/uiStore.svelte';
	import { setGraphicsQuality } from '$lib/stores/settings.svelte';
	import VoiceCalibration from '$lib/components/onboarding/VoiceCalibration.svelte';
	import { calibrationStore } from '$lib/stores/calibrationStore.svelte';

	const graphicsQuality = $derived(appSettings.graphicsQuality);

	// Accessibility state
	let reduceMotion = $state(appSettings.reduceMotion ?? false);
	let flashIntensity = $state(appSettings.flashIntensity ?? 1.0);

	// P0: Voice Calibration dialog state
	let showVoiceCalibration = $state(false);
	let hasVoiceCalibration = $derived(calibrationStore.isCalibrated);

	function handleSave() {
		updateSettings({
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
	
	function handleVoiceCalibration() {
		showVoiceCalibration = true;
	}
	
	function handleVoiceCalibrationComplete() {
		showVoiceCalibration = false;
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
				<h3 class="text-sm font-semibold mb-2">🎙️ Voice Calibration</h3>
				
				<!-- P0: Enhanced Voice Calibration -->
				<div class="mb-3">
					{#if hasVoiceCalibration}
						<div class="flex items-center gap-2 mb-2 text-sm text-green-400">
							<span>✅</span>
							<span>Voice profile calibrated</span>
						</div>
					{:else}
						<p class="text-xs text-amber-400 mb-2">
							⚠️ No voice calibration. For best results, calibrate your voice.
						</p>
					{/if}
					
					<button
						class="button-primary px-4 py-2 w-full mb-2"
						type="button"
						onclick={handleVoiceCalibration}
					>
						🎤 {hasVoiceCalibration ? 'Recalibrate Voice' : 'Calibrate Voice'}
					</button>
					<p class="text-xs text-secondary">
						Personalizes the sculpture mapping to your unique vocal range.
					</p>
				</div>
				
				<button
					class="button-secondary px-4 py-2 w-full"
					type="button"
					onclick={handleResetCalibration}
				>
					Reset App Calibration
				</button>
			</div>
		</div>
		
		<!-- P0: Voice Calibration Modal -->
		{#if showVoiceCalibration}
			<VoiceCalibration onComplete={handleVoiceCalibrationComplete} />
		{/if}
	</div>
</div>
