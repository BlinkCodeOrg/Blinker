import { ExtensionManifest, FirefoxCompatApi } from "./types";

export const FIREFOX_ONLY_MANIFEST_KEYS = [
  "applications",
  "browser_specific_settings",
  "experiment_apis",
  "protocol_handlers"
];

export const FIREFOX_ONLY_PERMISSIONS = new Set([
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

export const FIREFOX_ONLY_APIS: FirefoxCompatApi[] = [
  {
    name: "browser.* namespace",
    support: "polyfilled",
    reason: "Blinker maps browser.* to chrome.* for compatible WebExtension calls."
  },
  {
    name: "browser_specific_settings.gecko",
    support: "translated",
    reason: "Gecko extension metadata is removed before loading in Chromium/Electron."
  },
  {
    name: "applications.gecko",
    support: "translated",
    reason: "Legacy Gecko extension metadata is removed before loading in Chromium/Electron."
  },
  {
    name: "browser.experiments.*",
    support: "unsupported",
    reason: "Firefox experiments require privileged Gecko/XPCOM internals."
  },
  {
    name: "browser.activityLog",
    support: "unsupported",
    reason: "The Firefox activity log is a Firefox browser feature, not a WebExtension primitive in Chromium."
  },
  {
    name: "browser.dns",
    support: "unsupported",
    reason: "Firefox exposes DNS lookups through Gecko internals; Chromium extensions do not expose this API."
  },
  {
    name: "browser.geckoProfiler",
    support: "unsupported",
    reason: "Gecko profiler hooks do not exist in Electron."
  },
  {
    name: "browser.menus.overrideContext",
    support: "unsupported",
    reason: "Firefox-specific menu context override has no Chromium extension equivalent."
  },
  {
    name: "browser.mozillaAddons",
    support: "unsupported",
    reason: "This API is restricted to Mozilla-controlled add-ons."
  },
  {
    name: "browser.networkStatus",
    support: "unsupported",
    reason: "Firefox-specific network status events are not available through Chromium extension APIs."
  },
  {
    name: "browser.normandyAddonStudy",
    support: "unsupported",
    reason: "Normandy studies are Firefox infrastructure."
  },
  {
    name: "browser.pkcs11",
    support: "unsupported",
    reason: "Firefox PKCS#11 module management is implemented by Gecko/NSS internals."
  },
  {
    name: "browser.telemetry",
    support: "unsupported",
    reason: "Firefox telemetry APIs are Mozilla-private and should not be emulated by Blinker."
  },
  {
    name: "browser.urlbar",
    support: "unsupported",
    reason: "Firefox URL bar result providers are tied to Firefox's urlbar implementation."
  }
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasFirefoxMetadata(manifest: ExtensionManifest) {
  const browserSettings = manifest.browser_specific_settings;
  const applications = manifest.applications;

  if (isRecord(browserSettings) && isRecord(browserSettings.gecko)) return true;
  if (isRecord(applications) && isRecord(applications.gecko)) return true;
  if (isRecord(manifest.experiment_apis)) return true;

  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  return permissions.some((permission) => typeof permission === "string" && FIREFOX_ONLY_PERMISSIONS.has(permission));
}

export function getFirefoxOnlyApiWarnings(manifest: ExtensionManifest) {
  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  const optionalPermissions = Array.isArray(manifest.optional_permissions) ? manifest.optional_permissions : [];
  const requestedPermissions = new Set(
    [...permissions, ...optionalPermissions].filter((value) => typeof value === "string")
  );

  return FIREFOX_ONLY_APIS.filter((api) => {
    if (api.support !== "unsupported") return false;

    const permissionName = api.name.replace("browser.", "");
    return (
      requestedPermissions.has(permissionName) ||
      (api.name === "browser.experiments.*" && isRecord(manifest.experiment_apis))
    );
  }).map((api) => `Unsupported Firefox-only API: ${api.name}. ${api.reason}`);
}
