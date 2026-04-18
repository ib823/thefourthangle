import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadIssues } from './lib/load-issues.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const publicPem = readFileSync(join(root, 'public', 'pubkey.pem'), 'utf8');
const pubFingerprint = createHash('sha256').update(publicPem).digest('hex').slice(0, 16);
const publicKey = createPublicKey(publicPem);
const keyPath = join(root, '.keys', 'private.pem');

function resolvePrivateKeyPem() {
  if (existsSync(keyPath)) {
    return readFileSync(keyPath, 'utf8');
  }

  if (process.env.TFA_PRIVATE_KEY_PEM) {
    return process.env.TFA_PRIVATE_KEY_PEM;
  }

  const envB64 = process.env.TFA_PRIVATE_KEY_B64?.trim();
  if (!envB64) return null;

  const decoded = Buffer.from(envB64, 'base64').toString('utf8');
  if (decoded.includes('BEGIN PRIVATE KEY')) {
    return decoded;
  }

  // Backwards compatibility: legacy secret stores the PEM body lines only.
  return `-----BEGIN PRIVATE KEY-----\n${envB64}\n-----END PRIVATE KEY-----\n`;
}

const privateKeyPem = resolvePrivateKeyPem();
const privateKey = privateKeyPem ? createPrivateKey(privateKeyPem) : null;

if (privateKey) {
  const derivedPublicDer = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  const expectedPublicDer = publicKey.export({ type: 'spki', format: 'der' });
  if (!Buffer.from(derivedPublicDer).equals(Buffer.from(expectedPublicDer))) {
    console.error('Injected signing key does not match public/pubkey.pem');
    process.exit(1);
  }
}
const signaturesPath = join(root, 'public', 'signatures.json');
const existingManifest = existsSync(signaturesPath)
  ? JSON.parse(readFileSync(signaturesPath, 'utf8'))
  : { publicKeyFingerprint: pubFingerprint, issues: {} };

const CARD_LABELS = {
  hook: 'What they said',
  fact: 'What we found',
  reframe: 'The real question',
  analogy: 'Think of it this way',
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
  lines.push(`All ${issue.cards.length} perspectives read`);
  const viewCard = [...issue.cards].reverse().find(card => card.t === 'view');
  if (viewCard) lines.push(viewCard.big);

  return lines.join('\n');
}

const issues = loadIssues();
const publishedIssues = issues.filter(issue => issue.published === true);

const manifest = {
  publicKeyFingerprint: pubFingerprint,
  issues: {},
};

for (const issue of publishedIssues) {
  const readableText = buildReadableText(issue);
  const fingerprint = createHash('sha256').update(readableText).digest('hex');
  const existingEntry = existingManifest.issues?.[issue.id];

  let sig64 = null;
  let signedAt = new Date().toISOString();
  if (privateKey) {
    sig64 = sign(null, Buffer.from(fingerprint), privateKey).toString('base64');
  } else if (existingEntry?.fingerprint === fingerprint) {
    sig64 = existingEntry.signature ?? null;
    signedAt = existingEntry.signedAt ?? signedAt;
  }

  manifest.issues[issue.id] = {
    fingerprint,
    signature: sig64,
    signedAt,
  };

  console.log(`  ${issue.id}: ${fingerprint.slice(0, 16)}...`);
}

writeFileSync(signaturesPath, JSON.stringify(manifest, null, 2));
console.log(`\nPrepared ${publishedIssues.length} published issue fingerprints`);
console.log(`Signatures written to public/signatures.json`);
console.log(`Public key fingerprint: ${pubFingerprint}`);
if (!privateKey) {
  console.log('Private key not found — preserved existing valid signatures where fingerprints matched');
}
