export type ExtensionManifest = chrome.runtime.Manifest & Record<string, unknown>;

export type PreparedExtensionImport = {
  extensionPath: string;
  cleanupPaths: string[];
  warnings: string[];
};

export type PrepareExtensionImportOptions = {
  mutateSource?: boolean;
};

export type FirefoxCompatSupport = "polyfilled" | "translated" | "unsupported";

export type FirefoxCompatApi = {
  name: string;
  support: FirefoxCompatSupport;
  reason: string;
};
