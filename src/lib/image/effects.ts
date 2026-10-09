/** Pure pixel operations on RGBA data. No DOM needed, so they are easy to test. */
export interface Pixels { data: Uint8ClampedArray; width: number; height: number }

export interface Adjustments {
  brightness: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
  grayscale: boolean;
}

export const defaultAdjustments: Adjustments = { brightness: 0, contrast: 0, saturation: 0, grayscale: false };

export const isDefaultAdjustments = (a: Adjustments) =>
  a.brightness === 0 && a.contrast === 0 && a.saturation === 0 && !a.grayscale;

function blurPass(p: Pixels, r: number, horizontal: boolean) {
  const { data, width, height } = p;
  const len = horizontal ? width : height;
  const lines = horizontal ? height : width;
  const stride = horizontal ? 4 : width * 4;
  const lineStride = horizontal ? width * 4 : 4;
  const win = 2 * r + 1;
  const tmp = new Uint8ClampedArray(len * 4);
  const at = (i: number) => (i < 0 ? 0 : i >= len ? len - 1 : i) * 4;

  for (let line = 0; line < lines; line++) {
    const base = line * lineStride;
    for (let i = 0; i < len; i++) for (let c = 0; c < 4; c++) tmp[i * 4 + c] = data[base + i * stride + c];
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += tmp[at(k) + c];
      for (let i = 0; i < len; i++) {
        data[base + i * stride + c] = Math.round(sum / win);
        sum += tmp[at(i + r + 1) + c] - tmp[at(i - r) + c];
      }
    }
  }
}

/** Approximate Gaussian blur (three box-blur passes). Edges are clamped. */
export function boxBlur(p: Pixels, radius: number, passes = 3) {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) return;
  for (let i = 0; i < passes; i++) {
    blurPass(p, r, true);
    blurPass(p, r, false);
  }
}

/** Replace each block x block cell with its average colour. */
export function pixelate(p: Pixels, block: number) {
  const b = Math.max(1, Math.round(block));
  const { data, width, height } = p;
  for (let by = 0; by < height; by += b) {
    for (let bx = 0; bx < width; bx += b) {
      const x2 = Math.min(bx + b, width);
      const y2 = Math.min(by + b, height);
      const sum = [0, 0, 0, 0];
      for (let y = by; y < y2; y++) for (let x = bx; x < x2; x++) for (let c = 0; c < 4; c++) sum[c] += data[(y * width + x) * 4 + c];
      const n = (x2 - bx) * (y2 - by);
      const avg = sum.map((s) => Math.round(s / n));
      for (let y = by; y < y2; y++) for (let x = bx; x < x2; x++) for (let c = 0; c < 4; c++) data[(y * width + x) * 4 + c] = avg[c];
    }
  }
}

/** Overwrite every pixel with one opaque colour. This destroys the original pixels. */
export function fillSolid(p: Pixels, r = 0, g = 0, b = 0) {
  const { data } = p;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
  }
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Brightness, contrast, saturation and grayscale, applied in that order. */
export function applyAdjustments(p: Pixels, a: Adjustments) {
  if (isDefaultAdjustments(a)) return;
  const { data } = p;
  const add = a.brightness * 2.55;
  const c255 = a.contrast * 2.55;
  const cf = (259 * (c255 + 255)) / (255 * (259 - c255));
  const sf = 1 + a.saturation / 100;
  for (let i = 0; i < data.length; i += 4) {
    let r = clamp255(data[i] + add);
    let g = clamp255(data[i + 1] + add);
    let b = clamp255(data[i + 2] + add);
    r = clamp255(cf * (r - 128) + 128);
    g = clamp255(cf * (g - 128) + 128);
    b = clamp255(cf * (b - 128) + 128);
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    if (a.grayscale) {
      r = g = b = l;
    } else if (a.saturation !== 0) {
      r = l + (r - l) * sf;
      g = l + (g - l) * sf;
      b = l + (b - l) * sf;
    }
    data[i] = r; data[i + 1] = g; data[i + 2] = b; // Uint8ClampedArray clamps and rounds
  }
}
