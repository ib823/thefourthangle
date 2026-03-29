/**
 * Generates optimized image variants for each issue background.
 * Input:  public/og/backgrounds/issue-{ID}-bg.{jpg,png}
 * Output: public/images/issues/{ID}-thumb.{avif,jpg}   — 240x240
 *         public/images/issues/{ID}-card.{avif,jpg}     — 480x480
 *         public/images/issues/{ID}-hero.{avif,jpg}     — 960x540 (16:9 crop)
 *         public/images/issues/manifest.json            — list of IDs with images
 */
import sharp from 'sharp';
import { readdirSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const bgDir = join(root, 'public', 'og', 'backgrounds');
const outDir = join(root, 'public', 'images', 'issues');

mkdirSync(outDir, { recursive: true });

const files = readdirSync(bgDir).filter(f => /^issue-\d+-bg\.(jpg|jpeg|png)$/i.test(f));
const ids = files.map(f => f.match(/^issue-(\d+)-bg/)[1]);

console.log(`Generating image variants for ${ids.length} issues...`);

const SIZES = [
  { suffix: 'thumb', w: 240, h: 240, fit: 'cover', avifQ: 50, jpgQ: 70 },
  { suffix: 'card',  w: 480, h: 480, fit: 'cover', avifQ: 55, jpgQ: 75 },
  { suffix: 'hero',  w: 960, h: 504, fit: 'cover', avifQ: 60, jpgQ: 80 },  // ~1.91:1
];

let count = 0;
for (const id of ids) {
  const src = join(bgDir, files[ids.indexOf(id)]);

  for (const size of SIZES) {
    const base = join(outDir, `${id}-${size.suffix}`);

    // AVIF
    await sharp(src)
      .resize(size.w, size.h, { fit: size.fit, position: 'centre' })
      .avif({ quality: size.avifQ })
      .toFile(`${base}.avif`);

    // JPG fallback
    await sharp(src)
      .resize(size.w, size.h, { fit: size.fit, position: 'centre' })
      .jpeg({ quality: size.jpgQ, mozjpeg: true })
      .toFile(`${base}.jpg`);
  }
  count++;
}

// Write manifest
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(ids));
console.log(`  ✓ ${count} issues × ${SIZES.length} sizes × 2 formats = ${count * SIZES.length * 2} images`);
console.log(`  ✓ manifest.json (${ids.length} IDs)`);
