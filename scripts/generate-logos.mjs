/**
 * Generate all T4A logo variants from the locked vector paths.
 * Single source of truth: t4a_locked_vector.svg path data.
 * No font dependency — pure vector geometry for pixel-perfect rendering at every size.
 *
 * Fill ratios (% of canvas width occupied by glyph):
 * - Favicon: 82% fill
 * - App icons: 78% fill (Google Material icon keyline)
 * - Maskable icons: 66% fill (Android safe zone — bolder than default 56%)
 * - Apple touch icon: 78% fill
 * - Circle icons: 65% fill (inscribed in circle)
 * - Notification badges: 88% fill (near edge-to-edge, monochrome)
 * - Notification icons: 78% fill (colored, for notification shade)
 */

import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

mkdirSync(join(root, 'public', 'icons'), { recursive: true });

const NAVY = '#0f0f23';
const WHITE = '#FFFFFF';

// Locked vector path (from t4a_locked_vector.svg, viewBox 0 0 960 960)
// Glyph bounds: x 186–773 (w=587), y 363–595 (h=232)
const T4A_PATH = 'M 773 363 L 691 363 L 680 366 L 666 378 L 590 542 L 567 595 L 616 595 L 624 574 L 637 547 L 728 547 L 729 595 L 773 595 Z M 727 399 L 729 401 L 729 506 L 656 507 L 655 506 L 698 411 L 703 405 L 709 401 Z M 482 363 L 378 509 L 378 547 L 499 547 L 500 595 L 545 595 L 545 549 L 576 507 L 545 506 L 545 364 Z M 499 412 L 500 506 L 432 507 L 431 506 Z M 186 363 L 186 408 L 273 409 L 273 595 L 318 595 L 318 409 L 391 408 L 422 363 Z';

// Source glyph metrics (from the 960×960 canvas)
const SRC_X = 186;
const SRC_Y = 363;
const SRC_W = 587;   // 773 - 186
const SRC_H = 232;   // 595 - 363
const SRC_CX = SRC_X + SRC_W / 2;  // 479.5
const SRC_CY = SRC_Y + SRC_H / 2;  // 479

/**
 * Build SVG with T4A paths scaled and centered in a canvas.
 * @param {Object} opts
 * @param {number} opts.width - Canvas width
 * @param {number} opts.height - Canvas height
 * @param {number} opts.fillRatio - How much of canvas width the glyph should fill (0-1)
 * @param {string} opts.color - Glyph color
 * @param {string|null} opts.bgColor - Background color (null = transparent)
 * @param {number} [opts.rounded] - Background corner radius
 */
function buildSvg({ width, height, fillRatio, color, bgColor, rounded = 0 }) {
  const targetW = width * fillRatio;
  const scale = targetW / SRC_W;
  const targetH = SRC_H * scale;

  // Center the scaled glyph
  const tx = (width - targetW) / 2 - SRC_X * scale;
  const ty = (height - targetH) / 2 - SRC_Y * scale;

  const bg = bgColor
    ? (rounded > 0
      ? `<rect width="${width}" height="${height}" rx="${rounded}" fill="${bgColor}"/>`
      : `<rect width="${width}" height="${height}" fill="${bgColor}"/>`)
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${bg}
  <g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${scale.toFixed(6)})">
    <path d="${T4A_PATH}" fill="${color}" fill-rule="evenodd"/>
  </g>
</svg>`;
}

/**
 * Build SVG with T4A paths inside a circle.
 */
function buildCircleSvg({ size, fillRatio, color, bgColor }) {
  const targetW = size * fillRatio;
  const scale = targetW / SRC_W;
  const targetH = SRC_H * scale;

  const tx = (size - targetW) / 2 - SRC_X * scale;
  const ty = (size - targetH) / 2 - SRC_Y * scale;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${bgColor}"/>
  <g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${scale.toFixed(6)})">
    <path d="${T4A_PATH}" fill="${color}" fill-rule="evenodd"/>
  </g>
</svg>`;
}

async function generate(svg, outputPath) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outputPath);
  console.log(`  ✓ ${outputPath.replace(root + '/', '')}`);
}

