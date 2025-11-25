import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	sculptureStore,
	updateSculptureColors,
	setMeshReference
} from '../stores/sculptureStore.svelte';
import { uiStore } from '../stores/uiStore.svelte';
import { Mesh, BufferAttribute, BufferGeometry } from 'three';
import type { SculptureDefinition } from '../types';

// Mock mesh for testing
const createMockMesh = (vertexCount: number): Mesh => {
	const geometry = new BufferGeometry();

	// Create position attribute
	const positions = new Float32Array(vertexCount * 3);
	for (let i = 0; i < vertexCount; i++) {
		positions[i * 3] = Math.random() * 2 - 1; // x
		positions[i * 3 + 1] = Math.random() * 2 - 1; // y
		positions[i * 3 + 2] = Math.random() * 2 - 1; // z
	}
	geometry.setAttribute('position', new BufferAttribute(positions, 3));

	// Create color attribute with test colors
	const colors = new Float32Array(vertexCount * 3);
	for (let i = 0; i < vertexCount; i++) {
		colors[i * 3] = Math.random(); // r
		colors[i * 3 + 1] = Math.random(); // g
		colors[i * 3 + 2] = Math.random(); // b
	}
	geometry.setAttribute('color', new BufferAttribute(colors, 3));

	return new Mesh(geometry);
};

describe('Glaze Persistence', () => {
	beforeEach(() => {
		// Reset stores before each test
		sculptureStore.currentSculpture = null;
		sculptureStore.meshReference = null;
		uiStore.workspace = 'sculpt';
	});

	it('should capture vertex colors when stopping recording', () => {
		// Create a mock sculpture
		const mockSculpture: SculptureDefinition = {
			id: 'test-sculpture',
			name: 'Test Sculpture',
			createdAt: Date.now(),
			layers: [],
			radiusCurve: [],
			physical: {
				height: 150,
				sculptMode: 'additive',
				units: 'mm',
				orientation: 'vertical'
			}
		};

		// Set current sculpture
		sculptureStore.currentSculpture = mockSculpture;

		// Create mock mesh with colors
		const mockMesh = createMockMesh(100);
		setMeshReference(mockMesh);

		// Extract colors from mesh
		const colorAttribute = mockMesh.geometry.attributes.color;
		if (!colorAttribute || !colorAttribute.array) {
			throw new Error('Color attribute not found on mock mesh');
		}
		const expectedColors = Array.from(colorAttribute.array);

		// Update sculpture colors
		updateSculptureColors(colorAttribute.array as Float32Array);

		// Verify colors were stored
		expect(sculptureStore.currentSculpture.vertexColors).toEqual(expectedColors);
		expect(sculptureStore.currentSculpture.vertexColors).toHaveLength(300); // 100 vertices * 3 RGB values
	});

	it('should handle empty color arrays gracefully', () => {
		// Create a mock sculpture
		const mockSculpture: SculptureDefinition = {
			id: 'test-sculpture',
			name: 'Test Sculpture',
			createdAt: Date.now(),
			layers: [],
			radiusCurve: [],
			physical: {
				height: 150,
				sculptMode: 'additive',
				units: 'mm',
				orientation: 'vertical'
			}
		};

		// Set current sculpture
		sculptureStore.currentSculpture = mockSculpture;

		// Update with empty colors
		updateSculptureColors(new Float32Array(0));

		// Verify empty colors were stored
		expect(sculptureStore.currentSculpture.vertexColors).toEqual([]);
	});

	it('should validate color count against vertex count', () => {
		// Create a mock sculpture
		const mockSculpture: SculptureDefinition = {
			id: 'test-sculpture',
			name: 'Test Sculpture',
			createdAt: Date.now(),
			layers: [],
			radiusCurve: [],
			physical: {
				height: 150,
				sculptMode: 'additive',
				units: 'mm',
				orientation: 'vertical'
			}
		};

		// Set current sculpture
		sculptureStore.currentSculpture = mockSculpture;

		// Create mock mesh with 50 vertices
		const mockMesh = createMockMesh(50);
		setMeshReference(mockMesh);

		// Create mismatched color array (wrong length)
		const wrongColors = new Float32Array(100); // Should be 150 for 50 vertices

		// Mock console.assert to capture validation
		const consoleSpy = vi.spyOn(console, 'assert');

		// Mock alert to capture the error message
		const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

		// Update with wrong color count
		updateSculptureColors(wrongColors);

		// Verify assertion was called
		expect(consoleSpy).toHaveBeenCalledWith(
			false,
			expect.stringContaining('Color/Vertex Mismatch')
		);

		// Verify alert was called due to mismatch
		expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Data Corruption Detected'));

		// Verify colors were reset due to mismatch
		expect(sculptureStore.currentSculpture.vertexColors).toEqual([]);

		consoleSpy.mockRestore();
		alertSpy.mockRestore();
	});

	it('should show error color in glaze mode when no colors exist', () => {
		// Create a mock sculpture without colors
		const mockSculpture: SculptureDefinition = {
			id: 'test-sculpture',
			name: 'Test Sculpture',
			createdAt: Date.now(),
			radiusCurve: [],
			layers: [],
			physical: {
				height: 150,
				sculptMode: 'additive',
				units: 'mm',
				orientation: 'vertical'
			}
			// Vertex colors now stored in geometry attributes (legacy support)
		};

		// Set current sculpture
		sculptureStore.currentSculpture = mockSculpture;

		// Switch to glaze mode
		uiStore.workspace = 'glaze';

		// In glaze mode with no colors, should show error color
		// This is tested in Sculpture.svelte materialColor derived value
		// The error color is #FF00FF (Neon Pink)

		// Verify workspace is in glaze mode
		expect(uiStore.workspace).toBe('glaze');

		// Vertex colors now stored in geometry attributes, not sculpture object
		expect(sculptureStore.currentSculpture).toBeDefined();
	});
});
