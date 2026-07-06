import { browserWindowsManager, windowsController } from "@/controllers/windows-controller";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import { spacesController } from "@/controllers/spaces-controller";
import { debugPrint } from "@/modules/output";
import { searchOmniboxPlacesForProfile } from "@/saving/omnibox-place-search";
import { ipcMain } from "electron";
import type { OmniboxOpenParams } from "~/blinker/interfaces/browser/omnibox";
import { measurePerformanceSync } from "@/modules/performance";

async function profileIdFromSender(sender: Electron.WebContents): Promise<string | null> {
  const window = browserWindowsController.getWindowFromWebContents(sender);
  if (!window) return null;
  const spaceId = window.currentSpaceId;
  if (!spaceId) return null;
  const space = await spacesController.get(spaceId);
  return space?.profileId ?? null;
}

ipcMain.on("omnibox:show", (event, bounds: Electron.Rectangle | null, params: OmniboxOpenParams | null) => {
  debugPrint(
    "OMNIBOX",
    `IPC: show-omnibox received with bounds: ${JSON.stringify(bounds)} and params: ${JSON.stringify(params)}`
  );

  const parentWindow = windowsController.getWindowFromWebContents(event.sender);
  if (!parentWindow) {
    debugPrint("OMNIBOX", "Parent window not found");
    return;
  }
  if (!browserWindowsManager.isInstanceOf(parentWindow)) {
    debugPrint("OMNIBOX", "Parent window is not a BrowserWindow");
    return;
  }

  const omnibox = parentWindow.omnibox;
  omnibox.setBounds(bounds);
  omnibox.setOpenState(params);
  omnibox.show();
});

ipcMain.handle("omnibox:get-state", (event) => {
  const parentWindow = windowsController.getWindowFromWebContents(event.sender);
  if (!parentWindow) {
    debugPrint("OMNIBOX", "Parent window not found");
    return null;
  }
  if (!browserWindowsManager.isInstanceOf(parentWindow)) {
    debugPrint("OMNIBOX", "Parent window is not a BrowserWindow");
    return null;
  }

  return parentWindow.omnibox.getOpenState();
});

ipcMain.handle("omnibox:search-places", async (event, input: string, limit?: number) => {
  const profileId = await profileIdFromSender(event.sender);
  if (!profileId) return [];
  return measurePerformanceSync(
    "ipc.omnibox.searchPlaces",
    "ipc",
    () => searchOmniboxPlacesForProfile(profileId, input, limit),
    { inputLength: input.length, limit: limit ?? null }
  );
});

ipcMain.on("omnibox:hide", (event) => {
  debugPrint("OMNIBOX", "IPC: hide-omnibox received");

  const parentWindow = windowsController.getWindowFromWebContents(event.sender);
  if (!parentWindow) {
    debugPrint("OMNIBOX", "Parent window not found");
    return;
  }
  if (!browserWindowsManager.isInstanceOf(parentWindow)) {
    debugPrint("OMNIBOX", "Parent window is not a BrowserWindow");
    return;
  }

  const omnibox = parentWindow.omnibox;
  omnibox.hide();
});
