"use client";

import { useState } from "react";
import { generateUuids } from "@/lib/uuid";
import { CopyButton, buttonClass, fieldClass, primaryButtonClass } from "../shared/ui";

export default function UuidTool() {
  const [count, setCount] = useState(5);
  const [uppercase, setUppercase] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [ids, setIds] = useState<string[]>([]);

  const run = () => setIds(generateUuids({ count, uppercase, hyphens }));
  const text = ids.join("\n");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          How many
          <input
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(Math.min(500, Math.max(1, Number(e.target.value) || 1)))}
            className="w-24 rounded-md border border-line bg-panel px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={uppercase} onChange={(e) => setUppercase(e.target.checked)} /> Uppercase
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={hyphens} onChange={(e) => setHyphens(e.target.checked)} /> Hyphens
        </label>
        <button type="button" className={primaryButtonClass} onClick={run}>Generate</button>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor="uuid-out" className="text-sm font-medium">UUIDs</label>
          <div className="flex gap-2">
            <CopyButton text={text} disabled={!text} />
            <button type="button" className={buttonClass} onClick={() => setIds([])} disabled={!ids.length}>Clear</button>
          </div>
        </div>
        <textarea
          id="uuid-out"
          className={`${fieldClass} min-h-48`}
          readOnly
          value={text}
          placeholder="Press Generate to create UUIDs."
        />
      </div>
    </div>
  );
}
