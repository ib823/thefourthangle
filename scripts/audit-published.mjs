#!/usr/bin/env node
/**
 * Published Issue Audit
 *
 * Audits all published issues against the new accuracy + editorial criteria
 * (see docs/research/bite-size-reading.md and CLAUDE.md "Accuracy Standard").
 *
 * Runs four mechanically-checkable phases and produces a single consolidated
 * report saved to engine/output/audit-published-{date}.md.
 *
 * Phase 1 — Structural (length budget, concreteness, reframe.sub, image)
 * Phase 2 — Pipeline traceability (which engine artifacts exist per issue)
 * Phase 3 — Source quality (parse Stage 3 JSON for issues with artifacts)
 * Phase 4 — Anti-pattern text scan (hook/hedge/vague phrases in copy)
 *
 * Output also includes a prioritized review queue for human Phase 5.
 *
 * Usage: node scripts/audit-published.mjs
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ── Load issues ──
const tsContent = readFileSync(join(root, 'src', 'data', 'issues.ts'), 'utf8');
const issuesMatch = tsContent.match(/export const ISSUES:\s*Issue\[\]\s*=\s*(\[[\s\S]*\]);?\s*$/m);
if (!issuesMatch) {
  console.error('FATAL: Could not find ISSUES array in issues.ts');
  process.exit(1);
}
const issues = eval('(' + issuesMatch[1].replace(/;\s*$/, '') + ')');
const published = issues.filter(i => i.published);

// ── Build slug ↔ id mapping from reader.json files ──
// Each engine/output/{slug}-reader.json contains the final issue id.
const engineOutDir = join(root, 'engine', 'output');
const engineBriefDir = join(root, 'engine', 'briefs');
const slugToId = {};
const idToSlug = {};
if (existsSync(engineOutDir)) {
  const files = readdirSync(engineOutDir);
  for (const f of files) {
    if (!f.endsWith('-reader.json')) continue;
    const slug = f.replace(/-reader\.json$/, '');
    try {
      const obj = JSON.parse(readFileSync(join(engineOutDir, f), 'utf8'));
      if (obj.id) {
        slugToId[slug] = obj.id;
        idToSlug[obj.id] = slug;
      }
    } catch (_) {}
  }
}

// ── Concreteness helpers (copied from validator for self-containment) ──
const SPELLED_NUM = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|hundred|thousand|million|billion|trillion|RM|USD|MYR|first|second|third|fourth|fifth|half|quarter|both|all|none|every|each|several|many)\b/i;
const SENTENCE_STARTERS = new Set([
  'The','A','An','And','But','Or','If','When','Where','Why','How','What','Who',
  'This','That','These','Those','Is','Are','Was','Were','Be','Been','Being',
  'Has','Have','Had','Do','Does','Did','Will','Would','Could','Should','May',
  'Might','Must','Can','Not','No','Yes','It','Its','Their','They','We','You',
  'He','She','His','Her','Our','Your','My','To','From','For','With','Without',
  'In','On','At','By','As','Of','About','After','Before','During','Under','Over',
  'Through','Across','Between','Among','Then','Than','So','Such','While',
  'Because','Since','Although','Even','Just','Only','Also','Now','Here','There',
]);
function hasProperNoun(text) {
  const words = text.split(/\s+/);
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(/[^a-zA-Z]/g, '');
    if (w.length > 1 && /^[A-Z]/.test(w) && !SENTENCE_STARTERS.has(w)) return true;
  }
  return false;
}
function isConcrete(text) {
  return /\d/.test(text) || SPELLED_NUM.test(text) || hasProperNoun(text);
}

// ── Length budget (mirrors validator) ──
const LIMITS = {
  headline: { target: 75, max: 100 },
  context: { target: 200, max: 280 },
  cardBig: { target: 120, max: 180 },
  cardSub: { target: 160, max: 220 },
  cardTotal: { target: 240, max: 300 },
};

// ── Anti-pattern phrases (per CLAUDE.md hook engineering rules) ──
const ANTIPATTERNS = {
  hook: [
    'explores', 'examines', 'looks at', 'raises questions', 'sparks debate',
    'is set to', 'reportedly', 'amid concerns', 'is poised', 'in the spotlight',
  ],
  underclaim: [
    'some have alleged', 'there are concerns', 'critics argue',
    'questions have been raised', 'concerns have been raised',
  ],
  vague_attribution: [
    'critics say', 'observers note', 'some have argued', 'sources say',
    'it has been reported', 'it is understood',
  ],
  reframe_failure: [
    'perhaps the real issue', 'so what now', 'time will tell', 'only time',
  ],
};

// ── Phase 1: Structural ──
const phase1 = { lengthViolations: [], concreteness: [], reframeSub: [], missingImage: [] };

for (const i of published) {
  const id = i.id;
  // Length: hard max only (warnings at target are noise; published issues should clear hard max)
  if (i.headline && i.headline.length > LIMITS.headline.max) {
    phase1.lengthViolations.push({ id, field: 'headline', len: i.headline.length, max: LIMITS.headline.max });
  }
  if (i.context && i.context.length > LIMITS.context.max) {
    phase1.lengthViolations.push({ id, field: 'context', len: i.context.length, max: LIMITS.context.max });
  }
  if (i.cards) {
    for (let ci = 0; ci < i.cards.length; ci++) {
      const c = i.cards[ci];
      if (c.big && c.big.length > LIMITS.cardBig.max) {
        phase1.lengthViolations.push({ id, field: `cards[${ci}].big`, len: c.big.length, max: LIMITS.cardBig.max });
      }
      if (c.sub && c.sub.length > LIMITS.cardSub.max) {
        phase1.lengthViolations.push({ id, field: `cards[${ci}].sub`, len: c.sub.length, max: LIMITS.cardSub.max });
      }
      const total = (c.big?.length ?? 0) + (c.sub?.length ?? 0);
      if (total > LIMITS.cardTotal.max) {
        phase1.lengthViolations.push({ id, field: `cards[${ci}]`, len: total, max: LIMITS.cardTotal.max });
      }
      // Concreteness floor on fact cards
      if (c.t === 'fact') {
        const text = (c.big || '') + ' ' + (c.sub || '');
        if (!isConcrete(text)) {
          phase1.concreteness.push({ id, cardIdx: ci, lens: c.lens, big: c.big });
        }
      }
      // Reframe sub > 80
      if (c.t === 'reframe' && c.sub && c.sub.trim().length > 80) {
        phase1.reframeSub.push({ id, cardIdx: ci, len: c.sub.trim().length, big: c.big, sub: c.sub });
      }
    }
  }
  // Background image
  const bgDir = join(root, 'public', 'og', 'backgrounds');
  const hasBg = existsSync(join(bgDir, `issue-${id}-bg.jpg`)) || existsSync(join(bgDir, `issue-${id}-bg.png`));
  if (!hasBg) phase1.missingImage.push({ id, headline: i.headline });
}

// ── Phase 2: Pipeline traceability ──
const STAGES = ['brief', 'stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'reader'];
const phase2 = { matrix: [], unauditable: [], fullPipeline: [] };

for (const i of published) {
  const id = i.id;
  const slug = idToSlug[id];
  const row = { id, headline: i.headline, slug: slug || null, artifacts: {} };
  if (slug) {
    row.artifacts.brief = existsSync(join(engineBriefDir, `${slug}.md`));
    row.artifacts.stage1 = existsSync(join(engineOutDir, `${slug}-stage1.json`));
    row.artifacts.stage2 = existsSync(join(engineOutDir, `${slug}-stage2.json`));
    row.artifacts.stage3 = existsSync(join(engineOutDir, `${slug}-stage3.json`));
    row.artifacts.stage4 = existsSync(join(engineOutDir, `${slug}-stage4.json`));
    row.artifacts.stage5 = existsSync(join(engineOutDir, `${slug}-stage5.json`));
    row.artifacts.stage6 = existsSync(join(engineOutDir, `${slug}-stage6-synthesis.json`));
    row.artifacts.reader = existsSync(join(engineOutDir, `${slug}-reader.json`));
  } else {
    for (const s of STAGES) row.artifacts[s] = false;
  }
  const presentCount = Object.values(row.artifacts).filter(Boolean).length;
  row.presentCount = presentCount;
  phase2.matrix.push(row);
  if (presentCount === 0) phase2.unauditable.push(row);
  else if (presentCount >= 7) phase2.fullPipeline.push(row);
}

// ── Phase 3: Source quality (only on issues with stage3 file) ──
const phase3 = { results: [], flagged: [] };
const TH_FAS = 70; // factual_accuracy_score threshold
const TH_MTRUE = 0.7; // average m_true threshold

for (const row of phase2.matrix) {
  if (!row.artifacts.stage3 || !row.slug) continue;
  try {
    const stage3 = JSON.parse(readFileSync(join(engineOutDir, `${row.slug}-stage3.json`), 'utf8'));
    const claims = Array.isArray(stage3.claims) ? stage3.claims : [];
    const fas = typeof stage3.factual_accuracy_score === 'number' ? stage3.factual_accuracy_score : null;
    const sde = typeof stage3.source_diversity_estimate === 'number' ? stage3.source_diversity_estimate : null;
    let totalMTrue = 0, mTrueCount = 0;
    let verified = 0, unverified = 0, incorrect = 0, misleading = 0;
    for (const c of claims) {
      if (typeof c.m_true === 'number') { totalMTrue += c.m_true; mTrueCount++; }
      const status = (c.status || '').toUpperCase();
      if (status === 'VERIFIED') verified++;
      else if (status === 'UNVERIFIED') unverified++;
      else if (status === 'INCORRECT') incorrect++;
      else if (status === 'MISLEADING') misleading++;
    }
    const avgMTrue = mTrueCount > 0 ? totalMTrue / mTrueCount : null;
    const result = {
      id: row.id, slug: row.slug,
      claimCount: claims.length,
      verified, unverified, incorrect, misleading,
      factual_accuracy_score: fas,
      source_diversity_estimate: sde,
      avgMTrue: avgMTrue !== null ? Math.round(avgMTrue * 100) / 100 : null,
    };
    phase3.results.push(result);
    const flagged = (fas !== null && fas < TH_FAS) || (avgMTrue !== null && avgMTrue < TH_MTRUE) || incorrect > 0 || misleading > 0;
    if (flagged) phase3.flagged.push(result);
  } catch (e) {
    phase3.results.push({ id: row.id, slug: row.slug, error: e.message });
  }
}

// ── Phase 4: Anti-pattern text scan ──
const phase4 = { hits: [] };

function scanText(id, field, text) {
  if (!text) return;
  const lower = text.toLowerCase();
  for (const [category, phrases] of Object.entries(ANTIPATTERNS)) {
    for (const phrase of phrases) {
      if (lower.includes(phrase)) {
        phase4.hits.push({ id, field, category, phrase, text: text.length > 120 ? text.slice(0, 120) + '…' : text });
      }
    }
  }
}

for (const i of published) {
  scanText(i.id, 'headline', i.headline);
  scanText(i.id, 'context', i.context);
  if (i.cards) {
    for (let ci = 0; ci < i.cards.length; ci++) {
      const c = i.cards[ci];
      scanText(i.id, `cards[${ci}].big (${c.t})`, c.big);
      scanText(i.id, `cards[${ci}].sub (${c.t})`, c.sub);
    }
  }
}

// ── Build prioritized review queue ──
// Tier 1: no artifacts AND has any structural/anti-pattern flag
// Tier 2: low Stage 3 confidence (in phase3.flagged)
// Tier 3: anti-pattern hits only (no other flag)
const flaggedIds = new Set();
const tier1 = [], tier2 = [], tier3 = [];

const structuralFlaggedIds = new Set([
  ...phase1.lengthViolations.map(v => v.id),
  ...phase1.concreteness.map(v => v.id),
  ...phase1.reframeSub.map(v => v.id),
  ...phase1.missingImage.map(v => v.id),
]);
const antipatternFlaggedIds = new Set(phase4.hits.map(h => h.id));
const unauditableIds = new Set(phase2.unauditable.map(r => r.id));
const phase3FlaggedIds = new Set(phase3.flagged.map(r => r.id));

for (const i of published) {
  const id = i.id;
  const isUnauditable = unauditableIds.has(id);
  const hasStructural = structuralFlaggedIds.has(id);
  const hasAntipattern = antipatternFlaggedIds.has(id);
  const lowConfidence = phase3FlaggedIds.has(id);

  if (isUnauditable && (hasStructural || hasAntipattern)) {
    tier1.push({ id, headline: i.headline, reasons: { unauditable: true, structural: hasStructural, antipattern: hasAntipattern } });
  } else if (lowConfidence) {
    tier2.push({ id, headline: i.headline, ...phase3.results.find(r => r.id === id) });
  } else if (hasAntipattern && !isUnauditable && !hasStructural) {
    tier3.push({ id, headline: i.headline, hitCount: phase4.hits.filter(h => h.id === id).length });
  }
}

// ── Build markdown report ──
const today = new Date().toISOString().slice(0, 10);
const lines = [];
lines.push(`# Published Issue Audit — ${today}`);
lines.push('');
lines.push(`Audit of all ${published.length} published issues against the new accuracy + editorial criteria from CLAUDE.md (Accuracy Standard) and \`docs/research/bite-size-reading.md\`. Generated by \`scripts/audit-published.mjs\`.`);
lines.push('');
lines.push(`## Summary`);
lines.push('');
lines.push(`| Metric | Value |`);
lines.push(`|---|---:|`);
lines.push(`| Total published issues | ${published.length} |`);
lines.push(`| With full pipeline (≥7 of 8 artifacts) | ${phase2.fullPipeline.length} |`);
lines.push(`| Partially audited (1-6 artifacts) | ${phase2.matrix.length - phase2.fullPipeline.length - phase2.unauditable.length} |`);
lines.push(`| **Unauditable (zero artifacts)** | **${phase2.unauditable.length}** |`);
lines.push(`| Phase 1 structural flags | ${structuralFlaggedIds.size} issues |`);
lines.push(`| Phase 3 low-confidence (FAS<${TH_FAS} or m_true<${TH_MTRUE}) | ${phase3.flagged.length} issues |`);
lines.push(`| Phase 4 anti-pattern hits | ${phase4.hits.length} hits across ${antipatternFlaggedIds.size} issues |`);
lines.push(`| Tier 1 review (highest priority) | ${tier1.length} issues |`);
lines.push(`| Tier 2 review (low confidence) | ${tier2.length} issues |`);
lines.push(`| Tier 3 review (anti-pattern only) | ${tier3.length} issues |`);
lines.push('');

// Phase 1
lines.push(`## Phase 1 — Structural`);
lines.push('');
lines.push(`Hard-max length violations, concreteness floor, reframe.sub > 80, missing background images.`);
lines.push('');
lines.push(`### Length hard-max violations (${phase1.lengthViolations.length})`);
if (phase1.lengthViolations.length === 0) {
  lines.push(`*None.* All published issues respect the hard-max budget.`);
} else {
  for (const v of phase1.lengthViolations) {
    lines.push(`- **${v.id}** \`${v.field}\` — ${v.len} chars (max ${v.max})`);
  }
}
lines.push('');

lines.push(`### Concreteness floor flags (${phase1.concreteness.length})`);
if (phase1.concreteness.length === 0) {
  lines.push(`*None.* All published fact cards have a concrete anchor.`);
} else {
  for (const c of phase1.concreteness) {
    lines.push(`- **${c.id}** \`cards[${c.cardIdx}]\` [${c.lens}] — ${c.big}`);
  }
}
lines.push('');

lines.push(`### Reframe.sub > 80 chars (${phase1.reframeSub.length})`);
if (phase1.reframeSub.length === 0) {
  lines.push(`*None.* All published reframes are clean.`);
} else {
  for (const r of phase1.reframeSub) {
    lines.push(`- **${r.id}** (${r.len} chars)`);
    lines.push(`  - big: ${r.big}`);
    lines.push(`  - sub: ${r.sub}`);
  }
}
lines.push('');

lines.push(`### Missing background images (${phase1.missingImage.length})`);
if (phase1.missingImage.length === 0) {
  lines.push(`*None.*`);
} else {
  for (const m of phase1.missingImage) {
    lines.push(`- **${m.id}** — ${m.headline}`);
  }
}
lines.push('');

// Phase 2
lines.push(`## Phase 2 — Pipeline Traceability`);
lines.push('');
lines.push(`Per-issue audit of which engine artifacts exist. Issues with zero artifacts cannot be retroactively audited for accuracy and need editorial decision (review, backfill, or unpublish).`);
lines.push('');
lines.push(`### Unauditable issues — zero engine artifacts (${phase2.unauditable.length})`);
lines.push('');
lines.push(`These published issues have no brief, no stage outputs, no reader.json. They predate the pipeline or were fallback-published. **Recommendation:** flag each for editorial decision. Do NOT auto-unpublish.`);
lines.push('');
if (phase2.unauditable.length === 0) {
  lines.push(`*None.*`);
} else {
  for (const u of phase2.unauditable) {
    lines.push(`- **${u.id}** — ${u.headline}`);
  }
}
lines.push('');

lines.push(`### Full-pipeline issues (${phase2.fullPipeline.length})`);
lines.push('');
lines.push(`These have ≥7 of 8 expected artifacts and are fully auditable.`);
lines.push('');
if (phase2.fullPipeline.length === 0) {
  lines.push(`*None.*`);
} else {
  lines.push(`| ID | Slug | Headline |`);
  lines.push(`|---|---|---|`);
  for (const r of phase2.fullPipeline) {
    lines.push(`| ${r.id} | ${r.slug} | ${r.headline ? r.headline.slice(0, 80) : ''} |`);
  }
}
lines.push('');

const partial = phase2.matrix.filter(r => r.presentCount > 0 && r.presentCount < 7);
lines.push(`### Partially-audited issues (${partial.length})`);
lines.push('');
if (partial.length === 0) {
  lines.push(`*None.*`);
} else {
  lines.push(`| ID | Slug | Artifacts | Missing |`);
  lines.push(`|---|---|---:|---|`);
  for (const r of partial) {
    const missing = STAGES.filter(s => !r.artifacts[s]).join(', ');
    lines.push(`| ${r.id} | ${r.slug || '—'} | ${r.presentCount}/8 | ${missing} |`);
  }
}
lines.push('');

// Phase 3
lines.push(`## Phase 3 — Source Quality`);
lines.push('');
lines.push(`Parsed Stage 3 (Fact Verification) outputs for issues with artifacts. Threshold: \`factual_accuracy_score < ${TH_FAS}\` OR \`avg m_true < ${TH_MTRUE}\` OR any INCORRECT/MISLEADING claim.`);
lines.push('');
lines.push(`### Stage 3 results — all issues with artifacts (${phase3.results.length})`);
lines.push('');
if (phase3.results.length === 0) {
  lines.push(`*No Stage 3 outputs found on disk.*`);
} else {
  lines.push(`| ID | Claims | VER | UNV | INC | MIS | FAS | avg m_true | SDE | Flagged |`);
  lines.push(`|---|---:|---:|---:|---:|---:|---:|---:|---:|---|`);
  const sorted = [...phase3.results].sort((a, b) => (a.factual_accuracy_score ?? 100) - (b.factual_accuracy_score ?? 100));
  for (const r of sorted) {
    if (r.error) {
      lines.push(`| ${r.id} | ERROR | | | | | | | | parse: ${r.error} |`);
      continue;
    }
    const flagged = phase3FlaggedIds.has(r.id) ? '⚠️' : '';
    lines.push(`| ${r.id} | ${r.claimCount} | ${r.verified} | ${r.unverified} | ${r.incorrect} | ${r.misleading} | ${r.factual_accuracy_score ?? '—'} | ${r.avgMTrue ?? '—'} | ${r.source_diversity_estimate ?? '—'} | ${flagged} |`);
  }
}
lines.push('');

// Phase 4
lines.push(`## Phase 4 — Anti-Pattern Text Scan`);
lines.push('');
lines.push(`Greps published issue text for known anti-patterns from the CLAUDE.md hook engineering rules.`);
lines.push('');
lines.push(`### Hits by category`);
lines.push('');
const byCat = {};
for (const h of phase4.hits) {
  byCat[h.category] = (byCat[h.category] || 0) + 1;
}
if (Object.keys(byCat).length === 0) {
  lines.push(`*No hits across all ${published.length} published issues.* (Note: this means the published corpus is already clean of these specific phrases — surprising and worth verifying the patterns are correctly tuned.)`);
} else {
  lines.push(`| Category | Hits |`);
  lines.push(`|---|---:|`);
  for (const [cat, n] of Object.entries(byCat)) {
    lines.push(`| ${cat} | ${n} |`);
  }
}
lines.push('');

lines.push(`### All anti-pattern hits (${phase4.hits.length})`);
lines.push('');
if (phase4.hits.length === 0) {
  lines.push(`*None.*`);
} else {
  for (const h of phase4.hits) {
    lines.push(`- **${h.id}** \`${h.field}\` — *${h.category}*: "${h.phrase}"`);
    lines.push(`  > ${h.text}`);
  }
}
lines.push('');

// Prioritized review queue
lines.push(`## Prioritized Review Queue`);
lines.push('');
lines.push(`Three tiers, ordered by review priority. Tier 1 issues need immediate attention; Tier 3 are minor edits.`);
lines.push('');

lines.push(`### Tier 1 — Unauditable AND has flag (${tier1.length})`);
lines.push('');
lines.push(`These issues have no audit trail AND show structural or anti-pattern flags. Highest priority.`);
lines.push('');
if (tier1.length === 0) {
  lines.push(`*None.*`);
} else {
  for (const t of tier1) {
    const reasons = [];
    if (t.reasons.structural) reasons.push('structural');
    if (t.reasons.antipattern) reasons.push('anti-pattern');
    lines.push(`- **${t.id}** [${reasons.join(', ')}] — ${t.headline}`);
  }
}
lines.push('');

lines.push(`### Tier 2 — Low Stage 3 confidence (${tier2.length})`);
lines.push('');
lines.push(`Issues with documented audit trail but Stage 3 flagged factual accuracy concerns.`);
lines.push('');
if (tier2.length === 0) {
  lines.push(`*None.*`);
} else {
  for (const t of tier2) {
    lines.push(`- **${t.id}** — FAS ${t.factual_accuracy_score ?? '—'}, m_true ${t.avgMTrue ?? '—'}, INC ${t.incorrect ?? 0}, MIS ${t.misleading ?? 0}`);
    lines.push(`  ${t.headline}`);
  }
}
lines.push('');

lines.push(`### Tier 3 — Anti-pattern only (${tier3.length})`);
lines.push('');
lines.push(`Issues with no other flags but anti-pattern phrases in copy. Minor copy edits.`);
lines.push('');
if (tier3.length === 0) {
  lines.push(`*None.*`);
} else {
  for (const t of tier3) {
    lines.push(`- **${t.id}** (${t.hitCount} hit${t.hitCount > 1 ? 's' : ''}) — ${t.headline}`);
  }
}
lines.push('');

// Recommendations
lines.push(`## Recommendations`);
lines.push('');
lines.push(`1. **Tier 1 first** — these are the highest-leverage fixes (unauditable + at least one mechanical flag).`);
lines.push(`2. **For unauditable issues without other flags** (count: ${phase2.unauditable.length - tier1.length}) — editorial decision per issue: backfill audit trail (re-run pipeline), keep as legacy with disclaimer, or unpublish. Do NOT auto-act.`);
lines.push(`3. **Tier 2 issues need source review** — Stage 3 already flagged them. Re-read the Stage 3 output and either correct the cards or hold the issue.`);
lines.push(`4. **Tier 3 are copy edits** — fix the flagged phrases in place; no source review needed.`);
lines.push(`5. **Going forward** — the new accuracy rules in CLAUDE.md will prevent these gaps from recurring on new issues. This audit covers retroactive content only.`);
lines.push('');
lines.push(`---`);
lines.push(`*Generated by \`scripts/audit-published.mjs\` on ${today}. Re-run anytime to refresh.*`);

// ── Write report ──
mkdirSync(engineOutDir, { recursive: true });
const reportPath = join(engineOutDir, `audit-published-${today}.md`);
writeFileSync(reportPath, lines.join('\n'));

// ── Console summary ──
console.log(``);
console.log(`  Published Issue Audit — ${today}`);
console.log(`  ─────────────────────────────────────────────`);
console.log(`  Total published:           ${published.length}`);
console.log(`  Full pipeline (≥7/8):      ${phase2.fullPipeline.length}`);
console.log(`  Partial (1-6/8):           ${phase2.matrix.length - phase2.fullPipeline.length - phase2.unauditable.length}`);
console.log(`  Unauditable (0/8):         ${phase2.unauditable.length}`);
console.log(`  ─────────────────────────────────────────────`);
console.log(`  Phase 1 structural flags:  ${structuralFlaggedIds.size} issues`);
console.log(`    length violations:       ${phase1.lengthViolations.length}`);
console.log(`    concreteness flags:      ${phase1.concreteness.length}`);
console.log(`    reframe.sub flags:       ${phase1.reframeSub.length}`);
console.log(`    missing images:          ${phase1.missingImage.length}`);
console.log(`  Phase 3 low-confidence:    ${phase3.flagged.length} issues`);
console.log(`  Phase 4 anti-pattern hits: ${phase4.hits.length} hits across ${antipatternFlaggedIds.size} issues`);
console.log(`  ─────────────────────────────────────────────`);
console.log(`  REVIEW QUEUE`);
console.log(`    Tier 1 (highest):        ${tier1.length} issues`);
console.log(`    Tier 2 (low confidence): ${tier2.length} issues`);
console.log(`    Tier 3 (copy edits):     ${tier3.length} issues`);
console.log(`  ─────────────────────────────────────────────`);
console.log(``);
console.log(`  Full report: ${reportPath}`);
console.log(``);
