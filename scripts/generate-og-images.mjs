/**
 * Generates OG images for each PUBLISHED issue.
 * The issue's one-line art IS the OG image — no text overlay.
 * Resized to 1200×630 (1.91:1) with center crop.
 * Issues without a background image are blocked by validation.
 */
import sharp from 'sharp';
import { mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadIssues } from './lib/load-issues.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const issues = loadIssues();

const outDir = join(root, 'public', 'og');
const bgDir = join(root, 'public', 'og', 'backgrounds');
mkdirSync(outDir, { recursive: true });

// Clean regenerable artefacts for all formats. We keep the /og/backgrounds/
// source art, which is checked into the repo and hand-authored.
for (const file of readdirSync(outDir)) {
  if (!file.startsWith('issue-')) continue;
  if (/\.(png|webp|avif|jpg|jpeg)$/i.test(file)) {
    unlinkSync(join(outDir, file));
  }
}

// Only generate for published issues
const published = issues.filter(i => i.published);

console.log(`Generating OG images for ${published.length} published issues...`);

let count = 0;
let errors = 0;

for (const issue of published) {
  try {
    const bgPathPng = join(bgDir, `issue-${issue.id}-bg.png`);
    const bgPathJpg = join(bgDir, `issue-${issue.id}-bg.jpg`);
    const bgPath = existsSync(bgPathPng) ? bgPathPng : existsSync(bgPathJpg) ? bgPathJpg : null;

    if (!bgPath) {
      console.error(`  ERROR: Issue ${issue.id} is published but has no background image`);
      errors++;
      continue;
    }

    const outPath = join(outDir, `issue-${issue.id}.png`);

    // The art IS the OG — resize to 1200×630 with center crop.
    // This PNG is kept at canonical 1200×630 because it is the URL that
    // goes into <meta property="og:image"> for social scrapers, which do
    // not all understand <picture>.
    await sharp(bgPath)
      .resize(1200, 630, { fit: 'cover', position: 'centre' })
      .png({ compressionLevel: 9 })
      .toFile(outPath);

    // Responsive variants for <picture> delivery. See ADR-0002 Phase 8b.
    // Widths target 1x / 2x / 3x scenarios: small phone portrait (~375 CSS
    // px × 1.7 DPR), medium (~700 CSS px), and large (~1200 CSS px).
    // Encode order per width: AVIF → WebP → JPEG.
    const widths = [640, 960, 1200];
    for (const w of widths) {
      const h = Math.round(w / 1.9047619); // maintain 1.91:1 aspect
      const sized = sharp(bgPath).resize(w, h, { fit: 'cover', position: 'centre' });
      // Clone the resized pipeline per encoder; sharp pipelines are single-use.
      await sized.clone().avif({ quality: 55, effort: 6 }).toFile(join(outDir, `issue-${issue.id}-${w}w.avif`));
      await sized.clone().webp({ quality: 80 }).toFile(join(outDir, `issue-${issue.id}-${w}w.webp`));
      await sized.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(join(outDir, `issue-${issue.id}-${w}w.jpg`));
    }

    count++;
  } catch (e) {
    errors++;
    console.error(`  ERROR issue ${issue.id}: ${e.message}`);
  }
}

console.log(`Done: ${count} OG images generated, ${errors} errors.`);
if (errors > 0) process.exit(1);
