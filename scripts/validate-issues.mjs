/**
 * Issue Content Validator
 *
 * Runs structural, semantic, and integrity checks on all issues in issues.ts.
 * Must pass before any build artifact is generated.
 *
 * Usage: node scripts/validate-issues.mjs [--fix-ids] [--verbose]
 *   --fix-ids   Auto-fix duplicate IDs by appending suffix (dry-run report only)
 *   --verbose   Show passing checks too, not just failures
 *
 * Exit codes:
 *   0 = all checks passed
 *   1 = errors found (build should not proceed)
 */

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadIssues } from './lib/load-issues.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const verbose = process.argv.includes('--verbose');

const issues = loadIssues();

// ── Validation rules ──
const VALID_CARD_TYPES = ['hook', 'fact', 'reframe', 'analogy', 'view'];
const VALID_STATUSES = ['new', 'updated', null];
const VALID_LENSES = [
  'Legal', 'Rights', 'Economic', 'Governance', 'Technology',
  'Social', 'Political', 'Health', 'Environmental', 'Regional',
  'Historical', 'Critical', 'Theological', 'Security',
];
const STAGE_KEYS = ['pa', 'ba', 'fc', 'af', 'ct', 'sr'];

// Length budget — derived from research on mobile attention, microcontent, and
// Smart Brevity (see CLAUDE.md "Length Budget" section). Two bands per field:
//   target → ideal bite-size; exceeding emits a WARNING (drift signal to editor)
//   max    → hard ceiling; exceeding emits an ERROR (build breaks)
// Targets are tuned so a typical 6-card issue lands at ~1200–1500 chars total —
// readable in under 90 seconds on a phone, the window where new readers decide
// whether to subscribe.
const LIMITS = {
  headline: { min: 10, target: 75, max: 100 },     // Axios: ≤6 words; news CTR optimum 60–100 chars
  context: { min: 20, target: 200, max: 280 },     // 1–2 sentences setting up the gap
  cardBig: { min: 5, target: 120, max: 180 },      // one punchy claim per card
  cardSub: { target: 160, max: 220 },              // one supporting sentence
  cardTotal: { target: 240, max: 300 },            // big + sub — must fit mobile viewport
  opinionShift: { min: 0, max: 100 },
  stageScore: { min: 0, max: 100 },
  finalScore: { min: 0, max: 100 },
  cardCount: { min: 5, max: 8 },                   // typically 6-7, allow 5-8
  edition: { min: 1, max: 99 },
};

// ── Concreteness helpers (research: identifiable victim / Slovic psychic numbing) ──
// A fact card is "concrete enough" if it contains ANY of:
//   - a digit
//   - a spelled-out number / quantifier
//   - a proper noun (capitalized word that isn't sentence-initial)
// This drastically reduces false positives vs a pure /\d/ check.
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

// ── Collector ──
const errors = [];
const warnings = [];
let passCount = 0;

function err(issueId, field, msg) {
  errors.push({ id: issueId, field, msg });
}
function warn(issueId, field, msg) {
  warnings.push({ id: issueId, field, msg });
}
function pass(msg) {
  passCount++;
  if (verbose) console.log(`  ✓ ${msg}`);
}

// ══════════════════════════════════════════════
// GLOBAL CHECKS
// ══════════════════════════════════════════════

console.log(`\n  Validating ${issues.length} issues...\n`);

// 1. Duplicate IDs
const idCounts = {};
for (const issue of issues) {
  idCounts[issue.id] = (idCounts[issue.id] || 0) + 1;
}
const dupes = Object.entries(idCounts).filter(([, c]) => c > 1);
if (dupes.length > 0) {
  for (const [id, count] of dupes) {
    err(id, 'id', `Duplicate ID: appears ${count} times`);
  }
} else {
  pass(`No duplicate IDs across ${issues.length} issues`);
}

// 2. ID format check (4-digit string)
for (const issue of issues) {
  if (!/^\d{4}$/.test(issue.id)) {
    err(issue.id, 'id', `ID must be exactly 4 digits, got "${issue.id}"`);
  }
}

// 3. ID ordering (should be monotonic or at least consistent)
const ids = issues.map(i => parseInt(i.id, 10));
let orderIssues = 0;
for (let i = 1; i < ids.length; i++) {
  if (ids[i] > ids[i - 1]) orderIssues++;
}
// If most IDs are descending (newest first), that's fine
// If mixed, warn
const ascFraction = orderIssues / (ids.length - 1);
if (ascFraction > 0.3 && ascFraction < 0.7) {
  warn('global', 'order', `ID ordering is mixed (${Math.round(ascFraction * 100)}% ascending) — consider consistent ordering`);
} else {
  pass(`ID ordering is consistent (${ascFraction < 0.3 ? 'descending' : 'ascending'})`);
}

