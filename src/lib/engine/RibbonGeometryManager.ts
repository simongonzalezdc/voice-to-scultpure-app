/**
 * Ribbon Geometry Manager
 *
 * Creates ribbon/waveform sculptures from voice data.
 * Unlike LatheGeometry (rotational symmetry), ribbons flow through 3D space.
 *
 * MAPPING:
 * - Pitch → X-axis steering (low=left, high=right)
 * - Volume → Ribbon width/thickness
 * - Timbre → Z-depth modulation
 * - Time → Length progression
 *
 * PERFORMANCE STRATEGY:
 * - Sample at 10-15fps (not 60fps) - voice doesn't change that fast
 * - Pre-allocate max buffer size
 * - Incremental growth (append, don't rebuild)
 * - LOD: simplify older ribbon sections
 */

import {
	BufferGeometry,
	BufferAttribute,
	DynamicDrawUsage,
	StaticDrawUsage,
	Vector3
} from 'three';
import type { AnalysisFrame } from '$lib/types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Max ribbon length for 5-minute song at 10fps = 3000 segments */
const MAX_RIBBON_SEGMENTS = 3000;

/** Vertices per ribbon cross-section (square = 4, rounded = 8-16) */
const CROSS_SECTION_POINTS = 8;

/** How much pitch affects X steering (in world units per Hz) */
const PITCH_TO_X_SCALE = 0.002;

/** How much volume affects ribbon width */
const VOLUME_TO_WIDTH_SCALE = 0.3;

/** Base ribbon width when silent */
const BASE_RIBBON_WIDTH = 0.05;

/** How much timbre affects Z depth */
const TIMBRE_TO_Z_SCALE = 0.001;

/** Segment length along the ribbon (world units) */
const SEGMENT_LENGTH = 0.02;

/** Pitch smoothing factor (0-1, lower = smoother) */
const PITCH_SMOOTHING = 0.15;

// ============================================================================
// TYPES
// ============================================================================

export interface RibbonConfig {
	/** Max segments to allocate (default: 3000 for 5min @ 10fps) */
	maxSegments?: number;
	/** Cross-section detail (default: 8 vertices) */
	crossSectionPoints?: number;
	/** Whether geometry will be updated frequently */
	dynamic?: boolean;
}

export interface RibbonPoint {
	position: Vector3; // Center position
	width: number; // Ribbon width at this point
	depth: number; // Z-depth at this point
	color?: { r: number; g: number; b: number }; // Optional vertex color
}

// ============================================================================
// RIBBON GEOMETRY MANAGER
// ============================================================================

export class RibbonGeometryManager {
	private geometry: BufferGeometry;
	private positionBuffer: Float32Array;
	private normalBuffer: Float32Array;
	private uvBuffer: Float32Array;
	private colorBuffer: Float32Array;
	private indexBuffer: Uint32Array;

	private maxSegments: number;
	private crossSectionPoints: number;
	private isDynamic: boolean;
	private isDisposed: boolean = false;

	// Current ribbon state
	private currentSegmentCount: number = 0;
	private ribbonPoints: RibbonPoint[] = [];

	// Smoothing state
	private smoothedPitch: number = 220; // Default to A4
	private smoothedX: number = 0;
	private lastY: number = 0;

	constructor(config: RibbonConfig = {}) {
		this.maxSegments = config.maxSegments ?? MAX_RIBBON_SEGMENTS;
		this.crossSectionPoints = config.crossSectionPoints ?? CROSS_SECTION_POINTS;
		this.isDynamic = config.dynamic ?? true;

		// Calculate buffer sizes
		// Each segment has crossSectionPoints vertices × 2 rings (start + end)
		// But we share vertices between segments, so: (segments + 1) * crossSectionPoints
		const maxVertices = (this.maxSegments + 1) * this.crossSectionPoints;

		// Pre-allocate buffers
		this.positionBuffer = new Float32Array(maxVertices * 3);
		this.normalBuffer = new Float32Array(maxVertices * 3);
		this.uvBuffer = new Float32Array(maxVertices * 2);
		this.colorBuffer = new Float32Array(maxVertices * 3);

		// Index buffer: each segment creates 2 triangles per face
		// Faces = crossSectionPoints per segment
		// Triangles per face = 2
		// Indices per triangle = 3
		const maxIndices = this.maxSegments * this.crossSectionPoints * 2 * 3;
		this.indexBuffer = new Uint32Array(maxIndices);

		// Create geometry
		this.geometry = new BufferGeometry();
		this.initializeAttributes();

		console.log(
			`〰️ [RIBBON] Created manager: ${this.maxSegments} max segments, ${maxVertices} max vertices`
		);
	}

