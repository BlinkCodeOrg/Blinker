import { IPCListener } from "~/blinker/types";
import { SharedExtensionData } from "~/types/extensions";

// API //
export interface BlinkerExtensionsAPI {
  /**
   * Get all extensions in a specific profile
   */
  getAllInProfile: (profileId: string) => Promise<SharedExtensionData[]>;

  /**
   * Get all extensions in the current profile
   */
  getAllInCurrentProfile: () => Promise<SharedExtensionData[]>;

  /**
   * Listen for updates to the extensions in the current profile
   */
  onUpdated: IPCListener<[string, SharedExtensionData[]]>;

  /**
   * Set the enabled state of an extension
   */
  setExtensionEnabled: (extensionId: string, enabled: boolean) => Promise<boolean>;

  /**
   * Uninstall an extension
   */
  uninstallExtension: (extensionId: string) => Promise<boolean>;

  /**
   * Set the pinned state of an extension
   */
  setExtensionPinned: (extensionId: string, pinned: boolean) => Promise<boolean>;

  /**
   * Import an unpacked extension folder into the current profile
   */
  importUnpacked: () => Promise<SharedExtensionData | null>;

  /**
   * Import a packaged Firefox WebExtension (.xpi) into the current profile.
   */
  importFirefoxXpi: () => Promise<SharedExtensionData | null>;

  /** Reload an installed extension from disk. */
  reloadExtension: (extensionId: string) => Promise<boolean>;

  /** Open developer tools for an extension background context. */
  inspectExtension: (extensionId: string, view: "service_worker" | "background") => Promise<boolean>;

  /** Pack an extension directory into a portable ZIP archive. */
  packExtension: () => Promise<boolean>;
}
