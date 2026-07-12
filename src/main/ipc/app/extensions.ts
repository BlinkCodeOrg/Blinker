import { sendMessageToListeners } from "@/ipc/listeners-manager";
import { translateManifestString } from "@/modules/extensions/locales";
import {
  ExtensionData,
  ExtensionManager,
  getExtensionIcon,
  getExtensionSize,
  getManifest
} from "@/modules/extensions/management";
import { getPermissionWarnings } from "@/modules/extensions/permission-warnings";
import { spacesController } from "@/controllers/spaces-controller";
import {
  BrowserWindow as ElectronBrowserWindow,
  dialog,
  ipcMain,
  IpcMainInvokeEvent,
  WebContents,
  webContents
} from "electron";
import { ExtensionInspectView, SharedExtensionData } from "~/types/extensions";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import { loadedProfilesController } from "@/controllers/loaded-profiles-controller";
import AdmZip from "adm-zip";
import path from "path";

async function generateSharedExtensionData(
  extensionsManager: ExtensionManager,
  extensionId: string,
  extensionData: ExtensionData
): Promise<SharedExtensionData | null> {
  const extensionPath = await extensionsManager.getExtensionPath(extensionId, extensionData);
  if (!extensionPath) {
    return {
      type: extensionData.type,
      id: extensionId,
      name: "Broken extension",
      description: "The extension directory or manifest.json could not be found.",
      icon: "",
      enabled: false,
      pinned: extensionData.pinned,
      version: "unknown",
      path: extensionData.sourcePath ?? "",
      size: 0,
      permissions: [],
      inspectViews: [],
      errors: ["Extension directory or manifest.json is missing."]
    };
  }

  const manifest = await getManifest(extensionPath);
  if (!manifest) {
    return {
      type: extensionData.type,
      id: extensionId,
      name: "Invalid extension",
      description: "manifest.json is invalid or cannot be parsed.",
      icon: "",
      enabled: false,
      pinned: extensionData.pinned,
      version: "unknown",
      path: extensionPath,
      size: 0,
      permissions: [],
      inspectViews: [],
      errors: ["manifest.json is invalid or cannot be parsed."]
    };
  }

  const size = await getExtensionSize(extensionPath);

  const permissions: string[] = getPermissionWarnings(manifest.permissions ?? [], manifest.host_permissions ?? []);
  const inspectViews: ExtensionInspectView[] = [];
  if (manifest.background && "service_worker" in manifest.background && manifest.background.service_worker) {
    inspectViews.push("service_worker");
  }
  if (
    manifest.background &&
    !("service_worker" in manifest.background) &&
    (manifest.background.page || manifest.background.scripts?.length)
  ) {
    inspectViews.push("background");
  }

  const translatedName = await translateManifestString(extensionPath, manifest.name);
  const translatedShortName = manifest.short_name
    ? await translateManifestString(extensionPath, manifest.short_name)
    : undefined;
  const translatedDescription = manifest.description
    ? await translateManifestString(extensionPath, manifest.description)
    : undefined;

  const iconURL = new URL("blinker://extension-icon");
  iconURL.searchParams.set("id", extensionId);
  iconURL.searchParams.set("profile", extensionsManager.profileId);

  return {
    type: extensionData.type,
    id: extensionId,
    name: translatedName,
    short_name: translatedShortName,
    description: translatedDescription,
    icon: iconURL.toString(),
    enabled: extensionData.disabled ? false : true,
    pinned: extensionData.pinned ? true : false,
    version: manifest.version,
    path: extensionPath,
    size,
    permissions,
    inspectViews,
    errors: []
  };
}

async function getExtensionDataFromProfile(profileId: string): Promise<SharedExtensionData[]> {
  const loadedProfile = loadedProfilesController.get(profileId);
  if (!loadedProfile) {
    return [];
  }

  const { extensionsManager } = loadedProfile;

  const extensions = await extensionsManager.getInstalledExtensions();
  const promises = extensions.map(async (extensionData) => {
    return generateSharedExtensionData(extensionsManager, extensionData.id, extensionData);
  });

  const results = await Promise.all(promises);
  return results.filter((result) => result !== null);
}

async function getCurrentProfileIdFromWebContents(webContents: WebContents): Promise<string | null> {
  const window = browserWindowsController.getWindowFromWebContents(webContents);
  if (!window) return null;

  const spaceId = window.currentSpaceId;
  if (!spaceId) return null;

  const space = await spacesController.get(spaceId);
  if (!space) return null;

  return space.profileId;
}

ipcMain.handle(
  "extensions:get-all-in-profile",
  async (_event: IpcMainInvokeEvent, profileId: string): Promise<SharedExtensionData[]> => {
    return getExtensionDataFromProfile(profileId);
  }
);

