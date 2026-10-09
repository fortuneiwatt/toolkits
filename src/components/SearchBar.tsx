"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import type { ToolMeta } from "@/data/tools";

export function SearchBar({ tools }: { tools: ToolMeta[] }) {
  const [query, setQuery] = useState("");
  const id = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase().slice(0, 80);
    if (!q) return [];
    return tools
      .filter((t) => [t.name, t.description, ...(t.keywords ?? [])].join(" ").toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, tools]);

  return (
    <div role="search">
      <label htmlFor={id} className="sr-only">Search tools</label>
      <input
        id={id}
        type="search"
        value={query}
        maxLength={80}
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        placeholder="What do you need? Try “json” or “word count”"
        className="w-full rounded-md border border-line bg-panel px-4 py-3 text-base placeholder:text-muted"
      />
      <div aria-live="polite" className="mt-2">
        {query.trim() !== "" && results.length === 0 && (
          <p className="text-sm text-muted">No tools match “{query.trim().slice(0, 80)}” yet.</p>
        )}
        {results.length > 0 && (
          <ul className="overflow-hidden rounded-md border border-line bg-panel">
            {results.map((t) => (
              <li key={t.slug} className="border-b border-line last:border-b-0">
                <Link href={`/tools/${t.slug}`} className="block px-4 py-3 hover:bg-bg">
                  <span className="font-medium">{t.name}</span>
                  <span className="block text-sm text-muted">{t.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
