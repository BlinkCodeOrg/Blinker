import { app } from "electron";
import { debugPrint } from "@/modules/output";
import { hasCompletedOnboarding } from "@/saving/onboarding";
import { onboarding } from "@/controllers/windows-controller/interfaces/onboarding";
import { restoreSession as createInitialWindow } from "@/saving/tabs/restore";
import { flushPendingUrls, discardPendingUrls } from "@/app/urls";
import { markPerformance, measurePerformance } from "@/modules/performance";

export function runOnboardingOrInitialWindow() {
  debugPrint("INITIALIZATION", "waiting for app.whenReady() before onboarding check");
  markPerformance("initialWindow.waitAppReady", "startup");
  app.whenReady().then(async () => {
    markPerformance("app.ready", "startup");
    debugPrint("INITIALIZATION", "grabbing hasCompletedOnboarding()");
    try {
      const completed = await measurePerformance("onboarding.hasCompleted", "startup", () => hasCompletedOnboarding());
      debugPrint("INITIALIZATION", "grabbed hasCompletedOnboarding()", completed);
      if (!completed) {
        onboarding.show();
        markPerformance("onboarding.show", "startup");
        debugPrint("INITIALIZATION", "show onboarding window");
        // Discard any URLs queued during startup -- no browser windows should
        // be created while onboarding is in progress. Any URLs arriving after
        // this point are also discarded by handleOpenUrl via hasCompletedOnboarding().
        discardPendingUrls();
      } else {
        await measurePerformance("session.restore", "startup", () => createInitialWindow());
        markPerformance("browserWindow.initialReady", "startup");
        debugPrint("INITIALIZATION", "show browser window");
        // Now that the restored window(s) exist, open any URLs that were
        // received during startup as new tabs in the restored window instead
        // of creating additional windows.
        await measurePerformance("startup.flushPendingUrls", "startup", () => flushPendingUrls());
      }
    } catch (error) {
      debugPrint("INITIALIZATION", "hasCompletedOnboarding() failed, falling back to onboarding:", error);
      onboarding.show();
      markPerformance("onboarding.showAfterError", "startup");
      discardPendingUrls();
    }
  });
}
