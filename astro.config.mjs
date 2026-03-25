import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
export default defineConfig({
  site: 'https://thefourthangle.pages.dev',
  output: 'static',
  integrations: [
    svelte(),
  ],
  build: {
    format: 'file',
    inlineStylesheets: 'auto',
    assets: '_a',
  },
  vite: {
    plugins: [],
    build: {
      sourcemap: false,
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          chunkFileNames: '_a/[hash].js',
          entryFileNames: '_a/[hash].js',
          assetFileNames: '_a/[hash][extname]',
        },
      },
    },
    css: {
      modules: {
        generateScopedName: '[hash:base64:6]',
      },
    },
  },
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
    },
  },
});
