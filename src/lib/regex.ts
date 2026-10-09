/** Pure regex runner. In the browser it is executed inside a Web Worker (see regexClient.ts). */
export const REGEX_LIMITS = { pattern: 2_000, text: 200_000, matches: 1_000, replacement: 2_000 } as const;

export const ALLOWED_FLAGS = "dgimsuvy";

export interface RegexRequest {
  pattern: string;
  flags: string;
  text: string;
  /** When defined, also compute text.replace(regex, replacement). */
  replacement?: string;
}

export interface MatchInfo {
  index: number;
  length: number;
  text: string;
  groups: (string | undefined)[];
  named: Record<string, string | undefined>;
}

export type RegexResult =
  | { ok: true; matches: MatchInfo[]; truncated: boolean; replaced?: string }
  | { ok: false; error: string; timedOut?: boolean };

export function runRegex(req: RegexRequest): RegexResult {
  if (req.pattern.length > REGEX_LIMITS.pattern) return { ok: false, error: `The pattern is too long (limit ${REGEX_LIMITS.pattern.toLocaleString("en-US")} characters).` };
  if (req.text.length > REGEX_LIMITS.text) return { ok: false, error: `The test text is too long (limit ${REGEX_LIMITS.text.toLocaleString("en-US")} characters).` };
  if ((req.replacement ?? "").length > REGEX_LIMITS.replacement) return { ok: false, error: "The replacement is too long." };

  const flags = req.flags;
  if ([...flags].some((f) => !ALLOWED_FLAGS.includes(f)) || new Set(flags).size !== flags.length) return { ok: false, error: "Invalid flags." };

  let re: RegExp;
  try {
    re = new RegExp(req.pattern, flags);
  } catch (e) {
    const msg = e instanceof Error ? e.message.replace(/^Invalid regular expression: /, "") : "Invalid pattern";
    return { ok: false, error: msg };
  }

  const toInfo = (m: RegExpMatchArray | RegExpExecArray): MatchInfo => ({
    index: m.index ?? 0,
    length: m[0].length,
    text: m[0],
    groups: m.slice(1),
    named: m.groups ? Object.fromEntries(Object.entries(m.groups)) : {},
  });

  const matches: MatchInfo[] = [];
  let truncated = false;
  if (flags.includes("g")) {
    for (const m of req.text.matchAll(re)) {
      if (matches.length >= REGEX_LIMITS.matches) { truncated = true; break; }
      matches.push(toInfo(m));
    }
  } else {
    const m = re.exec(req.text);
    if (m) matches.push(toInfo(m));
  }

  const result: RegexResult = { ok: true, matches, truncated };
  if (req.replacement !== undefined) {
    re.lastIndex = 0;
    result.replaced = req.text.replace(re, req.replacement);
  }
  return result;
}

export interface Segment { text: string; match: boolean }

/** Split text into matched and unmatched runs for highlighting. Empty matches are skipped. */
export function toSegments(text: string, matches: MatchInfo[]): Segment[] {
  const out: Segment[] = [];
  let pos = 0;
  for (const m of matches) {
    if (m.length === 0 || m.index < pos) continue;
    if (m.index > pos) out.push({ text: text.slice(pos, m.index), match: false });
    out.push({ text: text.slice(m.index, m.index + m.length), match: true });
    pos = m.index + m.length;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), match: false });
  return out;
}
