import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

const securityHeaders = {
	'Cross-Origin-Embedder-Policy': 'require-corp',
	'Cross-Origin-Opener-Policy': 'same-origin'
};

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
		headers: securityHeaders
	},
	preview: {
		headers: securityHeaders
	},
	worker: {
		format: 'es'
	},
	optimizeDeps: {
		exclude: ['@threlte/core', 'three']
	}
});
