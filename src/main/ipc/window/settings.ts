import { sendMessageToListeners } from "@/ipc/listeners-manager";
import { BasicSettings, BasicSettingCards } from "@/modules/basic-settings";
import { getSettingValueById, setSettingValueById } from "@/saving/settings";
import { spacesController } from "@/controllers/spaces-controller";
import { tabsController } from "@/controllers/tabs-controller";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import { settings } from "@/controllers/windows-controller/interfaces/settings";
import { ipcMain } from "electron";
import { measurePerformanceSync } from "@/modules/performance";

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
  return measurePerformanceSync("ipc.settings.getSetting", "ipc", () => getSettingValueById(settingId), { settingId });
});

ipcMain.handle("settings:set-setting", (_event, settingId: string, value: unknown) => {
  return measurePerformanceSync("ipc.settings.setSetting", "ipc", () => setSettingValueById(settingId, value), {
    settingId
  });
});

ipcMain.handle("settings:get-basic-settings", () => {
  return measurePerformanceSync(
    "ipc.settings.getBasicSettings",
    "ipc",
    () => ({
      settings: BasicSettings,
      cards: BasicSettingCards
    }),
    { settings: BasicSettings.length, cards: BasicSettingCards.length }
  );
});

export function fireOnSettingsChanged() {
  sendMessageToListeners("settings:on-changed");
}
