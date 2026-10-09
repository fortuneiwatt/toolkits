// Change the name/URL here once; everything (metadata, sitemap, JSON-LD) follows.
export const site = {
  name: "Toolkit",
  tagline: "Free tools that run in your browser",
  description:
    "Free online tools for images, developers, security and everyday text and maths. Everything runs in your browser, so your files and text never leave your device.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
} as const;
