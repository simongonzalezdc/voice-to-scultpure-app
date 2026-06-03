<script lang="ts">
	/**
	 * Toast UI Component
	 * PHASE 3: Radical Observability - File Operation Feedback
	 *
	 * Renders toasts from the toastStore with animations and styling.
	 * Should be placed once at the top level (e.g., in +layout.svelte)
	 *
	 * Features:
	 * - Stacking toast notifications
	 * - Auto-dismiss with visual timer
	 * - Manual dismiss button
	 * - Accessibility: ARIA labels, keyboard support
	 * - Smooth enter/exit animations
	 */

	import { toastStore, type Toast } from '$lib/stores/toastStore.svelte';

	let toasts = $derived(toastStore.getToasts());

	function handleDismiss(id: string) {
		toastStore.dismiss(id);
	}

	function getTypeStyles(type: Toast['type']): {
		bgColor: string;
		borderColor: string;
		iconColor: string;
		icon: string;
	} {
		switch (type) {
			case 'success':
				return {
					bgColor: 'bg-green-900/90',
					borderColor: 'border-green-700',
					iconColor: 'text-green-400',
					icon: '✓'
				};
			case 'error':
				return {
					bgColor: 'bg-red-900/90',
					borderColor: 'border-red-700',
					iconColor: 'text-red-400',
					icon: '✕'
				};
			case 'warning':
				return {
					bgColor: 'bg-yellow-900/90',
					borderColor: 'border-yellow-700',
					iconColor: 'text-yellow-400',
					icon: '⚠'
				};
			case 'info':
			default:
				return {
					bgColor: 'bg-blue-900/90',
					borderColor: 'border-blue-700',
					iconColor: 'text-blue-400',
					icon: 'ℹ'
				};
		}
	}
</script>

<!-- Toast Container -->
<div
	class="toast-container"
	role="region"
	aria-label="Notifications"
	aria-live="polite"
	aria-atomic="false"
>
	{#each toasts as toast (toast.id)}
		{@const { iconColor, icon } = getTypeStyles(toast.type)}
		<div
			class="toast animate-in fade-in slide-in-from-top-4 duration-300"
			class:bg-green-900={toast.type === 'success'}
			class:bg-red-900={toast.type === 'error'}
			class:bg-yellow-900={toast.type === 'warning'}
			class:bg-blue-900={toast.type === 'info'}
			role="alert"
			aria-label="{toast.type}: {toast.title}"
		>
			<!-- Icon -->
			<div class="toast-icon {iconColor}">
				{icon}
			</div>

			<!-- Content -->
			<div class="toast-content">
				<div class="toast-title">{toast.title}</div>
				{#if toast.message}
					<div class="toast-message">{toast.message}</div>
				{/if}
			</div>

			<!-- Close Button -->
			{#if toast.dismissable}
				<button
					class="toast-close"
					onclick={() => handleDismiss(toast.id)}
					aria-label="Dismiss notification"
					title="Close"
				>
					×
				</button>
			{/if}

			<!-- Progress Bar (auto-dismiss indicator) -->
			{#if toast.duration > 0}
				<div class="toast-progress" style="--duration: {toast.duration}ms"></div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.toast-container {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		pointer-events: none;
		max-width: 24rem;

		@media (max-width: 640px) {
			top: 0.5rem;
			right: 0.5rem;
			max-width: calc(100vw - 1rem);
		}
	}

	.toast {
		pointer-events: auto;
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding: 1rem;
		border-radius: 0.5rem;
		border: 1px solid transparent;
		background-color: rgba(17, 24, 39, 0.9);
		backdrop-filter: blur(4px);
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
		animation: slideInFromTop 0.3s ease-out;
		position: relative;
		overflow: hidden;
		font-family:
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
	}

	.toast.bg-green-900 {
		background-color: rgba(20, 83, 45, 0.9);
		border-color: rgba(34, 197, 94, 0.3);
	}

	.toast.bg-red-900 {
		background-color: rgba(127, 29, 29, 0.9);
		border-color: rgba(239, 68, 68, 0.3);
	}

	.toast.bg-yellow-900 {
		background-color: rgba(113, 63, 18, 0.9);
		border-color: rgba(245, 158, 11, 0.3);
	}

	.toast.bg-blue-900 {
		background-color: rgba(30, 58, 138, 0.9);
		border-color: rgba(59, 130, 246, 0.3);
	}

	.toast-icon {
		font-size: 1.25rem;
		font-weight: bold;
		flex-shrink: 0;
		margin-top: 0.125rem;
	}

	.toast-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.toast-title {
		font-weight: 600;
		font-size: 0.95rem;
		color: #ffffff;
		line-height: 1.4;
	}

	.toast-message {
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.85);
		line-height: 1.4;
		word-break: break-word;
		font-family: 'Monaco', 'Courier New', monospace;
	}

	.toast-close {
		flex-shrink: 0;
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.6);
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0;
		margin: -0.5rem -0.25rem -0.5rem 0;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: color 0.2s ease;

		&:hover {
			color: rgba(255, 255, 255, 1);
		}

		&:focus {
			outline: 2px solid rgba(255, 255, 255, 0.5);
			outline-offset: 2px;
			border-radius: 0.25rem;
		}
	}

	.toast-progress {
		--duration: 4000ms;
		position: absolute;
		bottom: 0;
		left: 0;
		height: 3px;
		background: linear-gradient(90deg, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0.1));
		animation: progressBar var(--duration) linear forwards;
	}

	@keyframes slideInFromTop {
		from {
			transform: translateY(-100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	@keyframes progressBar {
		from {
			width: 100%;
		}
		to {
			width: 0%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.toast {
			animation: none;
		}

		.toast-progress {
			animation: none;
			width: 0;
		}
	}
</style>
