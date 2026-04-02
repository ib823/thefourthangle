/**
 * Generates optimized image variants for each issue background.
 * Everything lives in one folder: public/og/backgrounds/
 *
 * Source:  issue-{ID}-bg.{jpg,png}          — original art (uploaded)
 * Output:  issue-{ID}-thumb.{avif,jpg}      — 240x240
 *          issue-{ID}-card.{avif,jpg}       — 480x480
 *          issue-{ID}-hero.{avif,jpg}       — 960x504 (~1.91:1)
 *          manifest.json                    — list of IDs with images
 */
import sharp from 'sharp';
import { readdirSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dir = join(root, 'public', 'og', 'backgrounds');

mkdirSync(dir, { recursive: true });

const tsContent = readFileSync(join(root, 'src', 'data', 'issues.ts'), 'utf8');
const issuesMatch = tsContent.match(/export const ISSUES:\s*Issue\[\]\s*=\s*(\[[\s\S]*\]);?\s*$/m);
if (!issuesMatch) { console.error('Could not find ISSUES'); process.exit(1); }

let issues;
try {
  let arr = issuesMatch[1].replace(/;\s*$/, '');
  issues = eval('(' + arr + ')');
} catch (e) { console.error('Parse error:', e.message); process.exit(1); }

const publishedIds = new Set(issues.filter(issue => issue.published === true).map(issue => issue.id));
const files = readdirSync(dir).filter(file => /^issue-\d+-bg\.(jpg|jpeg|png)$/i.test(file));
const ids = files
  .map(file => file.match(/^issue-(\d+)-bg/i)?.[1])
  .filter(id => id && publishedIds.has(id));

console.log(`Generating image variants for ${ids.length} issues...`);

const SIZES = [
  { suffix: 'thumb', w: 240, h: 240, fit: 'cover', avifQ: 50, jpgQ: 70 },
  { suffix: 'card',  w: 480, h: 480, fit: 'cover', avifQ: 55, jpgQ: 75 },
  { suffix: 'hero',  w: 960, h: 504, fit: 'cover', avifQ: 60, jpgQ: 80 },
];

let count = 0;
for (const file of readdirSync(dir)) {
  if (/^issue-\d+-(thumb|card|hero)\.(avif|jpg)$/i.test(file)) {
    unlinkSync(join(dir, file));
  }
}

for (const id of ids) {
  const srcFile = files.find(file => file.startsWith(`issue-${id}-bg.`));
  if (!srcFile) continue;
  const src = join(dir, srcFile);

  for (const size of SIZES) {
    const base = join(dir, `issue-${id}-${size.suffix}`);

    await sharp(src)
      .resize(size.w, size.h, { fit: size.fit, position: 'centre' })
      .avif({ quality: size.avifQ })
      .toFile(`${base}.avif`);

    await sharp(src)
      .resize(size.w, size.h, { fit: size.fit, position: 'centre' })
      .jpeg({ quality: size.jpgQ, mozjpeg: true })
      .toFile(`${base}.jpg`);
  }
  count++;
}

writeFileSync(join(dir, 'manifest.json'), JSON.stringify(ids));
console.log(`  ✓ ${count} issues × ${SIZES.length} sizes × 2 formats = ${count * SIZES.length * 2} images`);
console.log(`  ✓ manifest.json (${ids.length} IDs)`);