// ══════════════════════════════════════════════
// PER-ISSUE CHECKS
// ══════════════════════════════════════════════

for (const issue of issues) {
  const id = issue.id ?? '???';

  // ── Required fields ──
  if (!issue.id) err(id, 'id', 'Missing id');
  if (issue.opinionShift == null) err(id, 'opinionShift', 'Missing opinionShift');
  if (!issue.headline) err(id, 'headline', 'Missing headline');
  if (!issue.context) err(id, 'context', 'Missing context');
  if (!issue.cards || !Array.isArray(issue.cards)) {
    err(id, 'cards', 'Missing or non-array cards');
    continue; // Can't check cards further
  }
  if (issue.edition == null) err(id, 'edition', 'Missing edition');

  // ── Status ──
  if (!VALID_STATUSES.includes(issue.status)) {
    err(id, 'status', `Invalid status: "${issue.status}" — must be "new", "updated", or null`);
  }

  // ── Numeric ranges ──
  if (typeof issue.opinionShift === 'number') {
    if (issue.opinionShift < LIMITS.opinionShift.min || issue.opinionShift > LIMITS.opinionShift.max) {
      err(id, 'opinionShift', `Out of range: ${issue.opinionShift} (must be ${LIMITS.opinionShift.min}-${LIMITS.opinionShift.max})`);
    }
  }
  if (typeof issue.edition === 'number') {
    if (issue.edition < LIMITS.edition.min || issue.edition > LIMITS.edition.max) {
      err(id, 'edition', `Out of range: ${issue.edition} (must be ${LIMITS.edition.min}-${LIMITS.edition.max})`);
    }
  }

  // ── Text lengths (bite-size budget) ──
  if (issue.headline) {
    if (issue.headline.length < LIMITS.headline.min) {
      err(id, 'headline', `Too short: ${issue.headline.length} chars (min ${LIMITS.headline.min})`);
    }
    if (issue.headline.length > LIMITS.headline.max) {
      warn(id, 'headline', `Over hard max: ${issue.headline.length} chars (max ${LIMITS.headline.max}) — trim to fit mobile preview`);
    } else if (issue.headline.length > LIMITS.headline.target) {
      warn(id, 'headline', `Over bite-size target: ${issue.headline.length} chars (target ${LIMITS.headline.target})`);
    }
  }
  if (issue.context) {
    if (issue.context.length < LIMITS.context.min) {
      err(id, 'context', `Too short: ${issue.context.length} chars (min ${LIMITS.context.min})`);
    }
    if (issue.context.length > LIMITS.context.max) {
      warn(id, 'context', `Over hard max: ${issue.context.length} chars (max ${LIMITS.context.max}) — break into a fact card`);
    } else if (issue.context.length > LIMITS.context.target) {
      warn(id, 'context', `Over bite-size target: ${issue.context.length} chars (target ${LIMITS.context.target})`);
    }
  }

  // ── Stage scores ──
  if (issue.stageScores) {
    for (const key of STAGE_KEYS) {
      const val = issue.stageScores[key];
      if (val == null) {
        err(id, `stageScores.${key}`, 'Missing stage score');
      } else if (typeof val !== 'number' || val < LIMITS.stageScore.min || val > LIMITS.stageScore.max) {
        err(id, `stageScores.${key}`, `Invalid: ${val} (must be number ${LIMITS.stageScore.min}-${LIMITS.stageScore.max})`);
      }
    }
  } else {
    warn(id, 'stageScores', 'Missing stageScores (VerdictBar won\'t render)');
  }

  if (issue.finalScore != null) {
    if (typeof issue.finalScore !== 'number' || issue.finalScore < LIMITS.finalScore.min || issue.finalScore > LIMITS.finalScore.max) {
      err(id, 'finalScore', `Invalid: ${issue.finalScore} (must be number ${LIMITS.finalScore.min}-${LIMITS.finalScore.max})`);
    }
  } else {
    warn(id, 'finalScore', 'Missing finalScore');
  }

  // ── Card count ──
  const cardCount = issue.cards.length;
  if (cardCount < LIMITS.cardCount.min || cardCount > LIMITS.cardCount.max) {
    err(id, 'cards', `${cardCount} cards (must be ${LIMITS.cardCount.min}-${LIMITS.cardCount.max})`);
  }

  // ── Card type sequence ──
  const types = issue.cards.map(c => c.t);
  const hookCount = types.filter(t => t === 'hook').length;
  const factCount = types.filter(t => t === 'fact').length;
  const reframeCount = types.filter(t => t === 'reframe').length;
  const viewCount = types.filter(t => t === 'view').length;

  if (hookCount !== 1) err(id, 'cards', `Must have exactly 1 hook card (found ${hookCount})`);
  if (factCount < 2 || factCount > 4) err(id, 'cards', `Must have 2-4 fact cards (found ${factCount})`);
  if (reframeCount !== 1) err(id, 'cards', `Must have exactly 1 reframe card (found ${reframeCount})`);
  if (viewCount !== 1) err(id, 'cards', `Must have exactly 1 view card (found ${viewCount})`);

  const analogyCount = types.filter(t => t === 'analogy').length;
  if (analogyCount > 1) warn(id, 'cards', `Multiple analogy cards (found ${analogyCount})`);

  // Analogy ordering: must come after reframe, before view
  const analogyIdx = types.lastIndexOf('analogy');
  const reframeIdx = types.lastIndexOf('reframe');
  const viewIdx = types.lastIndexOf('view');
  if (analogyIdx !== -1 && reframeIdx !== -1 && analogyIdx < reframeIdx) {
    warn(id, 'cards', 'analogy card should come after reframe');
  }
  if (analogyIdx !== -1 && viewIdx !== -1 && analogyIdx > viewIdx) {
    warn(id, 'cards', 'analogy card should come before view');
  }

  // First card should be hook, last should be view
  if (types[0] !== 'hook') {
    warn(id, 'cards[0]', `First card should be "hook", got "${types[0]}"`);
  }
  if (types[types.length - 1] !== 'view') {
    warn(id, 'cards[last]', `Last card should be "view", got "${types[types.length - 1]}"`);
  }

  // ── Per-card checks ──
  for (let ci = 0; ci < issue.cards.length; ci++) {
    const card = issue.cards[ci];
    const cardLabel = `cards[${ci}]`;

    // Type validity
    if (!VALID_CARD_TYPES.includes(card.t)) {
      err(id, `${cardLabel}.t`, `Invalid card type: "${card.t}"`);
    }

    // Big text required
    if (!card.big || card.big.trim().length === 0) {
      err(id, `${cardLabel}.big`, 'Missing or empty big text');
    } else {
      if (card.big.length < LIMITS.cardBig.min) {
        err(id, `${cardLabel}.big`, `Too short: ${card.big.length} chars (min ${LIMITS.cardBig.min})`);
      }
      if (card.big.length > LIMITS.cardBig.max) {
        warn(id, `${cardLabel}.big`, `Over hard max: ${card.big.length} chars (max ${LIMITS.cardBig.max}) — one claim per card`);
      } else if (card.big.length > LIMITS.cardBig.target) {
        warn(id, `${cardLabel}.big`, `Over bite-size target: ${card.big.length} chars (target ${LIMITS.cardBig.target})`);
      }
    }

    // Sub text (can be empty string but must exist)
    if (card.sub == null) {
      err(id, `${cardLabel}.sub`, 'Missing sub field (use "" for empty)');
    }
    if (card.sub && card.sub.length > LIMITS.cardSub.max) {
      warn(id, `${cardLabel}.sub`, `Over hard max: ${card.sub.length} chars (max ${LIMITS.cardSub.max}) — one supporting sentence`);
    } else if (card.sub && card.sub.length > LIMITS.cardSub.target) {
      warn(id, `${cardLabel}.sub`, `Over bite-size target: ${card.sub.length} chars (target ${LIMITS.cardSub.target})`);
    }

    // Combined big+sub length — must fit mobile card at readable font size
    const totalLen = (card.big?.length ?? 0) + (card.sub?.length ?? 0);
    if (totalLen > LIMITS.cardTotal.max) {
      warn(id, `${cardLabel}`, `Over hard max: ${totalLen} chars (max ${LIMITS.cardTotal.max}) — overflows mobile card`);
    } else if (totalLen > LIMITS.cardTotal.target) {
      warn(id, `${cardLabel}`, `Over bite-size target: ${totalLen} chars (target ${LIMITS.cardTotal.target})`);
    }

    // Lens required on fact cards
    if (card.t === 'fact') {
      if (!card.lens) {
        err(id, `${cardLabel}.lens`, 'Fact card missing lens');
      } else if (!VALID_LENSES.includes(card.lens)) {
        err(id, `${cardLabel}.lens`, `Unknown lens: "${card.lens}" — valid: ${VALID_LENSES.join(', ')}`);
      }

      // Concreteness floor — flag fact cards with NO digit, NO spelled-out number,
      // and NO mid-sentence proper noun. Catches genuinely abstract drafts only.
      // Refined from a pure /\d/ check (which had ~96% false positives on the
      // existing corpus). See docs/research/bite-size-reading.md.
      const factText = (card.big || '') + ' ' + (card.sub || '');
      if (!isConcrete(factText)) {
        warn(id, `${cardLabel}`, 'Fact card has no number, named actor, or spelled quantity — likely abstract. Add a concrete anchor (Slovic concreteness floor).');
      }
    }

    // Lens should NOT be on non-fact cards
    if (card.t !== 'fact' && card.lens) {
      warn(id, `${cardLabel}.lens`, `Lens "${card.lens}" on non-fact card type "${card.t}" — will be ignored`);
    }

    // Reframe sub: empty or short button only. Long discursive subs dilute the
    // aha spike (Kounios-Beeman). Threshold 80 chars: short punchlines (≤80) work
    // as "buttons"; longer subs are evidence and belong on a fact card.
    if (card.t === 'reframe' && card.sub && card.sub.trim().length > 80) {
      warn(id, `${cardLabel}.sub`, `Reframe sub is ${card.sub.trim().length} chars — discursive subs dilute the insight. Compress to ≤80 chars (a button) or move the evidence to a fact card.`);
    }
  }

  // ── Cross-field consistency ──
  // If stageScores exist, finalScore should too
  if (issue.stageScores && issue.finalScore == null) {
    warn(id, 'finalScore', 'Has stageScores but no finalScore');
  }
  if (issue.finalScore != null && !issue.stageScores) {
    warn(id, 'stageScores', 'Has finalScore but no stageScores');
  }

  // Fact cards should have unique lenses
  const factLenses = issue.cards.filter(c => c.t === 'fact' && c.lens).map(c => c.lens);
  const uniqueLenses = new Set(factLenses);
  if (uniqueLenses.size < factLenses.length) {
    warn(id, 'cards', `Duplicate lens across fact cards: ${factLenses.join(', ')}`);
  }

  // ── Published issues MUST have a background image ──
  if (issue.published) {
    const bgDir = join(root, 'public', 'og', 'backgrounds');
    const hasBg = existsSync(join(bgDir, `issue-${id}-bg.jpg`)) || existsSync(join(bgDir, `issue-${id}-bg.png`));
    if (!hasBg) {
      err(id, 'published', `BLOCKED: Published issue has no background image. Add public/og/backgrounds/issue-${id}-bg.{jpg,png} before publishing.`);
    }
  }

  // ── Optional fields: related, sourceDate ──
  if (issue.related) {
    if (!Array.isArray(issue.related)) {
      err(id, 'related', 'Must be an array of issue ID strings');
    } else {
      for (const rid of issue.related) {
        if (typeof rid !== 'string' || !/^\d{4}$/.test(rid)) {
          err(id, 'related', `Invalid related ID: "${rid}" — must be 4-digit string`);
        }
        if (rid === issue.id) {
          err(id, 'related', `Issue cannot reference itself`);
        }
      }
    }
  }

  if (issue.sourceDate) {
    if (typeof issue.sourceDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(issue.sourceDate)) {
      err(id, 'sourceDate', `Invalid format: "${issue.sourceDate}" — must be YYYY-MM-DD`);
    }
  }
}

