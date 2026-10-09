import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { site } from "@/config/site";
import { getCategory } from "@/data/categories";
import { getLiveTool, liveTools } from "@/data/tools";
import { safeJsonLd } from "@/lib/jsonLd";
import { ToolCard } from "@/components/ToolCard";
import { ToolWorkspace } from "@/tools/loaders";

// Unknown slugs 404 instead of rendering on demand: no surprise server work under load.
export const dynamicParams = false;

export function generateStaticParams() {
  return liveTools.map((t) => ({ slug: t.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tool = getLiveTool((await params).slug);
  if (!tool) return {};
  const title = `${tool.name}: free online tool`;
  return {
    title,
    description: tool.description,
    keywords: tool.keywords,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: { type: "website", title, description: tool.description, url: `/tools/${tool.slug}` },
  };
}

export default async function ToolPage({ params }: Props) {
  const tool = getLiveTool((await params).slug);
  if (!tool) notFound();
  const category = getCategory(tool.category);
  const related = (tool.related ?? []).map(getLiveTool).filter((t) => t !== undefined);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: tool.name,
      description: tool.description,
      url: `${site.url}/tools/${tool.slug}`,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    ...(tool.faq?.length
      ? [{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: tool.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }]
      : []),
  ];

  return (
    <article>
      {/* eslint-disable-next-line react/no-danger -- JSON-LD is escaped by safeJsonLd and is a non-executable data block */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <header>
        {category && (
          <Link href={`/category/${category.slug}`} className="text-sm text-accent hover:underline">{category.name}</Link>
        )}
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{tool.name}</h1>
        <p className="mt-2 max-w-2xl text-muted">{tool.description}</p>
      </header>

      <section aria-label={`${tool.name} workspace`} className="mt-6 rounded-md border border-line bg-panel p-4 sm:p-6">
        <ToolWorkspace slug={tool.slug} />
      </section>

      <div className="mt-10 grid max-w-3xl gap-8">
        {tool.about && (
          <section>
            <h2 className="text-xl font-semibold">About this tool</h2>
            <p className="mt-2">{tool.about}</p>
          </section>
        )}
        {tool.howTo && (
          <section>
            <h2 className="text-xl font-semibold">How to use it</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              {tool.howTo.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </section>
        )}
        {tool.faq && (
          <section>
            <h2 className="text-xl font-semibold">Questions</h2>
            <div className="mt-2 divide-y divide-line rounded-md border border-line bg-panel">
              {tool.faq.map((f) => (
                <details key={f.q} className="p-4">
                  <summary className="cursor-pointer font-medium">{f.q}</summary>
                  <p className="mt-2 text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Related tools</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((t) => <ToolCard key={t.slug} tool={t} />)}
          </div>
        </section>
      )}
    </article>
  );
}
