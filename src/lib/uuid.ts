export function uuidV4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts: still uses the secure RNG, never Math.random.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
  return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h.slice(8, 10).join("")}-${h.slice(10).join("")}`;
}

export interface UuidOptions {
  count: number;
  uppercase: boolean;
  hyphens: boolean;
}

export function generateUuids({ count, uppercase, hyphens }: UuidOptions): string[] {
  const n = Math.min(500, Math.max(1, Math.floor(Number.isFinite(count) ? count : 1)));
  return Array.from({ length: n }, () => {
    let id = uuidV4();
    if (!hyphens) id = id.replaceAll("-", "");
    return uppercase ? id.toUpperCase() : id;
  });
}
