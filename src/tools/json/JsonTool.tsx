"use client";

import { useMemo, useState } from "react";
import { formatJson, minifyJson, parseJson, type Indent } from "@/lib/json";
import { downloadText } from "@/lib/download";
import { MAX_TEXT_CHARS } from "@/lib/limits";
import { CopyButton, buttonClass, fieldClass } from "../shared/ui";

export type JsonMode = "format" | "validate" | "minify";

export function JsonTool({ mode }: { mode: JsonMode }) {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<Indent>(2);
  const [sort, setSort] = useState(false);

  const parsed = useMemo(() => parseJson(input), [input]);
  const output = useMemo(() => {
    if (!parsed.ok || mode === "validate") return "";
    return mode === "format" ? formatJson(parsed.value, indent, sort) : minifyJson(parsed.value);
  }, [parsed, mode, indent, sort]);

  const empty = input.trim() === "";

  return (
    <div className="grid gap-4">
      <div>
        <label htmlFor="json-in" className="mb-1 block text-sm font-medium">JSON input</label>
        <textarea
          id="json-in"
          className={`${fieldClass} min-h-56`}
          value={input}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => setInput(e.target.value.slice(0, MAX_TEXT_CHARS + 1))}
          placeholder='{"name":"Ada","skills":["math","code"]}'
        />
      </div>

      {mode === "format" && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            Indent
            <select
              className="rounded-md border border-line bg-panel px-2 py-1"
              value={String(indent)}
              onChange={(e) => setIndent(e.target.value === "tab" ? "tab" : (Number(e.target.value) as 2 | 4))}
            >
              <option value="2">2 spaces</option>
              <option value="4">4 spaces</option>
              <option value="tab">Tab</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={sort} onChange={(e) => setSort(e.target.checked)} />
            Sort keys A to Z
          </label>
        </div>
      )}

      <div role="status" aria-live="polite" className="text-sm">
        {empty ? (
          <span className="text-muted">Paste JSON above to get started.</span>
        ) : parsed.ok ? (
          <span className="font-medium text-ok">Valid JSON</span>
        ) : (
          <span className="font-medium text-bad">
            Invalid JSON{parsed.line ? ` at line ${parsed.line}, column ${parsed.column}` : ""}: {parsed.message}
          </span>
        )}
      </div>

      {mode !== "validate" && (
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label htmlFor="json-out" className="text-sm font-medium">Result</label>
            <div className="flex gap-2">
              <CopyButton text={output} disabled={!output} />
              <button
                type="button"
                className={buttonClass}
                disabled={!output}
                onClick={() => downloadText(mode === "format" ? "formatted.json" : "minified.json", output, "application/json")}
              >
                Download
              </button>
              <button type="button" className={buttonClass} onClick={() => setInput("")} disabled={empty}>
                Clear
              </button>
            </div>
          </div>
          <textarea id="json-out" className={`${fieldClass} min-h-56`} value={output} readOnly spellCheck={false} />
        </div>
      )}
    </div>
  );
}

export const JsonFormatter = () => <JsonTool mode="format" />;
export const JsonValidator = () => <JsonTool mode="validate" />;
export const JsonMinifier = () => <JsonTool mode="minify" />;
