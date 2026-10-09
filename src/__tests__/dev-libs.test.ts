import { vi } from "vitest";
import { decodeBase64, encodeBase64 } from "@/lib/base64";
import { urlDecode, urlEncode } from "@/lib/urlCodec";
import { REGEX_LIMITS, runRegex, toSegments } from "@/lib/regex";
import { startRegex } from "@/tools/dev/regexClient";

describe("base64", () => {
  it("encodes and decodes ASCII", () => {
    expect(encodeBase64("Hello, World!")).toBe("SGVsbG8sIFdvcmxkIQ==");
    expect(decodeBase64("SGVsbG8sIFdvcmxkIQ==")).toEqual({ ok: true, text: "Hello, World!" });
  });
  it("round-trips unicode, emoji and newlines", () => {
    for (const t of ["héllo wörld", "日本語のテキスト", "emoji 😀🎉", "line1\nline2\r\n\ttab", "", "a"]) {
      expect(decodeBase64(encodeBase64(t))).toEqual({ ok: true, text: t });
    }
  });
  it("URL-safe output uses -_ and no padding, and decodes back", () => {
    const text = "subjects?_d=>>>???";
    const std = encodeBase64(text);
    const safe = encodeBase64(text, { urlSafe: true });
    expect(std).toMatch(/[+/]/);
    expect(safe).not.toMatch(/[+/=]/);
    expect(decodeBase64(safe)).toEqual({ ok: true, text });
  });
  it("accepts missing padding, whitespace and line breaks", () => {
    expect(decodeBase64("SGVsbG8")).toEqual({ ok: true, text: "Hello" });
    expect(decodeBase64("SGVs\nbG8g\r\nV29y bGQ=")).toEqual({ ok: true, text: "Hello World" });
  });
  it("handles large input without a stack overflow", () => {
    const big = "x".repeat(500_000);
    expect(decodeBase64(encodeBase64(big))).toEqual({ ok: true, text: big });
  });
  it("rejects invalid input with a clear error", () => {
    expect(decodeBase64("not base64!!")).toMatchObject({ ok: false });
    expect(decodeBase64("A")).toMatchObject({ ok: false, error: expect.stringMatching(/length/) });
    expect(decodeBase64("SGVsbG8=SGVsbG8=")).toMatchObject({ ok: false });
    expect(decodeBase64("=abc")).toMatchObject({ ok: false });
  });
  it("explains when the bytes are not text", () => {
    expect(decodeBase64("//79")).toMatchObject({ ok: false, error: expect.stringMatching(/UTF-8/) });
  });
});

describe("url codec", () => {
  it("component encoding escapes reserved characters", () => {
    expect(urlEncode("a b&c=d/é", "component")).toEqual({ ok: true, value: "a%20b%26c%3Dd%2F%C3%A9" });
  });
  it("full-URL encoding keeps URL structure", () => {
    expect(urlEncode("https://x.com/a b?q=é&r=1", "full")).toEqual({ ok: true, value: "https://x.com/a%20b?q=%C3%A9&r=1" });
  });
  it("form encoding uses + for spaces and escapes ! ' ( ) ~", () => {
    expect(urlEncode("a b!'()~*", "form")).toEqual({ ok: true, value: "a+b%21%27%28%29%7E*" });
  });
  it("decodes each scope, including + as space for forms", () => {
    expect(urlDecode("a%20b%26c", "component")).toEqual({ ok: true, value: "a b&c" });
    expect(urlDecode("a+b%2Bc", "form")).toEqual({ ok: true, value: "a b+c" });
    expect(urlDecode("a+b", "component")).toEqual({ ok: true, value: "a+b" });
    expect(urlDecode("https://x.com/a%20b%3Fq", "full")).toEqual({ ok: true, value: "https://x.com/a b%3Fq" });
  });
  it("round-trips", () => {
    for (const scope of ["component", "form"] as const) {
      const t = "héllo wörld & 日本 😀 100% sure?";
      const enc = urlEncode(t, scope);
      expect(enc.ok && urlDecode(enc.value, scope)).toEqual({ ok: true, value: t });
    }
  });
  it("reports malformed input instead of throwing", () => {
    expect(urlDecode("%E0%A4%A", "component")).toMatchObject({ ok: false });
    expect(urlDecode("100%", "form")).toMatchObject({ ok: false });
    expect(urlEncode("\uD800", "component")).toMatchObject({ ok: false });
  });
});

