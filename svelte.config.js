import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		alias: {
			$lib: 'src/lib',
			'@threlte/core': 'src/lib/shims/threlte-core.ts',
			'@threlte/core-original': 'node_modules/@threlte/core'
		}
	}
};

export default config;

