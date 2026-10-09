"use client";

import { useState } from "react";
import { buttonClass } from "./controls";

/** Copies a PNG to the clipboard where the browser allows it. Passing a promise keeps Safari's user-gesture rule happy. */
export function CopyBlobButton({ getBlob, onResult }: { getBlob: () => Promise<Blob>; onResult: (kind: "error" | "info", text: string) => void }) {
  const [busy, setBusy] = useState(false);
  const supported = typeof window !== "undefined" && typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;

  async function copy() {
    setBusy(true);
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": getBlob() })]);
      onResult("info", "Copied the image to your clipboard.");
    } catch {
      onResult("error", "Your browser blocked copying. Use Download instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={buttonClass} disabled={busy || !supported} title={supported ? undefined : "Copying images isn't supported in this browser"} onClick={copy}>
      {busy ? "Copying…" : "Copy image"}
    </button>
  );
}
