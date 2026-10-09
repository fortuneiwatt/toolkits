import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 text-muted">That page doesn&apos;t exist. Try searching the tools instead.</p>
      <p className="mt-4"><Link href="/tools" className="text-accent hover:underline">Browse all tools</Link></p>
    </div>
  );
}
