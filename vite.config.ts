import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			$lib: path.resolve('./src/lib'),
			'@threlte/core': path.resolve('./src/lib/shims/threlte-core.ts'),
			'@threlte/core-original': path.resolve('./node_modules/@threlte/core')
		}
	},
	server: {
		headers: {
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Cross-Origin-Embedder-Policy': 'require-corp'
		}
	},
	optimizeDeps: {
		exclude: ['@threlte/core', 'three']
	}
});
