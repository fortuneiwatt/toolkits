import type { Metadata } from "next";
import { liveTools } from "@/data/tools";
import { ToolCard } from "@/components/ToolCard";
import { SearchBar } from "@/components/SearchBar";

export const metadata: Metadata = {
  title: "All tools",
  description: "Every free tool on the site, in one place.",
  alternates: { canonical: "/tools" },
};

export default function ToolsIndex() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">All tools</h1>
      <div className="mt-5 max-w-2xl"><SearchBar tools={liveTools} /></div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {liveTools.map((t) => <ToolCard key={t.slug} tool={t} />)}
      </div>
    </>
  );
}