async function main() {
  console.log('Generating T4A logos from locked vector...\n');

  // ── 1. Header logo — tight crop, transparent background ──
  // Used as logo.png in-app (content logo for about page, etc.)
  const headerScale = 0.42;  // 240px wide output
  const headerW = Math.ceil(SRC_W * headerScale);
  const headerH = Math.ceil(SRC_H * headerScale);
  await generate(
    buildSvg({ width: headerW, height: headerH, fillRatio: 0.96, color: '#1A1614', bgColor: null }),
    join(root, 'public', 'logo.png')
  );

  // ── 2. Favicon PNG — 48×48, navy background, prominent ──
  await generate(
    buildSvg({ width: 48, height: 48, fillRatio: 0.82, color: WHITE, bgColor: NAVY, rounded: 8 }),
    join(root, 'public', 'favicon.png')
  );

  // ── 2b. Favicon SVG ──
  const svgFav = buildSvg({ width: 32, height: 32, fillRatio: 0.82, color: WHITE, bgColor: NAVY, rounded: 6 });
  writeFileSync(join(root, 'public', 'favicon.svg'), svgFav);
  console.log('  ✓ public/favicon.svg');

  // ── 3. App icons — 78% fill, 12% rounded corners ──
  for (const size of [192, 512]) {
    await generate(
      buildSvg({ width: size, height: size, fillRatio: 0.78, color: WHITE, bgColor: NAVY, rounded: Math.round(size * 0.12) }),
      join(root, 'public', 'icons', `icon-${size}.png`)
    );
  }

  // ── 4. Maskable icons — 66% fill (bolder, Android safe zone is 80% circle) ──
  for (const size of [192, 512]) {
    await generate(
      buildSvg({ width: size, height: size, fillRatio: 0.66, color: WHITE, bgColor: NAVY }),
      join(root, 'public', 'icons', `icon-maskable-${size}.png`)
    );
  }

  // ── 5. Circle icons — 65% fill ──
  for (const size of [192, 512]) {
    await generate(
      buildCircleSvg({ size, fillRatio: 0.65, color: WHITE, bgColor: NAVY }),
      join(root, 'public', 'icons', `icon-circle-${size}.png`)
    );
  }

  // ── 6. Apple touch icon — 180×180, 78% fill ──
  await generate(
    buildSvg({ width: 180, height: 180, fillRatio: 0.78, color: WHITE, bgColor: NAVY, rounded: Math.round(180 * 0.12) }),
    join(root, 'public', 'icons', 'apple-touch-icon.png')
  );

  // ── 7. Notification badges — monochrome, 88% fill ──
  for (const size of [72, 96]) {
    await generate(
      buildSvg({ width: size, height: size, fillRatio: 0.88, color: WHITE, bgColor: null }),
      join(root, 'public', 'icons', `badge-${size}.png`)
    );
  }

  // ── 8. Notification icons — colored, for notification shade ──
  for (const size of [48, 72, 96, 144]) {
    await generate(
      buildSvg({ width: size, height: size, fillRatio: 0.78, color: WHITE, bgColor: NAVY, rounded: Math.round(size * 0.12) }),
      join(root, 'public', 'icons', `notif-${size}.png`)
    );
  }

  // ── 9. Additional PWA sizes (Android launchers) ──
  for (const size of [48, 72, 96, 144, 384]) {
    await generate(
      buildSvg({ width: size, height: size, fillRatio: 0.78, color: WHITE, bgColor: NAVY, rounded: Math.round(size * 0.12) }),
      join(root, 'public', 'icons', `icon-${size}.png`)
    );
  }

  // ── 10. Twitter/X profile — 400×400 circle ──
  mkdirSync(join(root, 'logo-concepts'), { recursive: true });
  await generate(
    buildCircleSvg({ size: 400, fillRatio: 0.65, color: WHITE, bgColor: NAVY }),
    join(root, 'logo-concepts', 'twitter-profile-400x400.png')
  );

  console.log('\nDone. All logo files generated from locked vector.');
}

main().catch(e => { console.error(e); process.exit(1); });
