import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const issuesDir = join(__dirname, '..', '..', 'src', 'data', 'issues');

export function loadIssues() {
  return readdirSync(issuesDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(issuesDir, f), 'utf8')));
}

export function getIssuesDir() {
  return issuesDir;
}
