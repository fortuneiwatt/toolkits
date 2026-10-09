import { clampRect, fitScale, limitDimensions, normalizeRect, resizeDimensions, zoomAtPoint } from "@/lib/image/geometry";
import { applyAdjustments, boxBlur, defaultAdjustments, fillSolid, pixelate, type Pixels } from "@/lib/image/effects";
import { canRedo, canUndo, createHistory, pushState, redoState, undoState } from "@/lib/image/history";
import {
  adjustedCanvas, applyRegionEffect, canvasToBlob, createCanvas, cropCanvas, flipCanvas, resizeCanvas, rotateCanvas, validateImageFile,
} from "@/lib/image/raster";

const px = (w: number, h: number, fn: (x: number, y: number) => [number, number, number, number]): Pixels => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(fn(x, y), (y * w + x) * 4);
  return { data, width: w, height: h };
};
const at = (p: Pixels, x: number, y: number) => Array.from(p.data.slice((y * p.width + x) * 4, (y * p.width + x) * 4 + 4));

function paint(c: HTMLCanvasElement, fn: (x: number, y: number) => string) {
  const ctx = c.getContext("2d")!;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { ctx.fillStyle = fn(x, y); ctx.fillRect(x, y, 1, 1); }
}
const px1 = (c: HTMLCanvasElement, x: number, y: number) => Array.from(c.getContext("2d")!.getImageData(x, y, 1, 1).data);

describe("geometry", () => {
  it("normalises drags in any direction", () => expect(normalizeRect({ x: 10, y: 20 }, { x: 4, y: 5 })).toEqual({ x: 4, y: 5, width: 6, height: 15 }));
  it("clamps rects to the image and rejects empty ones", () => {
    expect(clampRect({ x: -5, y: -5, width: 20, height: 20 }, 10, 10)).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    expect(clampRect({ x: 20, y: 20, width: 5, height: 5 }, 10, 10)).toBeNull();
    expect(clampRect({ x: 2, y: 2, width: 0.2, height: 0.2 }, 10, 10)?.width).toBe(1);
  });
  it("fits without upscaling", () => {
    expect(fitScale(1000, 800, 500, 400)).toBe(1);
    expect(fitScale(500, 400, 1000, 800, 0)).toBe(0.5);
  });
  it("limits dimensions", () => {
    expect(limitDimensions(8000, 4000, 4000)).toEqual({ width: 4000, height: 2000, scaled: true });
    expect(limitDimensions(100, 50, 4000).scaled).toBe(false);
  });
  it("resizes with and without aspect lock", () => {
    expect(resizeDimensions({ width: 400, height: 200 }, { width: 200 }, true, 4096)).toEqual({ width: 200, height: 100 });
    expect(resizeDimensions({ width: 400, height: 200 }, { height: 300 }, false, 4096)).toEqual({ width: 400, height: 300 });
    expect(resizeDimensions({ width: 400, height: 200 }, { width: 99999 }, false, 4096).width).toBe(4096);
    expect(resizeDimensions({ width: 400, height: 200 }, { width: NaN }, false, 4096).width).toBe(1);
  });
  it("zooms around the pointer", () => {
    const v = zoomAtPoint({ scale: 1, x: 0, y: 0 }, { x: 100, y: 100 }, 2);
    expect(v).toEqual({ scale: 2, x: -100, y: -100 });
    expect(zoomAtPoint({ scale: 8, x: 0, y: 0 }, { x: 0, y: 0 }, 2).scale).toBe(8);
  });
});

