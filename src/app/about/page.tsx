import type { Metadata } from "next";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "About", alternates: { canonical: "/about" } };

export default function About() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight">About {site.name}</h1>
      <p className="mt-4">
        {site.name} is a collection of free tools that run in your browser. We built it so you can get a small job done
        quickly without creating an account, installing anything or handing your data to a server.
      </p>
      <p className="mt-4">New tools are added regularly. Each one lives at its own page with a short guide and answers to common questions.</p>
    </div>
  );
}
