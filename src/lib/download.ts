/** Turn arbitrary text into a safe download filename. */
export function safeFilename(name: string, fallback = "download"): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 80);
  return cleaned || fallback;
}

export function downloadText(filename: string, content: string, mime = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFilename(filename);
  a.rel = "noopener";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFilename(filename);
  a.rel = "noopener";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
