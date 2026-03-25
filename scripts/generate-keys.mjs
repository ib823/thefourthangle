import { generateKeyPairSync, createHash } from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const keysDir = join(root, '.keys');
const publicDir = join(root, 'public');

if (!existsSync(keysDir)) mkdirSync(keysDir, { recursive: true });

const privatePath = join(keysDir, 'private.pem');
const publicPath = join(publicDir, 'pubkey.pem');

if (existsSync(privatePath)) {
  console.log('Keys already exist. Delete .keys/private.pem to regenerate.');
  process.exit(0);
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

writeFileSync(privatePath, privateKey, 'utf8');
writeFileSync(publicPath, publicKey, 'utf8');

const fingerprint = createHash('sha256').update(publicKey).digest('hex').slice(0, 16);

console.log('Ed25519 keypair generated.');
console.log(`  Private key: .keys/private.pem`);
console.log(`  Public key:  public/pubkey.pem`);
console.log(`  Fingerprint: ${fingerprint}`);
