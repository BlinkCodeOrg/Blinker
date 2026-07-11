import fs from "fs/promises";
import path from "path";
import AdmZip from "adm-zip";
import { prepareExtensionImport } from "./manifest";
import { PreparedExtensionImport } from "./types";

export async function prepareExtensionSourceForImport(
  sourcePath: string,
  stagingRoot: string
): Promise<PreparedExtensionImport> {
  const sourceStats = await fs.stat(sourcePath).catch(() => null);
  if (!sourceStats) return { extensionPath: sourcePath, cleanupPaths: [], warnings: [] };

  if (!sourceStats.isFile() || path.extname(sourcePath).toLowerCase() !== ".xpi") {
    return prepareExtensionImport(sourcePath, stagingRoot);
  }

  const unpackedXpiPath = path.join(
    stagingRoot,
    `${Date.now()}-${path.basename(sourcePath, path.extname(sourcePath)).replace(/[^a-z0-9._-]/gi, "-")}-xpi`
  );

  await fs.mkdir(stagingRoot, { recursive: true });
  await fs.rm(unpackedXpiPath, { recursive: true, force: true });
  await fs.mkdir(unpackedXpiPath, { recursive: true });
  new AdmZip(sourcePath).extractAllTo(unpackedXpiPath, true);

  const preparedImport = await prepareExtensionImport(unpackedXpiPath, stagingRoot, { mutateSource: true });

  return {
    ...preparedImport,
    cleanupPaths: Array.from(new Set([unpackedXpiPath, ...preparedImport.cleanupPaths])),
    warnings: [`Extracted Firefox .xpi package: ${path.basename(sourcePath)}`, ...preparedImport.warnings]
  };
}
