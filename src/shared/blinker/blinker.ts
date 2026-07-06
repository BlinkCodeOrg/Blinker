import { BlinkerAppAPI } from "~/blinker/interfaces/app/app";
import { BlinkerWindowsAPI } from "~/blinker/interfaces/app/windows";
import { BlinkerExtensionsAPI } from "~/blinker/interfaces/app/extensions";

import { BlinkerBrowserAPI } from "~/blinker/interfaces/browser/browser";
import { BlinkerTabsAPI } from "~/blinker/interfaces/browser/tabs";
import { BlinkerPinnedTabsAPI } from "~/blinker/interfaces/browser/pinned-tabs";
import { BlinkerPageAPI } from "~/blinker/interfaces/browser/page";
import { BlinkerNavigationAPI } from "~/blinker/interfaces/browser/navigation";
import { BlinkerInterfaceAPI } from "~/blinker/interfaces/browser/interface";
import { BlinkerOmniboxAPI } from "~/blinker/interfaces/browser/omnibox";
import { BlinkerNewTabAPI } from "~/blinker/interfaces/browser/newTab";
import { BlinkerFindInPageAPI } from "~/blinker/interfaces/browser/find-in-page";
import { BlinkerHistoryAPI } from "~/blinker/interfaces/browser/history";
import { BlinkerDownloadsAPI } from "~/blinker/interfaces/browser/downloads";
import { BlinkerBookmarksAPI } from "~/blinker/interfaces/browser/bookmarks";
import { BlinkerPasskeyAPI } from "~/blinker/interfaces/browser/passkey";
import { BlinkerPromptsAPI } from "~/blinker/interfaces/browser/prompts";

import { BlinkerProfilesAPI } from "~/blinker/interfaces/sessions/profiles";
import { BlinkerSpacesAPI } from "~/blinker/interfaces/sessions/spaces";

import { BlinkerSettingsAPI } from "~/blinker/interfaces/settings/settings";
import { BlinkerIconsAPI } from "~/blinker/interfaces/settings/icons";
import { BlinkerOpenExternalAPI } from "~/blinker/interfaces/settings/openExternal";
import { BlinkerOnboardingAPI } from "~/blinker/interfaces/settings/onboarding";
import { BlinkerPasswordsAPI } from "~/blinker/interfaces/settings/passwords";
import { BlinkerSitePermissionsAPI } from "~/blinker/interfaces/settings/site-permissions";
import { BlinkerUpdatesAPI } from "~/blinker/interfaces/app/updates";
import { BlinkerActionsAPI } from "~/blinker/interfaces/app/actions";
import { BlinkerShortcutsAPI } from "~/blinker/interfaces/app/shortcuts";

declare global {
  /**
   * The Blinker API instance exposed by the Electron preload script.
   * This is defined in electron/preload.ts and exposed via contextBridge
   */
  const blinker: {
    // App APIs
    app: BlinkerAppAPI;
    windows: BlinkerWindowsAPI;
    extensions: BlinkerExtensionsAPI;
    updates: BlinkerUpdatesAPI;
    actions: BlinkerActionsAPI;
    shortcuts: BlinkerShortcutsAPI;

    // Browser APIs
    browser: BlinkerBrowserAPI;
    tabs: BlinkerTabsAPI;
    pinnedTabs: BlinkerPinnedTabsAPI;
    page: BlinkerPageAPI;
    navigation: BlinkerNavigationAPI;
    history: BlinkerHistoryAPI;
    downloads: BlinkerDownloadsAPI;
    bookmarks: BlinkerBookmarksAPI;
    interface: BlinkerInterfaceAPI;
    passkey: BlinkerPasskeyAPI;
    omnibox: BlinkerOmniboxAPI;
    newTab: BlinkerNewTabAPI;
    findInPage: BlinkerFindInPageAPI;
    prompts: BlinkerPromptsAPI;

    // Session APIs
    profiles: BlinkerProfilesAPI;
    spaces: BlinkerSpacesAPI;

    // Settings APIs
    settings: BlinkerSettingsAPI;
    icons: BlinkerIconsAPI;
    openExternal: BlinkerOpenExternalAPI;
    onboarding: BlinkerOnboardingAPI;
    passwords: BlinkerPasswordsAPI;
    sitePermissions: BlinkerSitePermissionsAPI;
  };
}
