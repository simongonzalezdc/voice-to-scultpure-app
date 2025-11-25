/**
 * Ribbon Store
 * 
 * Stores ribbon geometry points for export.
 * The RibbonGeometryManager in Sculpture.svelte updates this store
 * so ExportTools can access the ribbon data.
 */

import type { RibbonPoint } from '$lib/engine/RibbonGeometryManager';

interface RibbonStoreState {
	/** Current ribbon points (for export) */
	points: RibbonPoint[];
	/** Number of segments in the ribbon */
	segmentCount: number;
	/** Whether a ribbon is currently being recorded */
	isRecording: boolean;
}

export const ribbonStore = $state<RibbonStoreState>({
	points: [],
	segmentCount: 0,
	isRecording: false
});

/**
 * Update the ribbon points (called from Sculpture.svelte)
 */
export function setRibbonPoints(points: RibbonPoint[]): void {
	ribbonStore.points = points;
	ribbonStore.segmentCount = points.length;
}

/**
 * Clear ribbon data
 */
export function clearRibbon(): void {
	ribbonStore.points = [];
	ribbonStore.segmentCount = 0;
	ribbonStore.isRecording = false;
}

/**
 * Set recording state
 */
export function setRibbonRecording(isRecording: boolean): void {
	ribbonStore.isRecording = isRecording;
}

/**
 * Get ribbon points for export
 */
export function getRibbonPointsForExport(): RibbonPoint[] {
	return [...ribbonStore.points];
}

