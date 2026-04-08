#!/usr/bin/env node
/**
 * Triage helper for unauditable published issues.
 *
 * Cross-references the 69 unauditable issues (published but with zero engine
 * artifacts) against the fallback rotation pool to distinguish:
 *
 *   FALLBACK  — intentionally pre-selected fallback content (in FALLBACK_WEEKS)
 *   ORPHAN    — published but in neither fallback nor pipeline (accidentally
 *               published or manually edited in)
 *   LEGACY    — likely predates the current pipeline (very low ID, no sourceDate,
 *               or sourceDate before first pipeline commit)
 *
 * Outputs a prioritized action list with per-issue recommendation.
 *
 * Usage: node scripts/triage-unauditable.mjs
 */

import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const engineOutDir = join(root, 'engine', 'output');
const engineBriefDir = join(root, 'engine', 'briefs');

// ── Load issues ──
const tsContent = readFileSync(join(root, 'src', 'data', 'issues.ts'), 'utf8');
const issuesMatch = tsContent.match(/export const ISSUES:\s*Issue\[\]\s*=\s*(\[[\s\S]*\]);?\s*$/m);
const issues = eval('(' + issuesMatch[1].replace(/;\s*$/, '') + ')');
const published = issues.filter(i => i.published);

// ── Load fallback rotation ──
const fallbackContent = readFileSync(join(root, 'src', 'data', 'fallback-rotation.ts'), 'utf8');
const fallbackMatch = fallbackContent.match(/FALLBACK_WEEKS:\s*string\[\]\[\]\s*=\s*(\[[\s\S]*?\]);/);
let fallbackWeeks = [];
if (fallbackMatch) {
  try {
    fallbackWeeks = eval(fallbackMatch[1]);
  } catch (e) {
    console.error('Failed to parse FALLBACK_WEEKS:', e.message);
  }
}
const fallbackIds = new Set(fallbackWeeks.flat());

// ── Slug ↔ id map (for artifact detection) ──
const slugToId = {}, idToSlug = {};
if (existsSync(engineOutDir)) {
  for (const f of readdirSync(engineOutDir).filter(f => f.endsWith('-reader.json'))) {
    const slug = f.replace(/-reader\.json$/, '');
    try {
      const obj = JSON.parse(readFileSync(join(engineOutDir, f), 'utf8'));
      if (obj.id) { slugToId[slug] = obj.id; idToSlug[obj.id] = slug; }
    } catch (_) {}
  }
}

// ── Identify the 69 unauditable issues (replicates audit Phase 2 logic) ──
function hasAnyArtifact(issue) {
  const slug = idToSlug[issue.id];
  if (!slug) return false;
  const candidates = [
    join(engineBriefDir, `${slug}.md`),
    join(engineOutDir, `${slug}-stage1.json`),
    join(engineOutDir, `${slug}-stage2.json`),
    join(engineOutDir, `${slug}-stage3.json`),
    join(engineOutDir, `${slug}-stage4.json`),
    join(engineOutDir, `${slug}-stage5.json`),
    join(engineOutDir, `${slug}-stage6-synthesis.json`),
    join(engineOutDir, `${slug}-reader.json`),
  ];
  return candidates.some(p => existsSync(p));
}
const unauditable = published.filter(i => !hasAnyArtifact(i));

// ── Categorize each unauditable issue ──
// FALLBACK: in fallback rotation
// ORPHAN:   not in fallback AND looks like manual injection (not in any known batch)
// LEGACY:   likely older content (by ID or sourceDate)
function categorize(issue) {
  const id = issue.id;
  const idNum = parseInt(id, 10);

  if (fallbackIds.has(id)) return 'FALLBACK';

  // Any engine brief on disk with a matching slug? (detect legacy briefs without full pipeline)
  // Briefs are named by slug, not ID — we can't directly match without a manifest.
  // But we can flag by ID band: IDs 0100-0999 are almost certainly pre-pipeline legacy.
  if (idNum < 1000) return 'LEGACY';

  // No sourceDate on newer-ID published issues is suspicious
  if (!issue.sourceDate) return 'ORPHAN';

  // Has sourceDate but no artifacts — unusual
  return 'ORPHAN';
}

const categorized = { FALLBACK: [], LEGACY: [], ORPHAN: [] };
for (const issue of unauditable) {
  const cat = categorize(issue);
  categorized[cat].push(issue);
}

// ── Action recommendations per category ──
function recommendationFor(cat) {
  switch (cat) {
    case 'FALLBACK':
      return 'KEEP. Intentional fallback content. If time permits, backfill a research brief to raise confidence; otherwise add disclaimer.';
    case 'LEGACY':
      return 'REVIEW. Very old pre-pipeline content. Options: (a) keep with legacy disclaimer, (b) unpublish, (c) rebuild through current pipeline. Review content against Accuracy Standard.';
    case 'ORPHAN':
      return 'INVESTIGATE. Published but in neither fallback rotation nor pipeline. Likely manually injected — needs verification. Options: (a) backfill artifacts, (b) unpublish pending review.';
  }
}

