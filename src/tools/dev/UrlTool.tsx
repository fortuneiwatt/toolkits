"use client";

import { useMemo, useState } from "react";
import { exceedsLimit, limitMessage } from "@/lib/limits";
import { urlDecode, urlEncode, type UrlScope } from "@/lib/urlCodec";
import { ConverterPane } from "../shared/Converter";

type Mode = "encode" | "decode";

const scopes: { id: UrlScope; label: string; hint: string }[] = [
  { id: "component", label: "Component", hint: "Escapes everything except letters, digits and - _ . ! ~ * ' ( ). Use for a query value or path segment." },
  { id: "full", label: "Full URL", hint: "Keeps URL structure (: / ? # & =) and only escapes unsafe characters." },
  { id: "form", label: "Form data", hint: "Like Component, but spaces become + (application/x-www-form-urlencoded)." },
];

export default function UrlTool() {
  const [mode, setMode] = useState<Mode>("encode");
  const [scope, setScope] = useState<UrlScope>("component");
  const [input, setInput] = useState("");

  const { output, error } = useMemo(() => {
    if (input === "") return { output: "", error: null };
    if (exceedsLimit(input)) return { output: "", error: limitMessage() };
    const r = mode === "encode" ? urlEncode(input, scope) : urlDecode(input, scope);
    return r.ok ? { output: r.value, error: null } : { output: "", error: r.error };
  }, [input, mode, scope]);

  return (
    <ConverterPane<Mode>
      idPrefix="url"
      modes={[{ id: "encode", label: "Encode" }, { id: "decode", label: "Decode" }]}
      mode={mode}
      onMode={setMode}
      options={
        <>
          <label className="flex items-center gap-2">
            Type
            <select className="rounded-md border border-line bg-panel px-2 py-1" value={scope} onChange={(e) => setScope(e.target.value as UrlScope)}>
              {scopes.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <span className="text-muted">{scopes.find((s) => s.id === scope)!.hint}</span>
        </>
      }
      input={input}
      onInput={setInput}
      inputLabel={mode === "encode" ? "Text or URL to encode" : "Encoded text to decode"}
      outputLabel={mode === "encode" ? "Encoded result" : "Decoded result"}
      placeholder={mode === "encode" ? "https://example.com/search?q=héllo wörld" : "h%C3%A9llo%20w%C3%B6rld"}
      output={output}
      error={error}
      onSwap={() => { setInput(output); setMode(mode === "encode" ? "decode" : "encode"); }}
    />
  );
}
