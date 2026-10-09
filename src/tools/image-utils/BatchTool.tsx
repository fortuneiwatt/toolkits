"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { downloadBlob } from "@/lib/download";
import { firstImageFile, loadImageFile } from "@/lib/image/load";
import {
  dedupeNames, formatBytes, outputFileName, processImage, resolveFormat, savingsPercent,
  type OutputChoice, type ResizeSpec,
} from "@/lib/image/process";
import { MAX_DIMENSION, formatFromMime, validateImageFile, type ExportFormat } from "@/lib/image/raster";
import { makeZip } from "@/lib/zip";
import { Slider } from "../image-editor/controls";
import { buttonClass, primaryButtonClass } from "../shared/ui";

export type BatchMode = "compress" | "resize" | "convert";

const MAX_FILES = 20;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/bmp";

interface Result {
  blob: Blob;
  name: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  format: ExportFormat | "original";
  /** Compress only: the re-encoded file was not smaller, so the original was kept. */
  kept: boolean;
  notes: string[];
}

interface Item {
  id: string;
  file: File;
  previewUrl: string;
  status: "queued" | "working" | "done" | "error";
  error?: string;
  result?: Result;
}

let idCounter = 0;
const nextId = () => `i${Date.now().toString(36)}${(idCounter++).toString(36)}`;

const MAX_DIM_CHOICES = [
  { value: 0, label: "Original size" },
  { value: 3840, label: "4K (3840 px)" },
  { value: 2560, label: "2560 px" },
  { value: 1920, label: "Full HD (1920 px)" },
  { value: 1280, label: "1280 px" },
  { value: 800, label: "800 px" },
];

const titles: Record<BatchMode, { action: string; running: string; suffix: string }> = {
  compress: { action: "Compress", running: "Compressing…", suffix: "-compressed" },
  resize: { action: "Resize", running: "Resizing…", suffix: "-resized" },
  convert: { action: "Convert", running: "Converting…", suffix: "" },
};

const field = "rounded-md border border-line bg-panel px-2 py-1 text-sm";

