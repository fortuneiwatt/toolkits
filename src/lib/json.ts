import { exceedsLimit, limitMessage } from "./limits";

export type ParseResult =
  | { ok: true; value: unknown }
  | { ok: false; message: string; line?: number; column?: number };

export function parseJson(input: string): ParseResult {
  if (exceedsLimit(input)) return { ok: false, message: limitMessage() };
  if (input.trim() === "") return { ok: false, message: "Enter some JSON to check." };
  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid JSON";
    const pos = /position (\d+)/.exec(message);
    if (pos) {
      const index = Number(pos[1]);
      const before = input.slice(0, index);
      const line = before.split("\n").length;
      const column = index - before.lastIndexOf("\n");
      return { ok: false, message, line, column };
    }
    return { ok: false, message };
  }
}

/** Recursively sort object keys. Uses fromEntries so a "__proto__" key stays an own property. */
export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}

export type Indent = 2 | 4 | "tab";

export function formatJson(value: unknown, indent: Indent, sort: boolean): string {
  const v = sort ? sortKeys(value) : value;
  return JSON.stringify(v, null, indent === "tab" ? "\t" : indent);
}

export const minifyJson = (value: unknown): string => JSON.stringify(value);
