export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Rect from two corner points, in any drag direction. */
export function normalizeRect(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

/** Intersect with [0,w]x[0,h] and snap to whole pixels. Returns null if nothing is left. */
export function clampRect(r: Rect, w: number, h: number): Rect | null {
  const x1 = clamp(Math.floor(r.x), 0, w);
  const y1 = clamp(Math.floor(r.y), 0, h);
  const x2 = clamp(Math.ceil(r.x + r.width), 0, w);
  const y2 = clamp(Math.ceil(r.y + r.height), 0, h);
  if (x2 - x1 < 1 || y2 - y1 < 1) return null;
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

/** Largest scale (never above 1) that fits an image inside a container with padding. */
export function fitScale(containerW: number, containerH: number, imgW: number, imgH: number, padding = 16): number {
  const availW = Math.max(1, containerW - padding * 2);
  const availH = Math.max(1, containerH - padding * 2);
  return Math.min(1, availW / imgW, availH / imgH);
}

/** Scale (w,h) down so the longest side is at most max. Never scales up. */
export function limitDimensions(w: number, h: number, max: number): { width: number; height: number; scaled: boolean } {
  const longest = Math.max(w, h);
  if (longest <= max) return { width: w, height: h, scaled: false };
  const k = max / longest;
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)), scaled: true };
}

/** New size when one dimension is edited, optionally keeping the aspect ratio. */
export function resizeDimensions(
  current: { width: number; height: number },
  edit: { width?: number; height?: number },
  lockAspect: boolean,
  max: number,
): { width: number; height: number } {
  let { width, height } = current;
  if (edit.width !== undefined) {
    width = edit.width;
    if (lockAspect) height = Math.round((edit.width * current.height) / current.width);
  } else if (edit.height !== undefined) {
    height = edit.height;
    if (lockAspect) width = Math.round((edit.height * current.width) / current.height);
  }
  return { width: clamp(Math.round(width) || 1, 1, max), height: clamp(Math.round(height) || 1, 1, max) };
}

/** Zoom keeping the point under the pointer fixed. */
export function zoomAtPoint(
  view: { scale: number; x: number; y: number },
  pointer: Point,
  factor: number,
  min = 0.05,
  max = 8,
) {
  const scale = clamp(view.scale * factor, min, max);
  const k = scale / view.scale;
  return { scale, x: pointer.x - (pointer.x - view.x) * k, y: pointer.y - (pointer.y - view.y) * k };
}
