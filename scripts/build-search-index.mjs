/**
 * Builds a MiniSearch index at build time.
 * Output: public/search-index.json (loaded lazily by the client)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import MiniSearch from 'minisearch';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Extract ISSUES from TypeScript
const tsContent = readFileSync(join(root, 'src', 'data', 'issues.ts'), 'utf8');
const issuesMatch = tsContent.match(/export const ISSUES:\s*Issue\[\]\s*=\s*(\[[\s\S]*\]);?\s*$/m);
if (!issuesMatch) { console.error('Could not find ISSUES'); process.exit(1); }

let issues;
try {
  let arr = issuesMatch[1].replace(/;\s*$/, '');
  issues = eval('(' + arr + ')');
} catch (e) { console.error('Parse error:', e.message); process.exit(1); }

// Filter to published issues only
const publishedIssues = issues.filter(i => i.published === true);
console.log(`  Issues: ${issues.length} total, ${publishedIssues.length} published (searchable)`);

// Build searchable documents
const docs = publishedIssues.map(issue => {
  const cardBigs = issue.cards.map(c => c.big).join(' ');
  const cardSubs = issue.cards.map(c => c.sub || '').join(' ');
  const lenses = issue.cards.filter(c => c.lens).map(c => c.lens).join(' ');

  return {
    id: issue.id,
    headline: issue.headline,
    context: issue.context,
    cardBigs,
    lenses,
  };
});

// Create index
const miniSearch = new MiniSearch({
  fields: ['headline', 'context', 'cardBigs', 'lenses'],
  storeFields: ['id'],
  searchOptions: {
    boost: { headline: 3, context: 2, cardBigs: 1, lenses: 1 },
    fuzzy: 0.2,
    prefix: true,
  },
});

miniSearch.addAll(docs);

// Export as JSON
const indexJson = JSON.stringify(miniSearch.toJSON());
writeFileSync(join(root, 'public', 'search-index.json'), indexJson);

const sizeKB = (Buffer.byteLength(indexJson) / 1024).toFixed(1);
console.log(`Search index: ${issues.length} issues indexed, ${sizeKB}KB`);