	/**
	 * Initialize buffer attributes with usage hints
	 */
	private initializeAttributes(): void {
		const usage = this.isDynamic ? DynamicDrawUsage : StaticDrawUsage;

		const posAttr = new BufferAttribute(this.positionBuffer, 3);
		posAttr.setUsage(usage);
		this.geometry.setAttribute('position', posAttr);

		const normAttr = new BufferAttribute(this.normalBuffer, 3);
		normAttr.setUsage(usage);
		this.geometry.setAttribute('normal', normAttr);

		const uvAttr = new BufferAttribute(this.uvBuffer, 2);
		uvAttr.setUsage(usage);
		this.geometry.setAttribute('uv', uvAttr);

		const colorAttr = new BufferAttribute(this.colorBuffer, 3);
		colorAttr.setUsage(usage);
		this.geometry.setAttribute('color', colorAttr);

		// Set initial index buffer (empty)
		this.geometry.setIndex(new BufferAttribute(this.indexBuffer, 1));
	}

	/**
	 * Add a new point to the ribbon from an analysis frame
	 * This is the main real-time entry point
	 */
	addFrame(frame: AnalysisFrame, sentimentColor?: { r: number; g: number; b: number }): boolean {
		if (this.isDisposed || this.currentSegmentCount >= this.maxSegments) {
			return false;
		}

		// Extract audio features
		const pitch = frame.pitch || 220;
		const energy = frame.energy || 0;
		const timbreZ = frame.timbre?.spectralCentroid || 2000;

		// Smooth pitch to prevent jitter
		this.smoothedPitch = this.smoothedPitch + (pitch - this.smoothedPitch) * PITCH_SMOOTHING;

		// Map pitch to X position (low = left, high = right)
		// Range: 80Hz - 800Hz mapped to -1 to +1
		const normalizedPitch = Math.max(0, Math.min(1, (this.smoothedPitch - 80) / 720));
		const targetX = (normalizedPitch - 0.5) * 2 * PITCH_TO_X_SCALE * 500;

		// Smooth X position for flowing curves
		this.smoothedX = this.smoothedX + (targetX - this.smoothedX) * PITCH_SMOOTHING;

		// Map volume to width
		const width = BASE_RIBBON_WIDTH + energy * VOLUME_TO_WIDTH_SCALE;

		// Map timbre to Z depth (spectral centroid: 1000-5000Hz)
		const normalizedTimbre = Math.max(0, Math.min(1, (timbreZ - 1000) / 4000));
		const depth = normalizedTimbre * TIMBRE_TO_Z_SCALE * 100;

		// Progress Y (ribbon length)
		const y = this.lastY + SEGMENT_LENGTH;
		this.lastY = y;

		// Create ribbon point
		const point: RibbonPoint = {
			position: new Vector3(this.smoothedX, y, depth),
			width,
			depth: width, // Use width for depth too (square cross-section)
			color: sentimentColor || this.pitchToColor(this.smoothedPitch, energy)
		};

		this.ribbonPoints.push(point);
		this.currentSegmentCount++;

		// Update geometry
		this.updateGeometry();

		return true;
	}

