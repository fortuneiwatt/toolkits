"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import Konva from "konva";
import { defaultAdjustments, isDefaultAdjustments, type Adjustments } from "@/lib/image/effects";
import { clampRect, fitScale, normalizeRect, resizeDimensions, zoomAtPoint, type Rect } from "@/lib/image/geometry";
import { canRedo, canUndo } from "@/lib/image/history";
import { loadImageFile, firstImageFile } from "@/lib/image/load";
import { MAX_DIMENSION, canvasToBlob, extensionFor, type ExportFormat } from "@/lib/image/raster";
import { downloadBlob } from "@/lib/download";
import { CopyBlobButton } from "./CopyBlobButton";
import { Panel, Slider, ToolGroup, buttonClass, primaryClass, swatches } from "./controls";
import { addShape, clearShapes, cropDoc, effectDoc, flipDoc, removeShape, resizeDoc, rotateDoc, setAdjustments, updateShape } from "./operations";
import { buildShapeNode, previewCanvas, readTransform, renderDocument } from "./scene";
import { editorReducer, initialEditorState } from "./state";
import { identity, newId, type Shape, type Tool } from "./types";

type Message = { kind: "error" | "info"; text: string } | null;
type TextEdit = { id?: string; x: number; y: number; value: string } | null;

const DRAW_TOOLS: Tool[] = ["brush", "eraser", "line", "arrow", "rect", "ellipse"];
const REGION_TOOLS: Tool[] = ["crop", "blur", "pixelate", "redact"];

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

