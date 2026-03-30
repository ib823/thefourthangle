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

// --- Thread detection: BFS on related[] fields ---
function detectThreads(allIssues) {
  const issueMap = new Map();
  for (const i of allIssues) issueMap.set(i.id, i);

  const visited = new Set();
  const issueThreads = {}; // issueId → { threadId, threadName, position, total, nextId }

  let threadCounter = 0;
  for (const issue of allIssues) {
    if (visited.has(issue.id)) continue;
    if (!issue.related || issue.related.length === 0) continue;

    // BFS to find connected component
    const component = [];
    const queue = [issue.id];
    while (queue.length > 0) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      component.push(id);
      const iss = issueMap.get(id);
      if (iss?.related) {
        for (const relId of iss.related) {
          if (!visited.has(relId) && issueMap.has(relId)) queue.push(relId);
        }
      }
    }

    if (component.length >= 2) {
      threadCounter++;
      // Sort by sourceDate ascending (oldest first = reading order)
      const sorted = component.sort((a, b) => {
        const da = issueMap.get(a)?.sourceDate || '9999';
        const db = issueMap.get(b)?.sourceDate || '9999';
        return da.localeCompare(db);
      });

      // Derive thread name from first issue's headline (first 40 chars)
      const firstName = issueMap.get(sorted[0])?.headline || 'Connected Issues';
      const threadName = firstName.length > 40 ? firstName.slice(0, 37) + '...' : firstName;
      const threadId = `thread-${threadCounter}`;

      for (let i = 0; i < sorted.length; i++) {
        issueThreads[sorted[i]] = {
          threadId,
          threadName,
          position: i,
          total: sorted.length,
          nextId: i < sorted.length - 1 ? sorted[i + 1] : null,
        };
      }
    }
  }
  return issueThreads;
}

const issueThreads = detectThreads(issues);
const threadCount = new Set(Object.values(issueThreads).map(t => t.threadId)).size;
if (threadCount > 0) console.log(`  Threads: ${threadCount} detected`);

// --- Feed summaries: strip card big/sub text ---
const bgDir = join(root, 'public', 'og', 'backgrounds');
const feedSummaries = publishedIssues.map(issue => {
  const thread = issueThreads[issue.id] || null;
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
    threadId: thread?.threadId || null,
    threadName: thread?.threadName || null,
    threadPosition: thread?.position ?? null,
    threadTotal: thread?.total ?? null,
    threadNextId: thread?.nextId || null,
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
