import { WebGLRenderer } from 'three';

export type RendererType = 'webgpu' | 'webgl';

export interface RendererConfig {
	canvas: HTMLCanvasElement;
	quality: 'low' | 'high';
}

export function createRenderer(config: RendererConfig): WebGLRenderer {
	const { canvas, quality } = config;

	// Use WebGL2 (WebGPU renderer would need separate implementation)
	const renderer = new WebGLRenderer({
		canvas,
		antialias: quality === 'high',
		powerPreference: 'high-performance',
		alpha: false
	});

	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = quality === 'high' ? 1 : 2; // PCF vs Basic
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 2 : 1));

	return renderer;
}

export function getRendererType(_renderer: WebGLRenderer): RendererType {
	// For now, always return webgl since WebGPU renderer isn't implemented
	return 'webgl';
}
