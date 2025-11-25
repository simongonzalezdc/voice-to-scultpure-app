module.exports = {
	root: true,
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
		'plugin:svelte/recommended',
		'prettier'
	],
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint'],
	parserOptions: {
		sourceType: 'module',
		ecmaVersion: 2022,
		extraFileExtensions: ['.svelte']
	},
	env: {
		browser: true,
		es2017: true,
		node: true
	},
	ignorePatterns: [
		'.svelte-kit/**',
		'node_modules/**',
		'build/**',
		'test-results/**',
		'playwright-report/**',
		'*.config.js',
		'*.config.ts'
	],
	overrides: [
		{
			files: ['*.svelte'],
			parser: 'svelte-eslint-parser',
			parserOptions: {
				parser: '@typescript-eslint/parser'
			},
			rules: {
				// Forbid old Svelte syntax
				'no-restricted-syntax': [
					'error',
					{
						selector:
							'ExportNamedDeclaration[declaration.type="VariableDeclaration"] > VariableDeclaration > VariableDeclarator[id.name]',
						message: 'Use Svelte 5 runes: let { prop } = $props() instead of export let prop'
					}
				],
				'svelte/valid-compile': [
					'error',
					{
						ignoreWarnings: false
					}
				]
			}
		}
	],
	rules: {
		'@typescript-eslint/no-explicit-any': 'warn',
		'@typescript-eslint/no-unused-vars': [
			'error',
			{
				argsIgnorePattern: '^_',
				varsIgnorePattern: '^_'
			}
		]
	}
};
