import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const privatePem = readFileSync(join(root, '.keys', 'private.pem'), 'utf8');
const publicPem = readFileSync(join(root, 'public', 'pubkey.pem'), 'utf8');
const privateKey = createPrivateKey(privatePem);

const pubFingerprint = createHash('sha256').update(publicPem).digest('hex').slice(0, 16);

function canonicalize(obj) {
  if (Array.isArray(obj)) return obj.map(canonicalize);
  if (obj !== null && typeof obj === 'object') {
    const sorted = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = canonicalize(obj[key]);
    }
    return sorted;
  }
  return obj;
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

const manifest = {
  publicKeyFingerprint: pubFingerprint,
  issues: {},
};

for (const issue of issues) {
  const canonical = JSON.stringify(canonicalize(issue.cards));
  const fingerprint = createHash('sha256').update(canonical).digest('hex');

  const signature = sign(null, Buffer.from(fingerprint), privateKey);
  const sig64 = signature.toString('base64');

  manifest.issues[issue.id] = {
    fingerprint,
    signature: sig64,
    signedAt: new Date().toISOString(),
  };

  console.log(`  ${issue.id}: ${fingerprint.slice(0, 16)}...`);
}

writeFileSync(join(root, 'public', 'signatures.json'), JSON.stringify(manifest, null, 2));
console.log(`\nSigned ${issues.length} issues`);
console.log(`Signatures written to public/signatures.json`);
console.log(`Public key fingerprint: ${pubFingerprint}`);