describe("runRegex", () => {
  const run = (pattern: string, flags: string, text: string, replacement?: string) => runRegex({ pattern, flags, text, replacement });

  it("finds all matches with index and text", () => {
    const r = run("\\d+", "g", "a1 b22 c333");
    expect(r).toMatchObject({ ok: true, truncated: false });
    if (r.ok) expect(r.matches.map((m) => [m.index, m.text])).toEqual([[1, "1"], [4, "22"], [8, "333"]]);
  });
  it("without g only the first match is returned", () => {
    const r = run("\\d+", "", "a1 b22");
    expect(r.ok && r.matches).toHaveLength(1);
  });
  it("captures numbered and named groups", () => {
    const r = run("(?<year>\\d{4})-(\\d{2})", "", "on 2026-10 ok");
    if (!r.ok) throw new Error("expected ok");
    expect(r.matches[0].groups).toEqual(["2026", "10"]);
    expect(r.matches[0].named).toEqual({ year: "2026" });
  });
  it("reports unmatched optional groups as undefined", () => {
    const r = run("(a)|(b)", "", "b");
    expect(r.ok && r.matches[0].groups).toEqual([undefined, "b"]);
  });
  it("flags work: i, m, s", () => {
    const i = run("hello", "i", "HELLO");
    expect(i.ok && i.matches).toHaveLength(1);
    const m = run("^b", "gm", "a\nb\nb");
    expect(m.ok && m.matches).toHaveLength(2);
    const noS = run("a.b", "", "a\nb");
    expect(noS.ok && noS.matches).toHaveLength(0);
    const withS = run("a.b", "s", "a\nb");
    expect(withS.ok && withS.matches).toHaveLength(1);
  });
  it("zero-length matches do not loop forever", () => {
    const r = run("x*", "g", "abc");
    expect(r.ok && r.matches.length).toBe(4);
  });
  it("caps the number of matches", () => {
    const r = run("a", "g", "a".repeat(REGEX_LIMITS.matches + 500));
    expect(r.ok && r.matches.length).toBe(REGEX_LIMITS.matches);
    expect(r.ok && r.truncated).toBe(true);
  });
  it("returns a readable error for invalid patterns and flags", () => {
    expect(run("(", "", "x")).toMatchObject({ ok: false, error: expect.any(String) });
    expect(run("a", "gg", "x")).toMatchObject({ ok: false });
    expect(run("a", "z", "x")).toMatchObject({ ok: false });
    expect(run("a", "uv", "x")).toMatchObject({ ok: false });
  });
  it("enforces size limits", () => {
    expect(run("a".repeat(REGEX_LIMITS.pattern + 1), "", "x")).toMatchObject({ ok: false });
    expect(run("a", "", "x".repeat(REGEX_LIMITS.text + 1))).toMatchObject({ ok: false });
  });
  it("previews replacements, including $1 and an empty replacement", () => {
    expect(run("(\\w+)@(\\w+)", "g", "me@home you@work", "$2:$1")).toMatchObject({ ok: true, replaced: "home:me work:you" });
    expect(run("\\s+", "g", "a  b   c", "")).toMatchObject({ ok: true, replaced: "abc" });
    const noRep = run("a", "g", "aaa");
    expect(noRep.ok && noRep.replaced).toBeUndefined();
  });
  it("a __proto__ group name does not pollute", () => {
    const r = run("(?<__proto__>a)", "", "a");
    expect(r.ok).toBe(true);
    expect(({} as Record<string, unknown>).a).toBeUndefined();
  });
});

describe("toSegments", () => {
  it("splits text into matched and unmatched runs", () => {
    const r = runRegex({ pattern: "\\d+", flags: "g", text: "a1b22" });
    if (!r.ok) throw new Error();
    expect(toSegments("a1b22", r.matches)).toEqual([
      { text: "a", match: false }, { text: "1", match: true }, { text: "b", match: false }, { text: "22", match: true },
    ]);
  });
  it("skips empty matches and handles no matches", () => {
    expect(toSegments("abc", [])).toEqual([{ text: "abc", match: false }]);
    expect(toSegments("abc", [{ index: 1, length: 0, text: "", groups: [], named: {} }])).toEqual([{ text: "abc", match: false }]);
    expect(toSegments("", [])).toEqual([]);
  });
});

describe("startRegex (worker handling)", () => {
  const original = globalThis.Worker;
  afterEach(() => { globalThis.Worker = original; vi.useRealTimers(); });

  function installFakeWorker(behaviour: "reply" | "hang" | "error") {
    const instances: { terminated: boolean; posted: unknown }[] = [];
    class FakeWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      terminated = false;
      posted: unknown = null;
      constructor() { instances.push(this); }
      postMessage(req: Parameters<typeof runRegex>[0]) {
        this.posted = req;
        if (behaviour === "reply") queueMicrotask(() => this.onmessage?.({ data: runRegex(req) } as MessageEvent));
        if (behaviour === "error") queueMicrotask(() => this.onerror?.());
      }
      terminate() { this.terminated = true; }
    }
    globalThis.Worker = FakeWorker as unknown as typeof Worker;
    return instances;
  }

  it("falls back to inline execution when Workers don't exist", async () => {
    // @ts-expect-error simulate an environment without Worker
    delete globalThis.Worker;
    const r = await startRegex({ pattern: "a", flags: "g", text: "aa" }).result;
    expect(r).toMatchObject({ ok: true });
  });
  it("returns the worker's answer and terminates the worker", async () => {
    const w = installFakeWorker("reply");
    const r = await startRegex({ pattern: "\\d", flags: "g", text: "a1b2" }).result;
    expect(r).toMatchObject({ ok: true });
    expect(w[0].terminated).toBe(true);
  });
  it("kills a worker that hangs (catastrophic backtracking) and reports a timeout", async () => {
    vi.useFakeTimers();
    const w = installFakeWorker("hang");
    const run = startRegex({ pattern: "(a+)+$", flags: "", text: "aaaa!" }, 500);
    vi.advanceTimersByTime(499);
    expect(w[0].terminated).toBe(false);
    vi.advanceTimersByTime(2);
    const r = await run.result;
    expect(r).toMatchObject({ ok: false, timedOut: true });
    expect(w[0].terminated).toBe(true);
  });
  it("reports worker errors", async () => {
    installFakeWorker("error");
    expect(await startRegex({ pattern: "a", flags: "", text: "a" }).result).toMatchObject({ ok: false });
  });
  it("cancel terminates the worker and the first result wins", async () => {
    const w = installFakeWorker("hang");
    const run = startRegex({ pattern: "a", flags: "", text: "a" });
    run.cancel();
    expect(w[0].terminated).toBe(true);
    expect(await run.result).toMatchObject({ ok: false, error: "Cancelled." });
  });
});
