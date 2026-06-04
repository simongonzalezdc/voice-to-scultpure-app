import type { LathePoint } from '$lib/types';

export function radiusCurveToSvg(curve: LathePoint[]): string {
	if (!curve.length) {
		return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="" /></svg>';
	}

	const width = 200;
	const height = 200;
	const padding = 10;
	const points = curve.map((point) => {
		const x = padding + point.x * (width - padding * 2);
		const y = padding + point.y * (height - padding * 2);
		return `${x.toFixed(2)} ${y.toFixed(2)}`;
	});
	const pathData = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point}`).join(' ');

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><path d="${pathData}" fill="none" stroke="currentColor" /></svg>`;
}
