import type { SculptureDefinition } from '$lib/types';
import { applyDeformation } from '$lib/engine/physicsMapping';

/**
 * Export profile SVG blueprint for ceramic pottery wheel use
 * Scales the normalized radiusCurve to physical dimensions and adds a ruler grid
 */
export function exportProfileSVG(sculpture: SculptureDefinition): string {
	const curve = sculpture.radiusCurve;
	if (curve.length < 2) {
		throw new Error('Not enough points for blueprint export');
	}

	// Apply deformation before export
	const deformedCurve = applyDeformation(curve, sculpture.deformation);

	// Get physical dimensions
	const physicalHeight = sculpture.physical.height;
	const units = sculpture.physical.units;
	const isMetric = units === 'mm';

	// Find max radius to determine SVG width
	const maxRadius = Math.max(...deformedCurve.map((p) => p.x));
	const minY = Math.min(...deformedCurve.map((p) => p.y));
	const maxY = Math.max(...deformedCurve.map((p) => p.y));
	const maxHeight = Math.max(0.001, maxY - minY); // Prevent division by zero

	// Scale to physical dimensions
	// Normalized curve: x is radius (0-1), y is height (0-1)
	// Physical: scale y to physicalHeight, scale x proportionally
	const heightScale = physicalHeight / maxHeight;
	const radiusScale = heightScale; // Keep aspect ratio

	// Convert to physical coordinates (mm or inches)
	const scaleFactor = isMetric ? 1 : 25.4; // inches to mm conversion
	const physicalMaxRadius = maxRadius * radiusScale * scaleFactor;
	const physicalMaxHeight = physicalHeight * scaleFactor;

	// SVG dimensions with padding for ruler
	const padding = 40; // Space for ruler and labels
	const svgWidth = physicalMaxRadius * 2 + padding * 2;
	const svgHeight = physicalMaxHeight + padding * 2;

	// Build the profile path
	let pathData = 'M';
	const minYValue = minY; // Use pre-calculated minY
	for (let i = 0; i < deformedCurve.length; i++) {
		const point = deformedCurve[i];
		const normalizedY = point.y - minYValue;
		const x = padding + physicalMaxRadius - point.x * radiusScale * scaleFactor; // Center horizontally
		const y = padding + normalizedY * heightScale * scaleFactor; // Top to bottom

		if (i === 0) {
			pathData += ` ${x.toFixed(2)} ${y.toFixed(2)}`;
		} else {
			pathData += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
		}
	}

	// Generate ruler grid (1cm lines)
	const rulerLines: string[] = [];
	const rulerStep = isMetric ? 10 : 10 / 25.4; // 1cm or ~0.4 inches
	const rulerStart = Math.ceil(padding / rulerStep) * rulerStep;

	// Vertical ruler lines (height)
	for (let y = rulerStart; y <= svgHeight - padding; y += rulerStep) {
		const cm = isMetric ? (y - padding) / 10 : (y - padding) / (10 / 25.4);
		rulerLines.push(
			`<line x1="${padding - 20}" y1="${y}" x2="${padding}" y2="${y}" stroke="#666" stroke-width="0.5" />`
		);
		rulerLines.push(
			`<text x="${padding - 25}" y="${y + 2}" font-size="8" fill="#666" text-anchor="end">${cm.toFixed(isMetric ? 0 : 1)}</text>`
		);
	}

	// Horizontal ruler lines (radius)
	for (let x = rulerStart; x <= svgWidth - padding; x += rulerStep) {
		const cm = isMetric ? (x - padding) / 10 : (x - padding) / (10 / 25.4);
		rulerLines.push(
			`<line x1="${x}" y1="${svgHeight - padding}" x2="${x}" y2="${svgHeight - padding + 20}" stroke="#666" stroke-width="0.5" />`
		);
		rulerLines.push(
			`<text x="${x}" y="${svgHeight - padding + 35}" font-size="8" fill="#666" text-anchor="middle">${cm.toFixed(isMetric ? 0 : 1)}</text>`
		);
	}

	// Build SVG
	const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}mm" height="${svgHeight}mm" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <defs>
    <style>
      .profile-path { fill: none; stroke: #000; stroke-width: 1; }
      .ruler-line { stroke: #999; stroke-width: 0.3; }
      .ruler-text { font-family: Arial, sans-serif; font-size: 8px; fill: #666; }
    </style>
  </defs>
  
  <!-- Ruler Grid -->
  <g id="ruler">
    ${rulerLines.join('\n    ')}
  </g>
  
  <!-- Profile Path -->
  <g id="profile" transform="translate(0, 0)">
    <path d="${pathData}" class="profile-path" />
    <!-- Mirror for full profile (pottery wheel needs both sides) -->
    <path d="${pathData}" class="profile-path" transform="scale(-1, 1) translate(${-svgWidth}, 0)" />
  </g>
  
  <!-- Center Line -->
  <line x1="${svgWidth / 2}" y1="${padding}" x2="${svgWidth / 2}" y2="${svgHeight - padding}" stroke="#ccc" stroke-width="0.5" stroke-dasharray="2,2" />
  
  <!-- Title -->
  <text x="${svgWidth / 2}" y="20" font-size="12" fill="#000" text-anchor="middle" font-weight="bold">${sculpture.name}</text>
  <text x="${svgWidth / 2}" y="35" font-size="10" fill="#666" text-anchor="middle">Height: ${physicalHeight}${units} | Scale: 1:1</text>
</svg>`;

	return svg;
}

export function downloadBlueprint(svg: string, filename: string): void {
	const blob = new Blob([svg], { type: 'image/svg+xml' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
