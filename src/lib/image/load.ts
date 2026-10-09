import { MAX_SOURCE_PIXELS, canvasFromSource, validateImageFile } from "./raster";

export interface LoadedImage {
  canvas: HTMLCanvasElement;
  downscaled: boolean;
  originalWidth: number;
  originalHeight: number;
}

/** Validate, decode and (if huge) downscale an image file. Throws an Error with a user-readable message. */
export async function loadImageFile(file: File): Promise<LoadedImage> {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error("That image couldn't be read. It may be corrupted.");
    }
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) throw new Error("That image has no size.");
    if (w * h > MAX_SOURCE_PIXELS) throw new Error("That image has too many pixels to open safely in a browser tab.");
    return canvasFromSource(img, w, h);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** First image file found in a paste or drop, if any. */
export function firstImageFile(items: { files?: FileList | null; items?: DataTransferItemList | null }): File | null {
  const fromFiles = Array.from(items.files ?? []).find((f) => f.type.startsWith("image/"));
  if (fromFiles) return fromFiles;
  for (const it of Array.from(items.items ?? [])) {
    if (it.kind === "file" && it.type.startsWith("image/")) {
      const f = it.getAsFile();
      if (f) return f;
    }
  }
  return null;
}
