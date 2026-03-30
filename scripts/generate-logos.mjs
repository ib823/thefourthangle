/**
 * Generate all T4A logo variants from Satoshi Black font.
 * Each variant is optimized for maximum subject fill per platform spec.
 *
 * Fill ratios:
 * - Header logo: text fills 100% width, tight crop
 * - Favicon: ~90% fill (1px optical margin at 32px)
 * - App icons: ~78% fill (Google Material icon keyline)
 * - Maskable icons: ~58% fill (Android 20% safe zone each side)
 * - Apple touch icon: ~78% fill
 * - Circle icons: ~65% fill (inscribed in circle)
 * - Notification badges: ~88% fill (near edge-to-edge)
 */

import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const fontPath = join(root, 'fonts', 'satoshi', 'Satoshi-Black.ttf');
const fontB64 = readFileSync(fontPath).toString('base64');
const fontFace = `@font-face { font-family: 'Sat'; font-weight: 900; src: url(data:font/ttf;base64,${fontB64}) format('truetype'); }`;

mkdirSync(join(root, 'public', 'icons'), { recursive: true });

const NAVY = '#0f0f23';
const WHITE = '#FFFFFF';
const DARK = '#1A1A1A';
const T = 'T4A';

// Satoshi Black metrics (measured): cap height ~72% of font-size, width of "T4A" ~2.1x cap height
// These ratios let us compute the exact font-size to fill a given canvas.
const CAP_HEIGHT_RATIO = 0.72;
const TEXT_WIDTH_RATIO = 2.05; // width / font-size for "T4A" in Satoshi Black

function buildSvg({ fontSize, color, bgColor, width, height, rounded = 0, text = T }) {
  const bg = bgColor
    ? (rounded > 0
      ? `<rect width="${width}" height="${height}" rx="${rounded}" fill="${bgColor}"/>`
      : `<rect width="${width}" height="${height}" fill="${bgColor}"/>`)
    : '';

  // Vertical centering: baseline = center + (capHeight / 2)
  // capHeight = fontSize * CAP_HEIGHT_RATIO
  const capHeight = fontSize * CAP_HEIGHT_RATIO;
  const baseline = height / 2 + capHeight / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <style>${fontFace}</style>
    ${bg}
    <text
      x="${width / 2}"
      y="${baseline}"
      font-family="Sat, sans-serif"
      font-weight="900"
      font-size="${fontSize}"
      fill="${color}"
      text-anchor="middle"
      letter-spacing="${fontSize * 0.02}"
    >${text}</text>
  </svg>`;
}

function buildCircleSvg({ fontSize, color, bgColor, size, text = T }) {
  const capHeight = fontSize * CAP_HEIGHT_RATIO;
  const baseline = size / 2 + capHeight / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <style>${fontFace}</style>
    <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${bgColor}"/>
    <text
      x="${size / 2}"
      y="${baseline}"
      font-family="Sat, sans-serif"
      font-weight="900"
      font-size="${fontSize}"
      fill="${color}"
      text-anchor="middle"
      letter-spacing="${fontSize * 0.02}"
    >${text}</text>
  </svg>`;
}

// Compute font-size to fill a given width at a target fill ratio
function fontSizeForWidth(targetWidth, fillRatio) {
  return (targetWidth * fillRatio) / TEXT_WIDTH_RATIO;
}

// Compute font-size to fill a given height at a target fill ratio
function fontSizeForHeight(targetHeight, fillRatio) {
  return (targetHeight * fillRatio) / CAP_HEIGHT_RATIO;
}

async function generate(svg, outputPath) {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outputPath);
  console.log(`  ✓ ${outputPath.replace(root + '/', '')}`);
}

