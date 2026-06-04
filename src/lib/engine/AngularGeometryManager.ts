/**
 * Angular Geometry Manager
 *
 * Builds a 3D surface for "spiral" / angular recording mode, where the sculpture
 * radius varies per (height, angle) instead of being radially symmetric like a
 * lathe. The angular radius field is produced by `generateAngularSculpture()`
 * (pitch → angle, spectral flatness → angular spread, energy → radius); this
 * manager wraps that field in a reusable BufferGeometry, mirroring the buffer
 * conventions of DynamicGeometryManager.
 *
 * ARCHITECTURE:
 * - Maintains a single BufferGeometry with pre-allocated position/normal/uv buffers.
 * - The surface is a closed grid of (radialSegments + 1) angular columns by
 *   `heightResolution` rows; the extra column duplicates the first to seal the seam.
 * - Vertices are regenerated in-place from the angular radius field each update.
 */

import { BufferGeometry, BufferAttribute, DynamicDrawUsage, StaticDrawUsage } from 'three';
import type { AnalysisFrame } from '$lib/types';
import { GEOMETRY_LATHE_SEGMENTS } from '$lib/config/constants';
import { generateAngularSculpture } from './physicsMapping';

export interface AngularGeometryConfig {
	/** Number of angular segments around the circumference (default: GEOMETRY_LATHE_SEGMENTS) */
	radialSegments?: number;
	/** Number of vertical (height) rows in the angular grid (default: 256) */
	profileResolution?: number;
	/** Whether this geometry will be updated frequently (default: true) */
	dynamic?: boolean;
}

/**
 * Manages a single BufferGeometry for angular/spiral sculpture rendering.
 */
export class AngularGeometryManager {
	private geometry: BufferGeometry;
	private positionBuffer: Float32Array;
	private normalBuffer: Float32Array;
	private uvBuffer: Float32Array;
	private colorBuffer: Float32Array | null = null;

	private radialSegments: number;
	private heightResolution: number;
	private isDynamic: boolean;
	private isDisposed = false;

	private spiralIntensity = 1.0;
	private spreadIntensity = 1.0;
	private lastHash = '';

	constructor(config: AngularGeometryConfig = {}) {
		this.radialSegments = config.radialSegments ?? GEOMETRY_LATHE_SEGMENTS;
		this.heightResolution = Math.max(2, config.profileResolution ?? 256);
		this.isDynamic = config.dynamic ?? true;

		const vertexCount = this.calculateVertexCount();
		this.positionBuffer = new Float32Array(vertexCount * 3);
		this.normalBuffer = new Float32Array(vertexCount * 3);
		this.uvBuffer = new Float32Array(vertexCount * 2);

		this.geometry = new BufferGeometry();
		this.initializeAttributes();
		this.generateIndices();
	}

	/**
	 * Total vertex count: (radialSegments + 1) angular columns × heightResolution rows.
	 * The +1 column duplicates the first to close the seam.
	 */
	private calculateVertexCount(): number {
		return (this.radialSegments + 1) * this.heightResolution;
	}

	private initializeAttributes(): void {
		const usage = this.isDynamic ? DynamicDrawUsage : StaticDrawUsage;

		const positionAttr = new BufferAttribute(this.positionBuffer, 3);
		positionAttr.setUsage(usage);
		this.geometry.setAttribute('position', positionAttr);

		const normalAttr = new BufferAttribute(this.normalBuffer, 3);
		normalAttr.setUsage(usage);
		this.geometry.setAttribute('normal', normalAttr);

		const uvAttr = new BufferAttribute(this.uvBuffer, 2);
		uvAttr.setUsage(usage);
		this.geometry.setAttribute('uv', uvAttr);
	}

	/**
	 * Change the angular segment count. Reallocates buffers, so call sparingly.
	 * @returns true if the count changed.
	 */
	setRadialSegments(segments: number): boolean {
		if (segments === this.radialSegments || segments < 3) return false;
		this.radialSegments = segments;

		const vertexCount = this.calculateVertexCount();
		this.positionBuffer = new Float32Array(vertexCount * 3);
		this.normalBuffer = new Float32Array(vertexCount * 3);
		this.uvBuffer = new Float32Array(vertexCount * 2);

		this.geometry.dispose();
		this.geometry = new BufferGeometry();
		this.initializeAttributes();
		this.generateIndices();

		this.lastHash = ''; // force regeneration on next update
		return true;
	}

	getRadialSegments(): number {
		return this.radialSegments;
	}

	/** Set the spiral intensity (0 = cylinder, 1 = full spiral). */
	setSpiralIntensity(value: number): void {
		const clamped = Math.max(0, Math.min(1, value));
		if (clamped !== this.spiralIntensity) {
			this.spiralIntensity = clamped;
			this.lastHash = '';
		}
	}

	/** Set the angular spread intensity (0 = uniform, 1 = organic). */
	setSpreadIntensity(value: number): void {
		const clamped = Math.max(0, Math.min(1, value));
		if (clamped !== this.spreadIntensity) {
			this.spreadIntensity = clamped;
			this.lastHash = '';
		}
	}

