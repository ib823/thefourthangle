/**
 * Builds verify.html with embedded signatures.
 * Fingerprints are computed from the full readable text of each issue,
 * matching what a reader would copy from the desktop reader.
 */
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const templatePath = join(root, 'public', 'verify.template.html');
const outputPath = join(root, 'public', 'verify.html');

if (!existsSync(templatePath)) {
  copyFileSync(outputPath, templatePath);
}

const keyPath = join(root, '.keys', 'private.pem');
if (!existsSync(keyPath)) {
  console.log('Verifier: skipped (no private key — using existing verify.html)');
  process.exit(0);
}
const privatePem = readFileSync(keyPath, 'utf8');
const privateKey = createPrivateKey(privatePem);

const CARD_LABELS = {
  hook: 'What they said',
  fact: 'What we found',
  reframe: 'The real question',
  view: 'The considered view',
};

// Extract ISSUES from TypeScript
const tsContent = readFileSync(join(root, 'src', 'data', 'issues.ts'), 'utf8');
const issuesMatch = tsContent.match(/export const ISSUES:\s*Issue\[\]\s*=\s*(\[[\s\S]*\]);?\s*$/m);
if (!issuesMatch) { console.error('Could not find ISSUES'); process.exit(1); }

let issues;
try {
  let arr = issuesMatch[1].replace(/;\s*$/, '');
  issues = eval('(' + arr + ')');
} catch (e) { console.error('Parse error:', e.message); process.exit(1); }

function opinionLabel(s) {
  if (s >= 80) return 'Fundamental';
  if (s >= 60) return 'Significant';
  if (s >= 40) return 'Partial';
  return 'Surface';
}

/**
 * Build the canonical readable text for an issue.
 * This must match what a reader copies from the desktop reader.
 */
function buildReadableText(issue) {
  const lines = [];
  lines.push(issue.headline);
  lines.push(issue.context);
  lines.push('');
  lines.push(`${issue.opinionShift}`);
  lines.push(opinionLabel(issue.opinionShift));

  // Stage scores
  if (issue.stageScores) {
    lines.push('PA');
    lines.push('BA');
    lines.push('FC');
    lines.push('AF');
    lines.push('CT');
    lines.push('SR');
  }
  if (issue.finalScore != null) {
    lines.push(String(issue.finalScore));
    lines.push('/100');
  }

  if (issue.status) lines.push(issue.status === 'new' ? 'New' : 'Updated');

  for (const card of issue.cards) {
    lines.push('');
    let label = CARD_LABELS[card.t] || card.t;
    if (card.t === 'fact' && card.lens) label += ` \u00B7 ${card.lens}`;
    lines.push(label);
    lines.push('');
    lines.push(card.big);
    if (card.sub) {
      lines.push('');
      lines.push(card.sub);
    }
  }

  lines.push('');
  lines.push('All 6 perspectives read');
  const viewCard = [...issue.cards].reverse().find(c => c.t === 'view');
  if (viewCard) lines.push(viewCard.big);

  return lines.join('\n');
}

const signatures = [];
for (const issue of issues) {
  const text = buildReadableText(issue);
  const fp = createHash('sha256').update(text).digest('hex');
  const sig = sign(null, Buffer.from(fp), privateKey).toString('base64');
  signatures.push({ fp, sig, id: issue.id });
}

// Read template and embed
let html = readFileSync(templatePath, 'utf8');
html = html.replace('SIGNATURES_PLACEHOLDER', JSON.stringify(signatures));
writeFileSync(outputPath, html, 'utf8');

console.log(`Verifier: ${signatures.length} full-text signatures embedded`);
