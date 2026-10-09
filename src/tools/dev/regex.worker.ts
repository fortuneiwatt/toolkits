import { runRegex, type RegexRequest } from "@/lib/regex";

// Runs off the main thread so a catastrophic pattern can be killed without freezing the page.
self.onmessage = (e: MessageEvent<RegexRequest>) => {
  self.postMessage(runRegex(e.data));
};
