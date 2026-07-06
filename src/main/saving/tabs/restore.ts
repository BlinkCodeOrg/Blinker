import { PersistedTabData, PersistedTabGroupData } from "~/types/tabs";
import { tabPersistenceManager } from "@/saving/tabs";
import { onSettingsCached } from "@/saving/settings";
import { tabsController } from "@/controllers/tabs-controller";
import { browserWindowsController } from "@/controllers/windows-controller/interfaces/browser";
import { shouldArchiveTab } from "@/saving/tabs";
import { app, screen } from "electron";
import { GlanceTabGroup } from "@/controllers/tabs-controller/tab-groups/glance";
import type { BrowserWindowCreationOptions, BrowserWindowType } from "@/controllers/windows-controller/types/browser";
import { markPerformance, measurePerformance, measurePerformanceSync } from "@/modules/performance";
import { setWindowSpace } from "@/ipc/session/spaces";

function intersects(a: Electron.Rectangle, b: Electron.Rectangle): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function getRestorableWindowOptions(windowState: {
  width: number;
  height: number;
  x?: number;
  y?: number;
}): BrowserWindowCreationOptions {
  const minWidth = 800;
  const minHeight = 400;
  const width = Math.max(minWidth, windowState.width);
  const height = Math.max(minHeight, windowState.height);
  const options: BrowserWindowCreationOptions = { width, height };

  if (windowState.x === undefined || windowState.y === undefined) {
    return options;
  }

  const restoredBounds = { x: windowState.x, y: windowState.y, width, height };
  const visibleOnDisplay = screen.getAllDisplays().some((display) => intersects(restoredBounds, display.workArea));
  if (!visibleOnDisplay) {
    return options;
  }

  options.x = windowState.x;
  options.y = windowState.y;
  return options;
}

/**
 * Loads tabs and tab groups from storage, filters archived ones,
 * and restores them into browser windows.
 */
export async function restoreSession(): Promise<boolean> {
  markPerformance("session.restore.start", "startup");
  await measurePerformance("session.restore.appReady", "startup", () => app.whenReady());
  await measurePerformance("session.restore.settingsCached", "startup", () => onSettingsCached());

  const tabs = await measurePerformance("session.restore.loadTabs", "startup", () => loadAndFilterTabs());
  markPerformance("session.restore.tabsLoaded", "startup", { tabs: tabs.length });
  if (tabs.length > 0) {
    await measurePerformance(
      "session.restore.createPersistedTabs",
      "startup",
      () => createTabsFromPersistedData(tabs),
      {
        tabs: tabs.length
      }
    );
  } else {
    await measurePerformance("session.restore.createEmptyWindow", "startup", () => browserWindowsController.create());
  }

  markPerformance("session.restore.end", "startup", { tabs: tabs.length });
  return true;
}

/**
 * Loads tabs from storage and filters out archived ones.
 */
async function loadAndFilterTabs(): Promise<PersistedTabData[]> {
  const allTabs = await tabPersistenceManager.loadAllTabs();

  const filtered: PersistedTabData[] = [];
  for (const tabData of allTabs) {
    if (typeof tabData.lastActiveAt === "number" && shouldArchiveTab(tabData.lastActiveAt)) {
      // Remove archived tab from storage
      await tabPersistenceManager.removeTab(tabData.uniqueId);
      continue;
    }
    filtered.push(tabData);
  }

  return filtered;
}

/**
 * Creates browser windows and tabs from persisted data.
 * Groups tabs by windowGroupId to recreate window layout.
 * Also restores tab groups.
 */
