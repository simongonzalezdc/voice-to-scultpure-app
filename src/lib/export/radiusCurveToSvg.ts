import type { LathePoint } from '$lib/types';

export function radiusCurveToSvg(curve: LathePoint[], scale: number = 10): string {
	// Scale: pixels per unit (default 10px = 1 unit)
	// Convert to mm coordinates (assuming 1 unit = 1mm)
	const mmScale = scale;

	let path = 'M';
	for (let i = 0; i < curve.length; i++) {
		const point = curve[i];
		const x = point.x * mmScale;
		const y = point.y * mmScale;
		if (i === 0) {
			path += ` ${x} ${y}`;
		} else {
			path += ` L ${x} ${y}`;
		}
	}

	const maxX = Math.max(...curve.map((p) => p.x)) * mmScale;
	const maxY = Math.max(...curve.map((p) => p.y)) * mmScale;

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maxX + 20}" height="${maxY + 20}" viewBox="0 0 ${maxX + 20} ${maxY + 20}">
  <g transform="translate(10, 10)">
    <path d="${path}" fill="none" stroke="#000" stroke-width="0.5" />
  </g>
</svg>`;

	return svg;
}

export function downloadSvg(svg: string, filename: string): void {
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

