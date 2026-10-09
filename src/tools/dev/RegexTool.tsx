"use client";

import { useEffect, useMemo, useState } from "react";
import { REGEX_LIMITS, toSegments, type RegexResult } from "@/lib/regex";
import { CopyButton, fieldClass } from "../shared/ui";
import { startRegex } from "./regexClient";

const FLAGS: { flag: string; name: string; hint: string }[] = [
  { flag: "g", name: "Global", hint: "Find all matches, not just the first" },
  { flag: "i", name: "Ignore case", hint: "Letters match in either case" },
  { flag: "m", name: "Multiline", hint: "^ and $ match at each line" },
  { flag: "s", name: "Dot all", hint: ". also matches new lines" },
  { flag: "u", name: "Unicode", hint: "Full Unicode support" },
];

const EXAMPLES = [
  { name: "Email", pattern: "[\\w.+-]+@[\\w-]+\\.[\\w.-]+", flags: "g", text: "Contact ada@example.com or grace.hopper@navy.mil today." },
  { name: "Dates", pattern: "(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})", flags: "g", text: "Born 1906-12-09, died 1992-01-01." },
  { name: "Hex colours", pattern: "#(?:[0-9a-f]{3}){1,2}\\b", flags: "gi", text: "Use #FFF, #1f4fd8 and #00ff00 but not #12." },
];

type Outcome = { key: string; result: RegexResult };

