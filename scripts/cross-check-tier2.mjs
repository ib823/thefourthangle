#!/usr/bin/env node
/**
 * For each Tier 2 issue, extract the flagged claims from Stage 3 and check
 * which key tokens (numbers, named actors) still appear in the published cards.
 * Outputs an actionable per-issue list of likely-still-present problems.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
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

const tier2 = ['1043','1146','1871','1887','1958','1960','1961','1962','1963','1964','1965','1966','1967','1970','1971','1972','1973','1974','1975'];

function extractTokens(text) {
  if (!text) return [];
  const tokens = new Set();
  // Numbers (with units)
  for (const m of text.matchAll(/\b(?:RM|US\$|USD|MYR)?\s?\d[\d,.]*\s?(?:billion|million|trillion|B|M|hectares?|ha|km|MW|TWh|years?|months?|days?|%|GW)?/gi)) {
    const t = m[0].trim();
    if (t.length > 2 && !/^(19|20)\d{2}$/.test(t)) tokens.add(t);
  }
  // Named entities (capitalized words 2+ chars)
  for (const m of text.matchAll(/\b[A-Z][A-Za-z]{2,}\b/g)) tokens.add(m[0]);
  return Array.from(tokens);
}

function getCardText(issue) {
  let txt = (issue.headline || '') + ' ' + (issue.context || '');
  if (issue.cards) for (const c of issue.cards) txt += ' ' + (c.big || '') + ' ' + (c.sub || '');
  return txt;
}

for (const id of tier2) {
  const slug = idToSlug[id];
  if (!slug) continue;
  const stage3Path = join(engineOutDir, `${slug}-stage3.json`);
  if (!existsSync(stage3Path)) continue;
  const issue = issues.find(i => i.id === id);
  if (!issue) continue;
  const j = JSON.parse(readFileSync(stage3Path, 'utf8'));
  const cardText = getCardText(issue);

  // Collect all flagged claims
  const flags = [];
  if (Array.isArray(j.claims)) {
    for (const c of j.claims) {
      const s = (c.status || '').toUpperCase();
      if (['INCORRECT', 'MISLEADING', 'UNVERIFIED'].includes(s)) {
        flags.push({ status: s, claim: c.claim || c.statement || '', correction: c.correction });
      }
    }
  }
  for (const [field, status] of [['key_incorrect', 'INCORRECT'], ['key_misleading', 'MISLEADING'], ['key_unverified', 'UNVERIFIED'], ['key_corrections', 'CORRECTION']]) {
    if (Array.isArray(j[field])) {
      for (const c of j[field]) {
        const text = typeof c === 'string' ? c : (c.claim || c.statement || JSON.stringify(c));
        flags.push({ status, claim: text });
      }
    }
  }

  if (flags.length === 0) continue;

  // For each flag, check if any of its tokens still appear in the cards
  const stillPresent = [];
  for (const flag of flags) {
    const tokens = extractTokens(flag.claim);
    const hits = tokens.filter(t => cardText.includes(t));
    if (hits.length >= 1) {
      stillPresent.push({ ...flag, hits });
    }
  }

  if (stillPresent.length === 0) continue;
  console.log('\n=== ' + id + ' (' + stillPresent.length + ' likely-still-present out of ' + flags.length + ' flagged) ===');
  for (const sp of stillPresent.slice(0, 6)) {
    console.log('  [' + sp.status + '] ' + sp.claim.slice(0, 200));
    console.log('    hits: ' + sp.hits.slice(0, 6).join(' | '));
    if (sp.correction) console.log('    fix: ' + sp.correction.slice(0, 200));
  }
}
