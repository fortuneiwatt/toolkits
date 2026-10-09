import { parseJson, formatJson, minifyJson, sortKeys } from "@/lib/json";
import { generateUuids, uuidV4 } from "@/lib/uuid";
import { textStats } from "@/lib/textStats";
import { safeJsonLd } from "@/lib/jsonLd";
import { safeFilename } from "@/lib/download";
import { exceedsLimit, MAX_TEXT_CHARS } from "@/lib/limits";

describe("json", () => {
  it("parses valid JSON", () => expect(parseJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } }));
  it("reports invalid JSON", () => expect(parseJson("{").ok).toBe(false));
  it("rejects empty input", () => expect(parseJson("  ").ok).toBe(false));
  it("rejects oversized input", () => {
    const r = parseJson(" ".repeat(MAX_TEXT_CHARS + 1));
    expect(r.ok).toBe(false);
    expect(exceedsLimit("x".repeat(MAX_TEXT_CHARS + 1))).toBe(true);
  });
  it("formats and minifies", () => {
    expect(formatJson({ a: 1 }, 2, false)).toBe('{\n  "a": 1\n}');
    expect(formatJson({ a: 1 }, "tab", false)).toBe('{\n\t"a": 1\n}');
    expect(minifyJson({ a: [1, 2] })).toBe('{"a":[1,2]}');
  });
  it("sorts keys recursively", () => {
    expect(JSON.stringify(sortKeys({ b: 1, a: { d: 1, c: 2 } }))).toBe('{"a":{"c":2,"d":1},"b":1}');
  });
  it("does not let a __proto__ key pollute anything", () => {
    const r = parseJson('{"__proto__":{"polluted":true},"a":1}');
    expect(r.ok).toBe(true);
    if (r.ok) sortKeys(r.value);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe("uuid", () => {
  it("generates valid v4", () =>
    expect(uuidV4()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
  it("clamps count and applies options", () => {
    expect(generateUuids({ count: 9999, uppercase: false, hyphens: true })).toHaveLength(500);
    expect(generateUuids({ count: -4, uppercase: false, hyphens: true })).toHaveLength(1);
    expect(generateUuids({ count: NaN, uppercase: false, hyphens: true })).toHaveLength(1);
    const [id] = generateUuids({ count: 1, uppercase: true, hyphens: false });
    expect(id).toMatch(/^[0-9A-F]{32}$/);
  });
  it("is unique across a batch", () =>
    expect(new Set(generateUuids({ count: 500, uppercase: false, hyphens: true })).size).toBe(500));
});

describe("textStats", () => {
  it("handles empty", () => expect(textStats("   ").words).toBe(0));
  it("counts", () => {
    const s = textStats("Hello world. This is a test!\n\nSecond paragraph.");
    expect(s.words).toBe(8);
    expect(s.sentences).toBe(3);
    expect(s.paragraphs).toBe(2);
  });
  it("counts emoji as one character", () => expect(textStats("a😀").characters).toBe(2));
});

describe("safety helpers", () => {
  it("escapes tag-closing characters in JSON-LD", () => {
    const out = safeJsonLd({ x: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out).x).toBe("</script><script>alert(1)</script>");
  });
  it("sanitises filenames", () => {
    expect(safeFilename("../../etc/passwd")).toBe("etc-passwd");
    expect(safeFilename("***")).toBe("download");
  });
});
