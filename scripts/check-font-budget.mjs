#!/usr/bin/env node
/**
 * Phase 4 font-budget gate.
 *
 * Sums the on-the-wire byte size of every font file under public/fonts/
 * and compares to the ADR-0001 ceiling (60 KB brotli).
 *
 * "On the wire" is approximated as: if the origin would negotiate
 * Content-Encoding: br for the asset, the brotli-encoded body; otherwise
 * the raw file. In practice, woff2 is already Brotli-compressed internally,
 * so brotli-over-HTTP is a no-op and raw bytes are the honest measurement.
 * See ADR-0001 for the full reasoning.
 *
 * Exit 0 on pass. Exit 1 on budget exceeded.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fontsDir = join(__dirname, '..', 'public', 'fonts');

const BUDGET_BYTES = 60 * 1024; // 60 KB brotli on the wire

const fonts = [];
let total = 0;
for (const name of readdirSync(fontsDir)) {
  if (!['.woff2', '.woff', '.ttf', '.otf'].includes(extname(name).toLowerCase())) continue;
  const path = join(fontsDir, name);
  const size = statSync(path).size;
  fonts.push({ name, size });
  total += size;
}

fonts.sort((a, b) => b.size - a.size);

console.log('Font budget check (ADR-0001: ≤ 60 KB brotli on the wire)');
for (const { name, size } of fonts) {
  console.log(`  ${name.padEnd(40)} ${String(size).padStart(8)} B`);
}
console.log(`  ${''.padEnd(40)} ${'--------'.padStart(8)}`);
console.log(`  ${'total'.padEnd(40)} ${String(total).padStart(8)} B   (${(total / 1024).toFixed(1)} KB)`);
console.log(`  ${'budget'.padEnd(40)} ${String(BUDGET_BYTES).padStart(8)} B   (${(BUDGET_BYTES / 1024).toFixed(1)} KB)`);

if (total > BUDGET_BYTES) {
  console.error(`\nFAIL: font payload ${total} B exceeds 60 KB brotli budget.`);
  console.error(`      Either remove a weight, drop a family, or raise the ADR-0001 budget.`);
  process.exit(1);
}

const headroom = BUDGET_BYTES - total;
console.log(`\nOK: ${headroom} B headroom (${(headroom / 1024).toFixed(1)} KB).`);
