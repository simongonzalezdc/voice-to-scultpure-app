<script lang="ts">
	import { sculptureStore } from '$lib/stores/sculptureStore.svelte';
	import { getRadiusMetrics } from '$lib/engine/metrics';
	import { DEFAULT_HEIGHT_MM } from '$lib/config/constants';

	let ratio = $derived.by(() => {
		const sculpture = sculptureStore.currentSculpture;
		const metrics = getRadiusMetrics(sculpture);
		if (!metrics) return 0;
		const height = sculpture?.physical?.height ?? DEFAULT_HEIGHT_MM;
		const scale = height / DEFAULT_HEIGHT_MM;
		const diameter = Math.max(0.001, metrics.maxRadius * scale * 2);
		return height / diameter;
	});

	let isGolden = $derived(ratio >= 1.61 && ratio <= 1.62);
</script>

{#if sculptureStore.currentSculpture}
	<div class="golden-guide {isGolden ? 'active' : ''}" aria-live="polite">
		<div class="phi">Φ</div>
		<div class="metrics">
			<div class="label">Golden Ratio Lock</div>
			<div class="value">{ratio ? ratio.toFixed(2) : '—'}</div>
		</div>
	</div>
{/if}

<style>
	.golden-guide {
		position: absolute;
		left: 16px;
		bottom: 16px;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.55);
		border: 1px solid rgba(255, 215, 0, 0.25);
		color: #f7e7a5;
		backdrop-filter: blur(8px);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
		transition:
			border-color 150ms ease,
			box-shadow 150ms ease,
			transform 150ms ease;
	}

	.golden-guide.active {
		border-color: #ffd700;
		box-shadow: 0 0 25px rgba(255, 215, 0, 0.4);
		transform: translateY(-2px);
		animation: golden-pulse 1s ease-in-out infinite alternate;
	}

	.phi {
		font-weight: 800;
		font-size: 18px;
		padding: 8px;
		border-radius: 50%;
		background: radial-gradient(circle at 30% 30%, #ffe8a3, #c48a1f);
		color: #2a1600;
		box-shadow: inset 0 1px 8px rgba(0, 0, 0, 0.3);
	}

	.metrics .label {
		font-size: 11px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: rgba(247, 231, 165, 0.8);
	}

	.metrics .value {
		font-size: 13px;
		font-weight: 700;
	}

	@keyframes golden-pulse {
		from {
			box-shadow: 0 0 18px rgba(255, 215, 0, 0.25);
		}
		to {
			box-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
		}
	}
</style>
