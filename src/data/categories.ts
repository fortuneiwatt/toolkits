export type CategorySlug =
  | "image"
  | "developer"
  | "security"
  | "text"
  | "calculators"
  | "generators";

export interface Category {
  slug: CategorySlug;
  name: string;
  description: string;
}

export const categories: Category[] = [
  { slug: "image", name: "Image tools", description: "Edit, compress, resize and convert images without uploading them anywhere." },
  { slug: "developer", name: "Developer tools", description: "Format, validate and convert the data you work with every day." },
  { slug: "security", name: "Security tools", description: "Defensive utilities: passwords, hashes, tokens and network references." },
  { slug: "text", name: "Text tools", description: "Count, compare and clean up text." },
  { slug: "calculators", name: "Calculators", description: "Quick answers for percentages, ages and unit conversions." },
  { slug: "generators", name: "Generators", description: "Create QR codes, IDs and other things on demand." },
];

export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