ipcMain.handle(
  "extensions:reload-extension",
  async (event: IpcMainInvokeEvent, extensionId: string): Promise<boolean> => {
    const profileId = await getCurrentProfileIdFromWebContents(event.sender);
    const loadedProfile = profileId ? loadedProfilesController.get(profileId) : null;
    if (!loadedProfile) return false;
    return loadedProfile.extensionsManager.reloadExtension(extensionId);
  }
);

ipcMain.handle(
  "extensions:inspect-extension",
  async (event: IpcMainInvokeEvent, extensionId: string, view: ExtensionInspectView): Promise<boolean> => {
    const profileId = await getCurrentProfileIdFromWebContents(event.sender);
    const loadedProfile = profileId ? loadedProfilesController.get(profileId) : null;
    if (!loadedProfile || !loadedProfile.session.extensions.getExtension(extensionId)) return false;

    const extensionOrigin = `chrome-extension://${extensionId}/`;
    const backgroundContents = webContents
      .getAllWebContents()
      .find((contents) => contents.getURL().startsWith(extensionOrigin));

    if (view === "background" && backgroundContents) {
      backgroundContents.openDevTools({ mode: "detach", activate: true });
      return true;
    }

    if (view === "service_worker") {
      const runningWorker = Object.values(loadedProfile.session.serviceWorkers.getAllRunning()).find((worker) =>
        worker.scope.startsWith(extensionOrigin)
      );
      if (!runningWorker) return false;

      const inspectorWindow = new ElectronBrowserWindow({
        show: false,
        webPreferences: { session: loadedProfile.session }
      });
      try {
        await inspectorWindow.loadURL(extensionOrigin);
        inspectorWindow.webContents.inspectServiceWorker();
        inspectorWindow.webContents.once("devtools-closed", () => inspectorWindow.destroy());
        return true;
      } catch (error) {
        console.error(`Failed to inspect service worker for extension ${extensionId}:`, error);
        inspectorWindow.destroy();
        return false;
      }
    }

    return false;
  }
);

ipcMain.handle("extensions:pack-extension", async (event: IpcMainInvokeEvent): Promise<boolean> => {
  const owner = browserWindowsController.getWindowFromWebContents(event.sender)?.browserWindow;
  const openOptions: Electron.OpenDialogOptions = {
    title: "Select extension directory",
    properties: ["openDirectory"]
  };
  const selected = owner ? await dialog.showOpenDialog(owner, openOptions) : await dialog.showOpenDialog(openOptions);
  if (selected.canceled || !selected.filePaths[0]) return false;

  const sourcePath = selected.filePaths[0];
  const manifest = await getManifest(sourcePath);
  if (!manifest?.name || !manifest.version || !manifest.manifest_version) {
    const messageOptions: Electron.MessageBoxOptions = {
      type: "error",
      title: "Invalid extension",
      message: "The selected folder does not contain a valid manifest.json."
    };
    if (owner) await dialog.showMessageBox(owner, messageOptions);
    else await dialog.showMessageBox(messageOptions);
    return false;
  }

  const saveOptions: Electron.SaveDialogOptions = {
    title: "Pack extension",
    defaultPath: `${path.basename(sourcePath)}-${manifest.version}.zip`,
    filters: [{ name: "ZIP archive", extensions: ["zip"] }]
  };
  const destination = owner
    ? await dialog.showSaveDialog(owner, saveOptions)
    : await dialog.showSaveDialog(saveOptions);
  if (destination.canceled || !destination.filePath) return false;

  try {
    const archive = new AdmZip();
    archive.addLocalFolder(sourcePath);
    archive.writeZip(destination.filePath);
    return true;
  } catch (error) {
    console.error(`Failed to pack extension at ${sourcePath}:`, error);
    return false;
  }
});

ipcMain.handle(
  "extensions:get-all-in-current-profile",
  async (event: IpcMainInvokeEvent): Promise<SharedExtensionData[]> => {
    const profileId = await getCurrentProfileIdFromWebContents(event.sender);
    if (!profileId) return [];

    return getExtensionDataFromProfile(profileId);
  }
);

ipcMain.handle(
  "extensions:set-extension-enabled",
  async (event: IpcMainInvokeEvent, extensionId: string, enabled: boolean): Promise<boolean> => {
    const profileId = await getCurrentProfileIdFromWebContents(event.sender);
    if (!profileId) return false;

    const loadedProfile = loadedProfilesController.get(profileId);
    if (!loadedProfile) return false;

    const { extensionsManager } = loadedProfile;
    if (!extensionsManager) return false;

    return await extensionsManager.setExtensionDisabled(extensionId, !enabled);
  }
);

