import { runRegex, type RegexRequest, type RegexResult } from "@/lib/regex";

export const REGEX_TIMEOUT_MS = 2000;

export interface RegexRun {
  result: Promise<RegexResult>;
  cancel: () => void;
}

/**
 * Run a regex in a Web Worker. If it takes longer than the timeout (e.g. catastrophic backtracking from a
 * pattern like (a+)+$), the worker is terminated and an error is returned instead of freezing the tab.
 * Browsers without Worker support fall back to running inline.
 */
export function startRegex(req: RegexRequest, timeoutMs = REGEX_TIMEOUT_MS): RegexRun {
  if (typeof Worker === "undefined") return { result: Promise.resolve(runRegex(req)), cancel: () => {} };

  let finish: (r: RegexResult) => void = () => {};
  const result = new Promise<RegexResult>((resolve) => { finish = resolve; });
  const worker = new Worker(new URL("./regex.worker.ts", import.meta.url), { type: "module" });
  let done = false;
  const end = (r: RegexResult) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    worker.terminate();
    finish(r);
  };
  const timer = setTimeout(
    () => end({ ok: false, timedOut: true, error: "This pattern took too long to run and was stopped. It may cause catastrophic backtracking, for example nested repeats like (a+)+. Try a simpler pattern." }),
    timeoutMs,
  );
  worker.onmessage = (e: MessageEvent<RegexResult>) => end(e.data);
  worker.onerror = () => end({ ok: false, error: "The pattern could not be run in this browser." });
  worker.postMessage(req);
  return { result, cancel: () => end({ ok: false, error: "Cancelled." }) };
}
