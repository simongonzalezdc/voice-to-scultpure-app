/**
 * High Resolution Render Export
 * AUDIT FIX: Completely rewritten to:
 * - Use Layer system (not deprecated radiusCurve)
 * - 2x super-sampling for anti-aliasing
 * - Match main renderer material properties (ceramic PBR)
 * - Professional 3-point lighting setup
 * - ACESFilmicToneMapping for proper HDR
 */

import {
	WebGLRenderer,
	PerspectiveCamera,
	Scene,
	DirectionalLight,
	AmbientLight,
	HemisphereLight,
	LatheGeometry,
	MeshPhysicalMaterial,
	Mesh,
	Vector2,
	ACESFilmicToneMapping,
	SRGBColorSpace,
	Color
} from 'three';
import JSZip from 'jszip';
import type { SculptureDefinition } from '$lib/types';
import { uiStore } from '$lib/stores/uiStore.svelte';
import { computeProfile } from '$lib/engine/compositor';
import { DEFAULT_MATERIAL_CERAMIC } from '$lib/types';

// High quality export settings
const EXPORT_SEGMENTS = 128; // 4x higher than preview (32)
const SUPER_SAMPLE_FACTOR = 2; // 2x super-sampling

export async function renderHighRes(
	sculpture: SculptureDefinition,
	quality: 'low' | 'high' = 'high'
): Promise<Blob> {
	const baseSize = quality === 'high' ? 4096 : 2048;
	const renderSize = baseSize * SUPER_SAMPLE_FACTOR; // Super-sample at 2x
	
	const canvas = document.createElement('canvas');
	canvas.width = renderSize;
	canvas.height = renderSize;

	const renderer = new WebGLRenderer({ 
		canvas, 
		antialias: true,
		preserveDrawingBuffer: true,
		powerPreference: 'high-performance'
	});
	renderer.setSize(renderSize, renderSize);
	
	// AUDIT FIX: Proper tone mapping and color space
	renderer.toneMapping = ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.2;
	renderer.outputColorSpace = SRGBColorSpace;

	const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
	const scene = new Scene();
	scene.background = new Color(0xf5f5f5); // Light gray background

	// AUDIT FIX: Professional 3-point lighting (matches MainScene)
	const hemisphereLight = new HemisphereLight(0xFDFBF7, 0x4A4A6A, 0.4);
	scene.add(hemisphereLight);
	
	const keyLight = new DirectionalLight(0xffffff, 1.2);
	keyLight.position.set(5, 8, 4);
	scene.add(keyLight);
	
	const fillLight = new DirectionalLight(0xE8E4E0, 0.4);
	fillLight.position.set(-3, 4, -2);
	scene.add(fillLight);
	
	const rimLight = new DirectionalLight(0xD4E5F7, 0.25);
	rimLight.position.set(0, 2, -5);
	scene.add(rimLight);

	const ambientLight = new AmbientLight(0xffffff, 0.15);
	scene.add(ambientLight);

	// AUDIT FIX: Use Layer system instead of deprecated radiusCurve
	let profile: { x: number; y: number }[];
	if (sculpture.layers && sculpture.layers.length > 0) {
		profile = computeProfile(sculpture.layers);
	} else if (sculpture.radiusCurve && sculpture.radiusCurve.length > 0) {
		// Fallback to legacy radiusCurve
		profile = sculpture.radiusCurve;
	} else {
		throw new Error('No sculpture data to render');
	}
	
	const points = profile.map((p) => new Vector2(p.x, p.y));
	const geometry = new LatheGeometry(points, EXPORT_SEGMENTS);
	
	// AUDIT FIX: Ceramic material with full PBR properties (matches Sculpture.svelte)
	const glazeRoughness = uiStore.activeGlaze.roughness ?? 0.35;
	const glazeTransmission = uiStore.activeGlaze.transmission ?? 0;
	const clearcoatAmount = Math.max(0, 0.9 - glazeRoughness * 0.8);
	
	const material = new MeshPhysicalMaterial({
		color: new Color(uiStore.activeGlaze.color || DEFAULT_MATERIAL_CERAMIC),
		roughness: glazeRoughness,
		metalness: 0.0,
		// Glaze layer
		clearcoat: clearcoatAmount,
		clearcoatRoughness: 0.15,
		// Ceramic body sheen
		sheen: 0.3,
		sheenRoughness: 0.4,
		sheenColor: new Color('#E8DCC8'),
		// Environment reflections
		envMapIntensity: 1.2,
		// Glaze refraction
		ior: 1.52,
		// Translucent glaze
		transmission: glazeTransmission,
		thickness: 0.5,
		attenuationColor: new Color('#D4C4A8'),
		attenuationDistance: 0.5
	});
	
	const mesh = new Mesh(geometry, material);
	scene.add(mesh);

	const zip = new JSZip();
	
	// Downsample canvas for final output
	const finalCanvas = document.createElement('canvas');
	finalCanvas.width = baseSize;
	finalCanvas.height = baseSize;
	const ctx = finalCanvas.getContext('2d')!;

	// Front view
	camera.position.set(0, 0.5, 3);
	camera.lookAt(0, 0.5, 0);
	renderer.render(scene, camera);
	ctx.drawImage(canvas, 0, 0, baseSize, baseSize); // Downsample
	const frontBlob = await canvasToBlob(finalCanvas);
	zip.file('front.png', frontBlob);

	// Top view
	camera.position.set(0, 4, 0.01);
	camera.lookAt(0, 0.5, 0);
	renderer.render(scene, camera);
	ctx.drawImage(canvas, 0, 0, baseSize, baseSize);
	const topBlob = await canvasToBlob(finalCanvas);
	zip.file('top.png', topBlob);

	// Side view
	camera.position.set(3, 0.5, 0);
	camera.lookAt(0, 0.5, 0);
	renderer.render(scene, camera);
	ctx.drawImage(canvas, 0, 0, baseSize, baseSize);
	const sideBlob = await canvasToBlob(finalCanvas);
	zip.file('side.png', sideBlob);

	// Isometric view (hero shot)
	camera.position.set(2.5, 2, 2.5);
	camera.lookAt(0, 0.5, 0);
	renderer.render(scene, camera);
	ctx.drawImage(canvas, 0, 0, baseSize, baseSize);
	const isoBlob = await canvasToBlob(finalCanvas);
	zip.file('isometric.png', isoBlob);

	// Cleanup
	geometry.dispose();
	material.dispose();
	renderer.dispose();

	const zipBlob = await zip.generateAsync({ type: 'blob' });
	return zipBlob;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) {
				resolve(blob);
			} else {
				reject(new Error('Failed to convert canvas to blob'));
			}
		}, 'image/png');
	});
}
