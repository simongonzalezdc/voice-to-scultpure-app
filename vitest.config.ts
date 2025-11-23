import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [svelte({ hot: !process.env.VITEST })],
	test: {
		globals: true,
		environment: 'jsdom',
		exclude: [
			'node_modules',
			'dist',
			'.idea',
			'.git',
			'.cache',
			'tests/**',  // Exclude Playwright E2E tests
			'**/*.spec.ts' // Only run .test.ts files, not .spec.ts
		]
	}
});
