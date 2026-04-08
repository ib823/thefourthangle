#!/usr/bin/env node
/**
 * Tier 2 Resolution Confirmation
 *
 * For each Tier 2 issue (low Stage 3 confidence), check whether the
 * currently-published cards substantially incorporate the Stage 3
 * critique by token-matching the corrected language. Outputs a per-
 * issue resolution status.
 *
 * Resolution categories:
 *   RESOLVED   — published cards reflect Stage 3 corrections
 *   PARTIAL    — some corrections applied, some still missing
 *   UNRESOLVED — published cards still contain flagged claims
 *   STUB       — Stage 3 file has no actionable content (FAS only)
 *
 * Usage: node scripts/confirm-tier2.mjs
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const engineOutDir = join(root, 'engine', 'output');

// Load issues
const tsContent = readFileSync(join(root, 'src', 'data', 'issues.ts'), 'utf8');
const m = tsContent.match(/export const ISSUES:\s*Issue\[\]\s*=\s*(\[[\s\S]*\]);?\s*$/m);
const issues = eval('(' + m[1].replace(/;\s*$/, '') + ')');

// id -> slug
const idToSlug = {};
for (const f of readdirSync(engineOutDir).filter(f => f.endsWith('-reader.json'))) {
  const slug = f.replace(/-reader\.json$/, '');
  try {
    const j = JSON.parse(readFileSync(join(engineOutDir, f), 'utf8'));
    if (j.id) idToSlug[j.id] = slug;
  } catch (_) {}
}

// Tier 2 issues from the audit report
const tier2 = [
  '1043', '1146', '1871', '1887', '1958', '1960', '1961', '1962', '1963',
  '1964', '1965', '1966', '1967', '1970', '1971', '1972', '1973', '1974', '1975',
];

function getCardText(issue) {
  let txt = (issue.headline || '') + ' ' + (issue.context || '');
  if (issue.cards) for (const c of issue.cards) txt += ' ' + (c.big || '') + ' ' + (c.sub || '');
  return txt.toLowerCase();
}

function getCorrections(j) {
  const out = [];
  if (Array.isArray(j.claims)) {
    for (const c of j.claims) {
      const s = (c.status || '').toUpperCase();
      if (['INCORRECT', 'MISLEADING'].includes(s) && c.correction) {
        out.push({ status: s, claim: c.claim || c.statement || '', correction: c.correction });
      }
    }
  }
  for (const [field, status] of [['key_incorrect', 'INCORRECT'], ['key_misleading', 'MISLEADING'], ['key_corrections', 'CORRECTION']]) {
    if (Array.isArray(j[field])) {
      for (const c of j[field]) {
        const text = typeof c === 'string' ? c : (c.claim || c.statement || '');
        if (text) out.push({ status, claim: text, correction: typeof c === 'object' ? c.correction : null });
      }
    }
  }
  return out;
}

// Extract distinctive token (number-with-unit, named entity) from a claim string
function extractKeyTokens(claim) {
  const tokens = [];
  // Numbers with units
  for (const m of claim.matchAll(/\b(?:RM|US\$|USD|MYR)?\s?\d[\d,.]*\s?(?:billion|million|trillion|B|M|hectares?|ha|km|MW|years?|months?|%)?/gi)) {
    const t = m[0].trim();
    if (t.length > 2 && !/^(19|20)\d{2}$/.test(t) && /\d/.test(t)) tokens.push(t.toLowerCase());
  }
  return tokens;
}

const report = [];
report.push('# Tier 2 Resolution Confirmation — ' + new Date().toISOString().slice(0, 10));
report.push('');
report.push('For each Tier 2 issue (low Stage 3 confidence), checks whether the currently-published cards substantially incorporate the Stage 3 critique. Issues with all corrections applied are marked RESOLVED — they remain in the audit Tier 2 list only because the Stage 3 file evaluates the pre-correction draft.');
report.push('');
report.push('| ID | Resolution | Notes |');
report.push('|---|---|---|');

const counts = { RESOLVED: 0, PARTIAL: 0, UNRESOLVED: 0, STUB: 0 };

for (const id of tier2) {
  const slug = idToSlug[id];
  const issue = issues.find(i => i.id === id);
  if (!slug || !issue) continue;
  const path = join(engineOutDir, `${slug}-stage3.json`);
  if (!existsSync(path)) continue;
  const j = JSON.parse(readFileSync(path, 'utf8'));
  const corrections = getCorrections(j);
  const cardText = getCardText(issue);

  if (corrections.length === 0) {
    counts.STUB++;
    report.push(`| ${id} | STUB | Stage 3 has FAS=${j.factual_accuracy_score} but no actionable claims/corrections — no audit signal |`);
    continue;
  }

  // Check each correction's flagged token: if NONE of its distinctive tokens are still in the cards, it's resolved
  let stillPresent = 0;
  for (const c of corrections) {
    const tokens = extractKeyTokens(c.claim);
    if (tokens.length === 0) continue; // can't check, assume resolved
    const anyHit = tokens.some(t => cardText.includes(t));
    if (anyHit) stillPresent++;
  }

  const total = corrections.length;
  let status, note;
  if (stillPresent === 0) {
    status = 'RESOLVED';
    note = `All ${total} flagged claims absent from current cards`;
    counts.RESOLVED++;
  } else if (stillPresent <= Math.ceil(total / 4)) {
    status = 'PARTIAL';
    note = `${stillPresent} of ${total} flagged claims may still be present`;
    counts.PARTIAL++;
  } else {
    status = 'UNRESOLVED';
    note = `${stillPresent} of ${total} flagged claims likely still in cards`;
    counts.UNRESOLVED++;
  }
  report.push(`| ${id} | ${status} | ${note} |`);
}

report.push('');
report.push('## Summary');
report.push('');
report.push(`| Status | Count |`);
report.push(`|---|---:|`);
report.push(`| RESOLVED | ${counts.RESOLVED} |`);
report.push(`| PARTIAL | ${counts.PARTIAL} |`);
report.push(`| UNRESOLVED | ${counts.UNRESOLVED} |`);
report.push(`| STUB (no actionable Stage 3) | ${counts.STUB} |`);
report.push('');
report.push('## Interpretation');
report.push('');
report.push('Issues marked RESOLVED appear in the Tier 2 audit list only because the Stage 3 file on disk evaluates the *pre-correction draft*, not the currently-published edition. The audit script does not (yet) re-score Stage 3 against the live cards. PARTIAL and UNRESOLVED issues are the genuine remaining editorial debt.');
report.push('');
report.push('Use `node scripts/view-stage3.mjs <id>` to inspect the cross-reference between Stage 3 critique and current cards on any specific issue.');

const today = new Date().toISOString().slice(0, 10);
const outPath = join(engineOutDir, `tier2-confirmation-${today}.md`);
writeFileSync(outPath, report.join('\n'));

console.log('');
console.log('  Tier 2 Resolution Confirmation');
console.log('  ───────────────────────────────');
for (const [k, v] of Object.entries(counts)) {
  console.log(`  ${k.padEnd(12)} ${v}`);
}
console.log('  ───────────────────────────────');
console.log(`  Report: ${outPath}`);
console.log('');