// ── Build report ──
const today = new Date().toISOString().slice(0, 10);
const lines = [];
lines.push(`# Unauditable Published Issue Triage — ${today}`);
lines.push('');
lines.push(`Classifies the ${unauditable.length} published issues with zero engine artifacts into FALLBACK / LEGACY / ORPHAN categories, with per-category action recommendations.`);
lines.push('');

lines.push(`## Summary`);
lines.push('');
lines.push(`| Category | Count | Action |`);
lines.push(`|---|---:|---|`);
lines.push(`| FALLBACK  | ${categorized.FALLBACK.length} | Keep — intentional content |`);
lines.push(`| LEGACY    | ${categorized.LEGACY.length} | Review — pre-pipeline content |`);
lines.push(`| ORPHAN    | ${categorized.ORPHAN.length} | Investigate — unexpected state |`);
lines.push(`| **Total** | **${unauditable.length}** | |`);
lines.push('');

lines.push(`## FALLBACK (${categorized.FALLBACK.length})`);
lines.push('');
lines.push(`> ${recommendationFor('FALLBACK')}`);
lines.push('');
if (categorized.FALLBACK.length === 0) {
  lines.push(`*None.*`);
} else {
  const weekMap = {};
  for (let w = 0; w < fallbackWeeks.length; w++) {
    for (const id of fallbackWeeks[w]) weekMap[id] = w + 1;
  }
  lines.push(`| ID | Week | Headline |`);
  lines.push(`|---|---:|---|`);
  const sorted = [...categorized.FALLBACK].sort((a, b) => (weekMap[a.id] || 99) - (weekMap[b.id] || 99) || a.id.localeCompare(b.id));
  for (const i of sorted) {
    lines.push(`| ${i.id} | W${weekMap[i.id] || '?'} | ${i.headline} |`);
  }
}
lines.push('');

lines.push(`## LEGACY (${categorized.LEGACY.length})`);
lines.push('');
lines.push(`> ${recommendationFor('LEGACY')}`);
lines.push('');
if (categorized.LEGACY.length === 0) {
  lines.push(`*None.*`);
} else {
  lines.push(`| ID | sourceDate | Headline |`);
  lines.push(`|---|---|---|`);
  const sorted = [...categorized.LEGACY].sort((a, b) => a.id.localeCompare(b.id));
  for (const i of sorted) {
    lines.push(`| ${i.id} | ${i.sourceDate || '—'} | ${i.headline} |`);
  }
}
lines.push('');

lines.push(`## ORPHAN (${categorized.ORPHAN.length})`);
lines.push('');
lines.push(`> ${recommendationFor('ORPHAN')}`);
lines.push('');
if (categorized.ORPHAN.length === 0) {
  lines.push(`*None.*`);
} else {
  lines.push(`| ID | sourceDate | Headline |`);
  lines.push(`|---|---|---|`);
  const sorted = [...categorized.ORPHAN].sort((a, b) => a.id.localeCompare(b.id));
  for (const i of sorted) {
    lines.push(`| ${i.id} | ${i.sourceDate || '—'} | ${i.headline} |`);
  }
}
lines.push('');

// ── Prioritized action list ──
lines.push(`## Recommended Action Order`);
lines.push('');
lines.push(`1. **ORPHAN first** (${categorized.ORPHAN.length} issues) — these are the most anomalous. Each needs individual investigation: was the issue manually injected, accidentally published, or did it lose its engine artifacts? Decide per issue: backfill or unpublish.`);
lines.push(`2. **LEGACY content review** (${categorized.LEGACY.length} issues) — bulk editorial review against the Accuracy Standard. Can be batched: open each, read cards, mark for keep / disclaim / unpublish. Do not auto-act.`);
lines.push(`3. **FALLBACK content** (${categorized.FALLBACK.length} issues) — lowest priority because these are intentionally chosen. Optional: backfill research briefs over time to raise audit confidence. Until then, they are acceptable legacy content.`);
lines.push('');
lines.push(`**Do NOT auto-unpublish any category.** Every issue needs human review before unpublishing.`);
lines.push('');
lines.push(`---`);
lines.push(`*Generated by \`scripts/triage-unauditable.mjs\` on ${today}.*`);

// ── Write report ──
mkdirSync(engineOutDir, { recursive: true });
const reportPath = join(engineOutDir, `triage-unauditable-${today}.md`);
writeFileSync(reportPath, lines.join('\n'));

// ── Console summary ──
console.log('');
console.log(`  Unauditable Issue Triage — ${today}`);
console.log(`  ─────────────────────────────────────────────`);
console.log(`  Total unauditable:     ${unauditable.length}`);
console.log(`    FALLBACK:            ${categorized.FALLBACK.length}  (intentional)`);
console.log(`    LEGACY:              ${categorized.LEGACY.length}  (pre-pipeline, review)`);
console.log(`    ORPHAN:              ${categorized.ORPHAN.length}  (investigate)`);
console.log(`  ─────────────────────────────────────────────`);
console.log(`  Fallback rotation pool: ${fallbackIds.size} total slots`);
console.log(`    Used by this triage:  ${categorized.FALLBACK.length}`);
console.log(`    Not currently pub'd:  ${fallbackIds.size - categorized.FALLBACK.length}`);
console.log(`  ─────────────────────────────────────────────`);
console.log('');
console.log(`  Full report: ${reportPath}`);
console.log('');
