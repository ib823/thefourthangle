import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const publicPem = readFileSync(join(root, 'public', 'pubkey.pem'), 'utf8');
const pubFingerprint = createHash('sha256').update(publicPem).digest('hex').slice(0, 16);
const keyPath = join(root, '.keys', 'private.pem');
const privateKey = existsSync(keyPath)
  ? createPrivateKey(readFileSync(keyPath, 'utf8'))
  : null;

const CARD_LABELS = {
  hook: 'What they said',
  fact: 'What we found',
  reframe: 'The real question',
  view: 'The considered view',
};

function opinionLabel(score) {
  if (score >= 80) return 'Fundamental';
  if (score >= 60) return 'Significant';
  if (score >= 40) return 'Partial';
  return 'Surface';
}

function buildReadableText(issue) {
  const lines = [];
  lines.push(issue.headline);
  lines.push(issue.context);
  lines.push('');
  lines.push(`${issue.opinionShift}`);
  lines.push(opinionLabel(issue.opinionShift));

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
  const viewCard = [...issue.cards].reverse().find(card => card.t === 'view');
  if (viewCard) lines.push(viewCard.big);

  return lines.join('\n');
}

// Extract ISSUES array from the TypeScript file
const tsContent = readFileSync(join(root, 'src', 'data', 'issues.ts'), 'utf8');
const issuesMatch = tsContent.match(/export const ISSUES:\s*Issue\[\]\s*=\s*(\[[\s\S]*\]);?\s*$/m);
if (!issuesMatch) {
  console.error('Could not find ISSUES array in issues.ts');
  process.exit(1);
}

// Evaluate the array (it's pure JSON-compatible data literals)
let issues;
try {
  // Clean up TypeScript-specific syntax for eval
  let arrayStr = issuesMatch[1];
  // Remove trailing semicolons
  arrayStr = arrayStr.replace(/;\s*$/, '');
  issues = eval('(' + arrayStr + ')');
} catch (e) {
  console.error('Failed to parse ISSUES array:', e.message);
  process.exit(1);
}

const publishedIssues = issues.filter(issue => issue.published === true);

const manifest = {
  publicKeyFingerprint: pubFingerprint,
  issues: {},
};

for (const issue of publishedIssues) {
  const readableText = buildReadableText(issue);
  const fingerprint = createHash('sha256').update(readableText).digest('hex');

  const sig64 = privateKey
    ? sign(null, Buffer.from(fingerprint), privateKey).toString('base64')
    : null;

  manifest.issues[issue.id] = {
    fingerprint,
    signature: sig64,
    signedAt: new Date().toISOString(),
  };

  console.log(`  ${issue.id}: ${fingerprint.slice(0, 16)}...`);
}

writeFileSync(join(root, 'public', 'signatures.json'), JSON.stringify(manifest, null, 2));
console.log(`\nPrepared ${publishedIssues.length} published issue fingerprints`);
console.log(`Signatures written to public/signatures.json`);
console.log(`Public key fingerprint: ${pubFingerprint}`);
if (!privateKey) {
  console.log('Private key not found — fingerprints written without signatures');
}
