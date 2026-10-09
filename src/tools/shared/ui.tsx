"use client";

import { useState } from "react";

export const fieldClass =
  "w-full rounded-md border border-line bg-panel p-3 font-mono text-sm leading-relaxed placeholder:text-muted";

export const buttonClass =
  "rounded-md border border-line bg-panel px-3 py-1.5 text-sm font-medium hover:border-accent disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButtonClass =
  "rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

export function CopyButton({ text, disabled }: { text: string; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 1500);
  }

  return (
    <button type="button" className={buttonClass} onClick={copy} disabled={disabled}>
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}</span>
    </button>
  );
}
