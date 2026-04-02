import { createPublicKey, verify } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function parseIssues() {
  const tsContent = readFileSync(join(root, 'src', 'data', 'issues.ts'), 'utf8');
  const issuesMatch = tsContent.match(/export const ISSUES:\s*Issue\[\]\s*=\s*(\[[\s\S]*\]);?\s*$/m);
  if (!issuesMatch) {
    console.error('Could not find ISSUES array in issues.ts');
    process.exit(1);
  }

  try {
    return eval('(' + issuesMatch[1].replace(/;\s*$/, '') + ')');
  } catch (error) {
    console.error(`Failed to parse ISSUES array: ${error.message}`);
    process.exit(1);
  }
}

const issues = parseIssues();
const publishedIssues = issues.filter(issue => issue.published === true);
const signatures = JSON.parse(readFileSync(join(root, 'public', 'signatures.json'), 'utf8'));
const publicKey = createPublicKey(readFileSync(join(root, 'public', 'pubkey.pem'), 'utf8'));
const hasSigningKey = Boolean(
  existsSync(join(root, '.keys', 'private.pem'))
  || process.env.TFA_PRIVATE_KEY_PEM
  || process.env.TFA_PRIVATE_KEY_B64
);

const failures = [];

if (!signatures.publicKeyFingerprint) {
  failures.push('Missing publicKeyFingerprint in public/signatures.json');
}

for (const issue of publishedIssues) {
  const entry = signatures.issues?.[issue.id];
  if (!entry) {
    failures.push(`Issue ${issue.id}: missing signature entry`);
    continue;
  }
  if (!entry.fingerprint) {
    failures.push(`Issue ${issue.id}: missing fingerprint`);
  }
  if (!entry.signature) {
    failures.push(`Issue ${issue.id}: missing signature`);
  }
  if (!entry.signedAt) {
    failures.push(`Issue ${issue.id}: missing signedAt`);
  }
  if (entry.fingerprint && entry.signature) {
    const isValid = verify(
      null,
      Buffer.from(entry.fingerprint),
      publicKey,
      Buffer.from(entry.signature, 'base64'),
    );
    if (!isValid) {
      failures.push(`Issue ${issue.id}: signature does not verify against public/pubkey.pem`);
    }
  }
}

if (failures.length > 0) {
  console.error('Published signature check failed:\n');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  if (!hasSigningKey) {
    console.error('\nHint: this is expected for local builds without a signing key. CI must provide TFA_PRIVATE_KEY_PEM or TFA_PRIVATE_KEY_B64.');
  }
  process.exit(1);
}

console.log(`Published signature check passed for ${publishedIssues.length} published issues.`);
