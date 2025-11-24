<script lang="ts">
	import Transport from '$lib/components/controls/Transport.svelte';
	import WorkspaceSwitcher from '$lib/components/layout/WorkspaceSwitcher.svelte';
	import { analysisStore } from '$lib/stores/analysisStore.svelte';
	import { recordingStore } from '$lib/stores/recording.svelte';

	const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

	function getNearestNote(pitch: number) {
		if (!pitch || pitch <= 0) return null;
		const midi = 69 + 12 * Math.log2(pitch / 440);
		const rounded = Math.round(midi);
		const freq = 440 * Math.pow(2, (rounded - 69) / 12);
		const note = NOTES[(rounded % 12 + 12) % 12];
		const octave = Math.floor(rounded / 12 - 1);
		return { name: `${note}${octave}`, frequency: freq };
	}

	let tunerState = $derived.by(() => {
		const pitch = analysisStore.latestFrame?.pitch ?? 0;
		const nearest = getNearestNote(pitch);
		const deviation = nearest ? pitch - nearest.frequency : 0;
		return { pitch, nearest, deviation };
	});

	let needleRotation = $derived(() => {
		const clamped = Math.max(-50, Math.min(50, tunerState.deviation || 0));
		return (clamped / 50) * 45;
	});

	let inTune = $derived(Math.abs(tunerState.deviation) < 5 && tunerState.nearest);
</script>

<div class="footer">
	<Transport />
	
	<div class="workspace-switcher-container">
		<WorkspaceSwitcher />
	</div>

	<div class="status-bar">
		<div class="stat">
			<span class="label">Mic</span>
			<div class="bar">
				<div class="fill" style={`width: ${Math.min(100, analysisStore.micLevel * 100)}%`}></div>
			</div>
			<span class="value">{Math.round(analysisStore.micLevel * 100)}%</span>
		</div>
		<div class="stat muted">
			<span class="label">State</span>
			<span class="value capitalize">{recordingStore.state}</span>
		</div>
	</div>

	<div class="tuner-card {inTune ? 'tuned' : ''}">
		<div class="dial">
			<div class="needle" style={`transform: rotate(${needleRotation}deg)`}></div>
			<div class="center-dot"></div>
		</div>
		<div class="readout">
			<div class="note">{tunerState.nearest ? tunerState.nearest.name : '—'}</div>
			<div class="deviation {inTune ? 'good' : ''}">
				{#if tunerState.nearest}
					{tunerState.deviation.toFixed(1)} Hz
				{:else}
					Listen...
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.footer {
		display: flex;
		align-items: center;
		gap: 16px;
		width: 100%;
	}

	.workspace-switcher-container {
		flex-shrink: 0;
	}

	.status-bar {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: 1;
		padding: 10px 12px;
		border: 1px solid var(--border-subtle);
		border-radius: 10px;
		background: linear-gradient(90deg, rgba(30, 30, 30, 0.8), rgba(20, 20, 20, 0.8));
	}

	.stat {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--text-secondary, #aaa);
	}

	.stat .label {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 700;
	}

	.stat .value {
		color: #fff;
		font-weight: 600;
	}

	.stat .bar {
		position: relative;
		width: 120px;
		height: 6px;
		background: #1f1f1f;
		border-radius: 6px;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.stat .fill {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		background: linear-gradient(90deg, #53a0fd, #7cdcff);
		border-radius: 6px;
	}

	.stat.muted .value {
		color: #9c9c9c;
		text-transform: capitalize;
	}

	.tuner-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: radial-gradient(circle at 20% 20%, rgba(90, 143, 255, 0.15), rgba(0, 0, 0, 0.5));
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
		min-width: 160px;
	}

	.tuner-card.tuned {
		border-color: rgba(74, 222, 128, 0.5);
		box-shadow: 0 0 24px rgba(74, 222, 128, 0.25);
	}

	.dial {
		position: relative;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: conic-gradient(
			from 180deg,
			rgba(255, 86, 86, 0.15) 0deg,
			rgba(255, 86, 86, 0.15) 120deg,
			rgba(255, 255, 255, 0.08) 120deg,
			rgba(255, 255, 255, 0.08) 240deg,
			rgba(74, 222, 128, 0.2) 240deg,
			rgba(74, 222, 128, 0.2) 300deg,
			rgba(255, 86, 86, 0.15) 300deg,
			rgba(255, 86, 86, 0.15) 360deg
		);
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.needle {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 2px;
		height: 24px;
		background: linear-gradient(180deg, #ffb36b, #ff5f6b);
		transform-origin: center 18px;
		border-radius: 999px;
		transition: transform 80ms ease-out;
	}

	.center-dot {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 8px;
		height: 8px;
		background: #0b1727;
		border: 2px solid rgba(255, 255, 255, 0.4);
		border-radius: 999px;
		transform: translate(-50%, -50%);
		box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
	}

	.readout {
		display: flex;
		flex-direction: column;
	}

	.note {
		font-weight: 700;
		color: #fff;
		font-size: 14px;
		letter-spacing: 0.02em;
	}

	.deviation {
		font-size: 12px;
		color: #f39b7a;
	}

	.deviation.good {
		color: #4ade80;
	}
</style>
