import type { SculptureDefinition } from '$lib/types';

export const sculptureStore = $state<{
	currentSculpture: SculptureDefinition | null;
	ghostSculpture: SculptureDefinition | null;
	geometryDirty: boolean;
}>({
	currentSculpture: null,
	ghostSculpture: null,
	geometryDirty: false
});

export function setCurrentSculpture(sculpture: SculptureDefinition | null): void {
	sculptureStore.currentSculpture = sculpture;
	sculptureStore.geometryDirty = true;
}

export function setGhostSculpture(sculpture: SculptureDefinition | null): void {
	sculptureStore.ghostSculpture = sculpture;
	if (sculpture) {
		sculptureStore.geometryDirty = true;
	}
}

export function clearGhostSculpture(): void {
	sculptureStore.ghostSculpture = null;
	sculptureStore.geometryDirty = true;
}

export function markGeometryClean(): void {
	sculptureStore.geometryDirty = false;
}

