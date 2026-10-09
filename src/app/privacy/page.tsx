import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight">Privacy</h1>
      <p className="mt-4">
        Our tools process what you enter on your own device. Text, JSON and files you use in a tool are not uploaded or stored by us.
      </p>
      <p className="mt-4">
        If a future tool needs server processing, it will say so clearly on that tool&apos;s page before you use it. We only collect
        information the product genuinely needs.
      </p>
    </div>
  );
}
