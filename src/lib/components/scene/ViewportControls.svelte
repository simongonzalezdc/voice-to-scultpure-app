<script lang="ts">
	import {
		uiStore,
		setLightingAngle,
		setZoom,
		setViewMode,
		setEnvironment,
		toggleBlueprintVisibility,
		setBlueprint
	} from '$lib/stores/uiStore.svelte';
	import { appSettings, updateSettings } from '$lib/stores/appSettingsStore.svelte';
	import { undo, redo, historyStore } from '$lib/stores/historyStore.svelte';
	import { Eye, Undo2, Redo2, Home } from 'lucide-svelte';

	let showMenu = $state(false);

	const potteryMode = $derived(appSettings.viewMode?.potteryMode ?? false);
	const viewMode = $derived(uiStore.view.mode);
	const environment = $derived(uiStore.view.environment);
	const showBlueprint = $derived(uiStore.view.showBlueprint);
	const blueprintId = $derived(uiStore.view.blueprintId);

	function handleZoomIn() {
		setZoom(uiStore.view.zoom + 0.1);
	}

	function handleZoomOut() {
		setZoom(uiStore.view.zoom - 0.1);
	}

	function handleLightRotate() {
		setLightingAngle(uiStore.view.lightingAngle + Math.PI / 4);
	}

	function togglePotteryMode() {
		updateSettings({
			viewMode: {
				...appSettings.viewMode,
				potteryMode: !potteryMode
			}
		});
	}

	function resetView() {
		setZoom(1.5);
		setLightingAngle(0);
		setViewMode('standard');
		console.log('🏠 [VIEW] Reset to default');
	}
</script>

