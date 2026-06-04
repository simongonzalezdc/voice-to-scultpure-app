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
	Color,
	PMREMGenerator,
	type Texture
} from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import JSZip from 'jszip';
import type { SculptureDefinition } from '$lib/types';
import { uiStore } from '$lib/stores/uiStore.svelte';
import { computeProfile } from '$lib/engine/compositor';
import { DEFAULT_MATERIAL_CERAMIC } from '$lib/types';
import {
	EXPORT_SEGMENTS_HIGH,
	EXPORT_SUPER_SAMPLE_FACTOR,
	EXPORT_TONE_MAPPING_EXPOSURE
} from '$lib/config/constants';
import { createCeramicMaterialProps } from '$lib/engine/materialFactory';

const ENVIRONMENT_MAPS = {
	studio: '/environments/studio_small_03_1k.hdr',
	neon: '/environments/royal_esplanade_1k.hdr',
	darkroom: '/environments/studio_small_03_1k.hdr'
} as const;

export async function renderHighRes(
	sculpture: SculptureDefinition,
	quality: 'low' | 'high' = 'high'
): Promise<Blob> {
	const baseSize = quality === 'high' ? 4096 : 2048;
	const renderSize = baseSize * EXPORT_SUPER_SAMPLE_FACTOR; // Super-sample at 2x

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
	renderer.toneMappingExposure = EXPORT_TONE_MAPPING_EXPOSURE;
	renderer.outputColorSpace = SRGBColorSpace;

	const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
	const scene = new Scene();
	scene.background = new Color(0xf5f5f5); // Light gray background

	// AUDIT FIX: Professional 3-point lighting (matches MainScene)
	const hemisphereLight = new HemisphereLight(0xfdfbf7, 0x4a4a6a, 0.4);
	scene.add(hemisphereLight);

	const keyLight = new DirectionalLight(0xffffff, 1.2);
	keyLight.position.set(5, 8, 4);
	scene.add(keyLight);

	const fillLight = new DirectionalLight(0xe8e4e0, 0.4);
	fillLight.position.set(-3, 4, -2);
	scene.add(fillLight);

	const rimLight = new DirectionalLight(0xd4e5f7, 0.25);
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
	const geometry = new LatheGeometry(
		points,
		quality === 'high' ? EXPORT_SEGMENTS_HIGH : Math.max(64, Math.floor(EXPORT_SEGMENTS_HIGH / 2))
	);

	// AUDIT FIX: Ceramic material with full PBR properties (matches Sculpture.svelte)
	const glazeRoughness = uiStore.activeGlaze.roughness ?? 0.35;
	const glazeTransmission = uiStore.activeGlaze.transmission ?? 0;
	const ceramicProps = createCeramicMaterialProps(
		uiStore.activeGlaze.color || DEFAULT_MATERIAL_CERAMIC,
		glazeRoughness,
		glazeTransmission
	);

	const material = new MeshPhysicalMaterial({
		...ceramicProps,
		color: new Color(ceramicProps.color),
		sheenColor: new Color(ceramicProps.sheenColor ?? '#ffffff'),
		attenuationColor: new Color(ceramicProps.attenuationColor ?? '#ffffff')
	});

	// Add environment reflections with PMREM
	const envPath = ENVIRONMENT_MAPS[uiStore.view.environment] ?? ENVIRONMENT_MAPS.studio;
	let envMap: Texture | null = null;

	try {
		envMap = await loadEnvironmentMap(renderer, envPath);
		material.envMap = envMap;
		material.needsUpdate = true;

		const mesh = new Mesh(geometry, material);
		scene.add(mesh);

		const zip = new JSZip();

		// Downsample canvas for final output
		const finalCanvas = document.createElement('canvas');
		finalCanvas.width = baseSize;
		finalCanvas.height = baseSize;
		const ctx = finalCanvas.getContext('2d')!;
		const downsample = () => {
			ctx.clearRect(0, 0, baseSize, baseSize);
			ctx.drawImage(canvas, 0, 0, baseSize, baseSize);
		};

		// Front view
		camera.position.set(0, 0.5, 3);
		camera.lookAt(0, 0.5, 0);
		renderer.render(scene, camera);
		downsample();
		const frontBlob = await canvasToBlob(finalCanvas);
		zip.file('front.png', frontBlob);

		// Top view
		camera.position.set(0, 4, 0.01);
		camera.lookAt(0, 0.5, 0);
		renderer.render(scene, camera);
		downsample();
		const topBlob = await canvasToBlob(finalCanvas);
		zip.file('top.png', topBlob);

		// Side view
		camera.position.set(3, 0.5, 0);
		camera.lookAt(0, 0.5, 0);
		renderer.render(scene, camera);
		downsample();
		const sideBlob = await canvasToBlob(finalCanvas);
		zip.file('side.png', sideBlob);

		// Isometric view (hero shot)
		camera.position.set(2.5, 2, 2.5);
		camera.lookAt(0, 0.5, 0);
		renderer.render(scene, camera);
		downsample();
		const isoBlob = await canvasToBlob(finalCanvas);
		zip.file('isometric.png', isoBlob);

		const zipBlob = await zip.generateAsync({ type: 'blob' });
		return zipBlob;
	} finally {
		// Ensure GPU resources are always released, even if env load fails
		geometry.dispose();
		material.dispose();
		envMap?.dispose();
		renderer.dispose();
	}
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

async function loadEnvironmentMap(renderer: WebGLRenderer, url: string): Promise<Texture> {
	const pmremGenerator = new PMREMGenerator(renderer);
	pmremGenerator.compileEquirectangularShader();

	return new Promise((resolve, reject) => {
		const loader = new RGBELoader();
		loader.load(
			url,
			(texture) => {
				const envMap = pmremGenerator.fromEquirectangular(texture).texture;
				texture.dispose();
				pmremGenerator.dispose();
				resolve(envMap);
			},
			undefined,
			(error) => {
				pmremGenerator.dispose();
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		);
	});
}
