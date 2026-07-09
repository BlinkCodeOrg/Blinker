import fs from "fs/promises";
import path from "path";
import extractZip from "extract-zip";

type ExtensionManifest = chrome.runtime.Manifest & Record<string, unknown>;

type PreparedExtensionImport = {
  extensionPath: string;
  cleanupPaths: string[];
  warnings: string[];
};

type PrepareExtensionImportOptions = {
  mutateSource?: boolean;
};

const FIREFOX_ONLY_MANIFEST_KEYS = [
  "applications",
  "browser_specific_settings",
  "experiment_apis",
  "protocol_handlers"
];

const FIREFOX_ONLY_PERMISSIONS = new Set([
  "activityLog",
  "dns",
  "geckoProfiler",
  "menus.overrideContext",
  "mozillaAddons",
  "networkStatus",
  "normandyAddonStudy",
  "pkcs11",
  "telemetry",
  "urlbar"
]);

const BROWSER_NAMESPACE_POLYFILL = "_blinker_firefox_browser_polyfill.js";
const BROWSER_NAMESPACE_POLYFILL_SOURCE = `(() => {
  if (typeof globalThis.browser === "undefined" && typeof globalThis.chrome !== "undefined") {
    globalThis.browser = globalThis.chrome;
  }
})();
`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneManifest(manifest: ExtensionManifest): ExtensionManifest {
  return JSON.parse(JSON.stringify(manifest)) as ExtensionManifest;
}

function hasFirefoxMetadata(manifest: ExtensionManifest) {
  const browserSettings = manifest.browser_specific_settings;
  const applications = manifest.applications;

  if (isRecord(browserSettings) && isRecord(browserSettings.gecko)) return true;
  if (isRecord(applications) && isRecord(applications.gecko)) return true;
  if (isRecord(manifest.experiment_apis)) return true;

  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  return permissions.some((permission) => typeof permission === "string" && FIREFOX_ONLY_PERMISSIONS.has(permission));
}

function sanitizePermissions(value: unknown, warnings: string[]) {
  if (!Array.isArray(value)) return value;

  return value.filter((permission) => {
    if (typeof permission !== "string") return true;
    if (!FIREFOX_ONLY_PERMISSIONS.has(permission)) return true;

    warnings.push(`Removed Firefox-only permission: ${permission}`);
    return false;
  });
}

function sanitizeActionManifest(manifest: ExtensionManifest, warnings: string[]) {
  const browserAction = manifest.browser_action;
  const pageAction = manifest.page_action;

  if (isRecord(browserAction) && "default_area" in browserAction) {
    delete browserAction.default_area;
    warnings.push("Removed Firefox-only browser_action.default_area.");
  }

  if (isRecord(pageAction) && "default_area" in pageAction) {
    delete pageAction.default_area;
    warnings.push("Removed Firefox-only page_action.default_area.");
  }
}

function sanitizeContentScripts(manifest: ExtensionManifest, warnings: string[]) {
  if (!Array.isArray(manifest.content_scripts)) return;

  for (const script of manifest.content_scripts) {
    if (!isRecord(script)) continue;
    if ("css_origin" in script) {
      delete script.css_origin;
      warnings.push("Removed Firefox-only content script css_origin.");
    }
  }
}

function prependScript(scripts: unknown, scriptPath: string) {
  if (!Array.isArray(scripts)) return scripts;
  if (scripts.includes(scriptPath)) return scripts;
  return [scriptPath, ...scripts];
}

