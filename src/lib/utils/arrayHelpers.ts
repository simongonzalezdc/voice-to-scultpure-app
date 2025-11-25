/**
 * Safe Array Access Utilities
 * Prevents undefined access errors with bounds checking
 */

/**
 * Safely access an array element with bounds checking
 * @param arr - Array to access
 * @param index - Index to access
 * @param fallback - Optional fallback value if index is out of bounds
 * @returns Array element or fallback/undefined
 */
export function safeArrayAccess<T>(arr: T[], index: number, fallback?: T): T | undefined {
	if (index >= 0 && index < arr.length) {
		return arr[index];
	}
	return fallback;
}

/**
 * Get a window of elements around an index
 * @param arr - Array to access
 * @param index - Center index
 * @param windowSize - Number of elements to return (default: 3)
 * @returns Array of elements or null if window is out of bounds
 */
export function getWindow<T>(arr: T[], index: number, windowSize: number = 3): T[] | null {
	const halfWindow = Math.floor(windowSize / 2);
	const start = index - halfWindow;
	const end = start + windowSize;

	if (start < 0 || end > arr.length) {
		return null;
	}

	return arr.slice(start, end);
}

/**
 * Safely access multiple array elements
 * @param arr - Array to access
 * @param indices - Array of indices to access
 * @returns Array of elements (undefined for out-of-bounds indices)
 */
export function safeMultiAccess<T>(arr: T[], indices: number[]): (T | undefined)[] {
	return indices.map((idx) => safeArrayAccess(arr, idx));
}

/**
 * Check if an index is valid for an array
 * @param arr - Array to check
 * @param index - Index to validate
 * @returns True if index is valid
 */
export function isValidIndex<T>(arr: T[], index: number): boolean {
	return index >= 0 && index < arr.length;
}
