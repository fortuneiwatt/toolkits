import { createCanvas } from "@/lib/image/raster";
import { defaultAdjustments } from "@/lib/image/effects";
import { flattenAnnotations, previewCanvas, renderDocument } from "@/tools/image-editor/scene";
import { identity, type DocState, type Shape } from "@/tools/image-editor/types";

const px = (c: HTMLCanvasElement, x: number, y: number) => Array.from(c.getContext("2d")!.getImageData(x, y, 1, 1).data);

function solid(w: number, h: number, color: string) {
  const c = createCanvas(w, h);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
  return c;
}
const doc = (shapes: Shape[] = [], base = solid(40, 40, "#ffffff")): DocState => ({ base, shapes, adjustments: { ...defaultAdjustments } });

const filledRect: Shape = { ...identity, id: "r", type: "rect", x: 10, y: 10, width: 20, height: 20, color: "#ff0000", strokeWidth: 2, filled: true };

describe("scene rendering (real Konva + canvas)", () => {
  it("renders the base image at full size", () => {
    const out = renderDocument(doc(), true);
    expect([out.width, out.height]).toEqual([40, 40]);
    expect(px(out, 5, 5)).toEqual([255, 255, 255, 255]);
  });
  it("draws annotations over the base", () => {
    const out = renderDocument(doc([filledRect]), true);
    expect(px(out, 20, 20)).toEqual([255, 0, 0, 255]);
    expect(px(out, 2, 2)).toEqual([255, 255, 255, 255]);
  });
  it("respects shape transforms (moved shape)", () => {
    const out = renderDocument(doc([{ ...filledRect, x: 0, y: 0 }]), true);
    expect(px(out, 5, 5)).toEqual([255, 0, 0, 255]);
    expect(px(out, 25, 25)).toEqual([255, 255, 255, 255]);
  });
  it("draws ellipses, lines and arrows", () => {
    const e: Shape = { ...identity, id: "e", type: "ellipse", x: 20, y: 20, radiusX: 8, radiusY: 8, color: "#00ff00", strokeWidth: 2, filled: true };
    expect(px(renderDocument(doc([e]), true), 20, 20)).toEqual([0, 255, 0, 255]);
    const l: Shape = { ...identity, id: "l", type: "line", points: [0, 20, 40, 20], color: "#0000ff", strokeWidth: 6 };
    expect(px(renderDocument(doc([l]), true), 20, 20)).toEqual([0, 0, 255, 255]);
    const a: Shape = { ...identity, id: "a", type: "arrow", points: [0, 20, 40, 20], color: "#0000ff", strokeWidth: 6 };
    expect(px(renderDocument(doc([a]), true), 10, 20)[2]).toBe(255);
  });
  it("eraser strokes cut annotations but never the photo", () => {
    const eraser: Shape = { ...identity, id: "x", type: "eraser", points: [0, 20, 40, 20], strokeWidth: 12 };
    const out = renderDocument(doc([filledRect, eraser], solid(40, 40, "#336699")), true);
    expect(px(out, 20, 20)).toEqual([0x33, 0x66, 0x99, 255]); // red rect erased, photo still there
    expect(px(out, 20, 12)).toEqual([255, 0, 0, 255]); // rect outside the stroke survives
  });
  it("applies adjustments to the photo only when asked", () => {
    const d = { ...doc([filledRect]), adjustments: { ...defaultAdjustments, grayscale: true } };
    const withAdj = renderDocument({ ...d, base: solid(40, 40, "#ff0000") }, true);
    const [r, g, b] = px(withAdj, 2, 2);
    expect(r === g && g === b).toBe(true);
    const noAdj = renderDocument({ ...d, base: solid(40, 40, "#ff0000") }, false);
    expect(px(noAdj, 2, 2)).toEqual([255, 0, 0, 255]);
  });
  it("flattening bakes annotations into the base and clears the shape list", () => {
    const flat = flattenAnnotations(doc([filledRect]));
    expect(flat.shapes).toHaveLength(0);
    expect(px(flat.base, 20, 20)).toEqual([255, 0, 0, 255]);
    const same = doc();
    expect(flattenAnnotations(same)).toBe(same);
  });
  it("preview canvas is the base itself when nothing is adjusted, and a copy otherwise", () => {
    const base = solid(10, 10, "#ff0000");
    expect(previewCanvas(base, defaultAdjustments)).toBe(base);
    const p = previewCanvas(base, { ...defaultAdjustments, brightness: 20 });
    expect(p).not.toBe(base);
    expect(p.width).toBe(10);
  });
  it("downsizes the preview for very large images", () => {
    const big = createCanvas(3200, 1600);
    const p = previewCanvas(big, { ...defaultAdjustments, brightness: 10 });
    expect(Math.max(p.width, p.height)).toBe(1600);
  });
});
