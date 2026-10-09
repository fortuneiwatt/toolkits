import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categories, getCategory } from "@/data/categories";
import { toolsInCategory } from "@/data/tools";
import { ToolCard } from "@/components/ToolCard";

export const dynamicParams = false;

export function generateStaticParams() {
  // Only categories that have at least one live tool get a page (no thin pages).
  return categories.filter((c) => toolsInCategory(c.slug).length > 0).map((c) => ({ slug: c.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = getCategory((await params).slug);
  if (!c) return {};
  return { title: c.name, description: c.description, alternates: { canonical: `/category/${c.slug}` } };
}

export default async function CategoryPage({ params }: Props) {
  const c = getCategory((await params).slug);
  if (!c) notFound();
  const list = toolsInCategory(c.slug);
  if (list.length === 0) notFound();
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">{c.name}</h1>
      <p className="mt-2 max-w-2xl text-muted">{c.description}</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => <ToolCard key={t.slug} tool={t} />)}
      </div>
    </>
  );
}