<div class="flex flex-col gap-2 relative">
	<!-- View Settings Button -->
	<button
		class="w-10 h-10 rounded-full bg-[#1a1a1a] border border-[#4a4a4a] text-white flex items-center justify-center hover:bg-[#2a2a2a] transition-colors {showMenu
			? 'bg-brand-primary border-brand-primary'
			: ''}"
		onclick={() => (showMenu = !showMenu)}
		title="View Settings"
	>
		<Eye size={18} />
	</button>

	<!-- View Settings Menu -->
	{#if showMenu}
		<div
			class="absolute top-0 right-12 w-64 bg-[#1a1a1a] border border-[#4a4a4a] rounded-lg p-3 z-50 shadow-2xl"
		>
			<div class="space-y-3">
				<!-- View Mode -->
				<div role="group" aria-labelledby="view-mode-label">
					<span id="view-mode-label" class="text-xs text-secondary font-semibold block mb-2"
						>View Mode</span
					>
					<div class="grid grid-cols-2 gap-1">
						<button
							class="px-2 py-1 text-xs rounded {viewMode === 'standard'
								? 'bg-brand-primary text-white'
								: 'bg-surface-alt text-secondary hover:text-primary'}"
							onclick={() => setViewMode('standard')}
						>
							Standard
						</button>
						<button
							class="px-2 py-1 text-xs rounded {viewMode === 'xray'
								? 'bg-brand-primary text-white'
								: 'bg-surface-alt text-secondary hover:text-primary'}"
							onclick={() => setViewMode('xray')}
						>
							X-Ray
						</button>
						<button
							class="px-2 py-1 text-xs rounded {viewMode === 'wireframe'
								? 'bg-brand-primary text-white'
								: 'bg-surface-alt text-secondary hover:text-primary'}"
							onclick={() => setViewMode('wireframe')}
						>
							Wireframe
						</button>
						<button
							class="px-2 py-1 text-xs rounded {viewMode === 'heatmap'
								? 'bg-brand-primary text-white'
								: 'bg-surface-alt text-secondary hover:text-primary'}"
							onclick={() => setViewMode('heatmap')}
						>
							Heatmap
						</button>
					</div>
				</div>

				<!-- Lighting -->
				<div class="border-t border-subtle pt-3">
					<label for="lighting-select" class="text-xs text-secondary font-semibold block mb-2"
						>Lighting</label
					>
					<select
						id="lighting-select"
						value={environment}
						onchange={(e) =>
							setEnvironment(
								(e.target as HTMLSelectElement).value as 'studio' | 'neon' | 'darkroom'
							)}
						class="w-full bg-surface-alt px-2 py-1 rounded text-xs text-white"
					>
						<option value="studio">Studio</option>
						<option value="neon">Neon</option>
						<option value="darkroom">Darkroom</option>
					</select>
				</div>

				<!-- Guides -->
				<div class="border-t border-subtle pt-3">
					<span class="text-xs text-secondary font-semibold block mb-2">Guides</span>
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={showBlueprint}
							onchange={toggleBlueprintVisibility}
							class="w-3 h-3 accent-brand-primary"
						/>
						<span class="text-xs text-white">Phantom Blueprint</span>
					</label>
					{#if showBlueprint}
						<select
							value={blueprintId ?? 'amphora'}
							onchange={(e) => setBlueprint((e.target as HTMLSelectElement).value)}
							class="w-full bg-surface-alt px-2 py-1 rounded text-xs text-white mt-2"
						>
							<option value="amphora">Amphora</option>
							<option value="chalice">Chalice</option>
						</select>
					{/if}
				</div>

				<!-- Camera -->
				<div class="border-t border-subtle pt-3">
					<span class="text-xs text-secondary font-semibold block mb-2">Camera</span>
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							checked={potteryMode}
							onchange={togglePotteryMode}
							class="w-3 h-3 accent-brand-primary"
						/>
						<span class="text-xs text-white">Pottery Mode (Lock Rotation)</span>
					</label>
				</div>
			</div>
		</div>
	{/if}

	<!-- Lighting Control -->
	<button
		class="w-10 h-10 rounded-full bg-[#1a1a1a] border border-[#4a4a4a] text-white flex items-center justify-center hover:bg-[#2a2a2a] transition-colors"
		onclick={handleLightRotate}
		title="Rotate Light"
	>
		💡
	</button>

	<!-- Zoom Controls -->
	<div class="flex flex-col rounded-full bg-[#1a1a1a] border border-[#4a4a4a] overflow-hidden">
		<button
			class="w-10 h-10 text-white flex items-center justify-center hover:bg-[#2a2a2a] transition-colors border-b border-[#4a4a4a]"
			onclick={handleZoomIn}
			title="Zoom In"
		>
			+
		</button>
		<button
			class="w-10 h-10 text-white flex items-center justify-center hover:bg-[#2a2a2a] transition-colors"
			onclick={handleZoomOut}
			title="Zoom Out"
		>
			-
		</button>
	</div>

	<!-- Reset View -->
	<button
		class="w-10 h-10 rounded-full bg-[#1a1a1a] border border-[#4a4a4a] text-white flex items-center justify-center hover:bg-[#2a2a2a] transition-colors tooltip"
		onclick={resetView}
		title="Reset View (Home)"
		data-tooltip="Reset View"
	>
		<Home size={18} />
	</button>

	<!-- Undo/Redo -->
	<div class="flex flex-col rounded-full bg-[#1a1a1a] border border-[#4a4a4a] overflow-hidden">
		<button
			class="w-10 h-10 text-white flex items-center justify-center hover:bg-[#2a2a2a] transition-colors border-b border-[#4a4a4a] disabled:opacity-30 disabled:cursor-not-allowed tooltip"
			onclick={undo}
			disabled={!historyStore.canUndo}
			title="Undo (Ctrl+Z)"
			data-tooltip="Undo"
		>
			<Undo2 size={16} />
		</button>
		<button
			class="w-10 h-10 text-white flex items-center justify-center hover:bg-[#2a2a2a] transition-colors disabled:opacity-30 disabled:cursor-not-allowed tooltip"
			onclick={redo}
			disabled={!historyStore.canRedo}
			title="Redo (Ctrl+Shift+Z)"
			data-tooltip="Redo"
		>
			<Redo2 size={16} />
		</button>
	</div>
</div>
