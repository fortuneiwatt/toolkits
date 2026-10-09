import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { categories } from "@/data/categories";
import { liveTools, toolsInCategory } from "@/data/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: site.url, lastModified: now },
    { url: `${site.url}/tools`, lastModified: now },
    ...categories.filter((c) => toolsInCategory(c.slug).length).map((c) => ({ url: `${site.url}/category/${c.slug}`, lastModified: now })),
    ...liveTools.map((t) => ({ url: `${site.url}/tools/${t.slug}`, lastModified: now })),
    { url: `${site.url}/about`, lastModified: now },
    { url: `${site.url}/privacy`, lastModified: now },
  ];
}
