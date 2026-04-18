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

for (const file of readdirSync(outDir)) {
  if (file.startsWith('issue-') && file.endsWith('.png')) {
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

    // The art IS the OG — resize to 1200×630 with center crop
    await sharp(bgPath)
      .resize(1200, 630, { fit: 'cover', position: 'centre' })
      .png({ compressionLevel: 9 })
      .toFile(outPath);

    // Generate WebP variants at 640w, 960w, 1200w for responsive srcset
    const widths = [640, 960, 1200];
    for (const w of widths) {
      const h = Math.round(w / 1.9047619); // maintain 1.91:1 aspect
      await sharp(bgPath)
        .resize(w, h, { fit: 'cover', position: 'centre' })
        .webp({ quality: 80 })
        .toFile(join(outDir, `issue-${issue.id}-${w}w.webp`));
    }

    count++;
  } catch (e) {
    errors++;
    console.error(`  ERROR issue ${issue.id}: ${e.message}`);
  }
}

console.log(`Done: ${count} OG images generated, ${errors} errors.`);
if (errors > 0) process.exit(1);
