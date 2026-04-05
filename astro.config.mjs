import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

let commitSha = 'unknown';
try {
  commitSha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();
} catch {}

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
    define: {
      __BUILD_DATE__: JSON.stringify(new Date().toISOString().split('T')[0]),
      __BUILD_ID__: JSON.stringify(randomBytes(4).toString('hex')),
      __COMMIT_SHA__: JSON.stringify(commitSha),
    },
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
