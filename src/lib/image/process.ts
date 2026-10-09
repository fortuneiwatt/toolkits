import { limitDimensions } from "./geometry";
import {
  MAX_DIMENSION, canvasToBlob, extensionFor, formatFromMime, resizeCanvas, type ExportFormat,
} from "./raster";

/** What the person picked for the output format. */
export type OutputChoice = "smart" | "same" | ExportFormat;

/**
 * smart: keep JPG and WebP, turn PNG/GIF/BMP into WebP (much smaller, keeps transparency).
 * same:  keep the input format where we can write it, otherwise PNG.
 */
export function resolveFormat(inputMime: string, choice: OutputChoice): ExportFormat {
  if (choice === "png" || choice === "jpeg" || choice === "webp") return choice;
  const known = formatFromMime(inputMime);
  if (choice === "same") return known ?? "png";
  return known === "jpeg" || known === "webp" ? known : "webp";
}

export type ResizeSpec =
  | { kind: "none" }
  | { kind: "fit"; maxWidth: number; maxHeight: number; allowEnlarge: boolean }
  | { kind: "exact"; width: number; height: number }
  | { kind: "percent"; percent: number };

const cap = (width: number, height: number) => {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const { width: cw, height: ch } = limitDimensions(w, h, MAX_DIMENSION);
  return { width: cw, height: ch };
};

/** Work out the output size for an image. Never exceeds MAX_DIMENSION on the longest side. */
export function targetSize(w: number, h: number, spec: ResizeSpec): { width: number; height: number } {
  switch (spec.kind) {
    case "none":
      return cap(w, h);
    case "exact":
      return cap(spec.width, spec.height);
    case "percent":
      return cap((w * spec.percent) / 100, (h * spec.percent) / 100);
    case "fit": {
      let k = Math.min(spec.maxWidth / w, spec.maxHeight / h);
      if (!Number.isFinite(k) || k <= 0) k = 1;
      if (!spec.allowEnlarge) k = Math.min(k, 1);
      return cap(w * k, h * k);
    }
  }
}

export interface ProcessResult {
  blob: Blob;
  width: number;
  height: number;
  /** The format actually written (can differ from the one requested if the browser can't encode it). */
  format: ExportFormat;
  fellBack: boolean;
}

export async function processImage(
  source: HTMLCanvasElement,
  opts: { resize: ResizeSpec; format: ExportFormat; quality: number },
): Promise<ProcessResult> {
  const size = targetSize(source.width, source.height, opts.resize);
  const canvas = size.width === source.width && size.height === source.height ? source : resizeCanvas(source, size.width, size.height);
  const blob = await canvasToBlob(canvas, opts.format, opts.quality);
  const actual = formatFromMime(blob.type) ?? "png";
  return { blob, width: canvas.width, height: canvas.height, format: actual, fellBack: actual !== opts.format };
}

export function baseName(filename: string): string {
  const stem = filename.replace(/\.[^./\\]+$/, "");
  return stem.replace(/[^\w.\- ()]+/g, "-").replace(/^[-.\s]+|[-.\s]+$/g, "").slice(0, 80) || "image";
}

export const outputFileName = (original: string, format: ExportFormat, suffix = "") => `${baseName(original)}${suffix}.${extensionFor(format)}`;

/** Make names unique by adding " (2)", " (3)" before the extension. */
export function dedupeNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const key = n.toLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 1) return n;
    const dot = n.lastIndexOf(".");
    return dot > 0 ? `${n.slice(0, dot)} (${count})${n.slice(dot)}` : `${n} (${count})`;
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Percent smaller (positive) or larger (negative), rounded. */
export const savingsPercent = (before: number, after: number) => (before > 0 ? Math.round((1 - after / before) * 100) : 0);
