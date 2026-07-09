import { spacesController } from "@/controllers/spaces-controller";
import { ipcMain } from "electron";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import { BrowserWindow } from "@/controllers/windows-controller/types";
import { NEW_TAB_URL, tabsController } from "@/controllers/tabs-controller";
import {
  chooseNewTabBackground,
  clearNewTabBackground,
  getNewTabBackground,
  updateNewTabBackground
} from "@/modules/new-tab-background";
import type { NewTabBackground } from "~/blinker/interfaces/browser/newTab";

export function openNewTab(window: BrowserWindow) {
  const omnibox = window.omnibox;
  if (omnibox.isVisible()) {
    omnibox.hide();
  }

  const spaceId = window.currentSpaceId;
  if (!spaceId) return;

  spacesController.get(spaceId).then(async (space) => {
    if (!space) return;

    const tab = await tabsController.createTab(window.id, space.profileId, spaceId, undefined, { url: NEW_TAB_URL });
    tabsController.activateTab(tab);
  });
}

ipcMain.on("new-tab:open", (event) => {
  const webContents = event.sender;
  const win = browserWindowsController.getWindowFromWebContents(webContents);
  if (!win) return;

  return openNewTab(win);
});

ipcMain.handle("new-tab-background:get", () => getNewTabBackground());
ipcMain.handle("new-tab-background:choose", () => chooseNewTabBackground());
ipcMain.handle(
  "new-tab-background:update",
  (_event, patch: Partial<Omit<NewTabBackground, "sourceUrl" | "mediaType">>) => updateNewTabBackground(patch)
);
ipcMain.handle("new-tab-background:clear", () => clearNewTabBackground());
