# Toolkit: free browser-based tools platform

Next.js (App Router) + TypeScript + Tailwind. Every page is **statically generated**, so traffic is served from a
CDN with no per-request server work. Tools run in the visitor's browser.

## Run

Requires Node 20.9 or newer (Node 22 LTS recommended).

```bash
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local   (set NEXT_PUBLIC_SITE_URL)
npm run dev                  # http://localhost:3000
npm test && npm run lint && npm run typecheck
npm run build && npm start
```

**Lockfile:** none is committed on purpose. A lockfile generated on one operating system can omit the native Next.js
compiler for another (this causes "Failed to load SWC binary"). Run `npm install` once on your machine, then commit
the `package-lock.json` it creates.

**`canvas` (tests only):** the image tests use the `canvas` package, listed under `optionalDependencies`. If it fails to
install on your machine the site still runs; only the image tests need it.

## Add a tool (3 steps)

1. Add its metadata to `src/data/tools.ts` with `status: "live"` plus `about`, `howTo`, `faq`, `related`.
2. Create the UI in `src/tools/<name>/` (a client component).
3. Register it in `src/tools/loaders.tsx`.

`npm test` fails if a live tool is missing metadata, a loader, or links to a related tool that doesn't exist.
Tools with `status: "planned"` get no page and no sitemap entry (no thin pages).

## Security model

| Control | Where |
| --- | --- |
| CSP, HSTS, nosniff, frame denial, COOP/CORP, Permissions-Policy | `next.config.ts` |
| No third-party scripts; connect-src limited to self | CSP |
| Unknown URLs 404 instead of rendering on demand (`dynamicParams = false`) | `app/**/[slug]/page.tsx` |
| Raw HTML rendering banned by lint (`react/no-danger`, `no-eval`) | `eslint.config.mjs` |
| JSON-LD escaped so it can't break out of its tag | `src/lib/jsonLd.ts` |
| Input size cap on every text tool | `src/lib/limits.ts` |
| Secure RNG only (`crypto`), never `Math.random` | `src/lib/uuid.ts` |
| Safe download filenames | `src/lib/download.ts` |
| `__proto__` keys can't pollute objects | `src/lib/json.ts` + tests |

**Known trade-off:** the CSP allows `'unsafe-inline'` for scripts because Next.js emits inline bootstrap scripts and
nonces would force every page to render dynamically (losing static speed). Compensating controls are above. If you later
need a stricter CSP, add a post-build step that hashes the inline scripts per page.

## Image Editor (Konva)

Code lives in `src/tools/image-editor/` (UI + Konva scene) and `src/lib/image/` (pure, tested logic).

- **Document model:** each undo step is `{ base raster, shapes[], adjustments }`. Annotations are editable vector shapes
  until a geometry or pixel operation (crop, rotate, flip, resize, blur, pixelate, redact) bakes them into the raster.
- **Undo/redo:** 30 steps, capped at roughly 80 million distinct pixels of rasters (~320 MB worst case), shared rasters counted once.
- **Preview = export:** one `buildShapeNode` function draws both the live view and the full-resolution export.
- **Privacy/safety:** files are validated (type, 25 MB, pixel count), SVG is rejected, huge images are downscaled to 4096 px,
  redact/pixelate/blur burn into pixels (not removable layers), exports are re-encoded so EXIF/GPS is dropped.
- **Client-only:** loaded with `ssr: false`; Konva is its own lazy chunk and never loads on other pages.
- **Not built yet:** pinch-zoom on touch screens, multi-line text, crop aspect-ratio presets, layer ordering.

## Image utilities (Compressor, Resizer, Converter)

One shared batch component, `src/tools/image-utils/BatchTool.tsx`, powers all three (`mode` = compress | resize | convert).
Pure logic is in `src/lib/image/process.ts` (output format choice, target sizes, file names) and `src/lib/zip.ts`
(a small store-only ZIP writer, verified against the system `unzip`).

- Up to 20 images per batch, 25 MB each, processed one at a time so the page stays responsive.
- Compress keeps the original file if re-encoding would not make it smaller.
- Output is never larger than 4096 px on the longest side; JPG output flattens transparency to white (and says so).
- If a browser can't encode WebP it falls back to PNG and tells the user.
- Not supported yet: HEIC (browsers can't decode it reliably), animated GIF output, SVG input.

## Rules for new tools

- Never render user input as HTML. Show it in a `<textarea>`, `<pre>` or as React text.
- Check `exceedsLimit()` before heavy work; move expensive work (regex, hashing big files, images) into a Web Worker.
- Randomness for passwords/IDs: `crypto.getRandomValues` only.
- Security tools stay defensive and educational.

## When you add a backend (contact form, analytics)

Validate every body with a schema (zod), cap body size, rate-limit per IP, add a honeypot/CAPTCHA to the contact form,
use parameterised queries only, set CORS to your own origin, keep secrets in env vars, and never log request bodies.
