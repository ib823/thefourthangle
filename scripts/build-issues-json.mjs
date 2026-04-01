/**
 * Generates JSON data files from issues.ts at build time:
 * - public/issues-feed.json  — feed summaries (no card text)
 * - public/issues/[id].json  — full issue per file
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Extract ISSUES from TypeScript (same pattern as other build scripts)
const tsContent = readFileSync(join(root, 'src', 'data', 'issues.ts'), 'utf8');
const issuesMatch = tsContent.match(/export const ISSUES:\s*Issue\[\]\s*=\s*(\[[\s\S]*\]);?\s*$/m);
if (!issuesMatch) { console.error('Could not find ISSUES'); process.exit(1); }

let issues;
try {
  let arr = issuesMatch[1].replace(/;\s*$/, '');
  issues = eval('(' + arr + ')');
} catch (e) { console.error('Parse error:', e.message); process.exit(1); }

// --- Filter to published issues only for the feed ---
const publishedIssues = issues.filter(i => i.published === true);
console.log(`Issues: ${issues.length} total, ${publishedIssues.length} published`);

// --- Feed summaries: strip card big/sub text ---
const bgDir = join(root, 'public', 'og', 'backgrounds');
const feedSummaries = publishedIssues.map(issue => {
  return {
    id: issue.id,
    opinionShift: issue.opinionShift,
    status: issue.status,
    edition: issue.edition,
    headline: issue.headline,
    context: issue.context,
    stageScores: issue.stageScores,
    finalScore: issue.finalScore,
    hasImage: existsSync(join(bgDir, `issue-${issue.id}-bg.jpg`)) || existsSync(join(bgDir, `issue-${issue.id}-bg.png`)),
    sourceDate: issue.sourceDate || null,
    // Keep card structure for category derivation and card count, but strip body text
    cards: issue.cards.map(c => ({ t: c.t, lens: c.lens })),
  };
});

writeFileSync(
  join(root, 'public', 'issues-feed.json'),
  JSON.stringify(feedSummaries),
  'utf8'
);
console.log(`  ✓ issues-feed.json (${feedSummaries.length} issues, ${Math.round(JSON.stringify(feedSummaries).length / 1024)}KB)`);

// --- Per-issue full payloads ---
const issuesDir = join(root, 'public', 'issues');
mkdirSync(issuesDir, { recursive: true });

for (const issue of issues) {
  writeFileSync(
    join(issuesDir, `${issue.id}.json`),
    JSON.stringify(issue),
    'utf8'
  );
}
console.log(`  ✓ issues/*.json (${issues.length} files)`);
