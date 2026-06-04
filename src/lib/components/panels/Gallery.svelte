<script lang="ts">
	import { onMount } from 'svelte';
	import {
		galleryStore,
		loadGallery,
		removeFromGallery,
		renameSculpture,
		formatDuration,
		type GallerySculpture
	} from '$lib/stores/galleryStore.svelte';
	import { setCurrentSculpture } from '$lib/stores/sculptureStore.svelte';
	import { Trash2, Edit2, Check, X, Image } from 'lucide-svelte';

	let editingId = $state<string | null>(null);
	let editName = $state('');

	onMount(() => {
		loadGallery();
	});

	function loadSculpture(item: GallerySculpture) {
		// Deep clone to avoid mutating gallery
		const clone = JSON.parse(JSON.stringify(item.sculpture));
		// Restore Float32Arrays
		clone.layers = clone.layers.map((layer: { data: number[]; mask: number[] }) => ({
			...layer,
			data: new Float32Array(layer.data),
			mask: new Float32Array(layer.mask)
		}));
		setCurrentSculpture(clone);
		console.log(`🖼️ [GALLERY] Loaded "${item.name}"`);
	}

	function startEdit(item: GallerySculpture) {
		editingId = item.id;
		editName = item.name;
	}

	function saveEdit() {
		if (editingId && editName.trim()) {
			renameSculpture(editingId, editName.trim());
		}
		editingId = null;
	}

	function cancelEdit() {
		editingId = null;
		editName = '';
	}

	function confirmDelete(item: GallerySculpture) {
		if (confirm(`Delete "${item.name}"?`)) {
			removeFromGallery(item.id);
		}
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="gallery-panel">
	<h3 class="panel-title">Gallery ({galleryStore.count})</h3>

	{#if galleryStore.count === 0}
		<div class="empty-state">
			<Image size={32} strokeWidth={1} />
			<p>No saved sculptures yet</p>
			<p class="hint">Record a sculpture to see it here</p>
		</div>
	{:else}
		<div class="sculpture-list">
			{#each galleryStore.sculptures as item (item.id)}
				<div class="sculpture-item">
					<button
						class="sculpture-preview"
						onclick={() => loadSculpture(item)}
						title="Click to load"
					>
						<div class="preview-icon">
							<Image size={24} strokeWidth={1.5} />
						</div>
					</button>

					<div class="sculpture-info">
						{#if editingId === item.id}
							<div class="edit-row">
								<input
									type="text"
									bind:value={editName}
									onkeydown={(e) => e.key === 'Enter' && saveEdit()}
									class="edit-input"
								/>
								<button onclick={saveEdit} class="icon-btn save" title="Save">
									<Check size={14} />
								</button>
								<button onclick={cancelEdit} class="icon-btn cancel" title="Cancel">
									<X size={14} />
								</button>
							</div>
						{:else}
							<button class="sculpture-name" onclick={() => loadSculpture(item)}>
								{item.name}
							</button>
						{/if}
						<div class="sculpture-meta">
							<span>{formatDate(item.createdAt)}</span>
							{#if item.duration > 0}
								<span class="duration">{formatDuration(item.duration)}</span>
							{/if}
						</div>
					</div>

					<div class="sculpture-actions">
						<button onclick={() => startEdit(item)} class="icon-btn" title="Rename">
							<Edit2 size={14} />
						</button>
						<button onclick={() => confirmDelete(item)} class="icon-btn delete" title="Delete">
							<Trash2 size={14} />
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.gallery-panel {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--surface-1, #1a1a1a);
		border-radius: 8px;
		max-height: 300px;
		overflow: hidden;
	}

	.panel-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-1, #fff);
		margin: 0;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
		color: var(--text-3, #666);
		text-align: center;
		gap: 0.5rem;
	}

	.empty-state p {
		margin: 0;
		font-size: 0.875rem;
	}

	.empty-state .hint {
		font-size: 0.75rem;
		opacity: 0.7;
	}

	.sculpture-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		overflow-y: auto;
		flex: 1;
	}

	.sculpture-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--surface-2, #222);
		border-radius: 6px;
		transition: background 0.15s;
	}

	.sculpture-item:hover {
		background: var(--surface-3, #2a2a2a);
	}

	.sculpture-preview {
		width: 40px;
		height: 40px;
		border-radius: 4px;
		background: var(--surface-3, #2a2a2a);
		border: 1px solid var(--border, #333);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-3, #666);
		cursor: pointer;
		flex-shrink: 0;
	}

	.sculpture-preview:hover {
		border-color: var(--accent, #4a9eff);
		color: var(--accent, #4a9eff);
	}

	.sculpture-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.sculpture-name {
		font-size: 0.8125rem;
		font-weight: 500;
		color: var(--text-1, #fff);
		background: none;
		border: none;
		padding: 0;
		text-align: left;
		cursor: pointer;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sculpture-name:hover {
		color: var(--accent, #4a9eff);
	}

	.sculpture-meta {
		display: flex;
		gap: 0.5rem;
		font-size: 0.6875rem;
		color: var(--text-3, #666);
	}

	.duration {
		color: var(--accent, #4a9eff);
	}

	.sculpture-actions {
		display: flex;
		gap: 0.25rem;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.sculpture-item:hover .sculpture-actions {
		opacity: 1;
	}

	.icon-btn {
		width: 24px;
		height: 24px;
		border: none;
		background: transparent;
		color: var(--text-3, #666);
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.icon-btn:hover {
		background: var(--surface-3, #333);
		color: var(--text-1, #fff);
	}

	.icon-btn.delete:hover {
		color: #ff4444;
	}

	.icon-btn.save {
		color: #4ade80;
	}

	.icon-btn.cancel {
		color: #f87171;
	}

	.edit-row {
		display: flex;
		gap: 0.25rem;
		align-items: center;
	}

	.edit-input {
		flex: 1;
		min-width: 0;
		padding: 0.25rem 0.5rem;
		font-size: 0.8125rem;
		background: var(--surface-1, #1a1a1a);
		border: 1px solid var(--accent, #4a9eff);
		border-radius: 4px;
		color: var(--text-1, #fff);
		outline: none;
	}
</style>
