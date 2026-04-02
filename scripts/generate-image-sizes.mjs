/**
 * Maintains the source-art manifest and removes obsolete derived variants.
 * Public runtime now uses a single canonical issue image: /og/issue-{ID}.png
 *
 * Source:  issue-{ID}-bg.{jpg,png}          — original art (uploaded)
 * Output:  manifest.json                    — list of IDs with source art
 */
import { readdirSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dir = join(root, 'public', 'og', 'backgrounds');

mkdirSync(dir, { recursive: true });

const tsContent = readFileSync(join(root, 'src', 'data', 'issues.ts'), 'utf8');
const issuesMatch = tsContent.match(/export const ISSUES:\s*Issue\[\]\s*=\s*(\[[\s\S]*\]);?\s*$/m);
if (!issuesMatch) { console.error('Could not find ISSUES'); process.exit(1); }

let issues;
try {
  let arr = issuesMatch[1].replace(/;\s*$/, '');
  issues = eval('(' + arr + ')');
} catch (e) { console.error('Parse error:', e.message); process.exit(1); }

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