	/**
	 * Regenerate the surface from captured audio frames.
	 * @returns true if the geometry was updated, false if skipped (no change).
	 */
	updateFromFrames(frames: AnalysisFrame[]): boolean {
		if (this.isDisposed) return false;
		if (!frames || frames.length === 0) return false;

		const hash = this.hashFrames(frames);
		if (hash === this.lastHash) return false;
		this.lastHash = hash;

		const result = generateAngularSculpture(frames, undefined, {
			spiralIntensity: this.spiralIntensity,
			spreadIntensity: this.spreadIntensity,
			heightResolution: this.heightResolution,
			angleResolution: this.radialSegments
		});

		this.generateVertices(result.angularRadii, result.angleResolution);

		const posAttr = this.geometry.getAttribute('position') as BufferAttribute;
		const uvAttr = this.geometry.getAttribute('uv') as BufferAttribute;
		posAttr.needsUpdate = true;
		uvAttr.needsUpdate = true;

		// Smooth normals across the closed surface (positions are fully populated).
		this.geometry.computeVertexNormals();
		(this.geometry.getAttribute('normal') as BufferAttribute).needsUpdate = true;

		this.geometry.computeBoundingSphere();
		this.geometry.computeBoundingBox();

		return true;
	}

	/**
	 * Write grid vertices from the angular radius field.
	 * radius(column, row) = angularRadii[row * angleResolution + (column % angleResolution)]
	 * height y is normalized to [0, 1] to match the lathe profile convention.
	 */
	private generateVertices(angularRadii: Float32Array, angleResolution: number): void {
		const columns = this.radialSegments + 1;
		const rows = this.heightResolution;
		let v = 0;

		for (let i = 0; i < columns; i++) {
			const phi = (i / this.radialSegments) * Math.PI * 2;
			const cosPhi = Math.cos(phi);
			const sinPhi = Math.sin(phi);
			const angleIdx = i % angleResolution;

			for (let j = 0; j < rows; j++) {
				const radius = angularRadii[j * angleResolution + angleIdx] ?? 0.3;
				const y = rows > 1 ? j / (rows - 1) : 0;

				this.positionBuffer[v * 3] = radius * cosPhi;
				this.positionBuffer[v * 3 + 1] = y;
				this.positionBuffer[v * 3 + 2] = radius * sinPhi;

				this.uvBuffer[v * 2] = i / this.radialSegments;
				this.uvBuffer[v * 2 + 1] = y;

				v++;
			}
		}
	}

	/**
	 * Update vertex colors. Accepts RGB triples; resamples if the length does not
	 * match the vertex count exactly.
	 */
	updateColors(colors: Float32Array): void {
		if (this.isDisposed) return;

		const vertexCount = this.calculateVertexCount();
		const expectedLength = vertexCount * 3;

		if (!this.colorBuffer || this.colorBuffer.length !== expectedLength) {
			this.colorBuffer = new Float32Array(expectedLength);
		}

		if (colors.length === expectedLength) {
			this.colorBuffer.set(colors);
		} else {
			const sourceCount = colors.length / 3;
			for (let i = 0; i < vertexCount; i++) {
				const t = vertexCount > 1 ? i / (vertexCount - 1) : 0;
				const sourceIndex = Math.max(
					0,
					Math.min(sourceCount - 1, Math.floor(t * (sourceCount - 1)))
				);
				this.colorBuffer[i * 3] = colors[sourceIndex * 3] ?? 1;
				this.colorBuffer[i * 3 + 1] = colors[sourceIndex * 3 + 1] ?? 1;
				this.colorBuffer[i * 3 + 2] = colors[sourceIndex * 3 + 2] ?? 1;
			}
		}

		let colorAttr = this.geometry.getAttribute('color') as BufferAttribute | undefined;
		if (!colorAttr) {
			colorAttr = new BufferAttribute(this.colorBuffer, 3);
			colorAttr.setUsage(this.isDynamic ? DynamicDrawUsage : StaticDrawUsage);
			this.geometry.setAttribute('color', colorAttr);
		} else {
			colorAttr.needsUpdate = true;
		}
	}

	/** Remove vertex colors. */
	clearColors(): void {
		if (this.geometry.hasAttribute('color')) {
			this.geometry.deleteAttribute('color');
		}
		this.colorBuffer = null;
	}

	/**
	 * Generate the triangle index buffer for the angular grid.
	 * Vertex layout is column-major: index = column * heightResolution + row.
	 */
	generateIndices(): void {
		if (this.geometry.index) return;

		const columns = this.radialSegments; // quads bridge column i → i+1 (last reaches the seam column)
		const rows = this.heightResolution;
		const indices: number[] = [];

		for (let i = 0; i < columns; i++) {
			for (let j = 0; j < rows - 1; j++) {
				const a = i * rows + j;
				const b = (i + 1) * rows + j;
				const c = (i + 1) * rows + j + 1;
				const d = i * rows + j + 1;
				indices.push(a, b, d);
				indices.push(b, c, d);
			}
		}

		this.geometry.setIndex(indices);
	}

	getGeometry(): BufferGeometry {
		return this.geometry;
	}

	getVertexCount(): number {
		return this.calculateVertexCount();
	}

	/** Cheap dirty-check key so repeated identical updates can be skipped. */
	private hashFrames(frames: AnalysisFrame[]): string {
		const last = frames[frames.length - 1];
		return `${frames.length}:${this.spiralIntensity}:${this.spreadIntensity}:${(last?.time ?? 0).toFixed(3)}`;
	}

	/** Dispose of all GPU resources. */
	dispose(): void {
		if (this.isDisposed) return;
		this.geometry.dispose();
		this.isDisposed = true;
	}
}

/**
 * Create an AngularGeometryManager with sensible defaults for real-time spiral recording.
 */
export function createAngularGeometry(config?: AngularGeometryConfig): AngularGeometryManager {
	return new AngularGeometryManager({
		radialSegments: GEOMETRY_LATHE_SEGMENTS,
		profileResolution: 256,
		dynamic: true,
		...config
	});
}