export function BatchTool({ mode }: { mode: BatchMode }) {
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  // options
  const [quality, setQuality] = useState(mode === "compress" ? 80 : 90);
  const [compressFormat, setCompressFormat] = useState<OutputChoice>("smart");
  const [maxDim, setMaxDim] = useState(0);
  const [convertTo, setConvertTo] = useState<ExportFormat>("webp");
  const [resizeBy, setResizeBy] = useState<"pixels" | "percent">("pixels");
  const [widthText, setWidthText] = useState("");
  const [heightText, setHeightText] = useState("");
  const [lock, setLock] = useState(true);
  const [percent, setPercent] = useState(50);
  const [enlarge, setEnlarge] = useState(false);
  const [resizeFormat, setResizeFormat] = useState<OutputChoice>("same");

  const inputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<Set<string>>(new Set());
  const runId = useRef(0);
  // Mirror of `items` so handlers can read the current list without side effects inside state updaters.
  const itemsRef = useRef<Item[]>([]);
  useEffect(() => { itemsRef.current = items; });

  // Release preview URLs when leaving the page.
  useEffect(() => {
    const urls = urlsRef.current;
    return () => { urls.forEach((u) => URL.revokeObjectURL(u)); urls.clear(); };
  }, []);

  const say = (kind: "error" | "info", text: string) => setMessage({ kind, text });

  const addFiles = useCallback((files: File[]) => {
    const problems: string[] = [];
    const room = MAX_FILES - itemsRef.current.length;
    const added: Item[] = [];
    for (const file of files) {
      const problem = validateImageFile(file);
      if (problem) { problems.push(`${file.name}: ${problem}`); continue; }
      if (added.length >= room) { problems.push(`Only ${MAX_FILES} images at a time. Extra files were skipped.`); break; }
      const previewUrl = URL.createObjectURL(file);
      urlsRef.current.add(previewUrl);
      added.push({ id: nextId(), file, previewUrl, status: "queued" });
    }
    if (added.length) setItems((current) => [...current, ...added]);
    setMessage(problems.length ? { kind: "error", text: Array.from(new Set(problems)).slice(0, 3).join(" ") } : null);
  }, []);

  // Paste a screenshot.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (!e.clipboardData) return;
      const file = firstImageFile({ files: e.clipboardData.files, items: e.clipboardData.items });
      if (file) { e.preventDefault(); addFiles([file]); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const removeItem = (id: string) => {
    const gone = itemsRef.current.find((i) => i.id === id);
    if (gone) { URL.revokeObjectURL(gone.previewUrl); urlsRef.current.delete(gone.previewUrl); }
    setItems((cur) => cur.filter((i) => i.id !== id));
  };

  const clearAll = () => {
    runId.current++; // stop any run in progress
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current.clear();
    setItems([]);
    setMessage(null);
    setRunning(false);
  };

  // ---------- options -> a processing plan ----------
  function plan(): { error: string } | { resize: ResizeSpec; choice: OutputChoice; q: number; suffix: string } {
    if (mode === "compress") {
      const resize: ResizeSpec = maxDim > 0 ? { kind: "fit", maxWidth: maxDim, maxHeight: maxDim, allowEnlarge: false } : { kind: "none" };
      return { resize, choice: compressFormat, q: quality / 100, suffix: titles.compress.suffix };
    }
    if (mode === "convert") return { resize: { kind: "none" }, choice: convertTo, q: quality / 100, suffix: "" };

    if (resizeBy === "percent") {
      if (!(percent >= 1 && percent <= 400)) return { error: "Enter a percentage between 1 and 400." };
      return { resize: { kind: "percent", percent }, choice: resizeFormat, q: quality / 100, suffix: titles.resize.suffix };
    }
    const w = Number(widthText);
    const h = Number(heightText);
    const hasW = widthText.trim() !== "" && w >= 1;
    const hasH = heightText.trim() !== "" && h >= 1;
    if ((widthText.trim() !== "" && !(w >= 1)) || (heightText.trim() !== "" && !(h >= 1))) return { error: "Width and height must be whole numbers of 1 or more." };
    if (!hasW && !hasH) return { error: "Enter a width, a height, or both." };
    if (!lock) {
      if (!hasW || !hasH) return { error: "Enter both width and height, or turn on Keep proportions." };
      return { resize: { kind: "exact", width: w, height: h }, choice: resizeFormat, q: quality / 100, suffix: titles.resize.suffix };
    }
    return {
      resize: { kind: "fit", maxWidth: hasW ? w : Infinity, maxHeight: hasH ? h : Infinity, allowEnlarge: enlarge },
      choice: resizeFormat,
      q: quality / 100,
      suffix: titles.resize.suffix,
    };
  }

  async function run() {
    const p = plan();
    if ("error" in p) { say("error", p.error); return; }
    if (!items.length) return;
    const myRun = ++runId.current;
    setRunning(true);
    setMessage(null);
    setItems((cur) => cur.map((i) => ({ ...i, status: "queued", error: undefined, result: undefined })));

    for (const item of items) {
      if (runId.current !== myRun) return;
      setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, status: "working" } : i)));
      await new Promise((r) => setTimeout(r, 0)); // let the UI paint between images
      try {
        const loaded = await loadImageFile(item.file);
        const format = resolveFormat(item.file.type, p.choice);
        const out = await processImage(loaded.canvas, { resize: p.resize, format, quality: p.q });

        const notes: string[] = [];
        if (loaded.downscaled) notes.push(`Opened at ${loaded.canvas.width}×${loaded.canvas.height} (the original ${loaded.originalWidth}×${loaded.originalHeight} is above the ${MAX_DIMENSION} px limit).`);
        if (out.fellBack) notes.push(`Your browser can't save ${format.toUpperCase()}, so this was saved as ${out.format.toUpperCase()}.`);
        if (format === "jpeg" && item.file.type !== "image/jpeg") notes.push("Transparent areas became white (JPG has no transparency).");

        let result: Result = {
          blob: out.blob, name: outputFileName(item.file.name, out.format, p.suffix), width: out.width, height: out.height,
          originalWidth: loaded.originalWidth, originalHeight: loaded.originalHeight, format: out.format, kept: false, notes,
        };
        const sameKind = out.format === formatFromMime(item.file.type);
        const sameSize = out.width === loaded.originalWidth && out.height === loaded.originalHeight;
        if (mode === "compress" && sameKind && sameSize && out.blob.size >= item.file.size) {
          result = { ...result, blob: item.file, name: item.file.name, format: "original", kept: true, notes: [...notes, "Already well optimised, so the original file was kept."] };
        }
        if (runId.current !== myRun) return;
        setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, status: "done", result } : i)));
      } catch (e) {
        if (runId.current !== myRun) return;
        setItems((cur) => cur.map((i) => (i.id === item.id ? { ...i, status: "error", error: e instanceof Error ? e.message : "Could not process this image." } : i)));
      }
    }
    if (runId.current === myRun) setRunning(false);
  }

  function downloadOne(item: Item) {
    if (item.result) downloadBlob(item.result.name, item.result.blob);
  }

  async function downloadAll() {
    const done = items.filter((i) => i.result);
    const names = dedupeNames(done.map((i) => i.result!.name));
    const entries = await Promise.all(done.map(async (i, n) => ({ name: names[n], data: new Uint8Array(await i.result!.blob.arrayBuffer()) })));
    downloadBlob(`${mode === "compress" ? "compressed" : mode === "resize" ? "resized" : "converted"}-images.zip`, new Blob([makeZip(entries) as BlobPart], { type: "application/zip" }));
  }

  const done = items.filter((i) => i.result);
  const totalBefore = done.reduce((s, i) => s + i.file.size, 0);
  const totalAfter = done.reduce((s, i) => s + i.result!.blob.size, 0);
  const lossy = mode === "compress" || (mode === "convert" && convertTo !== "png") || (mode === "resize" && resizeFormat !== "png");

  return (
    <div className="grid gap-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length) addFiles(files);
          else say("error", "Drop image files here (PNG, JPG, WebP, GIF or BMP).");
        }}
        className={`grid place-items-center gap-2 rounded-md border-2 border-dashed p-6 text-center ${dragOver ? "border-accent bg-bg" : "border-line"}`}
      >
        <p className="font-semibold">Drop images here</p>
        <p className="text-sm text-muted">or paste a screenshot with Ctrl+V. Up to {MAX_FILES} images, 25 MB each.</p>
        <button type="button" className={primaryButtonClass} onClick={() => inputRef.current?.click()} disabled={running}>Choose images</button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          aria-label="Choose image files"
          onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
        />
        <p className="text-xs text-muted">Your images stay on this device. Nothing is uploaded.</p>
      </div>

      {/* Options */}
      <fieldset className="grid gap-3 rounded-md border border-line p-3 sm:grid-cols-2" disabled={running}>
        <legend className="px-1 text-sm font-semibold">Options</legend>

        {mode === "compress" && (
          <>
            <Slider id="bt-quality" label="Quality" value={quality} min={30} max={100} unit="%" onChange={setQuality} />
            <label className="grid gap-1 text-sm">Output format
              <select className={field} value={compressFormat} onChange={(e) => setCompressFormat(e.target.value as OutputChoice)}>
                <option value="smart">Smart (JPG and WebP stay, PNG/GIF/BMP become WebP)</option>
                <option value="jpeg">JPG</option>
                <option value="webp">WebP</option>
                <option value="png">PNG (lossless, little saving)</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">Longest side
              <select className={field} value={maxDim} onChange={(e) => setMaxDim(Number(e.target.value))}>
                {MAX_DIM_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
          </>
        )}

        {mode === "convert" && (
          <>
            <label className="grid gap-1 text-sm">Convert to
              <select className={field} value={convertTo} onChange={(e) => setConvertTo(e.target.value as ExportFormat)}>
                <option value="webp">WebP (small, modern)</option>
                <option value="jpeg">JPG (works everywhere)</option>
                <option value="png">PNG (lossless, transparency)</option>
              </select>
            </label>
            {convertTo !== "png" && <Slider id="bt-quality" label="Quality" value={quality} min={30} max={100} unit="%" onChange={setQuality} />}
          </>
        )}

        {mode === "resize" && (
          <>
            <div className="flex gap-4 text-sm sm:col-span-2" role="radiogroup" aria-label="Resize by">
              <label className="flex items-center gap-2"><input type="radio" name="bt-by" checked={resizeBy === "pixels"} onChange={() => setResizeBy("pixels")} /> By pixels</label>
              <label className="flex items-center gap-2"><input type="radio" name="bt-by" checked={resizeBy === "percent"} onChange={() => setResizeBy("percent")} /> By percentage</label>
            </div>
            {resizeBy === "pixels" ? (
              <>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label className="grid gap-1">Width (px)
                    <input className={field} inputMode="numeric" value={widthText} placeholder="auto" onChange={(e) => setWidthText(e.target.value.replace(/\D/g, "").slice(0, 5))} />
                  </label>
                  <label className="grid gap-1">Height (px)
                    <input className={field} inputMode="numeric" value={heightText} placeholder="auto" onChange={(e) => setHeightText(e.target.value.replace(/\D/g, "").slice(0, 5))} />
                  </label>
                </div>
                <div className="grid content-end gap-1 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} /> Keep proportions</label>
                  {lock && <label className="flex items-center gap-2"><input type="checkbox" checked={enlarge} onChange={(e) => setEnlarge(e.target.checked)} /> Allow enlarging small images</label>}
                </div>
              </>
            ) : (
              <Slider id="bt-percent" label="Scale" value={percent} min={1} max={400} unit="%" onChange={setPercent} />
            )}
            <label className="grid gap-1 text-sm">Output format
              <select className={field} value={resizeFormat} onChange={(e) => setResizeFormat(e.target.value as OutputChoice)}>
                <option value="same">Same as original</option>
                <option value="jpeg">JPG</option>
                <option value="webp">WebP</option>
                <option value="png">PNG</option>
              </select>
            </label>
            {lossy && <Slider id="bt-quality" label="Quality" value={quality} min={30} max={100} unit="%" onChange={setQuality} />}
          </>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={primaryButtonClass} disabled={!items.length || running} onClick={run}>
          {running ? titles[mode].running : items.length ? `${titles[mode].action} ${items.length} ${items.length === 1 ? "image" : "images"}` : titles[mode].action}
        </button>
        <button type="button" className={buttonClass} disabled={done.length < 2 || running} onClick={downloadAll}>Download all (ZIP)</button>
        <button type="button" className={buttonClass} disabled={!items.length} onClick={clearAll}>Clear all</button>
      </div>

      <div role="status" aria-live="polite">
        {message && <p className={message.kind === "error" ? "text-sm text-bad" : "text-sm text-muted"}>{message.text}</p>}
      </div>

      {/* Results */}
      {items.length > 0 && (
        <ul className="grid gap-2" aria-label="Images">
          {items.map((it) => {
            const r = it.result;
            const pct = r ? savingsPercent(it.file.size, r.blob.size) : 0;
            return (
              <li key={it.id} className="grid gap-2 rounded-md border border-line bg-panel p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a remote image */}
                <img src={it.previewUrl} alt="" className="h-12 w-12 rounded object-cover" />
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium">{it.file.name}</p>
                  {it.status === "queued" && !r && <p className="text-muted">{formatBytes(it.file.size)}. Ready.</p>}
                  {it.status === "working" && <p className="text-muted">Working…</p>}
                  {it.status === "error" && <p className="text-bad">{it.error}</p>}
                  {r && (
                    <>
                      <p className="text-muted">
                        {formatBytes(it.file.size)} → <span className="font-medium text-ink">{formatBytes(r.blob.size)}</span>
                        {mode !== "convert" || pct !== 0 ? ` (${pct >= 0 ? "−" : "+"}${Math.abs(pct)}%)` : ""}
                        {" · "}{r.originalWidth}×{r.originalHeight}{r.width !== r.originalWidth || r.height !== r.originalHeight ? ` → ${r.width}×${r.height}` : ""}
                        {r.format !== "original" && ` · ${r.format === "jpeg" ? "JPG" : r.format.toUpperCase()}`}
                      </p>
                      {r.notes.map((n) => <p key={n} className="text-xs text-muted">{n}</p>)}
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" className={buttonClass} disabled={!r} onClick={() => downloadOne(it)}>Download</button>
                  <button type="button" className={buttonClass} disabled={running} onClick={() => removeItem(it.id)} aria-label={`Remove ${it.file.name}`}>Remove</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {done.length > 1 && (
        <p className="text-sm text-muted">
          Total: {formatBytes(totalBefore)} → <span className="font-medium text-ink">{formatBytes(totalAfter)}</span>
          {mode === "compress" && ` (${savingsPercent(totalBefore, totalAfter)}% smaller)`}
        </p>
      )}
      <p className="text-xs text-muted">Saved images are re-encoded, so camera and location data (EXIF) are removed.</p>
    </div>
  );
}

export const ImageCompressor = () => <BatchTool mode="compress" />;
export const ImageResizer = () => <BatchTool mode="resize" />;
export const ImageConverter = () => <BatchTool mode="convert" />;
