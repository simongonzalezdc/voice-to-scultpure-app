import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				// Base surfaces
				'bg-body': '#111015',
				'bg-elevated': '#19161D',
				'bg-panel': '#211F26',
				'bg-panel-alt': '#2B262F',
				'border-subtle': '#3A343F',
				'border-strong': '#4A424F',
				// Text
				'text-primary': '#F9FAFB',
				'text-secondary': '#C4C0C8',
				'text-muted': '#8B8491',
				'text-inverse': '#111015',
				// Brand
				'brand-primary': '#8F3E48',
				'brand-primary-hover': '#AE5D37',
				'brand-primary-soft': '#5B2B33',
				'brand-secondary': '#B5933C',
				'brand-secondary-soft': '#7F6530',
				// Jewel tones
				'jewel-amethyst': '#6B5D88',
				'jewel-sapphire': '#344676',
				'jewel-emerald': '#5A7850',
				'jewel-topaz': '#B5933C',
				'jewel-garnet': '#8F3E48',
				'jewel-fireopal': '#AE5D37',
				'jewel-turquoise': '#346C68',
				// Semantic
				success: '#5A7850',
				warning: '#B5933C',
				danger: '#8F3E48',
				info: '#346C68'
			}
		}
	},
	plugins: []
} satisfies Config;

