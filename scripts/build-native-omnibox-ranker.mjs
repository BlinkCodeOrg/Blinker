import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const manifestPath = path.join(root, "native", "omnibox-ranker", "Cargo.toml");
const targetName = process.platform === "win32" ? "blinker-omnibox-ranker.exe" : "blinker-omnibox-ranker";
const sourcePath = path.join(root, "native", "omnibox-ranker", "target", "release", targetName);
const outputDir = path.join(root, "native", "bin");
const outputPath = path.join(outputDir, targetName);

if (!existsSync(manifestPath)) {
  throw new Error(`Native omnibox ranker manifest not found: ${manifestPath}`);
}

const cargo = spawnSync("cargo", ["build", "--release", "--manifest-path", manifestPath], {
  stdio: "inherit"
});

if (cargo.status !== 0) {
  throw new Error("Failed to build native omnibox ranker.");
}

if (!existsSync(sourcePath)) {
  throw new Error(`Native omnibox ranker was not produced: ${sourcePath}`);
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
copyFileSync(sourcePath, outputPath);

console.log(`Copied native omnibox ranker to ${outputPath}`);
