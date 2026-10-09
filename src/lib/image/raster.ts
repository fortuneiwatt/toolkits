import { boxBlur, fillSolid, pixelate, applyAdjustments, type Adjustments } from "./effects";
import { clampRect, limitDimensions, type Rect } from "./geometry";

/** Longest side we keep in memory. Larger images are downscaled on import (mobile canvases fail above this). */
export const MAX_DIMENSION = 4096;
/** Reject files bigger than this before decoding. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Reject images with more pixels than this (decompression-bomb guard). */
export const MAX_SOURCE_PIXELS = 120_000_000;
/** SVG is intentionally excluded: it is a document format that can carry scripts. */
export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"] as const;

export type ExportFormat = "png" | "jpeg" | "webp";
export const mimeFor = (f: ExportFormat) => `image/${f}`;
export const extensionFor = (f: ExportFormat) => (f === "jpeg" ? "jpg" : f);

export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return "That file type isn't supported. Use PNG, JPG, WebP, GIF or BMP.";
  if (file.size > MAX_FILE_BYTES) return "That file is larger than 25 MB. Try a smaller image.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

const ctxOf = (c: HTMLCanvasElement) => {
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available in this browser.");
  return ctx;
};

export function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = createCanvas(src.width, src.height);
  ctxOf(c).drawImage(src, 0, 0);
  return c;
}

/** Draw any image source onto a new canvas, downscaling to MAX_DIMENSION if needed. */
export function canvasFromSource(source: CanvasImageSource, w: number, h: number) {
  const { width, height, scaled } = limitDimensions(w, h, MAX_DIMENSION);
  const c = createCanvas(width, height);
  const ctx = ctxOf(c);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return { canvas: c, downscaled: scaled, originalWidth: w, originalHeight: h };
}

export function cropCanvas(src: HTMLCanvasElement, rect: Rect): HTMLCanvasElement | null {
  const r = clampRect(rect, src.width, src.height);
  if (!r) return null;
  const c = createCanvas(r.width, r.height);
  ctxOf(c).drawImage(src, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
  return c;
}

/** turns: 1 = 90° clockwise, -1 = 90° counter-clockwise, 2 = 180°. */
export function rotateCanvas(src: HTMLCanvasElement, turns: 1 | -1 | 2): HTMLCanvasElement {
  const swap = turns !== 2;
  const c = createCanvas(swap ? src.height : src.width, swap ? src.width : src.height);
  const ctx = ctxOf(c);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

export function flipCanvas(src: HTMLCanvasElement, axis: "horizontal" | "vertical"): HTMLCanvasElement {
  const c = createCanvas(src.width, src.height);
  const ctx = ctxOf(c);
  if (axis === "horizontal") { ctx.translate(src.width, 0); ctx.scale(-1, 1); }
  else { ctx.translate(0, src.height); ctx.scale(1, -1); }
  ctx.drawImage(src, 0, 0);
  return c;
}

export function resizeCanvas(src: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  const c = createCanvas(width, height);
  const ctx = ctxOf(c);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

export type RegionEffect = "blur" | "pixelate" | "redact";

/**
 * Returns a NEW canvas with the effect burned into the pixels inside rect.
 * Redaction and pixelation are destructive on purpose: the original pixels cannot be recovered
 * from the exported file, unlike an overlay shape.
 */
export function applyRegionEffect(src: HTMLCanvasElement, rect: Rect, effect: RegionEffect, strength: number): HTMLCanvasElement | null {
  const r = clampRect(rect, src.width, src.height);
  if (!r) return null;
  const out = cloneCanvas(src);
  const ctx = ctxOf(out);
  const img = ctx.getImageData(r.x, r.y, r.width, r.height);
  if (effect === "redact") fillSolid(img, 0, 0, 0);
  else if (effect === "pixelate") pixelate(img, strength);
  else boxBlur(img, strength);
  ctx.putImageData(img, r.x, r.y);
  return out;
}

/** Returns a NEW canvas with brightness/contrast/saturation/grayscale applied. */
export function adjustedCanvas(src: HTMLCanvasElement, adj: Adjustments): HTMLCanvasElement {
  const out = cloneCanvas(src);
  const ctx = ctxOf(out);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  applyAdjustments(img, adj);
  ctx.putImageData(img, 0, 0);
  return out;
}

/** Encode a canvas. JPEG has no transparency, so it is composited onto white first. */
export function canvasToBlob(src: HTMLCanvasElement, format: ExportFormat, quality: number): Promise<Blob> {
  let source = src;
  if (format === "jpeg") {
    source = createCanvas(src.width, src.height);
    const ctx = ctxOf(source);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, source.width, source.height);
    ctx.drawImage(src, 0, 0);
  }
  return new Promise((resolve, reject) =>
    source.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not export this image."))), mimeFor(format), quality),
  );
}

export const formatFromMime = (mime: string): ExportFormat | null =>
  mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpeg" : mime === "image/webp" ? "webp" : null;