	/**
	 * Build ribbon from an array of analysis frames (batch mode)
	 * Used when processing a completed recording
	 */
	buildFromFrames(
		frames: AnalysisFrame[],
		sentimentColors?: { r: number; g: number; b: number }[]
	): void {
		// Downsample if too many frames (target 10-15fps equivalent)
		const targetSamples = Math.min(frames.length, this.maxSegments);
		const sampleRate = Math.max(1, Math.floor(frames.length / targetSamples));

		// Reset ribbon state
		this.reset();

		// Process frames
		for (let i = 0; i < frames.length; i += sampleRate) {
			const frame = frames[i];
			if (!frame) continue;
			const color = sentimentColors?.[Math.floor(i / sampleRate)];
			this.addFrame(frame, color);
		}

		console.log(
			`〰️ [RIBBON] Built from ${frames.length} frames → ${this.currentSegmentCount} segments`
		);
	}

	/**
	 * Update geometry buffers from ribbon points
	 */
	private updateGeometry(): void {
		if (this.ribbonPoints.length < 2) return;

		const points = this.ribbonPoints;
		const n = this.crossSectionPoints;

		// Generate vertices for each ribbon point
		for (let i = 0; i < points.length; i++) {
			const point = points[i];
			if (!point) continue;
			const baseIndex = i * n;

			// Generate cross-section vertices (circle around the center)
			for (let j = 0; j < n; j++) {
				const angle = (j / n) * Math.PI * 2;
				const localX = Math.cos(angle) * point.width;
				const localZ = Math.sin(angle) * point.depth;

				const vertexIndex = baseIndex + j;
				const posOffset = vertexIndex * 3;
				const uvOffset = vertexIndex * 2;

				// Position (local cross-section + ribbon center)
				this.positionBuffer[posOffset] = point.position.x + localX;
				this.positionBuffer[posOffset + 1] = point.position.y;
				this.positionBuffer[posOffset + 2] = point.position.z + localZ;

				// Normal (pointing outward from center)
				this.normalBuffer[posOffset] = Math.cos(angle);
				this.normalBuffer[posOffset + 1] = 0;
				this.normalBuffer[posOffset + 2] = Math.sin(angle);

				// UV
				this.uvBuffer[uvOffset] = j / n;
				this.uvBuffer[uvOffset + 1] = i / (points.length - 1);

				// Color
				if (point.color) {
					this.colorBuffer[posOffset] = point.color.r;
					this.colorBuffer[posOffset + 1] = point.color.g;
					this.colorBuffer[posOffset + 2] = point.color.b;
				} else {
					this.colorBuffer[posOffset] = 1;
					this.colorBuffer[posOffset + 1] = 1;
					this.colorBuffer[posOffset + 2] = 1;
				}
			}
		}

		// Generate indices (connect adjacent rings)
		let indexOffset = 0;
		for (let i = 0; i < points.length - 1; i++) {
			const ringA = i * n;
			const ringB = (i + 1) * n;

			for (let j = 0; j < n; j++) {
				const jNext = (j + 1) % n;

				// Two triangles per quad
				// Triangle 1
				this.indexBuffer[indexOffset++] = ringA + j;
				this.indexBuffer[indexOffset++] = ringB + j;
				this.indexBuffer[indexOffset++] = ringA + jNext;

				// Triangle 2
				this.indexBuffer[indexOffset++] = ringA + jNext;
				this.indexBuffer[indexOffset++] = ringB + j;
				this.indexBuffer[indexOffset++] = ringB + jNext;
			}
		}

		// Update geometry draw range
		const vertexCount = points.length * n;
		const indexCount = (points.length - 1) * n * 6;

		this.geometry.setDrawRange(0, indexCount);

		// Mark buffers as needing update
		const posAttr = this.geometry.getAttribute('position') as BufferAttribute;
		const normAttr = this.geometry.getAttribute('normal') as BufferAttribute;
		const uvAttr = this.geometry.getAttribute('uv') as BufferAttribute;
		const colorAttr = this.geometry.getAttribute('color') as BufferAttribute;
		const indexAttr = this.geometry.getIndex();

		posAttr.needsUpdate = true;
		normAttr.needsUpdate = true;
		uvAttr.needsUpdate = true;
		colorAttr.needsUpdate = true;
		if (indexAttr) indexAttr.needsUpdate = true;

		// Update bounding volumes
		this.geometry.computeBoundingSphere();
		this.geometry.computeBoundingBox();
	}