async function createTabsFromPersistedData(tabDatas: PersistedTabData[]): Promise<void> {
  // Group tabs by windowGroupId
  const windowGroups = new Map<string, PersistedTabData[]>();
  for (const tabData of tabDatas) {
    const groupId = tabData.windowGroupId;
    if (!windowGroups.has(groupId)) {
      windowGroups.set(groupId, []);
    }
    windowGroups.get(groupId)!.push(tabData);
  }

  // Load persisted tab groups and window states
  const persistedGroups = await measurePerformance("session.restore.loadTabGroups", "startup", () =>
    tabPersistenceManager.loadAllTabGroups()
  );
  const windowStates = await measurePerformance("session.restore.loadWindowStates", "startup", () =>
    tabPersistenceManager.loadAllWindowStates()
  );
  const uniqueIdToTabId = new Map<string, number>();
  const restoredTabsByWindow = new Map<number, number[]>();

  // Create a window for each window group
  for (const [windowGroupId, tabs] of windowGroups) {
    // Read window state from the dedicated window state store
    const windowState = windowStates.get(windowGroupId);

    const windowType: BrowserWindowType = windowState?.isPopup ? "popup" : "normal";
    const windowOptions: BrowserWindowCreationOptions = windowState ? getRestorableWindowOptions(windowState) : {};
    const window = await measurePerformance(
      "session.restore.createWindow",
      "startup",
      () => browserWindowsController.create(windowType, windowOptions),
      { tabs: tabs.length, popup: windowType === "popup" }
    );

    for (const tabData of tabs) {
      const tab = await measurePerformance(
        "session.restore.createTab",
        "startup",
        () =>
          tabsController.createTab(window.id, tabData.profileId, tabData.spaceId, undefined, {
            asleep: true,
            createdAt: tabData.createdAt,
            lastActiveAt: tabData.lastActiveAt,
            position: tabData.position,
            navHistory: tabData.navHistory,
            navHistoryIndex: tabData.navHistoryIndex,
            uniqueId: tabData.uniqueId,
            title: tabData.title,
            faviconURL: tabData.faviconURL || undefined
          }),
        { navEntries: tabData.navHistory?.length ?? 0 }
      );

      uniqueIdToTabId.set(tabData.uniqueId, tab.id);
      const restoredTabs = restoredTabsByWindow.get(window.id) ?? [];
      restoredTabs.push(tab.id);
      restoredTabsByWindow.set(window.id, restoredTabs);
    }
  }

  await measurePerformance("session.restore.tabGroups", "startup", () =>
    restoreTabGroups(persistedGroups, uniqueIdToTabId)
  );
  measurePerformanceSync("session.restore.activateInitialTabs", "startup", () =>
    activateInitialTabs(restoredTabsByWindow)
  );
}

function activateInitialTabs(restoredTabsByWindow: Map<number, number[]>): void {
  for (const [windowId, tabIds] of restoredTabsByWindow) {
    let newestTab = undefined as ReturnType<typeof tabsController.getTabById> | undefined;
    for (const tabId of tabIds) {
      const tab = tabsController.getTabById(tabId);
      if (!tab || tab.isDestroyed) continue;
      if (!newestTab || tab.lastActiveAt > newestTab.lastActiveAt) {
        newestTab = tab;
      }
    }

    if (!newestTab) {
      markPerformance("session.restore.noInitialTab", "startup", { windowId });
      continue;
    }

    const containingGroup = tabsController
      .getTabGroupsInWindow(windowId)
      .find((group) => group.spaceId === newestTab.spaceId && group.hasTab(newestTab.id));

    setWindowSpace(newestTab.getWindow(), newestTab.spaceId);
    tabsController.activateTab(containingGroup ?? newestTab);
    tabsController.focusActiveTab(windowId, newestTab.spaceId);
    markPerformance("session.restore.initialTabActivated", "startup", {
      windowId,
      tabId: newestTab.id,
      grouped: Boolean(containingGroup)
    });
  }
}

/**
 * Restores tab groups from persisted data using the uniqueId -> tabId mapping.
 */
async function restoreTabGroups(
  persistedGroups: PersistedTabGroupData[],
  uniqueIdToTabId: Map<string, number>
): Promise<void> {
  for (const groupData of persistedGroups) {
    // Resolve uniqueIds to runtime tab IDs
    const tabIds: number[] = [];
    for (const uniqueId of groupData.tabUniqueIds) {
      const tabId = uniqueIdToTabId.get(uniqueId);
      if (tabId !== undefined) {
        tabIds.push(tabId);
      }
    }

    if (tabIds.length < 2) {
      // Tab groups need at least 2 tabs
      try {
        await tabPersistenceManager.removeTabGroup(groupData.groupId);
      } catch (error) {
        console.error("Failed to remove stale tab group:", error);
      }
      continue;
    }

    try {
      const group = tabsController.createTabGroup(groupData.mode, tabIds as [number, ...number[]], groupData.groupId);

      // Restore glance front tab
      if (groupData.mode === "glance" && groupData.glanceFrontTabUniqueId) {
        const frontTabId = uniqueIdToTabId.get(groupData.glanceFrontTabUniqueId);
        if (frontTabId !== undefined && group instanceof GlanceTabGroup) {
          group.setFrontTab(frontTabId);
        }
      }
    } catch (error) {
      console.error("Failed to restore tab group:", error);
    }
  }
}
