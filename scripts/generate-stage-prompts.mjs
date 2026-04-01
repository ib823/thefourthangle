#!/usr/bin/env node
/**
 * Generate stage 2-5 browser prompts from a stage 1 JSON output.
 *
 * Usage: node scripts/generate-stage-prompts.mjs <slug>
 *
 * Reads:  engine/output/{slug}-stage1.json
 * Reads:  engine/templates/stage{2-5}-preamble.txt
 * Writes: engine/prompts-generated/{slug}-stage{2-5}-browser.txt
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/generate-stage-prompts.mjs <slug>');
  process.exit(1);
}

const root = join(import.meta.dirname, '..');
const stage1Path = join(root, 'engine', 'output', `${slug}-stage1.json`);

let stage1;
try {
  stage1 = readFileSync(stage1Path, 'utf-8');
  JSON.parse(stage1); // validate
} catch (e) {
  console.error(`Failed to read stage 1 JSON: ${stage1Path}`);
  console.error(e.message);
  process.exit(1);
}

const stages = [
  { n: 2, verb: 'AUDIT', label: 'Bias Audit (Gemini)' },
  { n: 3, verb: 'FACT-CHECK', label: 'Fact Verification (ChatGPT)' },
  { n: 4, verb: 'REVIEW', label: 'Alternative Framing (DeepSeek/ChatGPT)' },
  { n: 5, verb: 'STRESS-TEST', label: 'Contrarian Stress-Test (Grok)' },
];

mkdirSync(join(root, 'engine', 'prompts-generated'), { recursive: true });

for (const { n, verb, label } of stages) {
  const preamblePath = join(root, 'engine', 'templates', `stage${n}-preamble.txt`);
  const preamble = readFileSync(preamblePath, 'utf-8').trimEnd();
  const separator = `\n\n=== THE ANALYSIS TO ${verb} ===\n\n`;
  const output = preamble + separator + stage1;
  const outPath = join(root, 'engine', 'prompts-generated', `${slug}-stage${n}-browser.txt`);
  writeFileSync(outPath, output);
  console.log(`  Stage ${n} (${label}): ${outPath}`);
}

console.log(`\nGenerated 4 prompts for "${slug}"`);
