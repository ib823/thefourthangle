/**
 * Builds verify.html with embedded signatures sourced from signatures.json.
 * The reader and verifier therefore consume the same fingerprint manifest.
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const templatePath = join(root, 'public', 'verify.template.html');
const outputPath = join(root, 'public', 'verify.html');
const signaturesPath = join(root, 'public', 'signatures.json');

if (!existsSync(templatePath)) {
  copyFileSync(outputPath, templatePath);
}

const manifest = existsSync(signaturesPath)
  ? JSON.parse(readFileSync(signaturesPath, 'utf8'))
  : { issues: {} };

const signatures = Object.entries(manifest.issues || {}).map(([id, entry]) => ({
  id,
  fp: entry.fingerprint,
  sig: entry.signature || '',
}));

// Read template and embed
let html = readFileSync(templatePath, 'utf8');
html = html.replace('SIGNATURES_PLACEHOLDER', JSON.stringify(signatures));
writeFileSync(outputPath, html, 'utf8');

console.log(`Verifier: ${signatures.length} published issue signatures embedded`);
