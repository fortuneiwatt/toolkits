import type { CategorySlug } from "./categories";

export interface ToolMeta {
  slug: string;
  name: string;
  category: CategorySlug;
  /** One sentence, shown on cards and used as the meta description. */
  description: string;
  /** "live" tools get a page, sitemap entry and static build. "planned" ones are the roadmap. */
  status: "live" | "planned";
  keywords?: string[];
  /** Required for live tools (enforced by tests). */
  about?: string;
  howTo?: string[];
  faq?: { q: string; a: string }[];
  related?: string[];
}

// To add a tool: add an entry here, create its module in src/tools, register it in src/tools/loaders.tsx.
export const tools: ToolMeta[] = [
  // ---- LIVE ----
  {
    slug: "json-formatter",
    name: "JSON Formatter",
    category: "developer",
    status: "live",
    description: "Beautify and indent JSON so it is easy to read, with optional key sorting.",
    keywords: ["json beautifier", "pretty print json", "format json online"],
    about:
      "Paste JSON and get it back cleanly indented. Parsing and formatting happen entirely in your browser, so API responses, config files and anything sensitive stay on your device.",
    howTo: ["Paste or type your JSON into the input box.", "Choose an indent size and whether to sort keys.", "Copy the formatted result or download it as a .json file."],
    faq: [
      { q: "Is my JSON uploaded anywhere?", a: "No. Formatting runs locally in your browser and nothing is sent to a server." },
      { q: "Why did my large numbers change?", a: "JavaScript reads numbers as 64-bit floats, so integers beyond 9,007,199,254,740,991 can lose precision. Keep such values as strings." },
    ],
    related: ["json-validator", "json-minifier", "base64-encoder-decoder", "uuid-generator"],
  },
  {
    slug: "json-validator",
    name: "JSON Validator",
    category: "developer",
    status: "live",
    description: "Check whether JSON is valid and see exactly where it breaks.",
    keywords: ["validate json", "json lint", "json syntax checker"],
    about: "Find out if your JSON is valid. When it is not, the tool shows the error and, where the browser reports it, the line and column.",
    howTo: ["Paste your JSON into the input box.", "Read the result: valid, or the error with its position.", "Fix the problem and the result updates as you type."],
    faq: [{ q: "What counts as valid JSON?", a: "Strict JSON per RFC 8259: double-quoted keys and strings, no trailing commas, no comments." }],
    related: ["json-formatter", "json-minifier"],
  },
  {
    slug: "json-minifier",
    name: "JSON Minifier",
    category: "developer",
    status: "live",
    description: "Strip whitespace from JSON to make it as small as possible.",
    keywords: ["minify json", "compress json", "json compactor"],
    about: "Remove all unnecessary whitespace from JSON. Useful before embedding JSON in a request, a config value or a URL.",
    howTo: ["Paste your JSON into the input box.", "The minified output appears instantly.", "Copy it or download it."],
    faq: [{ q: "Does minifying change my data?", a: "No. Only whitespace outside of strings is removed. Values and key order stay the same." }],
    related: ["json-formatter", "json-validator"],
  },
  {
    slug: "uuid-generator",
    name: "UUID Generator",
    category: "generators",
    status: "live",
    description: "Generate random version 4 UUIDs in bulk, with format options.",
    keywords: ["uuid v4", "guid generator", "random uuid"],
    about: "Generates version 4 UUIDs using your browser's cryptographically secure random number generator.",
    howTo: ["Choose how many UUIDs you need (1 to 500).", "Pick uppercase or hyphen-free output if you need it.", "Copy the list or generate a new batch."],
    faq: [
      { q: "Are these UUIDs secure?", a: "They come from crypto.randomUUID(), which uses a secure random source. They are unique in practice, but a UUID is an identifier, not a secret." },
    ],
    related: ["json-formatter", "base64-encoder-decoder"],
  },
  {
    slug: "word-counter",
    name: "Word Counter",
    category: "text",
    status: "live",
    description: "Count words, characters, sentences and paragraphs, with reading time.",
    keywords: ["word count", "character count", "reading time"],
    about: "Type or paste text to see live counts for words, characters (with and without spaces), sentences, paragraphs and estimated reading time.",
    howTo: ["Type or paste your text.", "Counts update as you type.", "Clear the box to start over."],
    faq: [{ q: "How is reading time worked out?", a: "It assumes an average adult reading speed of about 230 words per minute." }],
    related: ["regex-tester", "json-formatter"],
  },

  {
    slug: "image-editor",
    name: "Image Editor",
    category: "image",
    status: "live",
    description: "Crop, resize, draw, add text, blur or redact details and adjust colour, all in your browser.",
    keywords: ["online image editor", "crop image", "blur part of image", "redact screenshot", "annotate screenshot"],
    about:
      "A full image editor that runs on your device. Open a photo or paste a screenshot, then crop, rotate, resize, draw arrows and shapes, add text, hide sensitive details with blur, pixelate or redact, and tune brightness, contrast and saturation. Your image is never uploaded.",
    howTo: [
      "Drop an image onto the editor, choose a file, or paste a screenshot with Ctrl+V (Cmd+V on Mac).",
      "Pick a tool on the left. Drag on the image to draw, crop or hide an area. Use Select to move, resize or rotate what you drew.",
      "Fine-tune with the Adjust, Rotate and Resize panels. Undo and Redo are always available.",
      "Choose PNG, JPG or WebP and press Download, or copy the result to your clipboard.",
    ],
    faq: [
      { q: "Is my image uploaded anywhere?", a: "No. Everything happens inside your browser tab. The image never leaves your device and nothing is stored." },
      { q: "Which tool should I use to hide passwords or personal details?", a: "Use Redact. It paints over the area and permanently replaces the original pixels. Pixelate and Blur reduce detail but are weaker: light blur on small text can sometimes be partly recovered, so use the strongest settings or Redact for anything sensitive." },
      { q: "Can anyone remove my redaction from the saved file?", a: "No. Redact, Pixelate and Blur are applied to the image pixels themselves, not added as a removable layer. Once saved, the original pixels are gone." },
      { q: "Does the saved image keep my location or camera data?", a: "No. The editor re-encodes the picture, so EXIF data such as GPS location and camera details is not included in the saved file." },
      { q: "Why did my large photo get smaller when I opened it?", a: "To keep editing smooth and avoid browser crashes, images are limited to 4096 pixels on the longest side. You will see a message when this happens." },
      { q: "Which formats can I open and save?", a: "You can open PNG, JPG, WebP, GIF and BMP files up to 25 MB, and save as PNG, JPG or WebP. Animated GIFs open as a single still frame." },
      { q: "Can I undo my changes?", a: "Yes. Undo and Redo cover every edit, including crops and redactions, and Reset returns to the original (and can itself be undone)." },
    ],
    related: ["image-compressor", "image-resizer", "image-converter"],
  },

  {
    slug: "image-compressor",
    name: "Image Compressor",
    category: "image",
    status: "live",
    description: "Make JPG, PNG and WebP images much smaller with adjustable quality. Batch up to 20 at once.",
    keywords: ["compress image", "reduce image size", "optimize images", "shrink photo file size"],
    about:
      "Shrink image files for faster websites, easier emailing and less storage. Pick a quality level, optionally cap the longest side, and compress up to 20 images at once. Everything runs in your browser, so your photos are never uploaded.",
    howTo: [
      "Drop your images onto the page, choose files, or paste a screenshot.",
      "Set the quality (80% is a good starting point) and, if you like, a maximum size for the longest side.",
      "Press Compress and check the before and after sizes.",
      "Download images one by one, or all together as a ZIP.",
    ],
    faq: [
      { q: "Are my images uploaded?", a: "No. Compression happens on your device in your browser. Nothing is sent to a server." },
      { q: "How much smaller will my files get?", a: "It depends on the image. Photos often shrink by half or more at 80% quality with little visible difference. Screenshots and graphics saved as WebP are usually much smaller than PNG. Files that are already well optimised may not shrink, and in that case the original is kept." },
      { q: "What does the Smart format do?", a: "JPG and WebP images stay in their format. PNG, GIF and BMP images become WebP, which is far smaller and keeps transparency. Choose JPG, WebP or PNG if you need a specific format." },
      { q: "Will compressing reduce quality?", a: "JPG and WebP compression is lossy, so some detail is discarded. At around 80% quality the difference is hard to see for most photos. PNG output is lossless but saves little." },
      { q: "Is location or camera data removed?", a: "Yes. Images are re-encoded, so EXIF data such as GPS location and camera details is not included in the result." },
      { q: "Is there a size limit?", a: "You can add up to 20 images of up to 25 MB each. Images larger than 4096 pixels on the longest side are scaled down to keep your browser stable, and you will see a note when that happens." },
    ],
    related: ["image-resizer", "image-converter", "image-editor"],
  },
  {
    slug: "image-resizer",
    name: "Image Resizer",
    category: "image",
    status: "live",
    description: "Resize images to exact pixel dimensions or a percentage, one or many at a time.",
    keywords: ["resize image", "change image dimensions", "scale photo", "bulk image resizer"],
    about:
      "Change the width and height of your images by pixels or by percentage. Keep the proportions so nothing looks stretched, or set exact dimensions. Resize up to 20 images at once without uploading anything.",
    howTo: [
      "Add your images by dropping, choosing files or pasting.",
      "Choose By pixels (set a width, a height, or both) or By percentage.",
      "Pick an output format, then press Resize.",
      "Download each image or all of them as a ZIP.",
    ],
    faq: [
      { q: "What does Keep proportions do?", a: "The image is scaled to fit inside the width and height you give, without stretching. If you only enter one of the two, the other is worked out automatically." },
      { q: "Can I make an image bigger?", a: "Yes, by percentage, or by pixels with Allow enlarging turned on. Enlarging cannot add detail, so large increases look soft. Results are limited to 4096 pixels on the longest side." },
      { q: "How do I get an exact size?", a: "Turn off Keep proportions and enter both width and height. The image is stretched to exactly that size, so the shape may change." },
      { q: "Are my images uploaded?", a: "No. Everything happens in your browser and nothing leaves your device." },
      { q: "Which format is used for the result?", a: "By default the same as the original (GIF and BMP files become PNG). You can switch to JPG, WebP or PNG." },
    ],
    related: ["image-compressor", "image-converter", "image-editor"],
  },
  {
    slug: "image-converter",
    name: "Image Converter",
    category: "image",
    status: "live",
    description: "Convert images between JPG, PNG and WebP. Batch convert up to 20 at once.",
    keywords: ["convert image", "png to jpg", "jpg to webp", "webp to png", "image format converter"],
    about:
      "Convert images between JPG, PNG and WebP in your browser. It also opens GIF and BMP files. Convert many images at once and download them together as a ZIP. Nothing is uploaded.",
    howTo: [
      "Drop your images onto the page, choose files, or paste a screenshot.",
      "Choose the format to convert to: WebP, JPG or PNG.",
      "For JPG and WebP, set the quality, then press Convert.",
      "Download images individually or all together as a ZIP.",
    ],
    faq: [
      { q: "Which format should I choose?", a: "JPG works everywhere and suits photos. PNG is lossless and keeps transparency, which suits screenshots and graphics. WebP is usually the smallest, keeps transparency and is supported by all modern browsers." },
      { q: "What happens to transparent areas when converting to JPG?", a: "JPG has no transparency, so transparent areas become white." },
      { q: "Can I convert iPhone HEIC photos?", a: "Not yet. Browsers cannot reliably open HEIC. On an iPhone you can set Camera formats to Most Compatible, or share photos as JPG, then convert them here." },
      { q: "Do animated GIFs stay animated?", a: "No. GIF files are opened as a single still frame." },
      { q: "Are my images uploaded?", a: "No. Conversion happens on your device and nothing is sent anywhere." },
    ],
    related: ["image-compressor", "image-resizer", "image-editor"],
  },

  {
    slug: "base64-encoder-decoder",
    name: "Base64 Encoder / Decoder",
    category: "developer",
    status: "live",
    description: "Encode text to Base64 or decode Base64 back to text. Supports Unicode and URL-safe Base64.",
    keywords: ["base64 encode", "base64 decode", "base64 converter", "url safe base64"],
    about:
      "Convert text to Base64 and back instantly. It handles any language and emoji correctly, accepts standard and URL-safe Base64, and forgives missing padding and line breaks when decoding. Everything runs in your browser, so tokens and data you paste are never uploaded.",
    howTo: [
      "Choose Encode or Decode.",
      "Paste or type your text into the input box. The result appears as you type.",
      "Optionally turn on URL-safe output when encoding.",
      "Copy or download the result, or press Use as input to flip it around.",
    ],
    faq: [
      { q: "Is Base64 encryption?", a: "No. Base64 is just a way of writing data using 64 safe characters. Anyone can decode it, so never use it to protect secrets or passwords." },
      { q: "Does it support Unicode and emoji?", a: "Yes. Text is converted using UTF-8 before encoding, so accented letters, non-Latin scripts and emoji round-trip correctly." },
      { q: "What is URL-safe Base64?", a: "A variant that uses - and _ instead of + and /, and drops the = padding, so the result can sit in a URL or filename. The decoder accepts both kinds automatically." },
      { q: "Why does decoding say the data isn't valid text?", a: "The Base64 decoded successfully, but the bytes aren't UTF-8 text. That usually means it holds binary data such as an image or file. This tool works with text." },
      { q: "Is my data uploaded anywhere?", a: "No. Encoding and decoding happen entirely in your browser." },
    ],
    related: ["url-encoder-decoder", "json-formatter", "uuid-generator"],
  },
  {
    slug: "url-encoder-decoder",
    name: "URL Encoder / Decoder",
    category: "developer",
    status: "live",
    description: "Percent-encode or decode URLs, query values and form data, with the right rules for each.",
    keywords: ["url encode", "url decode", "percent encoding", "encodeURIComponent", "urlencode online"],
    about:
      "Encode text so it is safe to put in a URL, or decode percent-encoded text back to normal. Choose Component for query values and path segments, Full URL to keep the structure of a whole address, or Form data for application/x-www-form-urlencoded (spaces as +). It all runs in your browser.",
    howTo: [
      "Choose Encode or Decode.",
      "Pick the type: Component, Full URL or Form data.",
      "Paste your text. The result appears as you type.",
      "Copy it, or press Use as input to run it back the other way.",
    ],
    faq: [
      { q: "Which type should I use?", a: "Use Component for a single value, such as one query parameter. Use Full URL when encoding a whole address and you want characters like : / ? & = left alone. Use Form data for HTML form bodies, where spaces are written as +." },
      { q: "Why do spaces become %20 in one mode and + in another?", a: "Both are valid in different places. %20 works anywhere in a URL. A + for a space is only correct in form data and query strings, so only the Form data type produces it." },
      { q: "What is double encoding?", a: "Encoding text that is already encoded, which turns %20 into %2520. If your result looks full of %25, decode once and try again." },
      { q: "Is this encryption?", a: "No. Percent-encoding only makes text safe for URLs. Anyone can decode it." },
      { q: "Is my text uploaded anywhere?", a: "No. Everything happens in your browser." },
    ],
    related: ["base64-encoder-decoder", "json-formatter", "regex-tester"],
  },
  {
    slug: "regex-tester",
    name: "Regex Tester",
    category: "developer",
    status: "live",
    description: "Test JavaScript regular expressions live with highlighted matches, capture groups and replace preview.",
    keywords: ["regex tester", "regular expression tester", "regex online", "javascript regex", "regex match highlighter"],
    about:
      "Write a regular expression and see it run against your text instantly. Matches are highlighted, every capture group (numbered and named) is listed, and you can preview a find-and-replace. Patterns run in a background thread and are stopped after two seconds, so a runaway pattern cannot freeze the page. Your text stays in your browser.",
    howTo: [
      "Type your pattern into the expression box and choose any flags you need.",
      "Paste the text to test. Matches are highlighted as you type.",
      "Read the match details to see each capture group, or try one of the examples.",
      "Turn on Preview a replacement to see the result of a find-and-replace, using $1 or $<name> for groups.",
    ],
    faq: [
      { q: "Which regex flavour does this use?", a: "JavaScript (ECMAScript), the same engine your browser uses. It is very close to other flavours but differs in places, for example in the syntax for named groups and in which advanced features are available. Always check the flavour of the language you will use the pattern in." },
      { q: "Why was my pattern stopped after 2 seconds?", a: "Some patterns, such as nested repeats like (a+)+$, can take exponentially longer as the text grows. This is called catastrophic backtracking, and it can freeze a program. The tester stops it and tells you, so simplify the pattern." },
      { q: "What do the flags mean?", a: "g finds all matches instead of only the first. i ignores case. m makes ^ and $ match at every line. s lets . match new lines. u turns on full Unicode support." },
      { q: "How do I use groups in a replacement?", a: "Write $1, $2 and so on for numbered groups, $<name> for named groups, and $& for the whole match. Leave the replacement empty to delete matches." },
      { q: "Are there limits?", a: "Patterns up to 2,000 characters, test text up to 200,000 characters, and the first 1,000 matches are shown." },
      { q: "Is my text uploaded anywhere?", a: "No. The pattern and text never leave your browser." },
    ],
    related: ["url-encoder-decoder", "base64-encoder-decoder", "word-counter", "json-formatter"],
  },

  // ---- PLANNED (MVP list from the blueprint) ----
  { slug: "password-generator", name: "Password Generator", category: "security", status: "planned", description: "Generate strong random passwords." },
  { slug: "password-strength", name: "Password Strength Checker", category: "security", status: "planned", description: "Estimate how hard a password is to guess." },
  { slug: "passphrase-generator", name: "Passphrase Generator", category: "security", status: "planned", description: "Generate memorable multi-word passphrases." },
  { slug: "hash-generator", name: "Hash Generator", category: "security", status: "planned", description: "Compute MD5, SHA-1, SHA-256 and SHA-512 hashes." },
  { slug: "jwt-decoder", name: "JWT Decoder", category: "security", status: "planned", description: "Inspect the header and payload of a JSON Web Token." },
  { slug: "subnet-calculator", name: "Subnet Calculator", category: "security", status: "planned", description: "Work out IPv4 and CIDR ranges." },
  { slug: "port-reference", name: "Port Reference", category: "security", status: "planned", description: "Look up common ports and protocols." },
  { slug: "character-counter", name: "Character Counter", category: "text", status: "planned", description: "Count characters with and without spaces." },
  { slug: "case-converter", name: "Case Converter", category: "text", status: "planned", description: "Switch text between upper, lower, title and other cases." },
  { slug: "text-diff", name: "Text Diff", category: "text", status: "planned", description: "Compare two pieces of text and see the changes." },
  { slug: "slug-generator", name: "Slug Generator", category: "text", status: "planned", description: "Turn titles into clean URL slugs." },
  { slug: "qr-generator", name: "QR Code Generator", category: "generators", status: "planned", description: "Create QR codes for links and text." },
  { slug: "percentage-calculator", name: "Percentage Calculator", category: "calculators", status: "planned", description: "Calculate percentages and percentage change." },
  { slug: "age-calculator", name: "Age Calculator", category: "calculators", status: "planned", description: "Work out age or the time between two dates." },
  { slug: "unit-converter", name: "Unit Converter", category: "calculators", status: "planned", description: "Convert length, weight, temperature and more." },
];

export const liveTools = tools.filter((t) => t.status === "live");
export const getTool = (slug: string) => tools.find((t) => t.slug === slug);
export const getLiveTool = (slug: string) => liveTools.find((t) => t.slug === slug);
export const toolsInCategory = (c: CategorySlug) => liveTools.filter((t) => t.category === c);
