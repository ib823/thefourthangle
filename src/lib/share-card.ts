/**
 * Generates a shareable card image (V2 — "The Attribution").
 *
 * 1080×1350 (4:5) — zero crop on Instagram, Facebook, Twitter, WhatsApp, Telegram, LinkedIn.
 * Statement centered → logo + wordmark as attribution → URL at bottom.
 *
 * Uses Canvas API directly for pixel-perfect cross-browser output.
 * Fonts loaded via document.fonts before drawing.
 */

const W = 1080;
const H = 1350;

function wrapText(ctx: CanvasRenderingContext2D, str: string, maxWidth: number): string[] {
  const words = str.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export type CardVariant = 'black' | 'white';

export async function generateShareCard(
  text: string,
  variant: CardVariant = 'black'
): Promise<Blob> {
  // Ensure fonts are ready
  await document.fonts.load('bold 42px "Manrope"');
  await document.fonts.load('bold 17px "Manrope"');
  await document.fonts.load('13px "Nunito Sans"');

  const isBlack = variant === 'black';
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = isBlack ? '#000000' : '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  const cx = W / 2;
  const maxTextW = W - 180;

  // ── Measure to center the statement+attribution block ──
  ctx.font = 'bold 42px "Manrope"';
  const lines = wrapText(ctx, text, maxTextW);
  const lineH = 60;
  const textH = lines.length * lineH;
  const gap = 52;
  const logoH = 28;
  const brandH = logoH + 14 + 17 + 22 + 12; // logo + spacing + wordmark + spacing + tagline
  const totalH = textH + gap + brandH;
  let y = (H - totalH) / 2 - 30;

  // ── STATEMENT ──
  ctx.font = 'bold 42px "Manrope"';
  ctx.fillStyle = isBlack ? '#FFFFFF' : '#111111';
  for (const line of lines) {
    ctx.fillText(line, cx, y);
    y += lineH;
  }

  // ── ATTRIBUTION ──
  y += gap;

  // Logo
  try {
    const logo = await loadImg('/logo.png');
    const lw = logoH * (logo.width / logo.height);
    if (!isBlack) {
      ctx.globalAlpha = 0.92;
      ctx.drawImage(logo, cx - lw / 2, y, lw, logoH);
      ctx.globalAlpha = 1;
    } else {
      // Invert logo for dark background using offscreen canvas
      const inv = document.createElement('canvas');
      inv.width = logo.width;
      inv.height = logo.height;
      const ictx = inv.getContext('2d')!;
      ictx.drawImage(logo, 0, 0);
      ictx.globalCompositeOperation = 'difference';
      ictx.fillStyle = '#FFFFFF';
      ictx.fillRect(0, 0, inv.width, inv.height);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(inv, cx - lw / 2, y, lw, logoH);
      ctx.globalAlpha = 1;
    }
  } catch {
    // Logo failed — skip silently
  }
  y += logoH + 14;

  // Wordmark
  ctx.font = 'bold 17px "Manrope"';
  ctx.fillStyle = isBlack ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.7)';
  ctx.fillText('The Fourth Angle', cx, y);
  y += 22;

  // Tagline
  ctx.font = '12px "Nunito Sans"';
  ctx.fillStyle = isBlack ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  ctx.fillText('Read past the first telling.', cx, y);

  // ── URL at bottom ──
  ctx.font = '13px "Nunito Sans"';
  ctx.fillStyle = isBlack ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)';
  ctx.fillText('thefourthangle.pages.dev', cx, H - 56);

  ctx.textAlign = 'left';

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}

export async function shareCardAsImage(text: string, variant: CardVariant = 'black'): Promise<void> {
  const blob = await generateShareCard(text, variant);
  const file = new File([blob], 'the-fourth-angle.png', { type: 'image/png' });

  // Try native share with file
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch {
      // User cancelled or share failed — fall through to download
    }
  }

  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'the-fourth-angle.png';
  a.click();
  URL.revokeObjectURL(url);
}
