import { createCanvas } from "@/lib/image/raster";
import { defaultAdjustments } from "@/lib/image/effects";
import { addShape, clearShapes, cropDoc, effectDoc, flipDoc, removeShape, resizeDoc, rotateDoc, setAdjustments, updateShape } from "@/tools/image-editor/operations";
import { editorReducer, initialEditorState } from "@/tools/image-editor/state";
import { identity, type DocState, type Shape } from "@/tools/image-editor/types";

const px = (c: HTMLCanvasElement, x: number, y: number) => Array.from(c.getContext("2d")!.getImageData(x, y, 1, 1).data);
function solid(w: number, h: number, color: string) {
  const c = createCanvas(w, h); const ctx = c.getContext("2d")!; ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); return c;
}
const base = (): DocState => ({ base: solid(40, 20, "#ffffff"), shapes: [], adjustments: { ...defaultAdjustments } });
const rect: Shape = { ...identity, id: "r1", type: "rect", x: 0, y: 0, width: 10, height: 10, color: "#ff0000", strokeWidth: 2, filled: true };

describe("document operations", () => {
  it("adds, updates, removes and clears shapes without mutating the old doc", () => {
    const d0 = base();
    const d1 = addShape(d0, rect);
    expect(d0.shapes).toHaveLength(0);
    const d2 = updateShape(d1, "r1", { x: 5 });
    expect(d2.shapes[0].x).toBe(5);
    expect(d1.shapes[0].x).toBe(0);
    expect(removeShape(d2, "r1").shapes).toHaveLength(0);
    expect(clearShapes(d2)?.shapes).toHaveLength(0);
    expect(clearShapes(d0)).toBeNull();
  });
  it("crop bakes annotations in and shrinks the base", () => {
    const d = addShape(base(), rect);
    const out = cropDoc(d, { x: 0, y: 0, width: 20, height: 10 })!;
    expect([out.base.width, out.base.height]).toEqual([20, 10]);
    expect(out.shapes).toHaveLength(0);
    expect(px(out.base, 5, 5)).toEqual([255, 0, 0, 255]);
  });
  it("crop is a no-op for the full image or an empty selection", () => {
    expect(cropDoc(base(), { x: 0, y: 0, width: 40, height: 20 })).toBeNull();
    expect(cropDoc(base(), { x: 100, y: 100, width: 5, height: 5 })).toBeNull();
  });
  it("rotate swaps dimensions and carries the annotation with the pixels", () => {
    const out = rotateDoc(addShape(base(), rect), 1);
    expect([out.base.width, out.base.height]).toEqual([20, 40]);
    // top-left red square rotates to the top-right
    expect(px(out.base, 15, 5)).toEqual([255, 0, 0, 255]);
    expect(px(out.base, 2, 5)).toEqual([255, 255, 255, 255]);
  });
  it("flip mirrors annotations too", () => {
    const out = flipDoc(addShape(base(), rect), "horizontal");
    expect(px(out.base, 35, 5)).toEqual([255, 0, 0, 255]);
    expect(px(out.base, 2, 5)).toEqual([255, 255, 255, 255]);
  });
  it("resize scales, clamps and ignores no-ops", () => {
    expect(resizeDoc(base(), 40, 20)).toBeNull();
    const out = resizeDoc(base(), 80, 40)!;
    expect([out.base.width, out.base.height]).toEqual([80, 40]);
    expect(resizeDoc(base(), 99999, 99999)!.base.width).toBe(4096);
  });
  it("REDACT burns black into the base, including any annotation underneath it", () => {
    const d = addShape(base(), rect);
    const out = effectDoc(d, { x: 0, y: 0, width: 12, height: 12 }, "redact", 0)!;
    expect(out.shapes).toHaveLength(0); // the red shape is gone from the document
    expect(px(out.base, 5, 5)).toEqual([0, 0, 0, 255]); // and its pixels are destroyed, not hidden
    expect(px(out.base, 30, 15)).toEqual([255, 255, 255, 255]);
  });
  it("sets adjustments as a parameter, leaving pixels untouched", () => {
    const d = base();
    const out = setAdjustments(d, { ...defaultAdjustments, brightness: 30 });
    expect(out.base).toBe(d.base);
    expect(out.adjustments.brightness).toBe(30);
  });
});

describe("editor reducer", () => {
  it("loads, commits, undoes, redoes, resets (undoably) and closes", () => {
    let s = editorReducer(initialEditorState, { type: "load", base: solid(10, 10, "#fff") });
    const first = s.history!.present;
    s = editorReducer(s, { type: "commit", doc: addShape(first, rect) });
    expect(s.history!.present.shapes).toHaveLength(1);
    s = editorReducer(s, { type: "undo" });
    expect(s.history!.present.shapes).toHaveLength(0);
    s = editorReducer(s, { type: "redo" });
    expect(s.history!.present.shapes).toHaveLength(1);
    s = editorReducer(s, { type: "reset" });
    expect(s.history!.present.shapes).toHaveLength(0);
    s = editorReducer(s, { type: "undo" });
    expect(s.history!.present.shapes).toHaveLength(1); // reset can be undone
    expect(editorReducer(s, { type: "commit", doc: null })).toBe(s);
    expect(editorReducer(s, { type: "close" }).history).toBeNull();
  });
  it("ignores actions before an image is loaded", () => {
    expect(editorReducer(initialEditorState, { type: "undo" })).toBe(initialEditorState);
    expect(editorReducer(initialEditorState, { type: "reset" })).toBe(initialEditorState);
  });
});