async function main() {
  console.log('Generating T4A logos (optimized fill)...\n');

  // 1. Header logo — tight crop, text fills nearly 100% of canvas
  // Canvas is just big enough for the text with 4% optical margin
  const headerFontSize = 140;
  const headerTextWidth = headerFontSize * TEXT_WIDTH_RATIO;
  const headerCapHeight = headerFontSize * CAP_HEIGHT_RATIO;
  const headerMarginX = headerTextWidth * 0.04;
  const headerMarginY = headerCapHeight * 0.12;
  const headerW = Math.ceil(headerTextWidth + headerMarginX * 2);
  const headerH = Math.ceil(headerCapHeight + headerMarginY * 2);
  await generate(
    buildSvg({ fontSize: headerFontSize, color: DARK, bgColor: null, width: headerW, height: headerH }),
    join(root, 'public', 'logo.png')
  );

  // 2. Favicon — 32x32 with navy background for tab visibility
  // Best practice: bold symbol on solid bg, not transparent text lost in tab bar
  const favFs = fontSizeForWidth(32, 0.82);
  await generate(
    buildSvg({ fontSize: favFs, color: WHITE, bgColor: NAVY, width: 32, height: 32, rounded: 6 }),
    join(root, 'public', 'favicon.png')
  );

  // 2b. SVG favicon — scales perfectly at any tab/bookmark size
  const svgFavicon = buildSvg({ fontSize: 24, color: WHITE, bgColor: NAVY, width: 32, height: 32, rounded: 6 });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(root, 'public', 'favicon.svg'), svgFavicon);
  console.log(`  ✓ public/favicon.svg`);

  // 3. App icons — 78% WIDTH fill (width is the constraining dimension for "T4A" in a square)
  for (const size of [192, 512]) {
    const fs = fontSizeForWidth(size, 0.78);
    await generate(
      buildSvg({ fontSize: fs, color: WHITE, bgColor: NAVY, width: size, height: size, rounded: Math.round(size * 0.12) }),
      join(root, 'public', 'icons', `icon-${size}.png`)
    );
  }

  // 4. Maskable icons — 56% WIDTH fill (Android safe zone: center 60% guaranteed)
  for (const size of [192, 512]) {
    const fs = fontSizeForWidth(size, 0.56);
    await generate(
      buildSvg({ fontSize: fs, color: WHITE, bgColor: NAVY, width: size, height: size }),
      join(root, 'public', 'icons', `icon-maskable-${size}.png`)
    );
  }

  // 5. Circle icons — 62% WIDTH fill (inscribed in circle)
  for (const size of [192, 512]) {
    const fs = fontSizeForWidth(size, 0.62);
    await generate(
      buildCircleSvg({ fontSize: fs, color: WHITE, bgColor: NAVY, size }),
      join(root, 'public', 'icons', `icon-circle-${size}.png`)
    );
  }

  // 6. Apple touch icon — 180x180, 78% WIDTH fill
  const appleFs = fontSizeForWidth(180, 0.78);
  await generate(
    buildSvg({ fontSize: appleFs, color: WHITE, bgColor: NAVY, width: 180, height: 180, rounded: Math.round(180 * 0.12) }),
    join(root, 'public', 'icons', 'apple-touch-icon.png')
  );

  // 7. Notification badges — 85% WIDTH fill (near edge-to-edge, monochrome)
  for (const size of [72, 96]) {
    const fs = fontSizeForWidth(size, 0.85);
    await generate(
      buildSvg({ fontSize: fs, color: WHITE, bgColor: null, width: size, height: size }),
      join(root, 'public', 'icons', `badge-${size}.png`)
    );
  }

  // 8. Twitter/X profile — 400x400 circle, T4A 62% width fill
  mkdirSync(join(root, 'logo-concepts'), { recursive: true });
  const twitterFs = fontSizeForWidth(400, 0.62);
  await generate(
    buildCircleSvg({ fontSize: twitterFs, color: WHITE, bgColor: NAVY, size: 400 }),
    join(root, 'logo-concepts', 'twitter-profile-400x400.png')
  );

  console.log('\nDone. 14 logo files generated (optimized fill ratios).');
}

main().catch(e => { console.error(e); process.exit(1); });
