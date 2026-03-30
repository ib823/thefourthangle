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
import { readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dir = join(root, 'public', 'og', 'backgrounds');

mkdirSync(dir, { recursive: true });

const files = readdirSync(dir).filter(f => /^issue-\d+-bg\.(jpg|jpeg|png)$/i.test(f));
const ids = files.map(f => f.match(/^issue-(\d+)-bg/)[1]);

console.log(`Generating image variants for ${ids.length} issues...`);

const SIZES = [
  { suffix: 'thumb', w: 240, h: 240, fit: 'cover', avifQ: 50, jpgQ: 70 },
  { suffix: 'card',  w: 480, h: 480, fit: 'cover', avifQ: 55, jpgQ: 75 },
  { suffix: 'hero',  w: 960, h: 504, fit: 'cover', avifQ: 60, jpgQ: 80 },
];

let count = 0;
for (const id of ids) {
  const src = join(dir, files[ids.indexOf(id)]);

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
