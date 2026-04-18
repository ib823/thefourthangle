/**
 * Maintains the source-art manifest and removes obsolete derived variants.
 * Public runtime now uses a single canonical issue image: /og/issue-{ID}.png
 *
 * Source:  issue-{ID}-bg.{jpg,png}          — original art (uploaded)
 * Output:  manifest.json                    — list of IDs with source art
 */
import { readdirSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadIssues } from './lib/load-issues.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dir = join(root, 'public', 'og', 'backgrounds');

mkdirSync(dir, { recursive: true });

const issues = loadIssues();

const publishedIds = new Set(issues.filter(issue => issue.published === true).map(issue => issue.id));
const files = readdirSync(dir).filter(file => /^issue-\d+-bg\.(jpg|jpeg|png)$/i.test(file));
const ids = files
  .map(file => file.match(/^issue-(\d+)-bg/i)?.[1])
  .filter(id => id && publishedIds.has(id));

console.log(`Reconciling source art for ${ids.length} published issues...`);
for (const file of readdirSync(dir)) {
  if (/^issue-\d+-(thumb|card|hero)\.(avif|jpg)$/i.test(file)) {
    unlinkSync(join(dir, file));
  }
}

writeFileSync(join(dir, 'manifest.json'), JSON.stringify(ids));
console.log(`  ✓ removed obsolete per-surface variants`);
console.log(`  ✓ manifest.json (${ids.length} IDs)`);