export default function ImageEditor() {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  const doc = state.history?.present ?? null;
  const hasDoc = doc !== null;

  const [tool, setTool] = useState<Tool>("select");
  const [color, setColor] = useState("#e5322d");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [fontSize, setFontSize] = useState(32);
  const [filled, setFilled] = useState(false);
  const [strength, setStrength] = useState(12);
  const [liveAdj, setLiveAdj] = useState<Adjustments | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [message, setMessage] = useState<Message>(null);
  const [textEdit, setTextEdit] = useState<TextEdit>(null);
  // The image a crop box was drawn on. The box is only "ready" while that image and the Crop tool are current.
  const [cropFor, setCropFor] = useState<HTMLCanvasElement | null>(null);
  const [format, setFormat] = useState<ExportFormat>("png");
  const [quality, setQuality] = useState(0.92);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [sizeEdit, setSizeEdit] = useState<{ forBase: HTMLCanvasElement; width: number; height: number } | null>(null);
  const [lockAspect, setLockAspect] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const imageLayerRef = useRef<Konva.Layer | null>(null);
  const shapeLayerRef = useRef<Konva.Layer | null>(null);
  const uiLayerRef = useRef<Konva.Layer | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const cropTransformerRef = useRef<Konva.Transformer | null>(null);
  const cropNodeRef = useRef<Konva.Rect | null>(null);
  const drawing = useRef<{ start: { x: number; y: number }; points: number[]; node: Konva.Node | null } | null>(null);

  // Latest values for the long-lived Konva handlers (bound once), updated after every render.
  const live = useRef({ tool, color, strokeWidth, fontSize, filled, strength, doc, view });
  useEffect(() => {
    live.current = { tool, color, strokeWidth, fontSize, filled, strength, doc, view };
  });

  const commit = useCallback((next: ReturnType<typeof addShape> | null) => dispatch({ type: "commit", doc: next }), []);
  const say = (kind: "error" | "info", text: string) => setMessage({ kind, text });

  // ---------- Loading images ----------
  const handleFile = useCallback(async (file: File) => {
    setBusy(true);
    setMessage(null);
    try {
      const img = await loadImageFile(file);
      dispatch({ type: "load", base: img.canvas });
      setTool("select");
      setTextEdit(null);
      setSelectedId(null);
      setLiveAdj(null);
      if (img.downscaled) {
        say("info", `Large image scaled down from ${img.originalWidth}×${img.originalHeight} to ${img.canvas.width}×${img.canvas.height} so it edits smoothly.`);
      }
    } catch (e) {
      say("error", e instanceof Error ? e.message : "That image couldn't be opened.");
    } finally {
      setBusy(false);
    }
  }, []);

  // Paste screenshots with Ctrl/Cmd+V.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isTypingTarget(e.target) || !e.clipboardData) return;
      const file = firstImageFile({ files: e.clipboardData.files, items: e.clipboardData.items });
      if (file) {
        e.preventDefault();
        void handleFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile]);

  // ---------- View helpers ----------
  const fitToView = useCallback((scaleOverride?: number) => {
    const el = containerRef.current;
    const d = live.current.doc;
    if (!el || !d) return;
    const w = d.base.width;
    const h = d.base.height;
    const scale = scaleOverride ?? fitScale(el.clientWidth, el.clientHeight, w, h, 24);
    setView({ scale, x: (el.clientWidth - w * scale) / 2, y: (el.clientHeight - h * scale) / 2 });
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const el = containerRef.current;
    if (!el) return;
    setView((v) => zoomAtPoint(v, { x: el.clientWidth / 2, y: el.clientHeight / 2 }, factor));
  }, []);

  // ---------- Stage lifecycle ----------
  useEffect(() => {
    if (!hasDoc) return;
    const el = containerRef.current;
    if (!el) return;

    const stage = new Konva.Stage({ container: el, width: el.clientWidth, height: el.clientHeight });
    const imageLayer = new Konva.Layer({ listening: true });
    const shapeLayer = new Konva.Layer();
    const uiLayer = new Konva.Layer();
    stage.add(imageLayer, shapeLayer, uiLayer);

    const transformer = new Konva.Transformer({ rotateEnabled: true, keepRatio: false, ignoreStroke: true, borderStroke: "#1f4fd8", anchorStroke: "#1f4fd8", anchorSize: 10 });
    const cropTransformer = new Konva.Transformer({ rotateEnabled: false, keepRatio: false, borderStroke: "#ffffff", anchorStroke: "#1f4fd8", anchorFill: "#ffffff", anchorSize: 12 });
    uiLayer.add(transformer, cropTransformer);

    stageRef.current = stage;
    imageLayerRef.current = imageLayer;
    shapeLayerRef.current = shapeLayer;
    uiLayerRef.current = uiLayer;
    transformerRef.current = transformer;
    cropTransformerRef.current = cropTransformer;

    const ro = new ResizeObserver(() => stage.size({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);

    const clearPreview = () => {
      drawing.current?.node?.destroy();
      drawing.current = null;
      uiLayer.batchDraw();
    };

    const pointer = () => stage.getRelativePointerPosition();

    const onDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
      const L = live.current;
      if (!L.doc || L.tool === "hand") return;
      if (L.tool === "select") {
        if (e.target === stage || e.target.getLayer() === imageLayer) setSelectedId(null);
        return;
      }
      if (e.evt.button > 0) return; // left button / touch / pen only
      const p = pointer();
      if (!p) return;

      if (L.tool === "text") {
        setTextEdit({ x: p.x, y: p.y, value: "" });
        return;
      }

      let node: Konva.Node | null = null;
      const dash = [8, 6];
      if (L.tool === "brush") node = new Konva.Line({ points: [p.x, p.y], stroke: L.color, strokeWidth: L.strokeWidth, lineCap: "round", lineJoin: "round", tension: 0.3 });
      else if (L.tool === "eraser") node = new Konva.Line({ points: [p.x, p.y], stroke: "rgba(120,120,120,0.55)", strokeWidth: L.strokeWidth * 2, lineCap: "round", lineJoin: "round" });
      else if (L.tool === "line") node = new Konva.Line({ points: [p.x, p.y, p.x, p.y], stroke: L.color, strokeWidth: L.strokeWidth, lineCap: "round" });
      else if (L.tool === "arrow") node = new Konva.Arrow({ points: [p.x, p.y, p.x, p.y], stroke: L.color, fill: L.color, strokeWidth: L.strokeWidth, pointerLength: Math.max(10, L.strokeWidth * 3), pointerWidth: Math.max(10, L.strokeWidth * 3) });
      else if (L.tool === "rect") node = new Konva.Rect({ x: p.x, y: p.y, width: 0, height: 0, stroke: L.color, strokeWidth: L.strokeWidth, fill: L.filled ? L.color : undefined });
      else if (L.tool === "ellipse") node = new Konva.Ellipse({ x: p.x, y: p.y, radiusX: 0, radiusY: 0, stroke: L.color, strokeWidth: L.strokeWidth, fill: L.filled ? L.color : undefined });
      else if (REGION_TOOLS.includes(L.tool)) {
        // Starting a new crop selection replaces the previous one.
        if (L.tool === "crop") {
          cropNodeRef.current?.destroy();
          cropNodeRef.current = null;
          cropTransformer.nodes([]);
          setCropFor(null);
        }
        node = new Konva.Rect({ x: p.x, y: p.y, width: 0, height: 0, stroke: L.tool === "redact" ? "#111" : "#ffffff", strokeWidth: 2 / L.view.scale, dash: dash.map((d) => d / L.view.scale), fill: "rgba(31,79,216,0.18)" });
      }
      if (!node) return;
      uiLayer.add(node as Konva.Shape);
      drawing.current = { start: p, points: [p.x, p.y], node };
    };

    const onMove = () => {
      const D = drawing.current;
      const L = live.current;
      if (!D || !D.node) return;
      const p = pointer();
      if (!p) return;
      if (L.tool === "brush" || L.tool === "eraser") {
        D.points.push(p.x, p.y);
        (D.node as Konva.Line).points(D.points);
      } else if (L.tool === "line" || L.tool === "arrow") {
        (D.node as Konva.Line).points([D.start.x, D.start.y, p.x, p.y]);
      } else if (L.tool === "ellipse") {
        const r = normalizeRect(D.start, p);
        (D.node as Konva.Ellipse).setAttrs({ x: r.x + r.width / 2, y: r.y + r.height / 2, radiusX: r.width / 2, radiusY: r.height / 2 });
      } else {
        const r = normalizeRect(D.start, p);
        (D.node as Konva.Rect).setAttrs(r);
      }
      uiLayer.batchDraw();
    };

    const onUp = () => {
      const D = drawing.current;
      const L = live.current;
      if (!D || !D.node || !L.doc) return;
      const p = pointer() ?? D.start;
      const dist = Math.hypot(p.x - D.start.x, p.y - D.start.y);
      const t = L.tool;

      if (REGION_TOOLS.includes(t)) {
        const rect: Rect = normalizeRect(D.start, p);
        if (t === "crop") {
          // Keep the rectangle on screen as an adjustable crop box.
          const box = D.node as Konva.Rect;
          drawing.current = null;
          if (rect.width < 4 || rect.height < 4) { box.destroy(); uiLayer.batchDraw(); return; }
          box.setAttrs({ draggable: true, fill: "rgba(0,0,0,0)", stroke: "#ffffff" });
          cropNodeRef.current = box;
          cropTransformer.nodes([box]);
          setCropFor(L.doc.base);
          uiLayer.batchDraw();
          return;
        }
        clearPreview();
        if (rect.width >= 2 && rect.height >= 2) {
          const next = effectDoc(L.doc, rect, t as "blur" | "pixelate" | "redact", L.strength);
          if (next) commit(next);
          else say("info", "Select an area inside the image.");
        }
        return;
      }

      const points = D.points;
      clearPreview();
      let shape: Shape | null = null;
      if (L.tool === "brush") {
        // A tap makes a dot.
        const pts = points.length === 2 ? [points[0], points[1], points[0] + 0.01, points[1] + 0.01] : points;
        shape = { ...identity, id: newId(), type: "pen", points: pts, color: L.color, strokeWidth: L.strokeWidth };
      } else if (L.tool === "eraser") {
        const pts = points.length === 2 ? [points[0], points[1], points[0] + 0.01, points[1] + 0.01] : points;
        shape = { ...identity, id: newId(), type: "eraser", points: pts, strokeWidth: L.strokeWidth * 2 };
      } else if (dist >= 3) {
        if (L.tool === "line" || L.tool === "arrow") {
          shape = { ...identity, id: newId(), type: L.tool, points: [D.start.x, D.start.y, p.x, p.y], color: L.color, strokeWidth: L.strokeWidth };
        } else if (L.tool === "rect") {
          const r = normalizeRect(D.start, p);
          shape = { ...identity, id: newId(), type: "rect", x: r.x, y: r.y, width: r.width, height: r.height, color: L.color, strokeWidth: L.strokeWidth, filled: L.filled };
        } else if (L.tool === "ellipse") {
          const r = normalizeRect(D.start, p);
          shape = { ...identity, id: newId(), type: "ellipse", x: r.x + r.width / 2, y: r.y + r.height / 2, radiusX: r.width / 2, radiusY: r.height / 2, color: L.color, strokeWidth: L.strokeWidth, filled: L.filled };
        }
      }
      if (shape) {
        commit(addShape(L.doc, shape));
        if (shape.type !== "eraser" && shape.type !== "pen") setSelectedId(null);
      }
    };

    const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
      // Plain scrolling keeps scrolling the page; Ctrl/Cmd + wheel (or trackpad pinch) zooms.
      if (!(e.evt.ctrlKey || e.evt.metaKey)) return;
      e.evt.preventDefault();
      const ptr = stage.getPointerPosition();
      if (!ptr) return;
      setView((v) => zoomAtPoint(v, ptr, e.evt.deltaY < 0 ? 1.1 : 1 / 1.1));
    };

    const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
      if (e.target === stage) setView((v) => ({ ...v, x: stage.x(), y: stage.y() }));
    };

    stage.on("pointerdown", onDown);
    stage.on("pointermove", onMove);
    stage.on("wheel", onWheel);
    stage.on("dragend", onDragEnd);
    window.addEventListener("pointerup", onUp);

    return () => {
      window.removeEventListener("pointerup", onUp);
      ro.disconnect();
      stage.destroy();
      stageRef.current = null;
      cropNodeRef.current = null;
    };
  }, [hasDoc, commit]);

  // ---------- Keep the photo node in sync ----------
  const shownAdj = liveAdj ?? doc?.adjustments ?? defaultAdjustments;
  const base = doc?.base ?? null;
  useEffect(() => {
    const layer = imageLayerRef.current;
    if (!layer || !base) return;
    layer.destroyChildren();
    layer.add(new Konva.Image({ image: previewCanvas(base, shownAdj), width: base.width, height: base.height, name: "photo" }));
    layer.batchDraw();
  }, [base, shownAdj, hasDoc]);

  // Fit the image when it is loaded or its dimensions change; clear any crop box.
  useEffect(() => {
    if (!base) return;
    fitToView();
    cropNodeRef.current?.destroy();
    cropNodeRef.current = null;
    cropTransformerRef.current?.nodes([]);
  }, [base, fitToView]);

  // Apply zoom/pan to the stage.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.scale({ x: view.scale, y: view.scale });
    stage.position({ x: view.x, y: view.y });
    stage.batchDraw();
  }, [view, hasDoc]);

  // ---------- Rebuild annotations ----------
  const shapes = doc?.shapes;
  useEffect(() => {
    const layer = shapeLayerRef.current;
    const transformer = transformerRef.current;
    if (!layer || !transformer || !shapes) return;
    const interactive = tool === "select";
    layer.destroyChildren();
    let selectedNode: Konva.Node | null = null;

    shapes.forEach((s) => {
      const node = buildShapeNode(s, interactive);
      if (interactive && s.type !== "eraser") {
        node.on("pointerdown tap", () => setSelectedId(s.id));
        node.on("dragend transformend", () => {
          const d = live.current.doc;
          if (d) commit(updateShape(d, s.id, readTransform(node)));
        });
        if (s.type === "text") {
          node.on("dblclick dbltap", () => setTextEdit({ id: s.id, x: s.x, y: s.y, value: s.text }));
        }
        if (s.id === selectedId) selectedNode = node;
      }
      layer.add(node as Konva.Shape);
    });
    transformer.nodes(selectedNode ? [selectedNode] : []);
    layer.batchDraw();
    uiLayerRef.current?.batchDraw();
  }, [shapes, tool, selectedId, commit, hasDoc]);

  // ---------- Tool changes ----------
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.draggable(tool === "hand");
    const cursors: Partial<Record<Tool, string>> = { hand: "grab", text: "text", select: "default" };
    stage.container().style.cursor = cursors[tool] ?? "crosshair";
    if (tool !== "select") transformerRef.current?.nodes([]);
    if (tool !== "crop") {
      cropNodeRef.current?.destroy();
      cropNodeRef.current = null;
      cropTransformerRef.current?.nodes([]);
      uiLayerRef.current?.batchDraw();
    }
  }, [tool, hasDoc]);

  // Switching tools also drops any selection or half-typed text.
  const pickTool = useCallback((t: Tool) => {
    setTool(t);
    if (t !== "select") setSelectedId(null);
    setTextEdit(null);
  }, []);

  // ---------- Actions ----------
  const applyCrop = useCallback(() => {
    const node = cropNodeRef.current;
    const d = live.current.doc;
    if (!node || !d) return;
    const rect = clampRect({ x: node.x(), y: node.y(), width: node.width() * node.scaleX(), height: node.height() * node.scaleY() }, d.base.width, d.base.height);
    if (!rect) { say("error", "Move the crop box over the image."); return; }
    const next = cropDoc(d, rect);
    if (next) commit(next);
    else say("info", "That crop is the whole image.");
  }, [commit]);

  const cancelCrop = useCallback(() => {
    cropNodeRef.current?.destroy();
    cropNodeRef.current = null;
    cropTransformerRef.current?.nodes([]);
    setCropFor(null);
    uiLayerRef.current?.batchDraw();
  }, []);

  const deleteSelected = useCallback(() => {
    const d = live.current.doc;
    if (d && selectedId) { commit(removeShape(d, selectedId)); setSelectedId(null); }
  }, [selectedId, commit]);

  // Keyboard shortcuts.
  useEffect(() => {
    if (!hasDoc) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") { e.preventDefault(); dispatch({ type: e.shiftKey ? "redo" : "undo" }); }
      else if (mod && k === "y") { e.preventDefault(); dispatch({ type: "redo" }); }
      else if ((k === "delete" || k === "backspace") && selectedId) { e.preventDefault(); deleteSelected(); }
      else if (k === "enter" && cropNodeRef.current) { e.preventDefault(); applyCrop(); }
      else if (k === "escape") { cancelCrop(); setSelectedId(null); setTextEdit(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasDoc, selectedId, deleteSelected, applyCrop, cancelCrop]);

  const commitText = (value: string) => {
    const d = live.current.doc;
    const edit = textEdit;
    setTextEdit(null);
    if (!d || !edit) return;
    const text = value.trim();
    if (edit.id) {
      commit(text ? updateShape(d, edit.id, { text } as Partial<Shape>) : removeShape(d, edit.id));
    } else if (text) {
      const shape: Shape = { ...identity, id: newId(), type: "text", x: edit.x, y: edit.y, text, fontSize: live.current.fontSize, color: live.current.color };
      commit(addShape(d, shape));
      setTool("select");
      setSelectedId(shape.id);
    }
  };

  const commitAdjustments = () => {
    if (!doc || !liveAdj) return;
    const same = JSON.stringify(liveAdj) === JSON.stringify(doc.adjustments);
    if (!same) commit(setAdjustments(doc, liveAdj));
    setLiveAdj(null);
  };

  const exportCanvas = () => {
    if (!doc) throw new Error("No image loaded.");
    return renderDocument(doc, true);
  };

  const download = async () => {
    setBusy(true);
    try {
      const blob = await canvasToBlob(exportCanvas(), format, quality);
      downloadBlob(`edited-image.${extensionFor(format)}`, blob);
      say("info", `Saved ${doc!.base.width}×${doc!.base.height} ${format.toUpperCase()} (${Math.max(1, Math.round(blob.size / 1024)).toLocaleString("en-US")} KB).`);
    } catch (e) {
      say("error", e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  const newImage = () => {
    if (state.history && canUndo(state.history) && !window.confirm("Close this image? Your edits will be lost.")) return;
    dispatch({ type: "close" });
    setMessage(null);
    setLiveAdj(null);
  };

  const onPickFile = (files: FileList | null) => {
    const f = files?.[0];
    if (f) void handleFile(f);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ======================= Empty state =======================
  if (!doc) {
    return (
      <div className="grid gap-3">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = firstImageFile({ files: e.dataTransfer.files, items: e.dataTransfer.items });
            if (f) void handleFile(f);
            else say("error", "Drop an image file (PNG, JPG, WebP, GIF or BMP).");
          }}
          className={`grid place-items-center gap-3 rounded-md border-2 border-dashed p-10 text-center ${dragOver ? "border-accent bg-bg" : "border-line"}`}
        >
          <p className="text-lg font-semibold">Drop an image here</p>
          <p className="text-sm text-muted">or paste a screenshot with Ctrl+V (Cmd+V on Mac)</p>
          <button type="button" className={primaryClass} disabled={busy} onClick={() => fileInputRef.current?.click()}>
            {busy ? "Opening…" : "Choose an image"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp" className="sr-only" aria-label="Choose an image file" onChange={(e) => onPickFile(e.target.files)} />
          <p className="text-xs text-muted">Your image stays on this device. Nothing is uploaded. PNG, JPG, WebP, GIF or BMP up to 25 MB.</p>
        </div>
        <div role="status" aria-live="polite">{message && <p className={message.kind === "error" ? "text-sm text-bad" : "text-sm text-muted"}>{message.text}</p>}</div>
      </div>
    );
  }

  // ======================= Editor =======================
  const history = state.history!;
  const cropReady = tool === "crop" && cropFor === doc.base;
  const sizeInput = sizeEdit && sizeEdit.forBase === doc.base ? sizeEdit : { width: doc.base.width, height: doc.base.height };
  const selected = tool === "select" ? doc.shapes.find((s) => s.id === selectedId) : undefined;
  const showStroke = DRAW_TOOLS.includes(tool);
  const showColor = (tool !== "eraser" && DRAW_TOOLS.includes(tool)) || tool === "text";
  const showFill = tool === "rect" || tool === "ellipse";
  const adj = shownAdj;

  const setAdj = (patch: Partial<Adjustments>) => setLiveAdj({ ...adj, ...patch });
  const resizeEdit = (edit: { width?: number; height?: number }) =>
    setSizeEdit({ forBase: doc.base, ...resizeDimensions({ width: doc.base.width, height: doc.base.height }, edit, lockAspect, MAX_DIMENSION) });

  return (
    <div className="grid gap-3">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass} disabled={!canUndo(history)} onClick={() => dispatch({ type: "undo" })}>Undo</button>
        <button type="button" className={buttonClass} disabled={!canRedo(history)} onClick={() => dispatch({ type: "redo" })}>Redo</button>
        <button type="button" className={buttonClass} disabled={!canUndo(history)} onClick={() => dispatch({ type: "reset" })}>Reset</button>
        <button type="button" className={buttonClass} disabled={!doc.shapes.length} onClick={() => commit(clearShapes(doc))}>Clear drawings</button>
        <button type="button" className={buttonClass} disabled={!selectedId} onClick={deleteSelected}>Delete selected</button>
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
        <button type="button" className={buttonClass} aria-label="Zoom out" onClick={() => zoomBy(1 / 1.25)}>−</button>
        <span className="w-14 text-center text-sm tabular-nums" aria-live="polite">{Math.round(view.scale * 100)}%</span>
        <button type="button" className={buttonClass} aria-label="Zoom in" onClick={() => zoomBy(1.25)}>+</button>
        <button type="button" className={buttonClass} onClick={() => fitToView()}>Fit</button>
        <button type="button" className={buttonClass} onClick={() => fitToView(1)}>100%</button>
        <span className="ml-auto text-sm text-muted tabular-nums">{doc.base.width}×{doc.base.height}</span>
        <button type="button" className={buttonClass} onClick={newImage}>New image</button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[9.5rem_minmax(0,1fr)_16rem]">
        {/* Tools */}
        <div className="grid content-start gap-3">
          <ToolGroup title="Edit" tools={["select", "hand", "crop", "text"]} active={tool} onPick={pickTool} />
          <ToolGroup title="Draw" tools={["brush", "eraser", "line", "arrow", "rect", "ellipse"]} active={tool} onPick={pickTool} />
          <ToolGroup title="Hide details" tools={["blur", "pixelate", "redact"]} active={tool} onPick={pickTool} />
        </div>

        {/* Canvas */}
        <div className="relative min-w-0">
          <div
            ref={containerRef}
            role="img"
            aria-label="Image editing canvas"
            className="relative h-[60vh] min-h-[320px] touch-none overflow-hidden rounded-md border border-line bg-[repeating-conic-gradient(var(--line)_0%_25%,var(--panel)_0%_50%)] bg-[length:16px_16px]"
          />
          {textEdit && (
            <input
              autoFocus
              aria-label="Text"
              defaultValue={textEdit.value}
              placeholder="Type, then press Enter"
              className="absolute z-10 min-w-24 rounded border border-accent bg-panel px-1 text-ink"
              style={{
                left: view.x + textEdit.x * view.scale,
                top: view.y + textEdit.y * view.scale,
                fontSize: Math.max(12, fontSize * view.scale),
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitText(e.currentTarget.value);
                if (e.key === "Escape") setTextEdit(null);
              }}
              onBlur={(e) => commitText(e.currentTarget.value)}
            />
          )}
          {tool === "crop" && (
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-md border border-line bg-panel p-2 shadow">
              <span className="text-sm">{cropReady ? "Adjust the box, then apply." : "Drag on the image to choose an area."}</span>
              <button type="button" className={primaryClass} disabled={!cropReady} onClick={applyCrop}>Apply crop</button>
              <button type="button" className={buttonClass} disabled={!cropReady} onClick={cancelCrop}>Cancel</button>
            </div>
          )}
        </div>

        {/* Side panels */}
        <div className="grid content-start gap-3">
          {(showColor || showStroke || showFill || tool === "blur" || tool === "pixelate" || tool === "redact" || (tool === "select" && selected)) && (
            <Panel title={tool === "select" ? "Selected shape" : "Tool options"}>
              {showColor && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <label htmlFor="ie-color">Colour</label>
                    <input id="ie-color" type="color" value={color} onChange={(e) => { setColor(e.target.value); }} className="h-7 w-10 cursor-pointer rounded border border-line bg-panel" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {swatches.map((c) => (
                      <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className={`h-6 w-6 rounded-full border ${color === c ? "border-accent ring-2 ring-accent" : "border-line"}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              )}
              {showStroke && <Slider id="ie-stroke" label={tool === "eraser" ? "Eraser size" : "Line width"} value={strokeWidth} min={1} max={40} onChange={setStrokeWidth} />}
              {showFill && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={filled} onChange={(e) => setFilled(e.target.checked)} /> Filled shape
                </label>
              )}
              {tool === "text" && <Slider id="ie-font" label="Text size" value={fontSize} min={12} max={160} onChange={setFontSize} />}
              {(tool === "blur" || tool === "pixelate") && (
                <Slider id="ie-strength" label={tool === "blur" ? "Blur radius" : "Block size"} value={strength} min={tool === "blur" ? 2 : 4} max={tool === "blur" ? 40 : 60} unit=" px" onChange={setStrength} />
              )}
              {tool === "redact" && <p className="text-sm text-muted">Drag over anything private. It is painted over permanently in the saved image.</p>}
              {tool === "select" && selected && (
                <>
                  {"color" in selected && (
                    <div className="flex flex-wrap gap-1.5">
                      {swatches.map((c) => (
                        <button key={c} type="button" aria-label={`Set colour ${c}`} onClick={() => commit(updateShape(doc, selected.id, { color: c } as Partial<Shape>))} className="h-6 w-6 rounded-full border border-line" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  )}
                  {"strokeWidth" in selected && selected.type !== "eraser" && (
                    <div className="flex gap-1.5">
                      <button type="button" className={buttonClass} disabled={selected.strokeWidth <= 1} onClick={() => commit(updateShape(doc, selected.id, { strokeWidth: Math.max(1, selected.strokeWidth - 2) } as Partial<Shape>))}>Thinner</button>
                      <button type="button" className={buttonClass} disabled={selected.strokeWidth >= 40} onClick={() => commit(updateShape(doc, selected.id, { strokeWidth: Math.min(40, selected.strokeWidth + 2) } as Partial<Shape>))}>Thicker</button>
                    </div>
                  )}
                  {selected.type === "text" && (
                    <div className="flex gap-1.5">
                      <button type="button" className={buttonClass} onClick={() => commit(updateShape(doc, selected.id, { fontSize: Math.max(8, selected.fontSize - 4) } as Partial<Shape>))}>Smaller text</button>
                      <button type="button" className={buttonClass} onClick={() => commit(updateShape(doc, selected.id, { fontSize: Math.min(300, selected.fontSize + 4) } as Partial<Shape>))}>Larger text</button>
                    </div>
                  )}
                  <p className="text-sm text-muted">Drag to move. Use the handles to resize or rotate. Double-click text to edit. Press Delete to remove.</p>
                </>
              )}
            </Panel>
          )}

          <Panel title="Adjust">
            <Slider id="ie-bright" label="Brightness" value={adj.brightness} min={-100} max={100} onChange={(v) => setAdj({ brightness: v })} onCommit={commitAdjustments} />
            <Slider id="ie-contrast" label="Contrast" value={adj.contrast} min={-100} max={100} onChange={(v) => setAdj({ contrast: v })} onCommit={commitAdjustments} />
            <Slider id="ie-sat" label="Saturation" value={adj.saturation} min={-100} max={100} onChange={(v) => setAdj({ saturation: v })} onCommit={commitAdjustments} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={adj.grayscale} onChange={(e) => commit(setAdjustments(doc, { ...doc.adjustments, grayscale: e.target.checked }))} /> Grayscale
            </label>
            <button type="button" className={buttonClass} disabled={isDefaultAdjustments(doc.adjustments) && !liveAdj} onClick={() => { setLiveAdj(null); commit(setAdjustments(doc, { ...defaultAdjustments })); }}>
              Reset adjustments
            </button>
          </Panel>

          <Panel title="Rotate, flip, resize">
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={buttonClass} onClick={() => commit(rotateDoc(doc, -1))}>Rotate left</button>
              <button type="button" className={buttonClass} onClick={() => commit(rotateDoc(doc, 1))}>Rotate right</button>
              <button type="button" className={buttonClass} onClick={() => commit(flipDoc(doc, "horizontal"))}>Flip horizontal</button>
              <button type="button" className={buttonClass} onClick={() => commit(flipDoc(doc, "vertical"))}>Flip vertical</button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label>Width
                <input type="number" min={1} max={MAX_DIMENSION} value={sizeInput.width} onChange={(e) => resizeEdit({ width: Number(e.target.value) })} className="mt-1 w-full rounded-md border border-line bg-panel px-2 py-1" />
              </label>
              <label>Height
                <input type="number" min={1} max={MAX_DIMENSION} value={sizeInput.height} onChange={(e) => resizeEdit({ height: Number(e.target.value) })} className="mt-1 w-full rounded-md border border-line bg-panel px-2 py-1" />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lockAspect} onChange={(e) => setLockAspect(e.target.checked)} /> Keep proportions</label>
            <button type="button" className={buttonClass} onClick={() => { const n = resizeDoc(doc, sizeInput.width, sizeInput.height); if (n) commit(n); }}>Apply size</button>
          </Panel>

          <Panel title="Save">
            <label className="grid gap-1 text-sm">Format
              <select className="rounded-md border border-line bg-panel px-2 py-1" value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
                <option value="png">PNG (lossless)</option>
                <option value="jpeg">JPG (smaller)</option>
                <option value="webp">WebP (smallest)</option>
              </select>
            </label>
            {format !== "png" && <Slider id="ie-quality" label="Quality" value={Math.round(quality * 100)} min={30} max={100} unit="%" onChange={(v) => setQuality(v / 100)} />}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={primaryClass} disabled={busy} onClick={download}>{busy ? "Saving…" : "Download"}</button>
              <CopyBlobButton getBlob={() => canvasToBlob(exportCanvas(), "png", 1)} onResult={say} />
            </div>
            <p className="text-xs text-muted">Saved images contain no camera or location data.</p>
          </Panel>
        </div>
      </div>

      <div role="status" aria-live="polite">{message && <p className={message.kind === "error" ? "text-sm text-bad" : "text-sm text-muted"}>{message.text}</p>}</div>
      <p className="text-xs text-muted">
        Shortcuts: Ctrl+Z undo, Ctrl+Shift+Z redo, Delete removes the selected shape, Enter applies a crop, Esc cancels. Ctrl + scroll zooms; use Pan to move around.
      </p>
    </div>
  );
}
