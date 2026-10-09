import { applyRegionEffect, cropCanvas, flipCanvas, resizeCanvas, rotateCanvas, MAX_DIMENSION, type RegionEffect } from "@/lib/image/raster";
import type { Adjustments } from "@/lib/image/effects";
import type { Rect } from "@/lib/image/geometry";
import { flattenAnnotations } from "./scene";
import type { DocState, Shape } from "./types";

/*
 * Every operation is pure: it takes a DocState and returns a new one (or null when it would do nothing).
 * Geometry and pixel operations first bake annotations into the base, so annotations always move,
 * crop and blur together with the photo. Adjustments stay as parameters and are unaffected.
 */

export const addShape = (doc: DocState, shape: Shape): DocState => ({ ...doc, shapes: [...doc.shapes, shape] });

export const updateShape = (doc: DocState, id: string, patch: Partial<Shape>): DocState => ({
  ...doc,
  shapes: doc.shapes.map((s) => (s.id === id ? ({ ...s, ...patch } as Shape) : s)),
});

export const removeShape = (doc: DocState, id: string): DocState => ({ ...doc, shapes: doc.shapes.filter((s) => s.id !== id) });

export const clearShapes = (doc: DocState): DocState | null => (doc.shapes.length ? { ...doc, shapes: [] } : null);

export const setAdjustments = (doc: DocState, adjustments: Adjustments): DocState => ({ ...doc, adjustments });

export function cropDoc(doc: DocState, rect: Rect): DocState | null {
  const flat = flattenAnnotations(doc);
  const base = cropCanvas(flat.base, rect);
  if (!base || (base.width === flat.base.width && base.height === flat.base.height)) return null;
  return { ...flat, base };
}

export function rotateDoc(doc: DocState, turns: 1 | -1 | 2): DocState {
  const flat = flattenAnnotations(doc);
  return { ...flat, base: rotateCanvas(flat.base, turns) };
}

export function flipDoc(doc: DocState, axis: "horizontal" | "vertical"): DocState {
  const flat = flattenAnnotations(doc);
  return { ...flat, base: flipCanvas(flat.base, axis) };
}

export function resizeDoc(doc: DocState, width: number, height: number): DocState | null {
  const w = Math.min(MAX_DIMENSION, Math.max(1, Math.round(width)));
  const h = Math.min(MAX_DIMENSION, Math.max(1, Math.round(height)));
  if (w === doc.base.width && h === doc.base.height) return null;
  const flat = flattenAnnotations(doc);
  return { ...flat, base: resizeCanvas(flat.base, w, h) };
}

export function effectDoc(doc: DocState, rect: Rect, effect: RegionEffect, strength: number): DocState | null {
  const flat = flattenAnnotations(doc);
  const base = applyRegionEffect(flat.base, rect, effect, strength);
  return base ? { ...flat, base } : null;
}