function addBrowserNamespacePolyfill(manifest: ExtensionManifest, warnings: string[]) {
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

function normalizeFirefoxManifest(manifest: ExtensionManifest) {
  const normalized = cloneManifest(manifest);
  const warnings: string[] = [];

  for (const key of FIREFOX_ONLY_MANIFEST_KEYS) {
    if (key in normalized) {
      delete normalized[key];
      warnings.push(`Removed Firefox-only manifest key: ${key}`);
    }
  }

  normalized.permissions = sanitizePermissions(normalized.permissions, warnings) as string[] | undefined;
  normalized.optional_permissions = sanitizePermissions(normalized.optional_permissions, warnings) as
    | string[]
    | undefined;

  sanitizeActionManifest(normalized, warnings);
  sanitizeContentScripts(normalized, warnings);
  addBrowserNamespacePolyfill(normalized, warnings);

  if (normalized.manifest_version === 2 && !normalized.browser_action && isRecord(normalized.action)) {
    normalized.browser_action = normalized.action as chrome.runtime.ManifestAction;
    delete normalized.action;
    warnings.push("Converted manifest v2 action to browser_action.");
  }

  if (normalized.manifest_version === 3 && !normalized.action && isRecord(normalized.browser_action)) {
    normalized.action = normalized.browser_action as chrome.runtime.ManifestAction;
    delete normalized.browser_action;
    warnings.push("Converted browser_action to manifest v3 action.");
  }

  return { manifest: normalized, warnings };
}

export async function prepareExtensionImport(
  sourcePath: string,
  stagingRoot: string,
  options: PrepareExtensionImportOptions = {}
): Promise<PreparedExtensionImport> {
  const manifestPath = path.join(sourcePath, "manifest.json");
  const manifestJSON = await fs.readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(manifestJSON) as ExtensionManifest;

  if (!hasFirefoxMetadata(manifest)) {
    return { extensionPath: sourcePath, cleanupPaths: [], warnings: [] };
  }

  const { manifest: normalizedManifest, warnings } = normalizeFirefoxManifest(manifest);
  const stagingPath = options.mutateSource
    ? sourcePath
    : path.join(stagingRoot, `${Date.now()}-${path.basename(sourcePath).replace(/[^a-z0-9._-]/gi, "-")}`);

  if (!options.mutateSource) {
    await fs.mkdir(stagingRoot, { recursive: true });
    await fs.rm(stagingPath, { recursive: true, force: true });
    await fs.cp(sourcePath, stagingPath, {
      recursive: true,
      filter: (item) => !item.includes(`${path.sep}.git${path.sep}`) && !item.endsWith(`${path.sep}.git`)
    });
  }

  await fs.writeFile(
    path.join(stagingPath, "manifest.json"),
    `${JSON.stringify(normalizedManifest, null, 2)}\n`,
    "utf-8"
  );
  await fs.writeFile(path.join(stagingPath, BROWSER_NAMESPACE_POLYFILL), BROWSER_NAMESPACE_POLYFILL_SOURCE, "utf-8");

  return {
    extensionPath: stagingPath,
    cleanupPaths: options.mutateSource ? [sourcePath] : [stagingPath],
    warnings
  };
}

export async function prepareExtensionSourceForImport(
  sourcePath: string,
  stagingRoot: string
): Promise<PreparedExtensionImport> {
  const sourceStats = await fs.stat(sourcePath).catch(() => null);
  if (!sourceStats) {
    return { extensionPath: sourcePath, cleanupPaths: [], warnings: [] };
  }

  if (!sourceStats.isFile() || path.extname(sourcePath).toLowerCase() !== ".xpi") {
    return prepareExtensionImport(sourcePath, stagingRoot);
  }

  const unpackedXpiPath = path.join(
    stagingRoot,
    `${Date.now()}-${path.basename(sourcePath, path.extname(sourcePath)).replace(/[^a-z0-9._-]/gi, "-")}-xpi`
  );

  await fs.mkdir(stagingRoot, { recursive: true });
  await fs.rm(unpackedXpiPath, { recursive: true, force: true });
  await fs.mkdir(unpackedXpiPath, { recursive: true });
  await extractZip(sourcePath, { dir: unpackedXpiPath });

  const preparedImport = await prepareExtensionImport(unpackedXpiPath, stagingRoot, { mutateSource: true });

  return {
    ...preparedImport,
    cleanupPaths: Array.from(new Set([unpackedXpiPath, ...preparedImport.cleanupPaths])),
    warnings: [`Extracted Firefox .xpi package: ${path.basename(sourcePath)}`, ...preparedImport.warnings]
  };
}
