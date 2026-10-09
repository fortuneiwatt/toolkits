import type { Adjustments } from "@/lib/image/effects";

export type Tool =
  | "select" | "hand" | "brush" | "eraser" | "line" | "arrow" | "rect" | "ellipse" | "text"
  | "crop" | "blur" | "pixelate" | "redact";

export interface Transform { x: number; y: number; rotation: number; scaleX: number; scaleY: number }

type Base = Transform & { id: string };

export type Shape =
  | (Base & { type: "pen"; points: number[]; color: string; strokeWidth: number })
  | (Base & { type: "eraser"; points: number[]; strokeWidth: number })
  | (Base & { type: "line" | "arrow"; points: number[]; color: string; strokeWidth: number })
  | (Base & { type: "rect"; width: number; height: number; color: string; strokeWidth: number; filled: boolean })
  | (Base & { type: "ellipse"; radiusX: number; radiusY: number; color: string; strokeWidth: number; filled: boolean })
  | (Base & { type: "text"; text: string; fontSize: number; color: string });

/** One undo step. `base` is the raster (replaced only by crop/rotate/flip/resize/blur/pixelate/redact). */
export interface DocState {
  base: HTMLCanvasElement;
  shapes: Shape[];
  adjustments: Adjustments;
}

export const identity: Transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };

let counter = 0;
export const newId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

export const toolLabels: Record<Tool, string> = {
  select: "Select", hand: "Pan", brush: "Brush", eraser: "Eraser", line: "Line", arrow: "Arrow",
  rect: "Rectangle", ellipse: "Ellipse", text: "Text", crop: "Crop", blur: "Blur", pixelate: "Pixelate", redact: "Redact",
};
