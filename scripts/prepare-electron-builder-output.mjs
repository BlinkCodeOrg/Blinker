import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const source = resolve("out");
const destination = resolve("compiled-app");

if (!existsSync(source)) {
  throw new Error("Cannot prepare Electron Builder output: out directory does not exist.");
}

rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true });

console.log("Prepared compiled-app for Electron Builder.");