export default function RegexTool() {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("g");
  const [text, setText] = useState("");
  const [replaceOn, setReplaceOn] = useState(false);
  const [replacement, setReplacement] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const flagString = useMemo(() => FLAGS.map((f) => f.flag).filter((f) => flags.includes(f)).join(""), [flags]);
  const key = JSON.stringify([pattern, flagString, text, replaceOn ? replacement : null]);
  const active = pattern !== "";

  // Run (debounced) in a Web Worker. Results are keyed so stale ones are ignored without extra state resets.
  useEffect(() => {
    if (!active) return;
    const run = { current: null as ReturnType<typeof startRegex> | null };
    const timer = setTimeout(() => {
      run.current = startRegex({ pattern, flags: flagString, text, replacement: replaceOn ? replacement : undefined });
      void run.current.result.then((result) => {
        if (result.ok || result.error !== "Cancelled.") setOutcome({ key, result });
      });
    }, 250);
    return () => { clearTimeout(timer); run.current?.cancel(); };
  }, [active, pattern, flagString, text, replaceOn, replacement, key]);

  const current = outcome && outcome.key === key ? outcome.result : null;
  const pending = active && current === null;
  const ok = current && current.ok ? current : null;
  const segments = useMemo(() => (ok ? toSegments(text, ok.matches) : []), [ok, text]);

  const toggleFlag = (f: string) => setFlags((cur) => (cur.includes(f) ? cur.replace(f, "") : cur + f));
  const applyExample = (e: (typeof EXAMPLES)[number]) => { setPattern(e.pattern); setFlags(e.flags); setText(e.text); };

  return (
    <div className="grid gap-4">
      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="rx-pattern" className="text-sm font-medium">Regular expression</label>
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-muted">Examples:</span>
            {EXAMPLES.map((e) => (
              <button key={e.name} type="button" className="rounded border border-line px-2 py-0.5 hover:border-accent" onClick={() => applyExample(e)}>{e.name}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-muted" aria-hidden="true">/</span>
          <input
            id="rx-pattern"
            className={`${fieldClass} flex-1`}
            value={pattern}
            maxLength={REGEX_LIMITS.pattern}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="\d+"
            onChange={(e) => setPattern(e.target.value)}
          />
          <span className="font-mono text-muted" aria-hidden="true">/{flagString}</span>
        </div>
        <div role="group" aria-label="Flags" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {FLAGS.map((f) => (
            <label key={f.flag} title={f.hint} className="flex items-center gap-1.5">
              <input type="checkbox" checked={flags.includes(f.flag)} onChange={() => toggleFlag(f.flag)} /> {f.name} <code className="text-muted">{f.flag}</code>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="rx-text" className="mb-1 block text-sm font-medium">Test text</label>
        <textarea
          id="rx-text"
          className={`${fieldClass} min-h-36`}
          value={text}
          spellCheck={false}
          onChange={(e) => setText(e.target.value.slice(0, REGEX_LIMITS.text + 1))}
          placeholder="Paste the text you want to test against."
        />
      </div>

      <div role="status" aria-live="polite" className="text-sm">
        {!active && <span className="text-muted">Enter a pattern to start.</span>}
        {pending && <span className="text-muted">Running…</span>}
        {current && !current.ok && <span className="font-medium text-bad">{current.error}</span>}
        {ok && (
          <span className={ok.matches.length ? "font-medium text-ok" : "text-muted"}>
            {ok.matches.length === 0 ? "No matches" : `${ok.matches.length}${ok.truncated ? "+" : ""} ${ok.matches.length === 1 ? "match" : "matches"}`}
            {ok.truncated && ` (showing the first ${REGEX_LIMITS.matches.toLocaleString("en-US")})`}
          </span>
        )}
      </div>

      {ok && text !== "" && (
        <div>
          <h3 className="mb-1 text-sm font-medium">Matches highlighted</h3>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-line bg-panel p-3 font-mono text-sm">
            {segments.map((s, i) => (s.match ? <mark key={i} className="rounded bg-accent/25 px-0.5 text-ink">{s.text}</mark> : <span key={i}>{s.text}</span>))}
          </pre>
        </div>
      )}

      {ok && ok.matches.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-medium">Match details</h3>
          <ol className="max-h-72 divide-y divide-line overflow-auto rounded-md border border-line bg-panel text-sm">
            {ok.matches.slice(0, 100).map((m, i) => (
              <li key={i} className="p-2.5">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="text-muted">#{i + 1} at {m.index}</span>
                  <code className="break-all font-mono">{m.text === "" ? "(empty match)" : JSON.stringify(m.text)}</code>
                </div>
                {m.groups.length > 0 && (
                  <ul className="mt-1 grid gap-0.5 pl-3 text-muted">
                    {m.groups.map((g, gi) => (
                      <li key={gi}>Group {gi + 1}: <code className="break-all font-mono text-ink">{g === undefined ? "undefined" : JSON.stringify(g)}</code></li>
                    ))}
                  </ul>
                )}
                {Object.keys(m.named).length > 0 && (
                  <ul className="mt-1 grid gap-0.5 pl-3 text-muted">
                    {Object.entries(m.named).map(([name, v]) => (
                      <li key={name}>{name}: <code className="break-all font-mono text-ink">{v === undefined ? "undefined" : JSON.stringify(v)}</code></li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          {ok.matches.length > 100 && <p className="mt-1 text-xs text-muted">Showing details for the first 100 matches.</p>}
        </div>
      )}

      <div className="grid gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={replaceOn} onChange={(e) => setReplaceOn(e.target.checked)} /> Preview a replacement
        </label>
        {replaceOn && (
          <>
            <div>
              <label htmlFor="rx-replace" className="mb-1 block text-sm font-medium">Replace with</label>
              <input id="rx-replace" className={fieldClass} value={replacement} maxLength={REGEX_LIMITS.replacement} spellCheck={false} placeholder="$1 for group 1, $<name> for a named group" onChange={(e) => setReplacement(e.target.value)} />
            </div>
            {ok?.replaced !== undefined && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="rx-replaced" className="text-sm font-medium">Result</label>
                  <CopyButton text={ok.replaced} />
                </div>
                <textarea id="rx-replaced" className={`${fieldClass} min-h-28`} readOnly value={ok.replaced} />
              </div>
            )}
          </>
        )}
      </div>

      <details className="rounded-md border border-line bg-panel p-3 text-sm">
        <summary className="cursor-pointer font-medium">Quick reference</summary>
        <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {[
            ["\\d  \\w  \\s", "digit, word character, whitespace"],
            ["\\D  \\W  \\S", "the opposites"],
            [". ", "any character (not a new line)"],
            ["^  $", "start and end of text or line"],
            ["*  +  ?", "0 or more, 1 or more, 0 or 1"],
            ["{3}  {2,5}", "exact count, range"],
            ["[abc]  [^abc]", "any of, none of"],
            ["(abc)  (?:abc)", "capture group, non-capturing"],
            ["(?<name>abc)", "named group"],
            ["a|b", "a or b"],
            ["\\b", "word boundary"],
            ["(?=x)  (?!x)", "followed by, not followed by"],
          ].map(([t, d]) => (
            <div key={t} className="flex gap-2"><dt><code className="font-mono">{t}</code></dt><dd className="text-muted">{d}</dd></div>
          ))}
        </dl>
      </details>
      <p className="text-xs text-muted">Patterns run in a separate background thread and are stopped after 2 seconds, so a runaway pattern can&apos;t freeze this page. Uses your browser&apos;s JavaScript regex engine.</p>
    </div>
  );
}
