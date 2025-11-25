/**
 * Metrics Store for tracking application performance and errors
 * Used to measure the impact of fixes and identify issues
 */

export interface Metrics {
	errors: {
		stateUnsafeMutation: number;
		geometryComputation: number;
		compositorResolutionMismatch: number;
	};
	performance: {
		geometryComputationTimes: number[];
		reactiveUpdateCounts: {
			currentGeometry: number;
			liveGeometry: number;
		};
	};
}

export const metricsStore = $state<Metrics>({
	errors: {
		stateUnsafeMutation: 0,
		geometryComputation: 0,
		compositorResolutionMismatch: 0
	},
	performance: {
		geometryComputationTimes: [],
		reactiveUpdateCounts: {
			currentGeometry: 0,
			liveGeometry: 0
		}
	}
});

export function trackError(errorType: keyof Metrics['errors']): void {
	metricsStore.errors[errorType]++;
	console.warn(
		`📊 [METRICS] Error tracked: ${errorType} (total: ${metricsStore.errors[errorType]})`
	);
}

export function trackGeometryComputationTime(duration: number): void {
	metricsStore.performance.geometryComputationTimes.push(duration);
	// Keep only last 100 measurements
	if (metricsStore.performance.geometryComputationTimes.length > 100) {
		metricsStore.performance.geometryComputationTimes.shift();
	}

	const avg =
		metricsStore.performance.geometryComputationTimes.reduce((a, b) => a + b, 0) /
		metricsStore.performance.geometryComputationTimes.length;
	console.log(
		`📊 [METRICS] Geometry computation: ${duration.toFixed(2)}ms (avg: ${avg.toFixed(2)}ms)`
	);
}

export function trackReactiveUpdate(type: 'currentGeometry' | 'liveGeometry'): void {
	metricsStore.performance.reactiveUpdateCounts[type]++;
	console.log(
		`📊 [METRICS] Reactive update: ${type} (total: ${metricsStore.performance.reactiveUpdateCounts[type]})`
	);
}

export function getMetricsSummary(): string {
	const { errors, performance } = metricsStore;
	const avgTime =
		performance.geometryComputationTimes.length > 0
			? performance.geometryComputationTimes.reduce((a, b) => a + b, 0) /
				performance.geometryComputationTimes.length
			: 0;

	return `
📊 Metrics Summary:
  Errors:
    - State Unsafe Mutation: ${errors.stateUnsafeMutation}
    - Geometry Computation: ${errors.geometryComputation}
    - Compositor Resolution Mismatch: ${errors.compositorResolutionMismatch}
  Performance:
    - Avg Geometry Computation: ${avgTime.toFixed(2)}ms
    - Reactive Updates (currentGeometry): ${performance.reactiveUpdateCounts.currentGeometry}
    - Reactive Updates (liveGeometry): ${performance.reactiveUpdateCounts.liveGeometry}
	`.trim();
}

export function resetMetrics(): void {
	metricsStore.errors = {
		stateUnsafeMutation: 0,
		geometryComputation: 0,
		compositorResolutionMismatch: 0
	};
	metricsStore.performance = {
		geometryComputationTimes: [],
		reactiveUpdateCounts: {
			currentGeometry: 0,
			liveGeometry: 0
		}
	};
	console.log('📊 [METRICS] Metrics reset');
}
