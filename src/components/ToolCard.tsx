import Link from "next/link";
import type { ToolMeta } from "@/data/tools";
import { getCategory } from "@/data/categories";

export function ToolCard({ tool }: { tool: ToolMeta }) {
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="block rounded-md border border-line bg-panel p-4 hover:border-accent"
    >
      <span className="block text-base font-semibold">{tool.name}</span>
      <span className="mt-1 block text-sm text-muted">{tool.description}</span>
      <span className="mt-3 block text-xs text-muted">{getCategory(tool.category)?.name}</span>
    </Link>
  );
}
