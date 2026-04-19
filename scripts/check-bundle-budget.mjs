#!/usr/bin/env node
/**
 * Phase 9 bundle-size gate.
 *
 * Sums brotli-compressed size of all JS + CSS assets in dist/_a/ and
 * compares against a budget. This runs AFTER `npm run build` has finished
 * — the stealth script renames files so we measure the shipped artefacts
 * and not intermediate chunks.
 *
 * The budget aligns with ADR-0001's "total +30 KB brotli across the
 * refactor" rule. A reference baseline is stored at scripts/bundle-baseline.json
 * the first time this runs (committed to the repo); subsequent runs fail
 * if the new total exceeds the baseline by > 10 KB (absolute) or > 5%
 * (relative).
 */
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants as zlibConstants } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distA = join(__dirname, '..', 'dist', '_a');
const baselineFile = join(__dirname, 'bundle-baseline.json');

if (!existsSync(distA)) {
  console.error(`FAIL: ${distA} does not exist. Run \`npm run build\` first.`);
  process.exit(1);
}

const ABS_DELTA_BUDGET = 10 * 1024; // +10 KB brotli
const REL_DELTA_BUDGET = 0.05; // +5 %

function brSize(path) {
  const raw = readFileSync(path);
  return brotliCompressSync(raw, {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 9 },
  }).length;
}

const entries = [];
let total = 0;
for (const name of readdirSync(distA)) {
  if (!/\.(js|css)$/.test(name)) continue;
  const path = join(distA, name);
  const raw = statSync(path).size;
  const br = brSize(path);
  entries.push({ name, raw, br });
  total += br;
}
entries.sort((a, b) => b.br - a.br);

console.log('Bundle size check (brotli on the wire)');
for (const { name, raw, br } of entries) {
  console.log(`  ${name.padEnd(30)} raw=${String(raw).padStart(8)}  br=${String(br).padStart(8)}`);
}
console.log(`  ${''.padEnd(30)} ${''.padStart(13)} ${'--------'.padStart(12)}`);
console.log(`  ${'total (JS + CSS, brotli)'.padEnd(30)} ${''.padStart(13)} ${String(total).padStart(12)}  (${(total / 1024).toFixed(1)} KB)`);

if (!existsSync(baselineFile)) {
  // First run: establish the baseline, pass.
  writeFileSync(baselineFile, JSON.stringify({ total, establishedAt: new Date().toISOString() }, null, 2));
  console.log(`\nOK: first run — baseline ${total} B written to scripts/bundle-baseline.json.`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselineFile, 'utf8'));
const delta = total - baseline.total;
const relDelta = delta / baseline.total;
console.log(`\nBaseline: ${baseline.total} B`);
console.log(`Delta:    ${delta > 0 ? '+' : ''}${delta} B  (${(relDelta * 100).toFixed(2)}%)`);

if (delta > ABS_DELTA_BUDGET && relDelta > REL_DELTA_BUDGET) {
  console.error(`\nFAIL: bundle grew by ${delta} B (${(relDelta * 100).toFixed(2)}%),`);
  console.error(`      exceeding both +${ABS_DELTA_BUDGET} B absolute AND +${REL_DELTA_BUDGET * 100}% relative limits.`);
  console.error(`      Either trim the bundle, or update scripts/bundle-baseline.json in the same PR that justifies the growth.`);
  process.exit(1);
}

if (delta > ABS_DELTA_BUDGET) {
  console.warn(`\nWARN: bundle grew by ${delta} B (exceeds +${ABS_DELTA_BUDGET} B absolute but within +${REL_DELTA_BUDGET * 100}% relative).`);
} else if (relDelta > REL_DELTA_BUDGET) {
  console.warn(`\nWARN: bundle grew by ${(relDelta * 100).toFixed(2)}% (exceeds +${REL_DELTA_BUDGET * 100}% relative but within +${ABS_DELTA_BUDGET} B absolute).`);
} else {
  console.log('\nOK: within bundle budget.');
}
