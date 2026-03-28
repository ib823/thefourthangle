/**
 * Post-build stealth hardening script.
 * Strips all framework-identifiable markers from the dist/ output.
 */
import { readdir, readFile, writeFile, rename, unlink } from 'fs/promises';
import { join, basename } from 'path';

const DIST = new URL('../dist', import.meta.url).pathname;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...await walk(p));
    else files.push(p);
  }
  return files;
}

function shortHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).slice(0, 8);
}

// Strip non-essential PNG chunks (keep only IHDR, IDAT, IEND)
function stripPngMetadata(buf) {
  if (buf[0] !== 0x89 || buf[1] !== 0x50) return buf; // not a PNG
  const sig = buf.subarray(0, 8);
  const chunks = [];
  let offset = 8;
  const keep = new Set(['IHDR', 'IDAT', 'IEND', 'sRGB', 'tRNS', 'PLTE']);
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
    const chunkTotal = 12 + len;
    if (keep.has(type)) {
      chunks.push(buf.subarray(offset, offset + chunkTotal));
    }
    offset += chunkTotal;
  }
  return Buffer.concat([sig, ...chunks]);
}

async function main() {
  const files = await walk(DIST);
  const renames = new Map();

  // ── PHASE 1: Compute JS file renames ──
  for (const f of files) {
    const base = basename(f);
    if (!base.endsWith('.js')) continue;
    if (!f.includes('/_a/')) continue;
    const stem = base.replace('.js', '');
    const dotParts = stem.split('.');
    if (dotParts.length >= 2) {
      const hash = dotParts[dotParts.length - 1];
      const newBase = `${hash}.js`;
      if (newBase !== base) renames.set(base, newBase);
    } else {
      const hash = shortHash(base + Date.now());
      renames.set(base, `${hash}.js`);
    }
  }

  // ── PHASE 2: Rename JS files ──
  for (const [oldBase, newBase] of renames) {
    try { await rename(join(DIST, '_a', oldBase), join(DIST, '_a', newBase)); } catch {}
  }

  // ── PHASE 3: Process all HTML files ──
  const htmlFiles = files.filter(f => f.endsWith('.html'));
  for (const f of htmlFiles) {
    let html = await readFile(f, 'utf8');

    // Astro custom elements
    html = html.replace(/astro-island/g, 'd-island');
    html = html.replace(/astro-slot/g, 'd-slot');
    html = html.replace(/astro-static-slot/g, 'd-ss');

    // Astro globals and events
    html = html.replace(/self\.Astro/g, 'self._R');
    html = html.replace(/\bAstro\b/g, '_R');
    html = html.replace(/astro:load/g, '_r:l');
    html = html.replace(/astro:unmount/g, '_r:u');
    html = html.replace(/astro:hydrate/g, '_r:h');
    html = html.replace(/astro:after-swap/g, '_r:s');
    html = html.replace(/astro:end/g, '_r:e');
    html = html.replace(/astro:idle/g, '_r:i');
    html = html.replace(/astro:visible/g, '_r:v');
    html = html.replace(/astro:media/g, '_r:m');
    html = html.replace(/astro:/g, '_r:');

    // Svelte patterns in inline scripts (gap fix)
    html = html.replace(/window\.__svelte/g, 'window._s');
    html = html.replace(/svelte\.dev\/e\/[a-z_]*/g, '');
    html = html.replace(/svelte-[a-z0-9]+/g, (m) => '_' + shortHash(m));

    // Strip HTML comments
    html = html.replace(/<!--[\s\S]*?-->/g, '');

    // Rename data-astro-* attributes to generic names (not strip — JS references them)
    html = html.replace(/data-astro-template/g, 'data-t');
    html = html.replace(/data-astro-[a-z-]+/g, 'data-x');

    // Strip component names from opts
    html = html.replace(/"name":"[A-Za-z]+"/g, '"name":"c"');

    // Apply file renames
    for (const [oldBase, newBase] of renames) {
      html = html.replaceAll(oldBase, newBase);
    }

    await writeFile(f, html, 'utf8');
  }

  // ── PHASE 4: Process all JS files ──
  const jsDir = join(DIST, '_a');
  let jsFiles;
  try { jsFiles = (await readdir(jsDir)).filter(f => f.endsWith('.js')); } catch { jsFiles = []; }
  for (const base of jsFiles) {
    const f = join(jsDir, base);
    let js = await readFile(f, 'utf8');

    js = js.replace(/https:\/\/svelte\.dev\/e\/[a-z_]*/g, '');
    js = js.replace(/window\.__svelte/g, 'window._s');
    js = js.replace(/\(window\._s\?\?=\{\}\)/g, '(window._s??={})');
    js = js.replace(/svelte-trusted-html/g, '_th');
    js = js.replace(/Failed to hydrate/g, 'Load error');
    js = js.replace(/astro-slot/g, 'd-slot');
    js = js.replace(/self\.Astro/g, 'self._R');
    js = js.replace(/astro:/g, '_r:');
    js = js.replace(/svelte-[a-z0-9]+/g, (m) => '_' + shortHash(m));

    for (const [oldBase, newBase] of renames) {
      js = js.replaceAll(oldBase, newBase);
    }

    await writeFile(f, js, 'utf8');
  }

  // ── PHASE 5: Process CSS files ──
  let cssFiles;
  try { cssFiles = (await readdir(jsDir)).filter(f => f.endsWith('.css')); } catch { cssFiles = []; }
  for (const base of cssFiles) {
    const f = join(jsDir, base);
    let css = await readFile(f, 'utf8');
    css = css.replace(/svelte-[a-z0-9]+/g, (m) => '_' + shortHash(m));
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');
    await writeFile(f, css, 'utf8');
  }

  // ── PHASE 6: Remove unused files ──
  try { await unlink(join(DIST, 'fonts', 'playfair-latin.woff2')); } catch {}
  try { await unlink(join(DIST, 'favicon.ico')); } catch {}
  try { await unlink(join(DIST, 'favicon.svg')); } catch {}

  // ── PHASE 7: Strip image metadata (PNG chunks + JPEG EXIF) ──
  const pngFiles = files.filter(f => f.endsWith('.png'));
  for (const f of pngFiles) {
    try {
      const buf = await readFile(f);
      const stripped = stripPngMetadata(buf);
      if (stripped.length < buf.length) {
        await writeFile(f, stripped);
      }
    } catch {}
  }

  // Strip JPEG EXIF (if any user-uploaded JPEGs exist)
  const jpgFiles = files.filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg'));
  for (const f of jpgFiles) {
    try {
      const buf = await readFile(f);
      // JPEG EXIF starts with FF D8 FF E1 — strip APP1 segment
      if (buf[0] === 0xFF && buf[1] === 0xD8) {
        let offset = 2;
        const cleaned = [buf.subarray(0, 2)]; // keep SOI marker
        while (offset < buf.length - 1) {
          if (buf[offset] !== 0xFF) break;
          const marker = buf[offset + 1];
          if (marker === 0xDA) { // Start of scan — rest is pixel data, keep all
            cleaned.push(buf.subarray(offset));
            break;
          }
          const segLen = buf.readUInt16BE(offset + 2);
          // Strip APP1 (EXIF), APP2 (ICC profile metadata), APP13 (IPTC)
          if (marker === 0xE1 || marker === 0xE2 || marker === 0xED) {
            // Skip this segment (strip it)
          } else {
            cleaned.push(buf.subarray(offset, offset + 2 + segLen));
          }
          offset += 2 + segLen;
        }
        const result = Buffer.concat(cleaned);
        if (result.length < buf.length) {
          await writeFile(f, result);
        }
      }
    } catch {}
  }

  // ── PHASE 8: Verification scan ──
  // Word-boundary patterns to avoid false positives like "astronaut"
  const DANGEROUS = [
    // Framework identifiers
    { term: 'astro', regex: /\bastro\b(?!naut|nom|logy|phys)/gi },
    { term: 'svelte', regex: /\bsvelte\b/gi },
    { term: 'vercel', regex: /\bvercel\b/gi },
    { term: 'thefourthangle.vercel', regex: /thefourthangle\.vercel/gi },
    // Identity traces
    { term: 'github', regex: /\bgithub\b/gi },
    { term: 'codespace', regex: /\bcodespace\b/gi },
    { term: 'ib823', regex: /ib823/gi },
    { term: 'fa-ops', regex: /fa-ops/gi },
    { term: 'fa-ops@proton', regex: /fa-ops@proton/gi },
    // AI/model references (editorial policy)
    { term: 'claude', regex: /\bclaude\b(?!\.md)/gi },
    { term: 'openai', regex: /\bopenai\b/gi },
    { term: 'chatgpt', regex: /\bchatgpt\b/gi },
    { term: 'gpt-4', regex: /\bgpt-4\b/gi },
    { term: 'anthropic', regex: /\banthropic\b/gi },
    { term: 'deepseek', regex: /\bdeepseek\b/gi },
    { term: 'gemini', regex: /\bgemini\b/gi },
    { term: 'language model', regex: /language model/gi },
    { term: 'LLM', regex: /\bLLM\b/g },
    // Local paths
    { term: '/workspaces/', regex: /\/workspaces\//gi },
    { term: '/home/codespace', regex: /\/home\/codespace/gi },
    { term: 'node_modules', regex: /node_modules/gi },
  ];
  const allFiles = await walk(DIST);
  let violations = 0;
  for (const f of allFiles) {
    if (f.endsWith('.png') || f.endsWith('.woff2') || f.endsWith('.ico')) continue;
    const content = await readFile(f, 'utf8');
    for (const { term, regex } of DANGEROUS) {
      regex.lastIndex = 0;
      const matches = content.match(regex);
      if (matches) {
        console.error(`  VIOLATION: "${term}" found ${matches.length}x in ${basename(f)}`);
        violations++;
      }
    }
  }

  // ── Report ──
  console.log('Stealth hardening complete:');
  console.log(`  HTML: ${htmlFiles.length}, JS: ${jsFiles.length}, CSS: ${cssFiles.length}`);
  console.log(`  Renames: ${renames.size}`);
  console.log(`  PNGs stripped: ${pngFiles.length}`);
  if (violations > 0) {
    console.error(`  ⚠ ${violations} STEALTH VIOLATIONS FOUND — review above`);
    process.exit(1);
  } else {
    console.log(`  ✓ Zero stealth violations. Clean for deployment.`);
  }
}

main().catch(e => { console.error('Stealth script failed:', e); process.exit(1); });
