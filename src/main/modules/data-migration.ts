import Database from "better-sqlite3";
import { app } from "electron";
import fs from "fs";
import path from "path";
import { BLINKER_DATA_DIR } from "@/modules/paths";
import { debugError, debugPrint } from "@/modules/output";

const MIGRATION_MARKER = ".blinker-data-migration-v1";
const SQL_TABLES_WITH_USER_DATA = [
  "tabs",
  "pinned_tabs",
  "tab_groups",
  "history_urls",
  "history_visits",
  "passwords",
  "bookmarks",
  "site_permissions",
  "downloads"
];

function pathExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function ensureDirectory(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFileIfExists(source: string, target: string): void {
  if (!pathExists(source)) return;
  ensureDirectory(path.dirname(target));
  fs.copyFileSync(source, target);
}

function copyDirectoryMissingOnly(sourceDir: string, targetDir: string): void {
  if (!pathExists(sourceDir)) return;
  ensureDirectory(targetDir);

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryMissingOnly(source, target);
      continue;
    }

    if (!pathExists(target)) {
      copyFileIfExists(source, target);
    }
  }
}

function readJsonObject(filePath: string): Record<string, unknown> | null {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return data && typeof data === "object" && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function mergeJsonFileMissingKeys(source: string, target: string): void {
  const sourceData = readJsonObject(source);
  if (!sourceData) return;

  const targetData = pathExists(target) ? readJsonObject(target) : {};
  if (!targetData) return;

  let changed = false;
  const merged = { ...targetData };
  for (const [key, value] of Object.entries(sourceData)) {
    if (!(key in merged)) {
      merged[key] = value;
      changed = true;
    }
  }

  if (!changed && pathExists(target)) return;
  ensureDirectory(path.dirname(target));
  fs.writeFileSync(target, `${JSON.stringify(merged, null, 2)}\n`);
}

function mergeDatastore(sourceDir: string, targetDir: string): void {
  if (!pathExists(sourceDir)) return;
  ensureDirectory(targetDir);

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      mergeDatastore(source, target);
      continue;
    }

    if (entry.name.endsWith(".json")) {
      mergeJsonFileMissingKeys(source, target);
    } else if (!pathExists(target)) {
      copyFileIfExists(source, target);
    }
  }
}

function getDatabaseScore(dbPath: string): number {
  if (!pathExists(dbPath)) return -1;

  let db: Database.Database | null = null;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    let score = 0;

    for (const table of SQL_TABLES_WITH_USER_DATA) {
      const exists = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
      if (!exists) continue;

      score += 1;
      const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count?: number };
      score += Number(row?.count ?? 0) * 10;
    }

    return score;
  } catch (error) {
    debugError("DATASTORE", `Failed to inspect database ${dbPath}:`, error);
    return -1;
  } finally {
    try {
      db?.close();
    } catch {
      // Ignore close failures in best-effort migration probing.
    }
  }
}

function copySqliteDatabase(sourceDb: string, targetDb: string): void {
  const backupSuffix = `.pre-blinker-migration-${Date.now()}`;

  if (pathExists(targetDb)) {
    fs.renameSync(targetDb, `${targetDb}${backupSuffix}`);
    for (const suffix of ["-wal", "-shm"]) {
      const sidecar = `${targetDb}${suffix}`;
      if (pathExists(sidecar)) {
        fs.renameSync(sidecar, `${sidecar}${backupSuffix}`);
      }
    }
  }

  copyFileIfExists(sourceDb, targetDb);
  copyFileIfExists(`${sourceDb}-wal`, `${targetDb}-wal`);
  copyFileIfExists(`${sourceDb}-shm`, `${targetDb}-shm`);
}

function maybeMigrateDatabase(sourceDb: string, targetDb: string): void {
  if (!pathExists(sourceDb)) return;

  const sourceScore = getDatabaseScore(sourceDb);
  const targetScore = getDatabaseScore(targetDb);
  if (sourceScore <= 0 || targetScore >= sourceScore) return;

  debugPrint("DATASTORE", `Migrating database ${sourceDb} -> ${targetDb}`);
  copySqliteDatabase(sourceDb, targetDb);
}

function getLegacyUserDataDirs(): string[] {
  const appDataDir = app.getPath("appData");
  const candidates = [
    path.join(appDataDir, "Flow"),
    path.join(appDataDir, "flow-browser"),
    path.join(appDataDir, "Flow Browser"),
    path.join(appDataDir, "Flow Nightly")
  ];

  return candidates.filter((candidate) => path.resolve(candidate) !== path.resolve(BLINKER_DATA_DIR));
}

function migrateFromUserDataDir(sourceDir: string): void {
  if (!pathExists(sourceDir)) return;

  debugPrint("DATASTORE", `Checking legacy user data at ${sourceDir}`);
  ensureDirectory(BLINKER_DATA_DIR);

  mergeDatastore(path.join(sourceDir, "datastore"), path.join(BLINKER_DATA_DIR, "datastore"));
  copyDirectoryMissingOnly(path.join(sourceDir, "Profiles"), path.join(BLINKER_DATA_DIR, "Profiles"));
  copyDirectoryMissingOnly(path.join(sourceDir, "icons"), path.join(BLINKER_DATA_DIR, "icons"));

  for (const filename of ["favicons.db"]) {
    const source = path.join(sourceDir, filename);
    const target = path.join(BLINKER_DATA_DIR, filename);
    if (!pathExists(target)) copyFileIfExists(source, target);
  }

  maybeMigrateDatabase(path.join(sourceDir, "flow.db"), path.join(BLINKER_DATA_DIR, "blinker.db"));
}

export function runStartupDataMigrations(): void {
  try {
    ensureDirectory(BLINKER_DATA_DIR);

    // v1.13.x already used the Blinker app folder, but the main SQLite file
    // was still named flow.db. Preserve that data after the later rename.
    maybeMigrateDatabase(path.join(BLINKER_DATA_DIR, "flow.db"), path.join(BLINKER_DATA_DIR, "blinker.db"));

    for (const legacyDir of getLegacyUserDataDirs()) {
      migrateFromUserDataDir(legacyDir);
    }

    fs.writeFileSync(path.join(BLINKER_DATA_DIR, MIGRATION_MARKER), `${new Date().toISOString()}\n`);
  } catch (error) {
    debugError("DATASTORE", "Startup data migration failed:", error);
  }
}