ipcMain.handle(
  "extensions:uninstall-extension",
  async (event: IpcMainInvokeEvent, extensionId: string): Promise<boolean> => {
    const profileId = await getCurrentProfileIdFromWebContents(event.sender);
    if (!profileId) return false;

    const loadedProfile = loadedProfilesController.get(profileId);
    if (!loadedProfile) return false;

    const { extensionsManager } = loadedProfile;
    if (!extensionsManager) return false;

    const window = browserWindowsController.getWindowFromWebContents(event.sender);
    if (!window) return false;

    const extensionData = extensionsManager.getExtensionDataFromCache(extensionId);
    if (!extensionData) return false;

    const sharedExtensionData = await generateSharedExtensionData(extensionsManager, extensionId, extensionData);

    if (!sharedExtensionData) return false;

    const extensionIcon = await getExtensionIcon(sharedExtensionData.path);

    const returnValue = await dialog.showMessageBox(window.browserWindow, {
      icon: extensionIcon ?? undefined,
      title: "Uninstall Extension",
      message: `Are you sure you want to uninstall "${sharedExtensionData.name}"?`,
      buttons: ["Cancel", "Uninstall"]
    });

    if (returnValue.response === 0) {
      return false;
    }

    return await extensionsManager.uninstallExtension(extensionId);
  }
);

ipcMain.handle(
  "extensions:set-extension-pinned",
  async (event: IpcMainInvokeEvent, extensionId: string, pinned: boolean): Promise<boolean> => {
    const profileId = await getCurrentProfileIdFromWebContents(event.sender);
    if (!profileId) return false;

    const loadedProfile = loadedProfilesController.get(profileId);
    if (!loadedProfile) return false;

    const { extensionsManager } = loadedProfile;
    if (!extensionsManager) return false;

    return await extensionsManager.setPinned(extensionId, pinned);
  }
);

ipcMain.handle("extensions:import-unpacked", async (event: IpcMainInvokeEvent): Promise<SharedExtensionData | null> => {
  const profileId = await getCurrentProfileIdFromWebContents(event.sender);
  if (!profileId) return null;

  const loadedProfile = loadedProfilesController.get(profileId);
  if (!loadedProfile) return null;

  const window = browserWindowsController.getWindowFromWebContents(event.sender);
  const dialogOptions: Electron.OpenDialogOptions = {
    title: "Import unpacked extension",
    properties: ["openDirectory"]
  };
  const result = window
    ? await dialog.showOpenDialog(window.browserWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);
  if (result.canceled || result.filePaths.length === 0) return null;

  const extensionId = await loadedProfile.extensionsManager.importUnpackedExtension(result.filePaths[0]);
  if (!extensionId) return null;

  const extensionData = loadedProfile.extensionsManager.getExtensionDataFromCache(extensionId);
  if (!extensionData) return null;

  const sharedExtension = await generateSharedExtensionData(
    loadedProfile.extensionsManager,
    extensionId,
    extensionData
  );
  await fireOnExtensionsUpdated(profileId);
  return sharedExtension;
});

ipcMain.handle(
  "extensions:import-firefox-xpi",
  async (event: IpcMainInvokeEvent): Promise<SharedExtensionData | null> => {
    const profileId = await getCurrentProfileIdFromWebContents(event.sender);
    if (!profileId) return null;

    const loadedProfile = loadedProfilesController.get(profileId);
    if (!loadedProfile) return null;

    const window = browserWindowsController.getWindowFromWebContents(event.sender);
    const dialogOptions: Electron.OpenDialogOptions = {
      title: "Import Firefox extension (.xpi)",
      properties: ["openFile"],
      filters: [{ name: "Firefox extension (.xpi)", extensions: ["xpi"] }]
    };
    const result = window
      ? await dialog.showOpenDialog(window.browserWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || result.filePaths.length === 0) return null;

    const extensionId = await loadedProfile.extensionsManager.importUnpackedExtension(result.filePaths[0]);
    if (!extensionId) return null;

    const extensionData = loadedProfile.extensionsManager.getExtensionDataFromCache(extensionId);
    if (!extensionData) return null;

    const sharedExtension = await generateSharedExtensionData(
      loadedProfile.extensionsManager,
      extensionId,
      extensionData
    );
    await fireOnExtensionsUpdated(profileId);
    return sharedExtension;
  }
);

export async function fireOnExtensionsUpdated(profileId: string) {
  const extensions = await getExtensionDataFromProfile(profileId);
  sendMessageToListeners("extensions:on-updated", profileId, extensions);
}
