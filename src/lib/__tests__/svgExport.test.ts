import { describe, it, expect } from 'vitest';
import { radiusCurveToSvg } from '../export/radiusCurveToSvg';
import type { LathePoint } from '../types';

describe('SVG Export', () => {
	it('should generate SVG from curve', () => {
		const curve: LathePoint[] = [
			{ x: 0, y: 0 },
			{ x: 0.1, y: 0.5 },
			{ x: 0, y: 1 }
		];

		const svg = radiusCurveToSvg(curve);
		expect(svg).toContain('<svg');
		expect(svg).toContain('path');
		expect(svg).toContain('d=');
	});
});