// ══════════════════════════════════════════════
// REPORT
// ══════════════════════════════════════════════

const errCount = errors.length;
const warnCount = warnings.length;

if (errCount > 0) {
  console.log(`  ERRORS (${errCount}):\n`);
  // Group by issue ID
  const grouped = {};
  for (const e of errors) {
    if (!grouped[e.id]) grouped[e.id] = [];
    grouped[e.id].push(e);
  }
  for (const [id, errs] of Object.entries(grouped)) {
    console.log(`  Issue ${id}:`);
    for (const e of errs) {
      console.log(`    ✗ ${e.field}: ${e.msg}`);
    }
  }
  console.log('');
}

if (warnCount > 0) {
  console.log(`  WARNINGS (${warnCount}):\n`);
  const grouped = {};
  for (const w of warnings) {
    if (!grouped[w.id]) grouped[w.id] = [];
    grouped[w.id].push(w);
  }
  // Only show first 20 unique issues with warnings
  const warnIssues = Object.entries(grouped);
  const shown = warnIssues.slice(0, 20);
  for (const [id, wrns] of shown) {
    console.log(`  Issue ${id}:`);
    for (const w of wrns) {
      console.log(`    ⚠ ${w.field}: ${w.msg}`);
    }
  }
  if (warnIssues.length > 20) {
    console.log(`  ... and ${warnIssues.length - 20} more issues with warnings`);
  }
  console.log('');
}

// Summary
console.log('  ─────────────────────────────────');
console.log(`  Issues:   ${issues.length}`);
console.log(`  Errors:   ${errCount}`);
console.log(`  Warnings: ${warnCount}`);
console.log(`  Passed:   ${passCount} global checks`);
console.log('  ─────────────────────────────────');

if (errCount > 0) {
  console.log(`\n  ✗ VALIDATION FAILED — ${errCount} error(s) must be fixed before build.\n`);
  process.exit(1);
} else {
  console.log(`\n  ✓ ALL CHECKS PASSED${warnCount > 0 ? ` (${warnCount} warnings)` : ''}.\n`);
  process.exit(0);
}
