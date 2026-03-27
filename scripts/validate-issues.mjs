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

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const verbose = process.argv.includes('--verbose');

// ── Extract issues from TypeScript ──
const tsContent = readFileSync(join(root, 'src', 'data', 'issues.ts'), 'utf8');
const issuesMatch = tsContent.match(/export const ISSUES:\s*Issue\[\]\s*=\s*(\[[\s\S]*\]);?\s*$/m);
if (!issuesMatch) {
  console.error('FATAL: Could not find ISSUES array in issues.ts');
  process.exit(1);
}

let issues;
try {
  let arr = issuesMatch[1].replace(/;\s*$/, '');
  issues = eval('(' + arr + ')');
} catch (e) {
  console.error('FATAL: Could not parse ISSUES array:', e.message);
  process.exit(1);
}

// ── Validation rules ──
const VALID_CARD_TYPES = ['hook', 'fact', 'reframe', 'view'];
const VALID_STATUSES = ['new', 'updated', null];
const VALID_LENSES = [
  'Legal', 'Rights', 'Economic', 'Governance', 'Technology',
  'Social', 'Political', 'Health', 'Environmental', 'Regional',
  'Historical', 'Critical', 'Theological', 'Security',
];
const STAGE_KEYS = ['pa', 'ba', 'fc', 'af', 'ct', 'sr'];

const LIMITS = {
  headline: { min: 10, max: 120 },
  context: { min: 20, max: 350 },
  cardBig: { min: 5, max: 300 },
  cardSub: { max: 400 },
  opinionShift: { min: 0, max: 100 },
  stageScore: { min: 0, max: 100 },
  finalScore: { min: 0, max: 100 },
  cardCount: { min: 5, max: 7 },  // typically 6, allow 5-7
  edition: { min: 1, max: 99 },
};

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

  // ── Text lengths ──
  if (issue.headline) {
    if (issue.headline.length < LIMITS.headline.min) {
      err(id, 'headline', `Too short: ${issue.headline.length} chars (min ${LIMITS.headline.min})`);
    }
    if (issue.headline.length > LIMITS.headline.max) {
      warn(id, 'headline', `Long: ${issue.headline.length} chars (recommended max ${LIMITS.headline.max})`);
    }
  }
  if (issue.context) {
    if (issue.context.length < LIMITS.context.min) {
      err(id, 'context', `Too short: ${issue.context.length} chars (min ${LIMITS.context.min})`);
    }
    if (issue.context.length > LIMITS.context.max) {
      warn(id, 'context', `Long: ${issue.context.length} chars (recommended max ${LIMITS.context.max})`);
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
        warn(id, `${cardLabel}.big`, `Long: ${card.big.length} chars (recommended max ${LIMITS.cardBig.max})`);
      }
    }

    // Sub text (can be empty string but must exist)
    if (card.sub == null) {
      err(id, `${cardLabel}.sub`, 'Missing sub field (use "" for empty)');
    }
    if (card.sub && card.sub.length > LIMITS.cardSub.max) {
      warn(id, `${cardLabel}.sub`, `Long: ${card.sub.length} chars (recommended max ${LIMITS.cardSub.max})`);
    }

    // Lens required on fact cards
    if (card.t === 'fact') {
      if (!card.lens) {
        err(id, `${cardLabel}.lens`, 'Fact card missing lens');
      } else if (!VALID_LENSES.includes(card.lens)) {
        err(id, `${cardLabel}.lens`, `Unknown lens: "${card.lens}" — valid: ${VALID_LENSES.join(', ')}`);
      }
    }

    // Lens should NOT be on non-fact cards
    if (card.t !== 'fact' && card.lens) {
      warn(id, `${cardLabel}.lens`, `Lens "${card.lens}" on non-fact card type "${card.t}" — will be ignored`);
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
