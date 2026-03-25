import { vitePreprocess } from '@astrojs/svelte';

export default {
	preprocess: vitePreprocess(),
	compilerOptions: {
		cssHash: ({ hash, css }) => `_${hash(css)}`
	}
}
