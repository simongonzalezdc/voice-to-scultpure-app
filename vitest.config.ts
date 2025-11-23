import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [svelte({ hot: !process.env.VITEST })],
	resolve: {
		alias: {
			$lib: path.resolve('./src/lib'),
			'@threlte/core': path.resolve('./src/lib/shims/threlte-core.ts'),
			'@threlte/core-original': path.resolve('./node_modules/@threlte/core')
		}
	},
	test: {
		globals: true,
		environment: 'jsdom',
		exclude: [
			'node_modules',
			'dist',
			'.idea',
			'.git',
			'.cache',
			'tests/**', // Exclude Playwright E2E tests
			'**/*.spec.ts' // Only run .test.ts files, not .spec.ts
		]
	}
});
