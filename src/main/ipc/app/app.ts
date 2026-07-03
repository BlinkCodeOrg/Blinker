import { defaultBrowserController } from "@/controllers/default-browser-controller";
import { app, clipboard } from "electron";
import { ipcMain } from "electron";
import {
  clearPerformanceEvents,
  getPerformanceSnapshot,
  markPerformance,
  recordPerformanceMeasure
} from "@/modules/performance";
import type { PerformanceEvent } from "~/types/performance";

ipcMain.handle("app:get-info", async () => {
  return {
    version: app.getVersion(),
    packaged: app.isPackaged
  };
});

ipcMain.on("app:write-text-to-clipboard", (_event, text: string) => {
  clipboard.writeText(text);
});

ipcMain.handle("app:set-default-browser", async () => {
  return await defaultBrowserController.setDefaultBrowser();
});

ipcMain.handle("app:get-default-browser", async () => {
  return defaultBrowserController.isDefaultBrowser();
});

ipcMain.handle("app:get-performance-snapshot", () => {
  return getPerformanceSnapshot();
});

ipcMain.on(
  "app:record-performance-event",
  (_event, event: Omit<PerformanceEvent, "id" | "endedAtMs"> & { endedAtMs?: number }) => {
    if (event.kind === "mark") {
      markPerformance(event.name, event.source, event.details);
      return;
    }

    recordPerformanceMeasure(event.name, event.durationMs ?? 0, event.source, event.details, event.startedAtMs);
  }
);

ipcMain.handle("app:clear-performance-snapshot", () => {
  clearPerformanceEvents();
});
