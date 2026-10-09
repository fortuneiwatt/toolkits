import fs from "node:fs";
import path from "node:path";
import { tools, liveTools } from "@/data/tools";
import { categories } from "@/data/categories";

describe("tool registry integrity", () => {
  const loaderSrc = fs.readFileSync(path.resolve(__dirname, "../tools/loaders.tsx"), "utf8");

  it("has unique slugs", () => expect(new Set(tools.map((t) => t.slug)).size).toBe(tools.length));
  it("uses only known categories", () => {
    const known = new Set(categories.map((c) => c.slug));
    tools.forEach((t) => expect(known.has(t.category)).toBe(true));
  });
  it.each(liveTools.map((t) => [t.slug, t] as const))("live tool %s is complete", (slug, t) => {
    expect(t.about?.length).toBeGreaterThan(40);
    expect(t.howTo?.length).toBeGreaterThan(0);
    expect(t.faq?.length).toBeGreaterThan(0);
    expect(loaderSrc).toContain(`"${slug}":`);
    (t.related ?? []).forEach((r) => expect(liveTools.some((l) => l.slug === r)).toBe(true));
  });
  it("has no loader for a tool that isn't live", () => {
    const registered = [...loaderSrc.matchAll(/^\s+"([a-z0-9-]+)":/gm)].map((m) => m[1]);
    registered.forEach((s) => expect(liveTools.some((t) => t.slug === s)).toBe(true));
  });
});
