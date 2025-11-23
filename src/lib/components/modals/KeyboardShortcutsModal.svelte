<script lang="ts">
	import { onMount } from 'svelte';

	let { isOpen, onClose } = $props<{ isOpen: boolean; onClose: () => void }>();

	const shortcuts = [
		{ key: 'Space', description: 'Start/Stop Recording' },
		{ key: 'F', description: 'Switch to Export Workspace' },
		{ key: 'Esc', description: 'Close Panels / Cancel' },
		{ key: 'Shift + ?', description: 'Show this help' }
	];

	// Focus trap
	let modalElement = $state<HTMLDivElement | null>(null);
	let firstFocusableElement = $state<HTMLElement | null>(null);
	let lastFocusableElement = $state<HTMLElement | null>(null);

	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen) return;

		if (event.key === 'Escape') {
			onClose();
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

	$effect(() => {
		if (isOpen && modalElement) {
			const focusableElements = modalElement.querySelectorAll(
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

{#if isOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
		onkeydown={handleKeydown}
	>
		<div
			bind:this={modalElement}
			class="bg-surface-panel rounded-lg shadow-2xl max-w-md w-full p-6 border border-subtle relative"
			role="dialog"
			aria-modal="true"
			aria-labelledby="shortcuts-title"
		>
			<button
				onclick={onClose}
				class="absolute top-4 right-4 text-secondary hover:text-primary transition-colors text-xl"
				title="Close shortcuts (or press Escape)"
				aria-label="Close shortcuts"
			>
				✕
			</button>

			<h2 id="shortcuts-title" class="text-2xl font-bold text-primary mb-6">Keyboard Shortcuts</h2>

			<div class="space-y-3">
				{#each shortcuts as shortcut}
					<div class="flex items-center justify-between border-b border-subtle pb-2 last:border-0">
						<span class="text-secondary text-sm">{shortcut.description}</span>
						<kbd
							class="px-2 py-1 bg-surface-alt border border-subtle rounded text-xs font-mono text-primary"
						>
							{shortcut.key}
						</kbd>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

