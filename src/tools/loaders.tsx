"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

const Loading = () => <p className="text-sm text-muted">Loading tool…</p>;

/**
 * Registry of tool UIs. Add one line per live tool. Each tool is code-split, so a
 * visitor only downloads the JavaScript for the tool they open. Pages are still
 * server-rendered/pre-rendered, so crawlers see the full content.
 */
const components: Record<string, ComponentType> = {
  "json-formatter": dynamic(() => import("./json/JsonTool").then((m) => m.JsonFormatter), { loading: Loading }),
  "json-validator": dynamic(() => import("./json/JsonTool").then((m) => m.JsonValidator), { loading: Loading }),
  "json-minifier": dynamic(() => import("./json/JsonTool").then((m) => m.JsonMinifier), { loading: Loading }),
  "uuid-generator": dynamic(() => import("./uuid/UuidTool"), { loading: Loading }),
  // Konva needs the browser, so the editor is client-only. The page text around it is still pre-rendered.
  "image-editor": dynamic(() => import("./image-editor/ImageEditor"), { ssr: false, loading: Loading }),
  "image-compressor": dynamic(() => import("./image-utils/BatchTool").then((m) => m.ImageCompressor), { loading: Loading }),
  "image-resizer": dynamic(() => import("./image-utils/BatchTool").then((m) => m.ImageResizer), { loading: Loading }),
  "image-converter": dynamic(() => import("./image-utils/BatchTool").then((m) => m.ImageConverter), { loading: Loading }),
  "base64-encoder-decoder": dynamic(() => import("./dev/Base64Tool"), { loading: Loading }),
  "url-encoder-decoder": dynamic(() => import("./dev/UrlTool"), { loading: Loading }),
  "regex-tester": dynamic(() => import("./dev/RegexTool"), { loading: Loading }),
  "word-counter": dynamic(() => import("./text/WordCounter"), { loading: Loading }),
};

export const hasToolComponent = (slug: string) => Object.hasOwn(components, slug);

export function ToolWorkspace({ slug }: { slug: string }) {
  if (!Object.hasOwn(components, slug)) return null;
  const Tool = components[slug];
  return <Tool />;
}
