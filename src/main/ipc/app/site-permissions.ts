import { ipcMain } from "electron";
import {
  clearSitePermissionsForProfile,
  deleteSitePermissionForProfile,
  listSitePermissionsForProfile,
  setSitePermissionForProfile
} from "@/saving/site-permissions";
import type { SitePermissionInput } from "~/types/site-permissions";
import { sendMessageToListeners } from "@/ipc/listeners-manager";

ipcMain.handle("site-permissions:list", async (_event, profileId: string) => {
  return listSitePermissionsForProfile(profileId);
});

ipcMain.handle("site-permissions:set", async (_event, profileId: string, input: SitePermissionInput) => {
  const result = setSitePermissionForProfile(profileId, input);
  sendMessageToListeners("site-permissions:on-changed");
  return result;
});

ipcMain.handle("site-permissions:remove", async (_event, profileId: string, id: number) => {
  const result = deleteSitePermissionForProfile(profileId, id);
  if (result) sendMessageToListeners("site-permissions:on-changed");
  return result;
});

ipcMain.handle("site-permissions:clear", async (_event, profileId: string) => {
  clearSitePermissionsForProfile(profileId);
  sendMessageToListeners("site-permissions:on-changed");
});
