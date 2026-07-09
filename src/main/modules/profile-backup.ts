import AdmZip from "adm-zip";
import { app, dialog } from "electron";
import fs from "fs/promises";
import path from "path";
import { checkpointDatabaseForBackup } from "@/saving/db";
import { BLINKER_DATA_DIR } from "@/modules/paths";
import { debugError, debugPrint } from "@/modules/output";

const ARCHIVE_VERSION = 1;
const ARCHIVE_MANIFEST = "blinker-backup.json";
const IMPORT_DIR = path.join(BLINKER_DATA_DIR, ".blinker-import");
const IMPORT_PAYLOAD_DIR = path.join(IMPORT_DIR, "payload");
const IMPORT_MARKER = path.join(IMPORT_DIR, "pending.json");

// Cache directories are deliberately omitted: they can be recreated and can make a backup several GB larger.
const BACKUP_ENTRIES = [
  "datastore",
  "Profiles",
  "icons",
  "new-tab-background",
  "blinker.db",
  "blinker.db-wal",
  "blinker.db-shm",
  "favicons.db",
  "favicons.db-wal",
  "favicons.db-shm"
];

type BackupManifest = {
  format: "blinker-profile";
  version: number;
  createdAt: string;
  appVersion: string;
  entries: string[];
};

function isInsideDataDirectory(filePath: string) {
  const relative = path.relative(BLINKER_DATA_DIR, filePath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function fileExists(filePath: string) {
  return Boolean(await fs.stat(filePath).catch(() => null));
}

function createManifest(entries: string[]): BackupManifest {
  return {
    format: "blinker-profile",
    version: ARCHIVE_VERSION,
    createdAt: new Date().toISOString(),
    appVersion: app.getVersion(),
    entries
  };
}

function readManifest(zip: AdmZip): BackupManifest | null {
  const entry = zip.getEntry(ARCHIVE_MANIFEST);
  if (!entry) return null;

  try {
    const manifest = JSON.parse(entry.getData().toString("utf8")) as BackupManifest;
    if (
      manifest.format !== "blinker-profile" ||
      manifest.version !== ARCHIVE_VERSION ||
      !Array.isArray(manifest.entries)
    ) {
      return null;
    }
    return manifest;
  } catch {
    return null;
  }
}

function archiveHasSafePaths(zip: AdmZip) {
  return zip.getEntries().every((entry) => {
    const normalized = path.posix.normalize(entry.entryName);
    return !normalized.startsWith("../") && !path.posix.isAbsolute(normalized);
  });
}

export async function exportProfileBackup(): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const result = await dialog.showSaveDialog({
    title: "Export Blinker profile",
    defaultPath: `Blinker-${new Date().toISOString().slice(0, 10)}.blinker`,
    filters: [{ name: "Blinker profile backup", extensions: ["blinker"] }]
  });

  if (result.canceled || !result.filePath) return { success: false };
  if (isInsideDataDirectory(result.filePath)) {
    return { success: false, error: "Choose a location outside Blinker data." };
  }

  try {
    checkpointDatabaseForBackup();
    const zip = new AdmZip();
    const entries: string[] = [];

    for (const entryName of BACKUP_ENTRIES) {
      const source = path.join(BLINKER_DATA_DIR, entryName);
      const stats = await fs.stat(source).catch(() => null);
      if (!stats) continue;

      if (stats.isDirectory()) {
        zip.addLocalFolder(source, entryName);
      } else {
        zip.addLocalFile(source);
      }
      entries.push(entryName);
    }

    zip.addFile(ARCHIVE_MANIFEST, Buffer.from(JSON.stringify(createManifest(entries), null, 2)));
    zip.writeZip(result.filePath);
    return { success: true, filePath: result.filePath };
  } catch (error) {
    debugError("DATASTORE", "Failed to export profile backup", error);
    return { success: false, error: "Could not create the backup." };
  }
}

export async function stageProfileBackupImport(): Promise<{ success: boolean; error?: string }> {
  const result = await dialog.showOpenDialog({
    title: "Import Blinker profile",
    properties: ["openFile"],
    filters: [{ name: "Blinker profile backup", extensions: ["blinker"] }]
  });

  if (result.canceled || !result.filePaths[0]) return { success: false };

  try {
    const zip = new AdmZip(result.filePaths[0]);
    const manifest = readManifest(zip);
    if (!manifest || !archiveHasSafePaths(zip)) {
      return { success: false, error: "This is not a valid Blinker backup." };
    }

    await fs.rm(IMPORT_DIR, { recursive: true, force: true });
    await fs.mkdir(IMPORT_PAYLOAD_DIR, { recursive: true });
    zip.extractAllTo(IMPORT_PAYLOAD_DIR, true);

    for (const entryName of manifest.entries) {
      if (!BACKUP_ENTRIES.includes(entryName) || !(await fileExists(path.join(IMPORT_PAYLOAD_DIR, entryName)))) {
        await fs.rm(IMPORT_DIR, { recursive: true, force: true });
        return { success: false, error: "The backup is incomplete." };
      }
    }

    await fs.writeFile(IMPORT_MARKER, JSON.stringify({ manifest, createdAt: Date.now() }, null, 2), "utf8");

    app.relaunch();
    setTimeout(() => app.exit(0), 100);
    return { success: true };
  } catch (error) {
    debugError("DATASTORE", "Failed to stage profile backup import", error);
    await fs.rm(IMPORT_DIR, { recursive: true, force: true });
    return { success: false, error: "Could not read this backup." };
  }
}

export async function applyPendingProfileBackup(): Promise<void> {
  const marker = await fs.readFile(IMPORT_MARKER, "utf8").catch(() => null);
  if (!marker) return;

  try {
    const { manifest } = JSON.parse(marker) as { manifest?: BackupManifest };
    if (!manifest || manifest.format !== "blinker-profile" || manifest.version !== ARCHIVE_VERSION) {
      throw new Error("Invalid staged backup manifest");
    }

    for (const entryName of manifest.entries) {
      if (!BACKUP_ENTRIES.includes(entryName)) continue;
      const source = path.join(IMPORT_PAYLOAD_DIR, entryName);
      const target = path.join(BLINKER_DATA_DIR, entryName);
      const sourceStats = await fs.stat(source).catch(() => null);
      if (!sourceStats) continue;

      await fs.rm(target, { recursive: true, force: true });
      if (sourceStats.isDirectory()) {
        await fs.cp(source, target, { recursive: true });
      } else {
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.copyFile(source, target);
      }
    }
    debugPrint("DATASTORE", "Imported staged .blinker profile backup");
  } catch (error) {
    debugError("DATASTORE", "Failed to apply staged profile backup", error);
  } finally {
    await fs.rm(IMPORT_DIR, { recursive: true, force: true });
  }
}
