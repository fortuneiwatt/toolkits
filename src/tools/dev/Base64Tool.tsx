"use client";

import { useMemo, useState } from "react";
import { decodeBase64, encodeBase64 } from "@/lib/base64";
import { exceedsLimit, limitMessage } from "@/lib/limits";
import { ConverterPane } from "../shared/Converter";

type Mode = "encode" | "decode";

export default function Base64Tool() {
  const [mode, setMode] = useState<Mode>("encode");
  const [input, setInput] = useState("");
  const [urlSafe, setUrlSafe] = useState(false);

  const { output, error } = useMemo(() => {
    if (input === "") return { output: "", error: null };
    if (exceedsLimit(input)) return { output: "", error: limitMessage() };
    if (mode === "encode") return { output: encodeBase64(input, { urlSafe }), error: null };
    const r = decodeBase64(input);
    return r.ok ? { output: r.text, error: null } : { output: "", error: r.error };
  }, [input, mode, urlSafe]);

  return (
    <ConverterPane<Mode>
      idPrefix="b64"
      modes={[{ id: "encode", label: "Encode text to Base64" }, { id: "decode", label: "Decode Base64 to text" }]}
      mode={mode}
      onMode={setMode}
      options={
        mode === "encode" ? (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={urlSafe} onChange={(e) => setUrlSafe(e.target.checked)} /> URL-safe (uses - and _, no padding)
          </label>
        ) : (
          <span className="text-muted">Standard and URL-safe Base64 both work. Line breaks and missing padding are fine.</span>
        )
      }
      input={input}
      onInput={setInput}
      inputLabel={mode === "encode" ? "Text to encode" : "Base64 to decode"}
      outputLabel={mode === "encode" ? "Base64 result" : "Decoded text"}
      placeholder={mode === "encode" ? "Hello, world!" : "SGVsbG8sIHdvcmxkIQ=="}
      output={output}
      error={error}
      downloadName={mode === "encode" ? "encoded.txt" : "decoded.txt"}
      onSwap={() => { setInput(output); setMode(mode === "encode" ? "decode" : "encode"); }}
    />
  );
}
