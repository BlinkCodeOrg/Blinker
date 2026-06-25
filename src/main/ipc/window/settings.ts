import { sendMessageToListeners } from "@/ipc/listeners-manager";
import { BasicSettings, BasicSettingCards } from "@/modules/basic-settings";
import { getSettingValueById, setSettingValueById } from "@/saving/settings";
import { spacesController } from "@/controllers/spaces-controller";
import { tabsController } from "@/controllers/tabs-controller";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import { settings } from "@/controllers/windows-controller/interfaces/settings";
import { ipcMain } from "electron";

ipcMain.on("settings:open", async (event) => {
  const window =
    browserWindowsController.getWindowFromWebContents(event.sender) || browserWindowsController.getWindows()[0];
  const spaceId = window?.currentSpaceId;
  if (!window || !spaceId) return;

  const space = await spacesController.get(spaceId);
  if (!space) return;

  const tab = await tabsController.createTab(window.id, space.profileId, spaceId, undefined, {
    url: "blinker://settings/"
  });
  tabsController.activateTab(tab);
});

ipcMain.on("settings:close", () => {
  settings.hide();
});

ipcMain.handle("settings:get-setting", (_event, settingId: string) => {
  return getSettingValueById(settingId);
});

ipcMain.handle("settings:set-setting", (_event, settingId: string, value: unknown) => {
  return setSettingValueById(settingId, value);
});

ipcMain.handle("settings:get-basic-settings", () => {
  return {
    settings: BasicSettings,
    cards: BasicSettingCards
  };
});

export function fireOnSettingsChanged() {
  sendMessageToListeners("settings:on-changed");
}
