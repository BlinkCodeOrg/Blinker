import { tabsController } from "@/controllers/tabs-controller";
import { sendMessageToListeners } from "@/ipc/listeners-manager";
import { debugPrint } from "@/modules/output";
import { queuePrompt } from "@/modules/prompts";
import { setAlwaysOpenExternal, shouldAlwaysOpenExternal } from "@/saving/open-external";
import { getSitePermissionSetting, setSitePermissionForProfile } from "@/saving/site-permissions";
import { app, dialog, OpenExternalPermissionRequest, type Session } from "electron";
import type { PromptResult, PromptState, SitePermissionPromptResult } from "~/types/prompts";

const MANAGED_PERMISSIONS = new Set([
  "media",
  "geolocation",
  "notifications",
  "midiSysex",
  "pointerLock",
  "fullscreen"
]);

function originFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function permissionLabelKey(permission: string) {
  switch (permission) {
    case "camera":
      return "permission.camera";
    case "microphone":
      return "permission.microphone";
    case "media":
      return "permission.cameraMicrophone";
    case "geolocation":
      return "permission.geolocation";
    case "notifications":
      return "permission.notifications";
    case "midiSysex":
      return "permission.midiSysex";
    case "pointerLock":
      return "permission.pointerLock";
    case "fullscreen":
      return "permission.fullscreen";
    default:
      return permission;
  }
}

function permissionKeys(permission: string, details: { mediaTypes?: string[] }): string[] {
  if (permission !== "media") return [permission];
  const mediaTypes = details.mediaTypes ?? [];
  const keys = new Set<string>();
  if (mediaTypes.includes("video")) keys.add("camera");
  if (mediaTypes.includes("audio")) keys.add("microphone");
  return keys.size > 0 ? [...keys] : ["media"];
}

async function requestSitePermission(tabId: number, origin: string, permission: string) {
  const { promise, resolve } = Promise.withResolvers<PromptResult<SitePermissionPromptResult>>();
  const state: PromptState = {
    id: "",
    type: "site-permission",
    tabId,
    originUrl: origin,
    origin,
    permission,
    permissionLabelKey: permissionLabelKey(permission),
    promise,
    resolver: resolve
  };

  queuePrompt(state);

  const result = await promise;
  if (!result.success) return "block";
  return result.result;
}

export function registerHandlersWithSession(session: Session) {
  session.setPermissionRequestHandler(async (webContents, permission, callback, details) => {
    debugPrint("PERMISSIONS", "permission request", webContents?.getURL() || "unknown-url", permission);

    if (permission === "openExternal") {
      const openExternalDetails = details as OpenExternalPermissionRequest;

      const requestingURL = openExternalDetails.requestingUrl;
      const externalURL = openExternalDetails.externalURL;

      if (openExternalDetails.externalURL) {
        const shouldAlwaysOpen = await shouldAlwaysOpenExternal(requestingURL, openExternalDetails.externalURL);
        if (shouldAlwaysOpen) {
          callback(true);
          return;
        }
      }

      const externalAppName =
        app.getApplicationNameForProtocol(openExternalDetails.externalURL ?? "") || "an unknown application";

      const url = new URL(openExternalDetails.requestingUrl);
      const minifiedUrl = `${url.protocol}//${url.host}`;

      dialog
        .showMessageBox({
          message: `"${minifiedUrl}" wants to open "${externalAppName}".`,
          buttons: ["Cancel", "Open", "Always Open"]
        })
        .then((response) => {
          switch (response.response) {
            case 2:
              if (externalURL) {
                setAlwaysOpenExternal(requestingURL, externalURL);
              }
            /* falls through */
            case 1:
              callback(true);
              break;
            case 0:
              callback(false);
              break;
          }
        });

      return;
    }

    const tab = webContents ? tabsController.getTabByWebContents(webContents) : null;
    const requestingUrl = details.requestingUrl || webContents?.getURL() || "";
    const origin = originFromUrl(requestingUrl);

    if (!tab || !origin || !MANAGED_PERMISSIONS.has(permission)) {
      callback(false);
      return;
    }

    const keys = permissionKeys(permission, details as { mediaTypes?: string[] });
    const storedSettings = keys.map(
      (key) =>
        getSitePermissionSetting(tab.profileId, origin, key) ??
        getSitePermissionSetting(tab.profileId, origin, permission)
    );
    if (storedSettings.every((setting) => setting === "allow")) {
      callback(true);
      return;
    }
    if (storedSettings.some((setting) => setting === "block")) {
      callback(false);
      return;
    }

    for (const key of keys) {
      const response = await requestSitePermission(tab.id, origin, key);
      if (response === "always") {
        setSitePermissionForProfile(tab.profileId, { origin, permission: key, setting: "allow" });
        sendMessageToListeners("site-permissions:on-changed");
        continue;
      }
      if (response !== "allow") {
        callback(false);
        return;
      }
    }
    callback(true);
  });

  session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    if (permission === "openExternal") return false;
    const tab = webContents ? tabsController.getTabByWebContents(webContents) : null;
    const origin = originFromUrl(requestingOrigin || webContents?.getURL() || "");
    if (!tab || !origin || !MANAGED_PERMISSIONS.has(permission)) return false;
    if (permission === "media") {
      const legacy = getSitePermissionSetting(tab.profileId, origin, "media");
      return (
        legacy === "allow" ||
        (getSitePermissionSetting(tab.profileId, origin, "camera") === "allow" &&
          getSitePermissionSetting(tab.profileId, origin, "microphone") === "allow")
      );
    }
    return getSitePermissionSetting(tab.profileId, origin, permission) === "allow";
  });
}