	/**
	 * Convert pitch to HSL color (for voice-driven coloring)
	 */
	private pitchToColor(
		pitch: number,
		energy: number
	): { r: number; g: number; b: number } {
		// Map pitch to hue (80Hz = red, 800Hz = purple)
		const t = Math.max(0, Math.min(1, (pitch - 80) / 720));
		const hue = t * 280 / 360; // 0° to 280°

		// Energy affects saturation and lightness
		const saturation = 0.5 + energy * 0.5;
		const lightness = 0.3 + energy * 0.4;

		// HSL to RGB conversion
		return this.hslToRgb(hue, saturation, lightness);
	}

	/**
	 * HSL to RGB conversion
	 */
	private hslToRgb(
		h: number,
		s: number,
		l: number
	): { r: number; g: number; b: number } {
		let r: number, g: number, b: number;

		if (s === 0) {
			r = g = b = l;
		} else {
			const hue2rgb = (p: number, q: number, t: number): number => {
				if (t < 0) t += 1;
				if (t > 1) t -= 1;
				if (t < 1 / 6) return p + (q - p) * 6 * t;
				if (t < 1 / 2) return q;
				if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
				return p;
			};

			const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			const p = 2 * l - q;
			r = hue2rgb(p, q, h + 1 / 3);
			g = hue2rgb(p, q, h);
			b = hue2rgb(p, q, h - 1 / 3);
		}

		return { r, g, b };
	}

	/**
	 * Reset ribbon to empty state
	 */
	reset(): void {
		this.ribbonPoints = [];
		this.currentSegmentCount = 0;
		this.smoothedPitch = 220;
		this.smoothedX = 0;
		this.lastY = 0;

		// Reset draw range to show nothing
		this.geometry.setDrawRange(0, 0);
	}

	/**
	 * Get the managed geometry
	 */
	getGeometry(): BufferGeometry {
		return this.geometry;
	}

	/**
	 * Get current segment count
	 */
	getSegmentCount(): number {
		return this.currentSegmentCount;
	}

	/**
	 * Get ribbon points for export/analysis
	 */
	getRibbonPoints(): RibbonPoint[] {
		return [...this.ribbonPoints];
	}

	/**
	 * Dispose of resources
	 */
	dispose(): void {
		if (this.isDisposed) return;
		this.geometry.dispose();
		this.isDisposed = true;
		console.log('🗑️ [RIBBON] Disposed geometry manager');
	}
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a RibbonGeometryManager with sensible defaults for Song Mode
 */
export function createRibbonGeometry(config?: RibbonConfig): RibbonGeometryManager {
	return new RibbonGeometryManager({
		maxSegments: MAX_RIBBON_SEGMENTS,
		crossSectionPoints: CROSS_SECTION_POINTS,
		dynamic: true,
		...config
	});
}

/**
 * Estimate ribbon geometry stats for a given duration
 */
export function estimateRibbonStats(durationSeconds: number, sampleRate: number = 10): {
	segments: number;
	vertices: number;
	triangles: number;
	memoryKB: number;
} {
	const segments = Math.ceil(durationSeconds * sampleRate);
	const vertices = (segments + 1) * CROSS_SECTION_POINTS;
	const triangles = segments * CROSS_SECTION_POINTS * 2;

	// Memory: position(3) + normal(3) + uv(2) + color(3) = 11 floats per vertex
	// + indices (segments * CROSS_SECTION_POINTS * 6)
	const floatsPerVertex = 11;
	const indicesCount = segments * CROSS_SECTION_POINTS * 6;
	const memoryBytes = vertices * floatsPerVertex * 4 + indicesCount * 4;
	const memoryKB = memoryBytes / 1024;

	return { segments, vertices, triangles, memoryKB };
}

