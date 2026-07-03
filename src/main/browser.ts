/**
 * Main entrypoint after conditions met in index.ts
 */

// Import everything
import "@/controllers";
import "@/ipc";
import "@/modules/content-blocker";
import "@/modules/extensions/main";
import { setupPlatformIntegration } from "@/app/platform";
import { processInitialUrl } from "@/app/urls";
import { setupSecondInstanceHandling } from "@/app/instance";
import { runOnboardingOrInitialWindow } from "@/app/onboarding";
import { setupAppLifecycle } from "@/app/lifecycle";
import { tabPersistenceManager } from "@/saving/tabs";
import { initCursorEdgeMonitor } from "@/controllers/windows-controller/utils/cursor-edge-monitor";
import { cleanupStaleEphemeralProfiles } from "@/controllers/profiles-controller/ephemeral";
import { initTabSync } from "@/controllers/tabs-controller/tab-sync";
import { pinnedTabsController } from "@/controllers/pinned-tabs-controller";
import { setupBasicAuthHandler } from "@/app/basic-auth";
import { markPerformance, measurePerformance, measurePerformanceSync } from "@/modules/performance";

async function bootstrapBrowser() {
  markPerformance("bootstrap.start", "startup");

  await measurePerformance("profiles.cleanupStaleEphemeral", "startup", () =>
    cleanupStaleEphemeralProfiles().catch((error) => {
      console.error("Failed to cleanup stale ephemeral profiles:", error);
    })
  );

  measurePerformanceSync("tabs.persistence.start", "startup", () => {
    tabPersistenceManager.start();
  });

  measurePerformanceSync("pinnedTabs.loadAll", "startup", () => {
    try {
      pinnedTabsController.loadAll();
    } catch (error) {
      console.error("Failed to load pinned tabs:", error);
    }
  });

  measurePerformanceSync("cursorEdgeMonitor.init", "startup", () => {
    initCursorEdgeMonitor();
  });

  measurePerformanceSync("tabSync.init", "startup", () => {
    initTabSync();
  });

  measurePerformanceSync("initialUrl.process", "startup", () => {
    processInitialUrl();
  });

  measurePerformanceSync("secondInstance.setup", "startup", () => {
    setupSecondInstanceHandling();
  });

  measurePerformanceSync("platformIntegration.setup", "startup", () => {
    setupPlatformIntegration();
  });

  measurePerformanceSync("initialWindow.schedule", "startup", () => {
    runOnboardingOrInitialWindow();
  });

  measurePerformanceSync("appLifecycle.setup", "startup", () => {
    setupAppLifecycle();
  });

  measurePerformanceSync("basicAuth.setup", "startup", () => {
    setupBasicAuthHandler();
  });

  markPerformance("bootstrap.end", "startup");
}

void bootstrapBrowser();
