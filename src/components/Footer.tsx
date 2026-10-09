import Link from "next/link";
import { site } from "@/config/site";
import { categories } from "@/data/categories";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-panel">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-2">
        <p className="text-muted">
          {site.name}: {site.tagline.toLowerCase()}. Files and text you use here are processed on your device.
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 sm:justify-end">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/category/${c.slug}`} className="hover:text-accent">{c.name}</Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
