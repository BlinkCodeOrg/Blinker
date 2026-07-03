/// Imports ///
import fs from "fs/promises";

/// Constants ///
const SOURCE_URL = "https://raw.githubusercontent.com/T3-Content/unduck/refs/heads/main/src/bang.ts";
const TARGET_PATH = "src/renderer/src/lib/omnibox-new/bangs.json";

function extractBangs(source: string) {
  const start = source.indexOf("[");
  const end = source.lastIndexOf("];");
  if (start === -1 || end === -1) {
    throw new Error("Could not find bangs array in source");
  }

  const arraySource = source.slice(start, end + 1);
  return Function(`"use strict"; return (${arraySource});`)() as unknown[];
}

/// Main ///
async function main() {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch bang source: ${res.status} ${res.statusText}`);
  }

  const source = await res.text();
  const bangs = extractBangs(source);
  await fs.writeFile(TARGET_PATH, JSON.stringify(bangs), "utf8");
  console.log(`Wrote bangs to ${TARGET_PATH}`);
}

await main();
