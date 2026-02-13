/**
 * Helper functions for PNG export
 * Breaks down the large exportToPng function into focused, testable pieces
 */

import type { Canvas, CanvasRenderingContext2D } from 'canvas';
import { loadImage } from 'canvas';
import QRCode from 'qrcode';

export interface PngDrawContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  theme: 'dark' | 'light';
  padding: number;
  fontSize: number;
  lineHeight: number;
}

export interface ContentArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Create and setup canvas for PNG export
 */
export function setupCanvas(
  createCanvasFn: (width: number, height: number) => Canvas,
  width: number,
  height: number,
  theme: 'dark' | 'light',
  headerInfo: { gradient: [string, string] }
): CanvasRenderingContext2D {
  const canvas = createCanvasFn(width, height);
  const ctx = canvas.getContext('2d');

  // Draw background gradient
  const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
  if (theme === 'dark') {
    bgGradient.addColorStop(0, headerInfo.gradient[0]);
    bgGradient.addColorStop(1, headerInfo.gradient[1]);
  } else {
    bgGradient.addColorStop(0, '#f8f9fa');
    bgGradient.addColorStop(1, '#e9ecef');
  }
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  return ctx;
}

/**
 * Calculate content area boundaries
 */
export function calculateContentArea(
  width: number,
  height: number,
  padding: number,
  watermark: boolean
): ContentArea {
  const boxX = padding;
  const boxY = 70;
  const boxWidth = width - padding * 2;
  const boxHeight = height - 70 - padding - (watermark ? 50 : 0);

  return { x: boxX, y: boxY, width: boxWidth, height: boxHeight };
}

/**
 * Draw terminal-style window box
 */
export function drawTerminalBox(
  ctx: CanvasRenderingContext2D,
  area: ContentArea,
  theme: 'dark' | 'light',
  drawRoundedRectFn: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => void
): void {
  // Terminal window background
  ctx.fillStyle = theme === 'dark' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.9)';
  drawRoundedRectFn(ctx, area.x, area.y, area.width, area.height, 12);
  ctx.fill();

  // Terminal window border
  ctx.strokeStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
  ctx.lineWidth = 1;
  drawRoundedRectFn(ctx, area.x, area.y, area.width, area.height, 12);
  ctx.stroke();
}

/**
 * Draw terminal window header with control dots
 */
export function drawTerminalHeader(
  ctx: CanvasRenderingContext2D,
  width: number,
  area: ContentArea,
  theme: 'dark' | 'light',
  headerInfo: { emoji: string; title: string },
  drawRoundedRectFn: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => void
): void {
  // Draw header bar background
  ctx.fillStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
  drawRoundedRectFn(ctx, area.x, area.y, area.width, 32, 12);
  ctx.fill();

  // Draw window controls (red, yellow, green dots)
  const dotY = area.y + 16;
  const dotRadius = 6;
  const dotColors = ['#ff5f56', '#ffbd2e', '#27ca40'];
  for (let i = 0; i < 3; i++) {
    const dotColor = dotColors[i];
    if (!dotColor) continue;
    ctx.beginPath();
    ctx.arc(area.x + 20 + i * 20, dotY, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();
  }

  // Draw title in header
  ctx.font = `bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
  ctx.textAlign = 'center';
  ctx.fillText(`${headerInfo.emoji} ${headerInfo.title}`, width / 2, area.y + 20);
}

/**
 * Draw text content with ANSI styling
 */
export function drawTextContent(
  ctx: CanvasRenderingContext2D,
  area: ContentArea,
  fontSize: number,
  lineHeight: number,
  parsedLines: Array<{
    segments: Array<{ text: string; color: string; bold?: boolean; italic?: boolean }>;
  }>
): void {
  ctx.textAlign = 'left';
  let y = area.y + 50;
  const textX = area.x + 20;

  for (const line of parsedLines) {
    let x = textX;

    for (const segment of line.segments) {
      // Set font based on style
      const fontWeight = segment.bold ? 'bold' : 'normal';
      const fontStyle = segment.italic ? 'italic' : 'normal';
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "JetBrains Mono", "Fira Code", "SF Mono", Menlo, Monaco, "Courier New", monospace`;
      ctx.fillStyle = segment.color;

      // Draw text
      ctx.fillText(segment.text, x, y);
      x += ctx.measureText(segment.text).width;
    }

    y += fontSize * lineHeight;
  }
}

/**
 * Draw watermark at bottom of image
 */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: 'dark' | 'light',
  hasQrCode: boolean
): void {
  const watermarkY = height - 25;
  ctx.font = `bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';
  ctx.textAlign = 'center';

  // Adjust watermark text position if QR code is present
  const watermarkText = hasQrCode
    ? '\u{1F47B} Generated by Specter  |  Scan to explore \u2192'
    : '\u{1F47B} Generated by Specter  |  Share your code story';
  const watermarkX = hasQrCode ? (width - 100) / 2 : width / 2;
  ctx.fillText(watermarkText, watermarkX, watermarkY);
}

/**
 * Draw QR code if URL provided
 */
export async function drawQrCode(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  padding: number,
  qrUrl: string,
  theme: 'dark' | 'light',
  drawRoundedRectFn: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) => void
): Promise<void> {
  try {
    const qrSize = 80;
    const qrX = width - padding - qrSize;
    const qrY = height - padding - qrSize + 10;

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: qrSize,
      margin: 1,
      color: {
        dark: theme === 'dark' ? '#ffffff' : '#000000',
        light: theme === 'dark' ? '#00000000' : '#ffffff00', // transparent background
      },
    });

    // Load and draw QR code image
    const qrImage = await loadImage(qrDataUrl);

    // Draw subtle background for QR code
    ctx.fillStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
    drawRoundedRectFn(ctx, qrX - 5, qrY - 5, qrSize + 10, qrSize + 10, 8);
    ctx.fill();

    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
  } catch (err) {
    // QR code generation failed, continue without it
    console.warn('Failed to generate QR code:', err);
  }
}
