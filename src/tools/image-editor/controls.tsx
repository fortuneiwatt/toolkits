"use client";

import type { ReactNode } from "react";
import { toolLabels, type Tool } from "./types";

const btn =
  "rounded-md border border-line bg-panel px-2.5 py-1.5 text-sm font-medium hover:border-accent disabled:cursor-not-allowed disabled:opacity-50";
const btnActive = "rounded-md border border-accent bg-accent px-2.5 py-1.5 text-sm font-semibold text-accent-ink";

export function ToolGroup({ title, tools, active, onPick }: { title: string; tools: Tool[]; active: Tool; onPick: (t: Tool) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-xs text-muted">{title}</legend>
      <div className="flex flex-wrap gap-1.5 lg:grid lg:grid-cols-2">
        {tools.map((t) => (
          <button key={t} type="button" aria-pressed={active === t} className={active === t ? btnActive : btn} onClick={() => onPick(t)}>
            {toolLabels[t]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Slider(props: {
  id: string; label: string; value: number; min: number; max: number; step?: number; unit?: string;
  onChange: (v: number) => void; onCommit?: () => void;
}) {
  return (
    <div>
      <label htmlFor={props.id} className="flex justify-between text-sm">
        <span>{props.label}</span>
        <span className="text-muted tabular-nums">{props.value}{props.unit ?? ""}</span>
      </label>
      <input
        id={props.id}
        type="range"
        className="w-full accent-[var(--accent)]"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        onPointerUp={props.onCommit}
        onKeyUp={props.onCommit}
        onBlur={props.onCommit}
      />
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 rounded-md border border-line bg-panel p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export const swatches = ["#e5322d", "#f59e0b", "#16a34a", "#2563eb", "#7c3aed", "#ffffff", "#111827"];

export const buttonClass = btn;
export const primaryClass = "rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";