describe("pixel effects", () => {
  it("redact overwrites every pixel", () => {
    const p = px(3, 3, () => [200, 100, 50, 255]);
    fillSolid(p);
    expect(at(p, 1, 1)).toEqual([0, 0, 0, 255]);
  });
  it("pixelate averages each block", () => {
    const p = px(2, 1, (x) => (x === 0 ? [0, 0, 0, 255] : [100, 100, 100, 255]));
    pixelate(p, 2);
    expect(at(p, 0, 0)).toEqual([50, 50, 50, 255]);
    expect(at(p, 1, 0)).toEqual([50, 50, 50, 255]);
  });
  it("blur smooths a hard edge and keeps flat areas unchanged", () => {
    const edge = px(9, 1, (x) => (x < 4 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    boxBlur(edge, 1);
    expect(at(edge, 4, 0)[0]).toBeGreaterThan(0);
    expect(at(edge, 3, 0)[0]).toBeGreaterThan(0);
    expect(at(edge, 3, 0)[0]).toBeLessThan(at(edge, 4, 0)[0]);
    const flat = px(5, 5, () => [80, 80, 80, 255]);
    boxBlur(flat, 2);
    expect(at(flat, 2, 2)).toEqual([80, 80, 80, 255]);
  });
  it("adjustments: defaults are a no-op, brightness/grayscale/saturation behave", () => {
    const p = px(1, 1, () => [100, 50, 150, 255]);
    applyAdjustments(p, defaultAdjustments);
    expect(at(p, 0, 0)).toEqual([100, 50, 150, 255]);

    const bright = px(1, 1, () => [100, 100, 100, 255]);
    applyAdjustments(bright, { ...defaultAdjustments, brightness: 50 });
    expect(at(bright, 0, 0)[0]).toBeGreaterThan(200);

    const gray = px(1, 1, () => [255, 0, 0, 255]);
    applyAdjustments(gray, { ...defaultAdjustments, grayscale: true });
    const [r, g, b] = at(gray, 0, 0);
    expect(r).toBe(g); expect(g).toBe(b);

    const desat = px(1, 1, () => [255, 0, 0, 255]);
    applyAdjustments(desat, { ...defaultAdjustments, saturation: -100 });
    expect(at(desat, 0, 0)[0]).toBe(at(desat, 0, 0)[1]);

    const hiContrast = px(2, 1, (x) => (x === 0 ? [100, 100, 100, 255] : [160, 160, 160, 255]));
    applyAdjustments(hiContrast, { ...defaultAdjustments, contrast: 60 });
    expect(at(hiContrast, 0, 0)[0]).toBeLessThan(100);
    expect(at(hiContrast, 1, 0)[0]).toBeGreaterThan(160);
  });
});

describe("history", () => {
  const opts = { limit: 3 };
  it("undoes and redoes, and clears redo on a new edit", () => {
    let h = createHistory(0);
    h = pushState(h, 1, opts); h = pushState(h, 2, opts);
    expect(h.present).toBe(2);
    h = undoState(h); expect(h.present).toBe(1); expect(canRedo(h)).toBe(true);
    h = redoState(h); expect(h.present).toBe(2);
    h = undoState(h); h = pushState(h, 9, opts);
    expect(canRedo(h)).toBe(false);
    expect(canUndo(h)).toBe(true);
  });
  it("caps the number of undo steps", () => {
    let h = createHistory(0);
    for (let i = 1; i <= 10; i++) h = pushState(h, i, opts);
    expect(h.past).toHaveLength(3);
  });
  it("drops oldest entries when the memory budget is exceeded, but shares resources", () => {
    type E = { img: object; n: number };
    const big = { id: 1 };
    const resource = (e: E) => ({ id: e.img, cost: 10 });
    let h = createHistory<E>({ img: big, n: 0 });
    for (let i = 1; i <= 5; i++) h = pushState(h, { img: big, n: i }, { limit: 50, resource, budget: 15 });
    expect(h.past).toHaveLength(5); // same image everywhere: counted once
    for (let i = 0; i < 4; i++) h = pushState(h, { img: { id: i + 10 }, n: 100 + i }, { limit: 50, resource, budget: 25 });
    expect(h.past.length).toBeLessThan(9);
    expect(h.past.length).toBeGreaterThanOrEqual(1);
  });
  it("ignores a push of the same state", () => {
    const h = createHistory({ a: 1 });
    expect(pushState(h, h.present, opts)).toBe(h);
  });
});

describe("raster operations (real canvas)", () => {
  it("validates files", () => {
    expect(validateImageFile({ type: "image/png", size: 1000 })).toBeNull();
    expect(validateImageFile({ type: "image/svg+xml", size: 1000 })).toMatch(/supported/);
    expect(validateImageFile({ type: "application/pdf", size: 1000 })).toMatch(/supported/);
    expect(validateImageFile({ type: "image/png", size: 30 * 1024 * 1024 })).toMatch(/25 MB/);
    expect(validateImageFile({ type: "image/png", size: 0 })).toMatch(/empty/);
  });

  // 4x2 image: left half red, right half blue
  const make = () => { const c = createCanvas(4, 2); paint(c, (x) => (x < 2 ? "#ff0000" : "#0000ff")); return c; };

  it("crops", () => {
    const out = cropCanvas(make(), { x: 2, y: 0, width: 2, height: 2 })!;
    expect([out.width, out.height]).toEqual([2, 2]);
    expect(px1(out, 0, 0)).toEqual([0, 0, 255, 255]);
    expect(cropCanvas(make(), { x: 50, y: 50, width: 5, height: 5 })).toBeNull();
  });
  it("rotates 90° clockwise: the left column ends up on top", () => {
    const out = rotateCanvas(make(), 1);
    expect([out.width, out.height]).toEqual([2, 4]);
    expect(px1(out, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(px1(out, 0, 3)).toEqual([0, 0, 255, 255]);
  });
  it("rotates counter-clockwise and 180°", () => {
    const ccw = rotateCanvas(make(), -1);
    expect(px1(ccw, 0, 0)).toEqual([0, 0, 255, 255]);
    const half = rotateCanvas(make(), 2);
    expect([half.width, half.height]).toEqual([4, 2]);
    expect(px1(half, 0, 0)).toEqual([0, 0, 255, 255]);
  });
  it("flips", () => {
    expect(px1(flipCanvas(make(), "horizontal"), 0, 0)).toEqual([0, 0, 255, 255]);
    const v = createCanvas(1, 2); paint(v, (_x, y) => (y === 0 ? "#ff0000" : "#00ff00"));
    expect(px1(flipCanvas(v, "vertical"), 0, 0)).toEqual([0, 255, 0, 255]);
  });
  it("resizes", () => {
    const out = resizeCanvas(make(), 8, 4);
    expect([out.width, out.height]).toEqual([8, 4]);
  });
  it("REDACT permanently destroys the pixels and leaves the source untouched", () => {
    const src = make();
    const out = applyRegionEffect(src, { x: 0, y: 0, width: 2, height: 2 }, "redact", 0)!;
    expect(px1(out, 0, 0)).toEqual([0, 0, 0, 255]);
    expect(px1(out, 3, 0)).toEqual([0, 0, 255, 255]);
    expect(px1(src, 0, 0)).toEqual([255, 0, 0, 255]);
  });
  it("pixelate and blur only change the selected region", () => {
    const src = createCanvas(8, 1); paint(src, (x) => (x % 2 ? "#ffffff" : "#000000"));
    const pix = applyRegionEffect(src, { x: 0, y: 0, width: 4, height: 1 }, "pixelate", 4)!;
    expect(px1(pix, 0, 0)[0]).toBe(px1(pix, 1, 0)[0]);
    expect(px1(pix, 5, 0)).toEqual(px1(src, 5, 0));
    const blur = applyRegionEffect(src, { x: 0, y: 0, width: 4, height: 1 }, "blur", 1)!;
    expect(px1(blur, 6, 0)).toEqual(px1(src, 6, 0));
    expect(applyRegionEffect(src, { x: 99, y: 0, width: 1, height: 1 }, "blur", 1)).toBeNull();
  });
  it("applies adjustments to a copy", () => {
    const src = createCanvas(1, 1); paint(src, () => "#ff0000");
    const out = adjustedCanvas(src, { ...defaultAdjustments, grayscale: true });
    const [r, g, b] = px1(out, 0, 0);
    expect(r === g && g === b).toBe(true);
    expect(px1(src, 0, 0)).toEqual([255, 0, 0, 255]);
  });
  it("exports png/jpeg/webp blobs with the right type", async () => {
    const c = make();
    expect((await canvasToBlob(c, "png", 1)).type).toBe("image/png");
    expect((await canvasToBlob(c, "jpeg", 0.8)).type).toBe("image/jpeg");
  });
});
