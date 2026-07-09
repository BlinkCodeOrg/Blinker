import { ExtensionManifest } from "./types";

export const BROWSER_NAMESPACE_POLYFILL = "_blinker_firefox_browser_polyfill.js";

export const BROWSER_NAMESPACE_POLYFILL_SOURCE = `(() => {
  if (typeof globalThis.browser === "undefined" && typeof globalThis.chrome !== "undefined") {
    globalThis.browser = globalThis.chrome;
  }
})();
`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function prependScript(scripts: unknown, scriptPath: string) {
  if (!Array.isArray(scripts)) return scripts;
  if (scripts.includes(scriptPath)) return scripts;
  return [scriptPath, ...scripts];
}

export function addBrowserNamespacePolyfill(manifest: ExtensionManifest, warnings: string[]) {
  const background = manifest.background;

  if (isRecord(background)) {
    const backgroundRecord = background as Record<string, unknown>;
    if (Array.isArray(backgroundRecord.scripts)) {
      backgroundRecord.scripts = prependScript(backgroundRecord.scripts, BROWSER_NAMESPACE_POLYFILL);
      warnings.push("Added browser.* namespace polyfill to background scripts.");
    } else if (typeof backgroundRecord.service_worker === "string") {
      warnings.push("Manifest v3 service workers cannot be safely wrapped with the browser.* polyfill.");
    }
  }

  if (!Array.isArray(manifest.content_scripts)) return;

  for (const script of manifest.content_scripts) {
    if (!isRecord(script)) continue;
    const scriptRecord = script as Record<string, unknown>;
    scriptRecord.js = prependScript(scriptRecord.js, BROWSER_NAMESPACE_POLYFILL);
  }

  warnings.push("Added browser.* namespace polyfill to content scripts.");
}
