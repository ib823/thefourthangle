import sharp from 'sharp';
import path from 'path';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function process() {
  // === LOGO 2B (black mark, transparent bg) — for page content ===
  const buf2B = await sharp(path.join(ROOT, 'Logo 2B.svg'))
    .resize(1024, 1024)
    .png()
    .toBuffer();
  
  const trimmed2B = await sharp(buf2B)
    .trim({ threshold: 30 })
    .toBuffer({ resolveWithObject: true });
  
  console.log('2B trimmed:', trimmed2B.info.width, 'x', trimmed2B.info.height);
  
  // Recolor: pure black -> warm #1F1A14
  const raw2B = await sharp(trimmed2B.data).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = raw2B.info;
  const px = Buffer.from(raw2B.data);
  
  for (let i = 0; i < w * h; i++) {
    const idx = i * ch;
    if (px[idx] < 50 && px[idx+1] < 50 && px[idx+2] < 50 && (ch < 4 || px[idx+3] > 0)) {
      px[idx] = 0x1F; px[idx+1] = 0x1A; px[idx+2] = 0x14;
    }
  }
  
  // Add ~5% padding for breathing room
  const padX = Math.round(w * 0.05);
  const padY = Math.round(h * 0.05);
  await sharp(px, { raw: { width: w, height: h, channels: ch } })
    .extend({ top: padY, bottom: padY, left: padX, right: padX, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(ROOT, 'public/logo.png'));
  console.log('logo.png saved');
  
  // === LOGO 2A (white mark on dark bg) — for favicon/PWA ===
  const buf2A = await sharp(path.join(ROOT, 'logo 2A.svg'))
    .resize(1024, 1024)
    .png()
    .toBuffer();
  
  const raw2A = await sharp(buf2A).raw().toBuffer({ resolveWithObject: true });
  const w2 = raw2A.info.width, h2 = raw2A.info.height, ch2 = raw2A.info.channels;
  const px2 = Buffer.from(raw2A.data);
  
  for (let i = 0; i < w2 * h2; i++) {
    const idx = i * ch2;
    // Black bg -> warm dark #2B231B
    if (px2[idx] < 15 && px2[idx+1] < 15 && px2[idx+2] < 15) {
      px2[idx] = 0x2B; px2[idx+1] = 0x23; px2[idx+2] = 0x1B;
    }
    // White mark -> warm white #F8F5EF
    if (px2[idx] > 240 && px2[idx+1] > 240 && px2[idx+2] > 240) {
      px2[idx] = 0xF8; px2[idx+1] = 0xF5; px2[idx+2] = 0xEF;
    }
  }
  
  await sharp(px2, { raw: { width: w2, height: h2, channels: ch2 } })
    .resize(192, 192).png()
    .toFile(path.join(ROOT, 'public/icons/icon-192.png'));
  console.log('icon-192.png saved');
  
  await sharp(px2, { raw: { width: w2, height: h2, channels: ch2 } })
    .resize(512, 512).png()
    .toFile(path.join(ROOT, 'public/icons/icon-512.png'));
  console.log('icon-512.png saved');
  
  // Verify
  for (const f of ['public/logo.png', 'public/icons/icon-192.png', 'public/icons/icon-512.png']) {
    const m = await sharp(path.join(ROOT, f)).metadata();
    console.log(f + ':', m.width + 'x' + m.height);
  }
}

process().catch(e => console.error(e));
