import { Tab } from "./core/tab";
import { quitController } from "@/controllers/quit-controller";
import { getSettingValueById } from "@/saving/settings";
import { SleepTabValueMap } from "@/modules/basic-settings";

/**
 * Parses a duration string like "30m", "1h", "12h", "1d" into seconds.
 */
function parseDurationToSeconds(value: string): number {
  const match = value.match(/^(\d+)(m|h|d)$/);
  if (!match) return 0;
  const num = parseInt(match[1], 10);
  switch (match[2]) {
    case "m":
      return num * 60;
    case "h":
      return num * 60 * 60;
    case "d":
      return num * 24 * 60 * 60;
    default:
      return 0;
  }
}

/**
 * Periodically checks inactive tabs and:
 * - Archives (destroys) tabs inactive beyond the archive threshold
 * - Puts tabs to sleep once they exceed the sleep threshold
 *
 * Interval: 10 seconds. Only processes normal (non-pinned, non-bookmark) tabs
 * that are not currently visible.
 */
export function startTabLifecycleTimer(tabs: Map<number, Tab>): void {
  setInterval(() => {
    if (quitController.isQuitting) return;

    // Poll pageState on all awake tabs (scroll position, form data, etc.)
    for (const tab of tabs.values()) {
      tab.pollPageState();
    }

    const nowSec = Math.floor(Date.now() / 1000);

    // Read settings once per tick (not per tab)
    const archiveAfter = getSettingValueById("archiveTabAfter");
    const archiveSec =
      typeof archiveAfter === "string" && archiveAfter !== "never" ? parseDurationToSeconds(archiveAfter) : 0;

    const sleepAfter = getSettingValueById("sleepTabAfter");
    const sleepSec =
      typeof sleepAfter === "string" && sleepAfter !== "never"
        ? (SleepTabValueMap[sleepAfter as keyof typeof SleepTabValueMap] ?? 0)
        : 0;

    for (const tab of tabs.values()) {
      if (tab.owner.kind !== "normal") continue;
      if (tab.visible) continue;

      // Auto-archive (destroy) tabs inactive too long
      if (archiveSec > 0 && nowSec - tab.lastActiveAt >= archiveSec) {
        tab.destroy();
        continue;
      }

      // Auto-sleep tabs inactive past threshold
      if (!tab.asleep && sleepSec > 0 && nowSec - tab.lastActiveAt >= sleepSec) {
        tab.putToSleep();
      }
    }
  }, 10_000);
}
