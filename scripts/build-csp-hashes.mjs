/**
 * Compute SHA-256 hashes for all inline <script> blocks in built HTML.
 * Updates both public/_headers (source) and dist/_headers (deployed).
 * Must run AFTER stealth.mjs (which modifies inline scripts).
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');

function findHtmlFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findHtmlFiles(full));
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

const hashes = new Set();
for (const file of findHtmlFiles(distDir)) {
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(/<script>(.+?)<\/script>/gs)) {
    hashes.add(`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
  }
}

if (hashes.size === 0) {
  console.log('  ✓ No inline scripts — CSP needs no script hashes');
  process.exit(0);
}

const hashDirective = [...hashes].join(' ');
console.log(`  ✓ ${hashes.size} inline script hash(es)`);

function updateHeaders(path) {
  if (!existsSync(path)) return;
  let content = readFileSync(path, 'utf8');
  content = content.replace(
    /script-src\s+'self'[^;]*/,
    `script-src 'self' ${hashDirective}`
  );
  writeFileSync(path, content);
}

// Update both source and dist copies
updateHeaders(join(root, 'public', '_headers'));
updateHeaders(join(distDir, '_headers'));
console.log('  ✓ Updated _headers (public + dist)');
