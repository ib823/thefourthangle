/**
 * Generates 1200x630 OG images for each issue.
 * Reads ISSUES from the TypeScript source, renders SVG, converts to PNG via sharp.
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Extract ISSUES from TypeScript (same eval pattern as build-verifier.mjs)
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
    // Truncate last line with ellipsis
    const last = lines[maxLines - 1];
    if (last.length > maxChars - 3) {
      lines[maxLines - 1] = last.slice(0, maxChars - 3) + '...';
    } else {
      lines[maxLines - 1] = last + '...';
    }
  }
  return lines;
}

function scoreColor(score) {
  if (score >= 80) return '#E03131';
  if (score >= 60) return '#B85C00';
  if (score >= 40) return '#1971C2';
  return '#868E96';
}

function buildSvg(issue) {
  const W = 1200;
  const H = 630;

  const headlineLines = wrapText(issue.headline, 28, 3);
  const contextLines = wrapText(issue.context, 55, 2);

  const headlineY = 250;
  const headlineLineHeight = 54;
  const headlineBottomY = headlineY + (headlineLines.length - 1) * headlineLineHeight;
  const contextY = headlineBottomY + 40;
  const contextLineHeight = 26;

  const headlineTspans = headlineLines.map((line, i) =>
    `<tspan x="60" dy="${i === 0 ? 0 : headlineLineHeight}">${escapeXml(line)}</tspan>`
  ).join('');

  const contextTspans = contextLines.map((line, i) =>
    `<tspan x="60" dy="${i === 0 ? 0 : contextLineHeight}">${escapeXml(line)}</tspan>`
  ).join('');

  // Color bar segments
  const barColors = ['#868E96', '#1971C2', '#1971C2', '#1971C2', '#E03131', '#7048E8'];
  const barY = H - 40;
  const barSegments = barColors.map((color, i) =>
    `<rect x="${i * 200}" y="${barY}" width="200" height="4" fill="${color}"/>`
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#F8F9FA"/>

  <!-- Brand -->
  <text x="60" y="80" font-family="sans-serif" font-size="16" font-weight="700" fill="#212529" letter-spacing="1">${escapeXml('THE FOURTH ANGLE')}</text>

  <!-- Opinion Shift Score -->
  <text x="1140" y="80" font-family="sans-serif" font-size="24" font-weight="800" fill="${scoreColor(issue.opinionShift)}" text-anchor="end">${issue.opinionShift}</text>

  <!-- Headline -->
  <text x="60" y="${headlineY}" font-family="sans-serif" font-size="44" font-weight="800" fill="#212529">${headlineTspans}</text>

  <!-- Context -->
  <text x="60" y="${contextY}" font-family="sans-serif" font-size="18" font-weight="400" fill="#495057">${contextTspans}</text>

  <!-- Color Bar -->
  ${barSegments}

  <!-- Perspectives label -->
  <text x="1140" y="${H - 40}" font-family="sans-serif" font-size="14" fill="#868E96" text-anchor="end">6 perspectives</text>
</svg>`;
}

console.log(`Generating OG images for ${issues.length} issues...`);

let count = 0;
for (const issue of issues) {
  const svg = buildSvg(issue);
  const outPath = join(outDir, `issue-${issue.id}.png`);
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  count++;
  if (count % 10 === 0) console.log(`  ${count}/${issues.length} done`);
}

console.log(`Done: ${count} OG images saved to public/og/`);
