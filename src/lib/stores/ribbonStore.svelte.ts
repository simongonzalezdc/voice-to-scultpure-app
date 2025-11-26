// DEPRECATED: Ribbon mode has been removed
// This file is kept as a stub for backwards compatibility

export interface RibbonPoint {
	x: number;
	y: number;
	z: number;
	width: number;
	color?: { r: number; g: number; b: number };
}

export const ribbonStore = $state<{
	points: RibbonPoint[];
	isRecording: boolean;
	segmentCount: number;
}>({
	points: [],
	isRecording: false,
	segmentCount: 0
});

export function setRibbonPoints(_newPoints: RibbonPoint[]): void {
	// No-op: Ribbon mode removed
}

export function setRibbonRecording(_isRecording: boolean): void {
	// No-op: Ribbon mode removed
}

export function getRibbonPointsForExport(): RibbonPoint[] {
	return [];
}
