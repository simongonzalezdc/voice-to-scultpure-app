<script lang="ts">
	import LoadingSpinner from './LoadingSpinner.svelte';

	let {
		visible = false,
		message = 'Loading...',
		progress = -1 // -1 = indeterminate, 0-100 = determinate
	} = $props<{ visible?: boolean; message?: string; progress?: number }>();
</script>

{#if visible}
	<div class="overlay fade-in">
		<div class="content glass-panel-light">
			<LoadingSpinner size={32} />
			<span class="message">{message}</span>
			{#if progress >= 0}
				<div class="progress-bar">
					<div class="progress-fill" style="width: {progress}%"></div>
				</div>
				<span class="progress-text">{Math.round(progress)}%</span>
			{/if}
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: var(--z-modal-backdrop, 100);
	}

	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		padding: 32px 48px;
		border-radius: 16px;
	}

	.message {
		font-size: 0.875rem;
		color: var(--text-primary, #f9fafb);
		font-weight: 500;
	}

	.progress-bar {
		width: 200px;
		height: 4px;
		background: var(--bg-panel-alt, #2b262f);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(
			90deg,
			var(--brand-primary, #8f3e48),
			var(--brand-primary-hover, #ae5d37)
		);
		border-radius: 2px;
		transition: width 0.3s ease-out;
	}

	.progress-text {
		font-size: 0.75rem;
		color: var(--text-muted, #8b8491);
		font-family: var(--font-mono, monospace);
	}

	.fade-in {
		animation: fade-in 0.2s ease-out;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
