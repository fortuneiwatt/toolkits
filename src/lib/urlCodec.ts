export type UrlScope = "component" | "full" | "form";
export type UrlResult = { ok: true; value: string } | { ok: false; error: string };

/** Characters encodeURIComponent leaves alone but form encoding (application/x-www-form-urlencoded) does not. */
const FORM_EXTRA = /[!'()~]/g;
const hex = (c: string) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`;

export function urlEncode(input: string, scope: UrlScope): UrlResult {
  try {
    if (scope === "full") return { ok: true, value: encodeURI(input) };
    const component = encodeURIComponent(input);
    if (scope === "component") return { ok: true, value: component };
    return { ok: true, value: component.replace(FORM_EXTRA, hex).replace(/%20/g, "+") };
  } catch {
    return { ok: false, error: "This text contains an unpaired surrogate character and can't be encoded." };
  }
}

export function urlDecode(input: string, scope: UrlScope): UrlResult {
  try {
    if (scope === "full") return { ok: true, value: decodeURI(input) };
    return { ok: true, value: decodeURIComponent(scope === "form" ? input.replace(/\+/g, " ") : input) };
  } catch {
    return { ok: false, error: "This contains a malformed % sequence, so it can't be decoded." };
  }
}
