import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createCanvas } from "@/lib/image/raster";
import {
  baseName, dedupeNames, formatBytes, outputFileName, processImage, resolveFormat, savingsPercent, targetSize,
} from "@/lib/image/process";
import { crc32, makeZip } from "@/lib/zip";

describe("output format", () => {
  it("smart keeps jpg/webp and turns everything else into webp", () => {
    expect(resolveFormat("image/jpeg", "smart")).toBe("jpeg");
    expect(resolveFormat("image/webp", "smart")).toBe("webp");
    expect(resolveFormat("image/png", "smart")).toBe("webp");
    expect(resolveFormat("image/gif", "smart")).toBe("webp");
    expect(resolveFormat("image/bmp", "smart")).toBe("webp");
  });
  it("same keeps writable formats, otherwise png", () => {
    expect(resolveFormat("image/jpeg", "same")).toBe("jpeg");
    expect(resolveFormat("image/png", "same")).toBe("png");
    expect(resolveFormat("image/gif", "same")).toBe("png");
  });
  it("an explicit choice always wins", () => expect(resolveFormat("image/png", "jpeg")).toBe("jpeg"));
});

describe("targetSize", () => {
  it("none keeps the size", () => expect(targetSize(800, 600, { kind: "none" })).toEqual({ width: 800, height: 600 }));
  it("fit scales down inside the box and keeps proportions", () => {
    expect(targetSize(2000, 1000, { kind: "fit", maxWidth: 1000, maxHeight: 1000, allowEnlarge: false })).toEqual({ width: 1000, height: 500 });
  });
  it("fit never enlarges unless allowed", () => {
    expect(targetSize(400, 200, { kind: "fit", maxWidth: 1000, maxHeight: 1000, allowEnlarge: false })).toEqual({ width: 400, height: 200 });
    expect(targetSize(400, 200, { kind: "fit", maxWidth: 800, maxHeight: Infinity, allowEnlarge: true })).toEqual({ width: 800, height: 400 });
  });
  it("one dimension only works via Infinity", () => {
    expect(targetSize(1000, 500, { kind: "fit", maxWidth: Infinity, maxHeight: 100, allowEnlarge: false })).toEqual({ width: 200, height: 100 });
  });
  it("exact stretches, percent scales", () => {
    expect(targetSize(100, 100, { kind: "exact", width: 50, height: 20 })).toEqual({ width: 50, height: 20 });
    expect(targetSize(200, 100, { kind: "percent", percent: 50 })).toEqual({ width: 100, height: 50 });
  });
  it("never exceeds the 4096 safety cap, keeping proportions", () => {
    expect(targetSize(1000, 500, { kind: "percent", percent: 1000 })).toEqual({ width: 4096, height: 2048 });
    expect(targetSize(100, 100, { kind: "exact", width: 99999, height: 99999 })).toEqual({ width: 4096, height: 4096 });
  });
  it("never returns zero", () => expect(targetSize(10, 10, { kind: "percent", percent: 0 })).toEqual({ width: 1, height: 1 }));
});

describe("names and formatting", () => {
  it("builds safe output names", () => {
    expect(baseName("My Photo.final.JPG")).toBe("My Photo.final");
    expect(baseName("../../etc/passwd.png")).toBe("etc-passwd");
    expect(baseName("###.png")).toBe("image");
    expect(outputFileName("a.png", "jpeg", "-small")).toBe("a-small.jpg");
  });
  it("dedupes duplicates case-insensitively", () => {
    expect(dedupeNames(["a.jpg", "A.jpg", "b.jpg", "a.jpg"])).toEqual(["a.jpg", "A (2).jpg", "b.jpg", "a (3).jpg"]);
  });
  it("formats sizes and savings", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(savingsPercent(1000, 250)).toBe(75);
    expect(savingsPercent(1000, 1100)).toBe(-10);
    expect(savingsPercent(0, 5)).toBe(0);
  });
});

function noisy(w: number, h: number) {
  const c = createCanvas(w, h);
  const ctx = c.getContext("2d")!;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    ctx.fillStyle = `rgb(${(x * 7 + y * 3) % 256},${(x * 5 + y * 11) % 256},${(x * y) % 256})`;
    ctx.fillRect(x, y, 2, 2);
  }
  return c;
}

describe("processImage (real canvas)", () => {
  it("lower quality gives a smaller JPEG", async () => {
    const src = noisy(200, 200);
    const hi = await processImage(src, { resize: { kind: "none" }, format: "jpeg", quality: 0.95 });
    const lo = await processImage(src, { resize: { kind: "none" }, format: "jpeg", quality: 0.3 });
    expect(hi.format).toBe("jpeg");
    expect(lo.blob.size).toBeLessThan(hi.blob.size);
  });
  it("resizes to the target dimensions", async () => {
    const out = await processImage(noisy(200, 100), { resize: { kind: "percent", percent: 50 }, format: "png", quality: 1 });
    expect([out.width, out.height]).toEqual([100, 50]);
    expect(out.blob.type).toBe("image/png");
  });
  it("transparent PNG becomes white (not black) when saved as JPEG", async () => {
    const src = createCanvas(4, 4); // fully transparent
    const out = await processImage(src, { resize: { kind: "none" }, format: "jpeg", quality: 0.9 });
    expect(out.blob.type).toBe("image/jpeg");
    expect(out.blob.size).toBeGreaterThan(0);
  });
  it("reports the format actually written when the browser can't encode the one requested", async () => {
    const out = await processImage(noisy(20, 20), { resize: { kind: "none" }, format: "webp", quality: 0.8 });
    expect(out.blob.type).toBe(`image/${out.format}`);
    expect(out.fellBack).toBe(out.format !== "webp");
  });
});

describe("zip writer", () => {
  it("computes the standard CRC-32", () => expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926));
  it("produces an archive that the system unzip accepts and extracts byte-for-byte", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zip-"));
    const a = new Uint8Array(Array.from({ length: 5000 }, (_, i) => i % 251));
    const b = new TextEncoder().encode("héllo wörld ✓");
    const zip = makeZip([{ name: "a.bin", data: a }, { name: "naïve ✓.txt", data: b }]);
    const file = path.join(dir, "t.zip");
    fs.writeFileSync(file, zip);
    const has = spawnSync("unzip", ["-v"]).status === 0;
    if (!has) return; // unzip not installed on this machine: skip the external check
    expect(execFileSync("unzip", ["-tq", file]).toString()).toMatch(/No errors/);
    execFileSync("unzip", ["-qo", file, "-d", dir]);
    expect(new Uint8Array(fs.readFileSync(path.join(dir, "a.bin")))).toEqual(a);
    expect(fs.readFileSync(path.join(dir, "naïve ✓.txt"), "utf8")).toBe("héllo wörld ✓");
  });
  it("flattens path traversal in entry names", () => {
    const zip = makeZip([{ name: "../../evil.txt", data: new Uint8Array([1]) }]);
    const text = new TextDecoder("latin1").decode(zip);
    expect(text).not.toContain("../");
  });
  it("handles an empty archive", () => expect(makeZip([]).length).toBe(22));
});
