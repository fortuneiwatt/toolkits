import Link from "next/link";
import { site } from "@/config/site";
import { categories } from "@/data/categories";
import { liveTools, toolsInCategory } from "@/data/tools";
import { SearchBar } from "@/components/SearchBar";
import { ToolCard } from "@/components/ToolCard";

export default function Home() {
  return (
    <>
      <section className="py-6 sm:py-10">
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">{site.tagline}</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Format JSON, count words, generate IDs and more. Nothing you paste or open is uploaded.
        </p>
        <div className="mt-6 max-w-2xl">
          <SearchBar tools={liveTools} />
        </div>
      </section>

      {categories.map((c) => {
        const list = toolsInCategory(c.slug);
        if (list.length === 0) return null;
        return (
          <section key={c.slug} className="mt-10">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-semibold">{c.name}</h2>
              <Link href={`/category/${c.slug}`} className="text-sm text-accent hover:underline">See all</Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((t) => <ToolCard key={t.slug} tool={t} />)}
            </div>
          </section>
        );
      })}
    </>
  );
}
