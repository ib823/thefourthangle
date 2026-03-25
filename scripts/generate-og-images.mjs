/**
 * Generates 1200x630 OG images for each issue.
 * Dark design with "4" brand mark, verdict dots from real stageScores,
 * dual scores (Opinion Shift + Neutrality), and safe-zone compliance.
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
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

// ── The "4" brand mark as SVG path ──
// Traced from public/logo.png — angular geometric "4" with diagonal slash
const LOGO_4_PATH = `
  M 19.5 0 L 8.5 22 L 0 22 L 0 17 L 13.5 17 L 13.5 15.5
  L 4.5 15.5 L 15.5 0 Z
  M 19.5 0 L 19.5 27 L 13.5 27 L 13.5 22 L 8.5 22 L 19.5 0 Z
  M 19.5 17 L 25 17 L 25 22 L 19.5 22 Z
  M 19.5 22 L 19.5 27 L 16.5 27 L 16.5 25 L 17.5 22 Z
`;

function buildSvg(issue) {
  const W = 1200;
  const H = 630;

  // ── Layout constants (safe zone: 120px inset) ──
  const SL = 100;   // safe left
  const SR = 1100;  // safe right
  const ST = 72;    // safe top
  const SB = 560;   // safe bottom (above platform overlays)

  // ── Headline ──
  const headlineLines = wrapText(issue.headline, 32, 2);
  const headlineY = 220;
  const headlineLineHeight = 52;

  const headlineTspans = headlineLines.map((line, i) =>
    `<tspan x="${SL}" dy="${i === 0 ? 0 : headlineLineHeight}">${escapeXml(line)}</tspan>`
  ).join('');

  // ── Context ──
  const contextLines = wrapText(issue.context, 60, 2);
  const contextY = headlineY + (headlineLines.length - 1) * headlineLineHeight + 48;
  const contextLineHeight = 24;

  const contextTspans = contextLines.map((line, i) =>
    `<tspan x="${SL}" dy="${i === 0 ? 0 : contextLineHeight}">${escapeXml(line)}</tspan>`
  ).join('');

  // ── Verdict dots (bottom-left) ──
  const stageKeys = ['pa', 'ba', 'fc', 'af', 'ct', 'sr'];
  const stageLabels = ['PA', 'BA', 'FC', 'AF', 'CT', 'SR'];
  const scores = issue.stageScores || { pa: 50, ba: 50, fc: 50, af: 50, ct: 50, sr: 50 };
  const dotY = SB - 30;
  const dotStartX = SL;
  const dotGap = 36;
  const dotR = 7;

  const dots = stageKeys.map((key, i) => {
    const x = dotStartX + i * dotGap + dotR;
    const color = stageColor(scores[key] || 50);
    return `
      <circle cx="${x}" cy="${dotY}" r="${dotR}" fill="${color}"/>
      <text x="${x}" y="${dotY + 18}" font-family="sans-serif" font-size="9" font-weight="600" fill="#475569" text-anchor="middle" letter-spacing="0.5">${stageLabels[i]}</text>
    `;
  }).join('');

  // ── Dual scores (bottom-right) ──
  const os = issue.opinionShift ?? 0;
  const ns = issue.finalScore ?? 0;
  const nsRounded = Math.round(ns);
  const osColor = opinionShiftColor(os);
  const nsColor = neutralityColor(ns);

  // ── Score bar (full safe-zone width) ──
  const barY = SB + 2;
  const barW = SR - SL;
  const barFill = Math.max(1, Math.round((ns / 100) * barW));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0f0f23"/>

  <!-- Brand mark: "4" logo -->
  <g transform="translate(${SL}, ${ST - 18}) scale(1.1)">
    <path d="${LOGO_4_PATH}" fill="#3B82F6"/>
  </g>
  <text x="${SL + 36}" y="${ST}" font-family="sans-serif" font-size="14" font-weight="700" fill="#3B82F6" letter-spacing="2">THE FOURTH ANGLE</text>

  <!-- Headline -->
  <text x="${SL}" y="${headlineY}" font-family="sans-serif" font-size="42" font-weight="800" fill="#FFFFFF" letter-spacing="-0.5">${headlineTspans}</text>

  <!-- Context -->
  <text x="${SL}" y="${contextY}" font-family="sans-serif" font-size="16" font-weight="400" fill="#94A3B8">${contextTspans}</text>

  <!-- Verdict dots -->
  ${dots}

  <!-- Opinion Shift (bottom-right area) -->
  <text x="${SR - 260}" y="${dotY - 12}" font-family="sans-serif" font-size="10" font-weight="600" fill="#64748B" letter-spacing="1">OPINION SHIFT</text>
  <text x="${SR - 260}" y="${dotY + 12}" font-family="sans-serif" font-size="30" font-weight="800" fill="${osColor}">${os}<tspan font-size="16" fill="${osColor}">%</tspan></text>

  <!-- Separator -->
  <text x="${SR - 140}" y="${dotY + 8}" font-family="sans-serif" font-size="24" fill="#334155">·</text>

  <!-- Neutrality Score -->
  <text x="${SR - 112}" y="${dotY - 12}" font-family="sans-serif" font-size="10" font-weight="600" fill="#64748B" letter-spacing="1">NEUTRALITY</text>
  <text x="${SR - 112}" y="${dotY + 12}" font-family="sans-serif" font-size="30" font-weight="800" fill="${nsColor}">${nsRounded}<tspan font-size="15" fill="#64748B">/100</tspan></text>

  <!-- Score bar -->
  <rect x="${SL}" y="${barY}" width="${barW}" height="3" rx="1.5" fill="#1E293B"/>
  <rect x="${SL}" y="${barY}" width="${barFill}" height="3" rx="1.5" fill="${nsColor}"/>
</svg>`;
}

// ── Generate all images ──
console.log(`Generating OG images for ${issues.length} issues...`);

let count = 0;
let errors = 0;
for (const issue of issues) {
  try {
    const svg = buildSvg(issue);
    const outPath = join(outDir, `issue-${issue.id}.png`);
    await sharp(Buffer.from(svg)).png({ quality: 80, compressionLevel: 9 }).toFile(outPath);
    count++;
    if (count % 100 === 0) console.log(`  ${count}/${issues.length} done`);
  } catch (e) {
    errors++;
    console.error(`  ERROR issue ${issue.id}: ${e.message}`);
  }
}

console.log(`Done: ${count} OG images generated, ${errors} errors.`);
if (errors > 0) process.exit(1);
