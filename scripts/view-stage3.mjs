#!/usr/bin/env node
/**
 * Stage 3 viewer — pretty-prints INCORRECT / MISLEADING / UNVERIFIED claims
 * and key corrections for any audited issue. Handles all 8 schemas found in
 * the engine/output/ Stage 3 corpus.
 *
 * Usage:
 *   node scripts/view-stage3.mjs <issue-id>        # look up by issue id
 *   node scripts/view-stage3.mjs <slug>             # look up by slug
 *   node scripts/view-stage3.mjs --list             # list all stage3 files with FAS
 *
 * Cross-references src/data/issues.ts so you see the currently-published
 * card content alongside the Stage 3 critique.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadIssues } from './lib/load-issues.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const engineOutDir = join(root, 'engine', 'output');

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node scripts/view-stage3.mjs <issue-id|slug|--list>');
  process.exit(1);
}

// ── Build slug ↔ id mapping from reader.json files ──
const slugToId = {}, idToSlug = {};
const readerFiles = readdirSync(engineOutDir).filter(f => f.endsWith('-reader.json'));
for (const f of readerFiles) {
  const slug = f.replace(/-reader\.json$/, '');
  try {
    const obj = JSON.parse(readFileSync(join(engineOutDir, f), 'utf8'));
    if (obj.id) { slugToId[slug] = obj.id; idToSlug[obj.id] = slug; }
  } catch (_) {}
}

// ── List mode ──
if (arg === '--list') {
  const stage3Files = readdirSync(engineOutDir).filter(f => f.endsWith('-stage3.json'));
  console.log('');
  console.log(`  Stage 3 outputs on disk (${stage3Files.length})`);
  console.log('  ─────────────────────────────────────────────');
  const rows = [];
  for (const f of stage3Files) {
    const slug = f.replace(/-stage3\.json$/, '');
    try {
      const j = JSON.parse(readFileSync(join(engineOutDir, f), 'utf8'));
      const fas = typeof j.factual_accuracy_score === 'number' ? j.factual_accuracy_score : null;
      const id = slugToId[slug] || '—';
      rows.push({ id, slug, fas });
    } catch (e) {
      rows.push({ id: '?', slug, fas: 'ERR' });
    }
  }
  rows.sort((a, b) => (a.fas ?? 999) - (b.fas ?? 999));
  for (const r of rows) {
    const pad = String(r.fas ?? '—').padStart(3);
    console.log(`  FAS ${pad}  ${String(r.id).padEnd(6)}  ${r.slug}`);
  }
  console.log('');
  process.exit(0);
}

// ── Resolve to slug ──
let slug = arg;
if (/^\d+$/.test(arg)) {
  // Padded to 4 digits
  const id = arg.padStart(4, '0');
  if (idToSlug[id]) slug = idToSlug[id];
  else {
    console.error(`No reader.json found for issue ${id}. Try: node scripts/view-stage3.mjs --list`);
    process.exit(1);
  }
}

const stage3Path = join(engineOutDir, `${slug}-stage3.json`);
if (!existsSync(stage3Path)) {
  console.error(`Stage 3 file not found: ${stage3Path}`);
  console.error(`Try: node scripts/view-stage3.mjs --list`);
  process.exit(1);
}

const id = slugToId[slug] || '—';
const stage3 = JSON.parse(readFileSync(stage3Path, 'utf8'));

// ── Load currently-published issue cards (for cross-reference) ──
let currentIssue = null;
try {
  const issues = loadIssues();
  currentIssue = issues.find(i => i.id === id);
} catch (_) {}

// ── Pretty-print header ──
console.log('');
console.log(`  Stage 3 Fact Verification — Issue ${id}`);
console.log(`  Slug: ${slug}`);
console.log('  ═══════════════════════════════════════════════════════════════');

if (currentIssue) {
  console.log(`  Currently published: ${currentIssue.published ? 'YES' : 'no'} (edition ${currentIssue.edition}, status ${currentIssue.status})`);
  console.log(`  Headline: ${currentIssue.headline}`);
}
console.log('');

// ── FAS + SDE ──
if (typeof stage3.factual_accuracy_score === 'number') {
  const score = stage3.factual_accuracy_score;
  const tier = score >= 80 ? '✓ strong' : score >= 70 ? '~ acceptable' : score >= 50 ? '⚠ concerning' : '✗ not publication-ready';
  console.log(`  factual_accuracy_score:   ${score}  (${tier})`);
}
if (typeof stage3.source_diversity_estimate === 'number') {
  console.log(`  source_diversity_estimate: ${stage3.source_diversity_estimate}`);
}
console.log('');

// ── Overall assessment ──
if (stage3.overall_assessment) {
  console.log('  ── OVERALL ASSESSMENT ─────────────────────────────────────────');
  wrapLines(stage3.overall_assessment, 75, '  ').forEach(l => console.log(l));
  console.log('');
}

// ── Source assessment ──
if (stage3.source_assessment) {
  console.log('  ── SOURCE ASSESSMENT ──────────────────────────────────────────');
  wrapLines(stage3.source_assessment, 75, '  ').forEach(l => console.log(l));
  console.log('');
}

// ── Schema A: claims[] with status + Dempster-Shafer ──
if (Array.isArray(stage3.claims) && stage3.claims.length > 0) {
  const grouped = { INCORRECT: [], MISLEADING: [], UNVERIFIED: [], VERIFIED: [] };
  for (const c of stage3.claims) {
    const status = (c.status || '').toUpperCase();
    if (grouped[status]) grouped[status].push(c);
  }
  for (const status of ['INCORRECT', 'MISLEADING', 'UNVERIFIED', 'VERIFIED']) {
    if (grouped[status].length === 0) continue;
    console.log(`  ── ${status} CLAIMS (${grouped[status].length}) ────────────────────────`);
    for (let i = 0; i < grouped[status].length; i++) {
      const c = grouped[status][i];
      console.log(`  ${i + 1}. ${c.claim || c.statement || '(unnamed claim)'}`);
      if (c.m_true !== undefined) {
        console.log(`     m_true=${c.m_true}  m_false=${c.m_false}  m_unknown=${c.m_unknown}`);
      }
      if (c.source) {
        wrapLines('     source: ' + c.source, 75, '').forEach(l => console.log(l));
      }
      if (c.correction) {
        wrapLines('     correction: ' + c.correction, 75, '').forEach(l => console.log(l));
      }
      console.log('');
    }
  }
}

// ── Schema B: key_corrections array ──
if (Array.isArray(stage3.key_corrections) && stage3.key_corrections.length > 0) {
  console.log(`  ── KEY CORRECTIONS (${stage3.key_corrections.length}) ───────────────────────`);
  for (let i = 0; i < stage3.key_corrections.length; i++) {
    const c = stage3.key_corrections[i];
    if (typeof c === 'string') {
      wrapLines(`  ${i + 1}. ${c}`, 75, '     ').forEach(l => console.log(l));
    } else {
      console.log(`  ${i + 1}. ${JSON.stringify(c, null, 2).split('\n').map(l => '     ' + l).join('\n').trimStart()}`);
    }
    console.log('');
  }
}

// ── Schema C: key_incorrect / key_misleading / key_unverified / key_verified ──
for (const [field, label] of [
  ['key_incorrect', 'KEY INCORRECT'],
  ['key_misleading', 'KEY MISLEADING'],
  ['key_unverified', 'KEY UNVERIFIED'],
  ['key_verified', 'KEY VERIFIED'],
]) {
  if (!Array.isArray(stage3[field]) || stage3[field].length === 0) continue;
  console.log(`  ── ${label} (${stage3[field].length}) ──────────────────────────`);
  for (let i = 0; i < stage3[field].length; i++) {
    const c = stage3[field][i];
    if (typeof c === 'string') {
      wrapLines(`  ${i + 1}. ${c}`, 75, '     ').forEach(l => console.log(l));
    } else {
      const txt = c.claim || c.statement || JSON.stringify(c);
      wrapLines(`  ${i + 1}. ${txt}`, 75, '     ').forEach(l => console.log(l));
      if (c.correction) wrapLines('     → ' + c.correction, 75, '       ').forEach(l => console.log(l));
      if (c.source) wrapLines('     source: ' + c.source, 75, '       ').forEach(l => console.log(l));
    }
    console.log('');
  }
}

// ── Schema D: verified_facts_to_use ──
if (Array.isArray(stage3.verified_facts_to_use) && stage3.verified_facts_to_use.length > 0) {
  console.log(`  ── VERIFIED FACTS TO USE (${stage3.verified_facts_to_use.length}) ─────────────`);
  for (let i = 0; i < stage3.verified_facts_to_use.length; i++) {
    const f = stage3.verified_facts_to_use[i];
    const txt = typeof f === 'string' ? f : JSON.stringify(f);
    wrapLines(`  ${i + 1}. ${txt}`, 75, '     ').forEach(l => console.log(l));
    console.log('');
  }
}

// ── Schema E: claims_summary ──
if (stage3.claims_summary) {
  console.log('  ── CLAIMS SUMMARY ─────────────────────────────────────────────');
  const cs = stage3.claims_summary;
  if (typeof cs === 'string') {
    wrapLines(cs, 75, '  ').forEach(l => console.log(l));
  } else {
    for (const [k, v] of Object.entries(cs)) console.log(`  ${k}: ${v}`);
  }
  console.log('');
}

// ── Omitted facts ──
if (Array.isArray(stage3.omitted_facts) && stage3.omitted_facts.length > 0) {
  console.log(`  ── OMITTED FACTS (${stage3.omitted_facts.length}) ──────────────────────────`);
  for (let i = 0; i < stage3.omitted_facts.length; i++) {
    const f = stage3.omitted_facts[i];
    const txt = typeof f === 'string' ? f : JSON.stringify(f);
    wrapLines(`  ${i + 1}. ${txt}`, 75, '     ').forEach(l => console.log(l));
    console.log('');
  }
}

// ── Current published cards (cross-reference) ──
if (currentIssue) {
  console.log('  ── CURRENTLY PUBLISHED CARDS (for cross-reference) ────────────');
  for (let ci = 0; ci < currentIssue.cards.length; ci++) {
    const c = currentIssue.cards[ci];
    const label = c.t + (c.lens ? ` [${c.lens}]` : '');
    console.log(`  [${ci}] ${label}`);
    if (c.big) wrapLines(`      ${c.big}`, 75, '      ').forEach(l => console.log(l));
    if (c.sub) wrapLines(`      sub: ${c.sub}`, 75, '      ').forEach(l => console.log(l));
    console.log('');
  }
}

console.log('  ═══════════════════════════════════════════════════════════════');
console.log('');

// ── Helpers ──
function wrapLines(text, width, indent = '') {
  if (!text) return [];
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = indent;
  for (const w of words) {
    if (line.length + w.length + 1 > width + indent.length && line.length > indent.length) {
      lines.push(line);
      line = indent + w;
    } else {
      line += (line.length > indent.length ? ' ' : '') + w;
    }
  }
  if (line.length > indent.length) lines.push(line);
  return lines;
}
