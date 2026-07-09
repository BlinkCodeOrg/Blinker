import fs from "fs/promises";
import path from "path";
import {
  FIREFOX_ONLY_MANIFEST_KEYS,
  FIREFOX_ONLY_PERMISSIONS,
  getFirefoxOnlyApiWarnings,
  hasFirefoxMetadata
} from "./api-registry";
import { addBrowserNamespacePolyfill, BROWSER_NAMESPACE_POLYFILL, BROWSER_NAMESPACE_POLYFILL_SOURCE } from "./polyfill";
import { ExtensionManifest, PreparedExtensionImport, PrepareExtensionImportOptions } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneManifest(manifest: ExtensionManifest): ExtensionManifest {
  return JSON.parse(JSON.stringify(manifest)) as ExtensionManifest;
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

export function normalizeFirefoxManifest(manifest: ExtensionManifest) {
  const normalized = cloneManifest(manifest);
  const warnings = getFirefoxOnlyApiWarnings(manifest);

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
