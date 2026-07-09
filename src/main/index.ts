import { debugPrint } from "@/modules/output";
import { markPerformance } from "@/modules/performance";
import { runStartupDataMigrations } from "@/modules/data-migration";
import { applyPendingProfileBackup } from "@/modules/profile-backup";
import { app } from "electron";

function printHeader() {
  if (!app.isPackaged) {
    console.log("\n".repeat(75));
  }

  console.log("\x1b[34m%s\x1b[0m", "--- Blinker Browser ---");

  if (app.isPackaged) {
    console.log("\x1b[32m%s\x1b[0m", `Production Build (${app.getVersion()})`);
  } else {
    console.log("\x1b[31m%s\x1b[0m", `Development Build (${app.getVersion()})`);
  }

  console.log("");
}

function initializeApp() {
  markPerformance("initialize.start", "startup");

  const singleInstanceLock = app.requestSingleInstanceLock();
  if (!singleInstanceLock) {
    app.quit();
    return false;
  }

  if (process.platform === "win32") {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch("disable-gpu");
  }

  debugPrint("INITIALIZATION", "single instance lock acquired");

  // Disable FedCM (Google One Tap, which doesn't work as the native prompt never shows in Electron)
  app.commandLine.appendSwitch("--disable-features", "FedCm");

  // Print header
  printHeader();

  void (async () => {
    await applyPendingProfileBackup();
    runStartupDataMigrations();
    await import("@/browser");
  })();

  markPerformance("browser.import.requested", "startup");

  return true;
}

// Start the application
const initialized = initializeApp();
if (!initialized) {
  app.quit();
}
