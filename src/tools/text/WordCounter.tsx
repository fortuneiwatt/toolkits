"use client";

import { useMemo, useState } from "react";
import { textStats } from "@/lib/textStats";
import { MAX_TEXT_CHARS } from "@/lib/limits";
import { buttonClass, fieldClass } from "../shared/ui";

export default function WordCounter() {
  const [text, setText] = useState("");
  const s = useMemo(() => textStats(text), [text]);
  const minutes = s.readingMinutes === 0 ? "0 min" : s.readingMinutes < 1 ? "under 1 min" : `${Math.ceil(s.readingMinutes)} min`;

  const rows: [string, string][] = [
    ["Words", s.words.toLocaleString("en-US")],
    ["Characters", s.characters.toLocaleString("en-US")],
    ["Characters (no spaces)", s.charactersNoSpaces.toLocaleString("en-US")],
    ["Sentences", s.sentences.toLocaleString("en-US")],
    ["Paragraphs", s.paragraphs.toLocaleString("en-US")],
    ["Reading time", minutes],
  ];

  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-md border border-line bg-panel p-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <label htmlFor="wc-in" className="mb-1 block text-sm font-medium">Your text</label>
        <textarea
          id="wc-in"
          className={`${fieldClass} min-h-64 font-sans`}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_CHARS))}
          placeholder="Type or paste text here."
        />
      </div>
      <div><button type="button" className={buttonClass} onClick={() => setText("")} disabled={!text}>Clear</button></div>
    </div>
  );
}
