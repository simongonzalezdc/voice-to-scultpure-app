import {
	WebGLRenderer,
	PerspectiveCamera,
	Scene,
	DirectionalLight,
	AmbientLight,
	LatheGeometry,
	MeshPhysicalMaterial,
	Mesh,
	Vector2
} from 'three';
import JSZip from 'jszip';
import type { SculptureDefinition } from '$lib/types';
import { uiStore } from '$lib/stores/uiStore.svelte';

export async function renderHighRes(
	sculpture: SculptureDefinition,
	quality: 'low' | 'high' = 'high'
): Promise<Blob> {
	const size = quality === 'high' ? 4096 : 2048;
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;

	const renderer = new WebGLRenderer({ canvas, antialias: true });
	renderer.setSize(size, size);

	const camera = new PerspectiveCamera(50, 1, 0.1, 1000);
	const scene = new Scene();

	// Lights
	const directionalLight = new DirectionalLight(0xffffff, 1);
	directionalLight.position.set(5, 10, 5);
	scene.add(directionalLight);

	const ambientLight = new AmbientLight(0xffffff, 0.3);
	scene.add(ambientLight);

	// Create geometry
	const radiusCurve = sculpture.radiusCurve || [];
	const points = radiusCurve.map((p) => new Vector2(p.x, p.y));
	const geometry = new LatheGeometry(points, 32);
	const material = new MeshPhysicalMaterial({
		transmission: (uiStore.activeGlaze.roughness ?? 0.5) * 0.8,
		thickness: 0.5,
		roughness: uiStore.activeGlaze.roughness ?? 0.5,
		clearcoat: 0.8,
		clearcoatRoughness: 0.2,
		color: 0xffffff
	});
	const mesh = new Mesh(geometry, material);
	scene.add(mesh);

	const zip = new JSZip();

	// Front view
	camera.position.set(0, 2, 5);
	camera.lookAt(0, 0, 0);
	renderer.render(scene, camera);
	const frontBlob = await canvasToBlob(canvas);
	zip.file('front.png', frontBlob);

	// Top view
	camera.position.set(0, 5, 0);
	camera.lookAt(0, 0, 0);
	renderer.render(scene, camera);
	const topBlob = await canvasToBlob(canvas);
	zip.file('top.png', topBlob);

	// Side view
	camera.position.set(5, 2, 0);
	camera.lookAt(0, 0, 0);
	renderer.render(scene, camera);
	const sideBlob = await canvasToBlob(canvas);
	zip.file('side.png', sideBlob);

	// Isometric view
	camera.position.set(4, 4, 4);
	camera.lookAt(0, 0, 0);
	renderer.render(scene, camera);
	const isoBlob = await canvasToBlob(canvas);
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
