<script lang="ts">
	let { size = 24, message = '' } = $props<{ size?: number; message?: string }>();
</script>

<div class="loading-container" style="--spinner-size: {size}px">
	<div class="spinner"></div>
	{#if message}
		<span class="message">{message}</span>
	{/if}
</div>

<style>
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.spinner {
		width: var(--spinner-size);
		height: var(--spinner-size);
		border: 2px solid var(--border-subtle, #3a343f);
		border-top-color: var(--brand-primary, #8f3e48);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.message {
		font-size: 0.75rem;
		color: var(--text-muted, #8b8491);
		text-align: center;
	}
</style>
