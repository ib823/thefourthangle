/**
 * Issue array built from per-file JSON in src/data/issues/.
 * Uses Vite's import.meta.glob so the JSON is resolved at build time —
 * works in Astro SSG, Vitest, and any Vite-bundled context.
 *
 * Browser code (Svelte components, client libs) should import types/helpers
 * from ./issue-types instead, to keep the full array out of client bundles.
 */
import type { Issue } from './issue-types';

const modules = import.meta.glob<Issue>('./issues/*.json', {
  eager: true,
  import: 'default',
});

export const ISSUES: Issue[] = Object.keys(modules)
  .sort()
  .map((key) => modules[key]);
