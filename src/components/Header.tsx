import Link from "next/link";
import { site } from "@/config/site";

export function Header() {
  return (
    <header className="border-b border-line bg-panel">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          {site.name}
        </Link>
        <nav aria-label="Main" className="flex gap-5 text-sm">
          <Link href="/tools" className="hover:text-accent">All tools</Link>
          <Link href="/about" className="hover:text-accent">About</Link>
          <Link href="/privacy" className="hover:text-accent">Privacy</Link>
        </nav>
      </div>
    </header>
  );
}
