/**
 * Generates JSON data files from issues.ts at build time:
 * - public/issues-feed.json  — feed summaries (no card text)
 * - public/issues/[id].json  — full issue per file
 */
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadIssues } from './lib/load-issues.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const issues = loadIssues();

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

const issuesDir = join(root, 'public', 'issues');
rmSync(issuesDir, { recursive: true, force: true });
mkdirSync(issuesDir, { recursive: true });

// --- Per-issue full payloads (published only) ---
for (const issue of publishedIssues) {
  writeFileSync(
    join(issuesDir, `${issue.id}.json`),
    JSON.stringify(issue),
    'utf8'
  );
}
console.log(`  ✓ issues/*.json (${publishedIssues.length} files)`);
