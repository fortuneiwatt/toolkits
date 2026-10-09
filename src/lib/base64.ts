/** Base64 for text. Unicode-safe (UTF-8), with an optional URL-safe alphabet. */
export function encodeBase64(text: string, opts: { urlSafe?: boolean } = {}): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  // Chunked so large inputs don't overflow the call stack.
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const out = btoa(binary);
  return opts.urlSafe ? out.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : out;
}

export type Base64Decode = { ok: true; text: string } | { ok: false; error: string };

/** Accepts standard and URL-safe Base64, with or without padding, ignoring whitespace and line breaks. */
export function decodeBase64(input: string): Base64Decode {
  let s = input.replace(/\s+/g, "");
  if (s === "") return { ok: true, text: "" };
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) return { ok: false, error: "This contains characters that aren't valid Base64." };
  s = s.replace(/=+$/, "");
  if (s.length % 4 === 1) return { ok: false, error: "The length isn't valid for Base64. Part of it may be missing." };
  s += "=".repeat((4 - (s.length % 4)) % 4);

  let binary: string;
  try {
    binary = atob(s);
  } catch {
    return { ok: false, error: "This isn't valid Base64." };
  }
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, error: "The decoded data isn't valid UTF-8 text. It may be binary data such as an image or file." };
  }
}
