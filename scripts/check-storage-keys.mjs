#!/usr/bin/env node
/**
 * Phase 1 / follow-up 3a guard.
 *
 * Fails CI if any new code introduces a legacy `tfa-<name>` localStorage key
 * outside the allowed files:
 *   - src/lib/reading-state.ts          (LEGACY_KEYS source of truth)
 *   - src/lib/__tests__/reading-state.test.ts  (migration tests use legacy)
 *
 * sessionStorage keys are allowed ANYWHERE (e.g. `tfa-sw-build`,
 * `tfa-cinema-dismissed` — intentionally session-scoped, not migrated).
 *
 * The guard only catches the `'tfa-<word>'` literal pattern; anything that
 * slipped by (e.g. template literals) is a follow-up to this guard, not a
 * blocker.
 */
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const ALLOWED_FILES = new Set([
  'src/lib/reading-state.ts',
  'src/lib/__tests__/reading-state.test.ts',
]);

// Match 'tfa-foo' literals. The pattern avoids 'tfa:v1:…' (colon) and
// deliberately does not try to parse — it grep-checks. Use ripgrep so output
// is stable across platforms.
const pattern = "['\"]tfa-[a-zA-Z0-9:_-]+['\"]";
let raw;
try {
  // Scope to src/ only. Workers (Cloudflare service names like tfa-notify)
  // use tfa- in their wrangler config and are not storage keys.
  raw = execSync(`grep -rEn ${JSON.stringify(pattern)} src 2>/dev/null || true`, {
    cwd: repoRoot,
    encoding: 'utf8',
  });
} catch (e) {
  console.error('grep failed:', e.message);
  process.exit(1);
}

const lines = raw.trim().split('\n').filter(Boolean);
const violations = [];
for (const line of lines) {
  const [pathPart, ...rest] = line.split(':');
  const remainder = rest.join(':');

  // Skip sessionStorage — these legacy tfa-* keys are intentional
  // (session-scoped, not migrated; see brief-v3 Phase 1).
  if (/\bsessionStorage\b/.test(remainder)) continue;

  // Skip allowed files entirely (reading-state owns the legacy-key list).
  if (ALLOWED_FILES.has(pathPart)) continue;

  violations.push(line);
}

if (violations.length === 0) {
  console.log('OK: no legacy tfa-* localStorage key literals in source.');
  process.exit(0);
}

console.error('FAIL: legacy tfa-* localStorage key literals found outside allowed files.');
console.error('Allowed files: ' + Array.from(ALLOWED_FILES).join(', '));
console.error('');
for (const v of violations) console.error('  ' + v);
console.error('');
console.error('Use the tfa:v1:* namespace directly, or route through src/lib/reading-state.ts.');
process.exit(1);
