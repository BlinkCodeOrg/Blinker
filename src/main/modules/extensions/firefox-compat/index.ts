export {
  FIREFOX_ONLY_APIS,
  FIREFOX_ONLY_MANIFEST_KEYS,
  FIREFOX_ONLY_PERMISSIONS,
  getFirefoxOnlyApiWarnings,
  hasFirefoxMetadata
} from "./api-registry";
export { normalizeFirefoxManifest, prepareExtensionImport } from "./manifest";
export { addBrowserNamespacePolyfill, BROWSER_NAMESPACE_POLYFILL, BROWSER_NAMESPACE_POLYFILL_SOURCE } from "./polyfill";
export { prepareExtensionSourceForImport } from "./xpi";
export type {
  ExtensionManifest,
  FirefoxCompatApi,
  FirefoxCompatSupport,
  PreparedExtensionImport,
  PrepareExtensionImportOptions
} from "./types";
