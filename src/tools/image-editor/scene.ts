import Konva from "konva";
import { adjustedCanvas, createCanvas } from "@/lib/image/raster";
import { isDefaultAdjustments, type Adjustments } from "@/lib/image/effects";
import type { DocState, Shape, Transform } from "./types";

export const FONT_FAMILY = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

/** Longest side of the on-screen preview used while adjusting sliders. Export always uses full resolution. */
const PREVIEW_MAX = 1600;

export function readTransform(node: Konva.Node): Transform {
  return { x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: node.scaleX(), scaleY: node.scaleY() };
}

/** Build the Konva node for one shape. The same function feeds the live view and the export. */
export function buildShapeNode(shape: Shape, interactive: boolean): Konva.Node {
  const common = {
    id: shape.id,
    x: shape.x, y: shape.y, rotation: shape.rotation, scaleX: shape.scaleX, scaleY: shape.scaleY,
    // Eraser strokes only cut into annotations, so they are never selectable.
    listening: interactive && shape.type !== "eraser",
    draggable: interactive && shape.type !== "eraser",
  };
  switch (shape.type) {
    case "pen":
      return new Konva.Line({ ...common, points: shape.points, stroke: shape.color, strokeWidth: shape.strokeWidth, lineCap: "round", lineJoin: "round", tension: 0.3, strokeScaleEnabled: false, hitStrokeWidth: Math.max(12, shape.strokeWidth) });
    case "eraser":
      return new Konva.Line({ ...common, points: shape.points, stroke: "#000", strokeWidth: shape.strokeWidth, lineCap: "round", lineJoin: "round", tension: 0.3, globalCompositeOperation: "destination-out" });
    case "line":
      return new Konva.Line({ ...common, points: shape.points, stroke: shape.color, strokeWidth: shape.strokeWidth, lineCap: "round", strokeScaleEnabled: false, hitStrokeWidth: Math.max(12, shape.strokeWidth) });
    case "arrow":
      return new Konva.Arrow({ ...common, points: shape.points, stroke: shape.color, fill: shape.color, strokeWidth: shape.strokeWidth, lineCap: "round", pointerLength: Math.max(10, shape.strokeWidth * 3), pointerWidth: Math.max(10, shape.strokeWidth * 3), strokeScaleEnabled: false, hitStrokeWidth: Math.max(12, shape.strokeWidth) });
    case "rect":
      return new Konva.Rect({ ...common, width: shape.width, height: shape.height, stroke: shape.color, strokeWidth: shape.strokeWidth, fill: shape.filled ? shape.color : undefined, strokeScaleEnabled: false });
    case "ellipse":
      return new Konva.Ellipse({ ...common, radiusX: shape.radiusX, radiusY: shape.radiusY, stroke: shape.color, strokeWidth: shape.strokeWidth, fill: shape.filled ? shape.color : undefined, strokeScaleEnabled: false });
    case "text":
      return new Konva.Text({ ...common, text: shape.text, fontSize: shape.fontSize, fontFamily: FONT_FAMILY, fill: shape.color });
  }
}

/** The canvas shown on screen: the base, or a downscaled adjusted copy while adjustments are active. */
export function previewCanvas(base: HTMLCanvasElement, adj: Adjustments): HTMLCanvasElement {
  if (isDefaultAdjustments(adj)) return base;
  const k = Math.min(1, PREVIEW_MAX / Math.max(base.width, base.height));
  if (k === 1) return adjustedCanvas(base, adj);
  const small = createCanvas(base.width * k, base.height * k);
  small.getContext("2d")!.drawImage(base, 0, 0, small.width, small.height);
  return adjustedCanvas(small, adj);
}

/**
 * Render the document to a flat canvas at full resolution (scale 1, no zoom or pan).
 * withAdjustments=false is used to bake annotations into the base before crop/rotate/flip/resize.
 */
export function renderDocument(doc: DocState, withAdjustments: boolean): HTMLCanvasElement {
  const { width, height } = doc.base;
  const image = withAdjustments && !isDefaultAdjustments(doc.adjustments) ? adjustedCanvas(doc.base, doc.adjustments) : doc.base;

  const stage = new Konva.Stage({ container: document.createElement("div"), width, height });
  const imageLayer = new Konva.Layer({ listening: false });
  const shapeLayer = new Konva.Layer({ listening: false });
  stage.add(imageLayer, shapeLayer);
  // Avoid allocating devicePixelRatio-sized buffers for an offscreen render.
  imageLayer.getCanvas().setPixelRatio(1);
  shapeLayer.getCanvas().setPixelRatio(1);

  imageLayer.add(new Konva.Image({ image, width, height }));
  doc.shapes.forEach((s) => shapeLayer.add(buildShapeNode(s, false) as Konva.Shape));
  stage.draw();
  const out = stage.toCanvas({ pixelRatio: 1 }) as HTMLCanvasElement;
  stage.destroy();
  return out;
}

/** Whether there is anything to bake into the base. */
export const hasAnnotations = (doc: DocState) => doc.shapes.length > 0;

/** Return a doc whose annotations have been burned into the base raster. Adjustments stay as parameters. */
export function flattenAnnotations(doc: DocState): DocState {
  if (!hasAnnotations(doc)) return doc;
  return { ...doc, base: renderDocument({ ...doc, adjustments: { ...doc.adjustments } }, false), shapes: [] };
}
