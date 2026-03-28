/**
 * Generates 1200x630 OG images for each issue.
 * Dark design with "4" brand mark, verdict dots from real stageScores,
 * dual scores (Opinion Shift + Neutrality), and safe-zone compliance.
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ── Parse issues from TypeScript source ──
const tsContent = readFileSync(join(root, 'src', 'data', 'issues.ts'), 'utf8');
const issuesMatch = tsContent.match(/export const ISSUES:\s*Issue\[\]\s*=\s*(\[[\s\S]*\]);?\s*$/m);
if (!issuesMatch) { console.error('Could not find ISSUES'); process.exit(1); }

let issues;
try {
  let arr = issuesMatch[1].replace(/;\s*$/, '');
  issues = eval('(' + arr + ')');
} catch (e) { console.error('Parse error:', e.message); process.exit(1); }

const outDir = join(root, 'public', 'og');
mkdirSync(outDir, { recursive: true });

// ── Helpers ──

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function wrapText(text, maxChars, maxLines) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if ((current + ' ' + word).length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  if (lines.length > maxLines) {
    lines.length = maxLines;
    const last = lines[maxLines - 1];
    const words2 = last.split(/\s+/);
    if (words2.length > 1) {
      words2.pop();
      lines[maxLines - 1] = words2.join(' ') + '...';
    } else {
      lines[maxLines - 1] = last.slice(0, maxChars - 3) + '...';
    }
  }
  return lines;
}

// ── Color system (consistent with app) ──

function opinionShiftColor(score) {
  if (score >= 80) return '#EF4444';
  if (score >= 60) return '#F59E0B';
  if (score >= 40) return '#3B82F6';
  return '#64748B';
}

function neutralityColor(score) {
  if (score >= 75) return '#3B82F6';
  if (score >= 50) return '#EAB308';
  return '#EF4444';
}

function stageColor(score) {
  if (score >= 75) return '#22C55E';
  if (score >= 50) return '#EAB308';
  return '#EF4444';
}

// ── Brand mark font (Satoshi Black) ──
const satoshiPath = join(root, 'logo-concepts', 'satoshi_fonts', 'Satoshi_Complete', 'Fonts', 'OTF', 'Satoshi-Black.otf');
const satoshiB64 = existsSync(satoshiPath) ? readFileSync(satoshiPath).toString('base64') : '';
const FONT_FACE = satoshiB64 ? `<style>@font-face { font-family: 'SB'; font-weight: 900; src: url(data:font/otf;base64,${satoshiB64}) format('opentype'); }</style>` : '';

function buildSvg(issue) {
  const W = 1200;
  const H = 630;
  const CX = W / 2; // center x

  // ── Layout: center-aligned for crop resilience ──
  // Social platforms crop OG images to different ratios (1:1, 4:3, 1.91:1).
  // Center-aligned content survives all crop ratios.
  const ST = 72;    // safe top
  const SB = 540;   // safe bottom

  // ── Headline (centered) ──
  const headlineLines = wrapText(issue.headline, 34, 2);
  const headlineY = 210;
  const headlineLineHeight = 54;

  const headlineTspans = headlineLines.map((line, i) =>
    `<tspan x="${CX}" dy="${i === 0 ? 0 : headlineLineHeight}">${escapeXml(line)}</tspan>`
  ).join('');

  // ── Context (centered) ──
  const contextLines = wrapText(issue.context, 65, 2);
  const contextY = headlineY + (headlineLines.length - 1) * headlineLineHeight + 44;
  const contextLineHeight = 24;

  const contextTspans = contextLines.map((line, i) =>
    `<tspan x="${CX}" dy="${i === 0 ? 0 : contextLineHeight}">${escapeXml(line)}</tspan>`
  ).join('');

  // ── Verdict dots (centered at bottom) ──
  const stageKeys = ['pa', 'ba', 'fc', 'af', 'ct', 'sr'];
  const stageLabels = ['PA', 'BA', 'FC', 'AF', 'CT', 'SR'];
  const scores = issue.stageScores || { pa: 50, ba: 50, fc: 50, af: 50, ct: 50, sr: 50 };
  const dotY = SB;
  const dotGap = 36;
  const dotR = 7;
  const dotsWidth = (stageKeys.length - 1) * dotGap;
  const dotStartX = CX - dotsWidth / 2;

  const dots = stageKeys.map((key, i) => {
    const x = dotStartX + i * dotGap;
    const color = stageColor(scores[key] || 50);
    return `
      <circle cx="${x}" cy="${dotY}" r="${dotR}" fill="${color}"/>
      <text x="${x}" y="${dotY + 18}" font-family="sans-serif" font-size="9" font-weight="600" fill="#475569" text-anchor="middle" letter-spacing="0.5">${stageLabels[i]}</text>
    `;
  }).join('');

  // ── Dual scores (below headline, centered) ──
  const os = issue.opinionShift ?? 0;
  const ns = issue.finalScore ?? 0;
  const nsRounded = Math.round(ns);
  const osColor = opinionShiftColor(os);
  const nsColor = neutralityColor(ns);

  const scoresY = SB + 46;

  // ── Score bar (centered, 400px wide) ──
  const barW = 400;
  const barX = CX - barW / 2;
  const barY = SB + 60;
  const barFill = Math.max(1, Math.round((ns / 100) * barW));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${FONT_FACE}</defs>
  <rect width="${W}" height="${H}" fill="#0f0f23"/>

  <!-- Brand mark (centered top) -->
  <text x="${CX}" y="${ST + 2}" font-family="${satoshiB64 ? 'SB' : 'sans-serif'}" font-weight="900" font-size="28" fill="#3B82F6" text-anchor="middle">4<tspan font-family="sans-serif" font-size="12" font-weight="700" fill="#3B82F6" letter-spacing="2" dx="6">THE FOURTH ANGLE</tspan></text>

  <!-- Headline (centered) -->
  <text x="${CX}" y="${headlineY}" font-family="sans-serif" font-size="42" font-weight="800" fill="#FFFFFF" letter-spacing="-0.5" text-anchor="middle">${headlineTspans}</text>

  <!-- Context (centered) -->
  <text x="${CX}" y="${contextY}" font-family="sans-serif" font-size="16" font-weight="400" fill="#94A3B8" text-anchor="middle">${contextTspans}</text>

  <!-- Verdict dots (centered) -->
  ${dots}

  <!-- Scores row (centered) -->
  <text x="${CX - 30}" y="${scoresY - 16}" font-family="sans-serif" font-size="10" font-weight="600" fill="#64748B" letter-spacing="1" text-anchor="end">OPINION SHIFT</text>
  <text x="${CX - 30}" y="${scoresY + 8}" font-family="sans-serif" font-size="24" font-weight="800" fill="${osColor}" text-anchor="end">${os}<tspan font-size="14" fill="${osColor}">%</tspan></text>

  <text x="${CX}" y="${scoresY}" font-family="sans-serif" font-size="18" fill="#334155" text-anchor="middle">·</text>

  <text x="${CX + 30}" y="${scoresY - 16}" font-family="sans-serif" font-size="10" font-weight="600" fill="#64748B" letter-spacing="1" text-anchor="start">NEUTRALITY</text>
  <text x="${CX + 30}" y="${scoresY + 8}" font-family="sans-serif" font-size="24" font-weight="800" fill="${nsColor}" text-anchor="start">${nsRounded}<tspan font-size="13" fill="#64748B">/100</tspan></text>

  <!-- Score bar (centered) -->
  <rect x="${barX}" y="${barY}" width="${barW}" height="3" rx="1.5" fill="#1E293B"/>
  <rect x="${barX}" y="${barY}" width="${barFill}" height="3" rx="1.5" fill="${nsColor}"/>
</svg>`;
}

// ── AI background directory ──
const bgDir = join(root, 'public', 'og', 'backgrounds');

// ── Generate all images ──
console.log(`Generating OG images for ${issues.length} issues...`);

let count = 0;
let errors = 0;
let withBg = 0;
for (const issue of issues) {
  try {
    const svg = buildSvg(issue);
    const outPath = join(outDir, `issue-${issue.id}.png`);
    const bgPath = join(bgDir, `issue-${issue.id}-bg.png`);

    if (existsSync(bgPath)) {
      // Composite: AI background + dark gradient overlay + SVG data layer
      const bg = await sharp(bgPath).resize(1200, 630, { fit: 'cover' }).toBuffer();
      const gradient = Buffer.from(
        `<svg width="1200" height="630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#0f0f23" stop-opacity="0.3"/><stop offset="40%" stop-color="#0f0f23" stop-opacity="0.75"/><stop offset="100%" stop-color="#0f0f23" stop-opacity="0.92"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/></svg>`
      );
      const overlay = Buffer.from(svg.replace(/<rect width="1200" height="630" fill="#0f0f23"\/>/, ''));

      await sharp(bg)
        .composite([
          { input: await sharp(gradient).toBuffer(), blend: 'over' },
          { input: await sharp(Buffer.from(overlay)).toBuffer(), blend: 'over' },
        ])
        .png({ compressionLevel: 9 })
        .toFile(outPath);
      withBg++;
    } else {
      // Fallback: solid dark background (current behavior)
      await sharp(Buffer.from(svg)).png({ quality: 80, compressionLevel: 9 }).toFile(outPath);
    }
    count++;
    if (count % 100 === 0) console.log(`  ${count}/${issues.length} done`);
  } catch (e) {
    errors++;
    console.error(`  ERROR issue ${issue.id}: ${e.message}`);
  }
}

console.log(`Done: ${count} OG images generated (${withBg} with AI backgrounds), ${errors} errors.`);
if (errors > 0) process.exit(1);
