import { dialog } from "electron";
import fs from "fs/promises";
import path from "path";
import { getDatastore } from "@/saving/datastore";
import { BLINKER_DATA_DIR } from "@/modules/paths";
import type { NewTabBackground, NewTabBackgroundFit } from "~/blinker/interfaces/browser/newTab";

const BACKGROUND_DIRECTORY = path.join(BLINKER_DATA_DIR, "new-tab-background");
const backgroundStore = getDatastore("new-tab-background");

const DEFAULT_BACKGROUND: NewTabBackground = {
  sourceUrl: null,
  mediaType: null,
  fit: "cover",
  scale: 1,
  positionX: 50,
  positionY: 50,
  overlay: 0
};

type PersistedBackground = Omit<NewTabBackground, "sourceUrl"> & { fileName?: string };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getMediaType(filePath: string): "image" | "video" | null {
  const extension = path.extname(filePath).toLowerCase();
  if ([".mp4", ".webm", ".ogv", ".m4v", ".mov"].includes(extension)) return "video";
  if (
    [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".bmp", ".svg", ".ico", ".tif", ".tiff"].includes(extension)
  ) {
    return "image";
  }
  return null;
}

function normalizeBackground(value: Partial<PersistedBackground>): PersistedBackground {
  const fit: NewTabBackgroundFit = ["cover", "contain", "stretch"].includes(value.fit ?? "")
    ? (value.fit as NewTabBackgroundFit)
    : DEFAULT_BACKGROUND.fit;
  return {
    fileName: typeof value.fileName === "string" ? value.fileName : undefined,
    mediaType: value.mediaType === "image" || value.mediaType === "video" ? value.mediaType : null,
    fit,
    scale: clamp(Number(value.scale) || DEFAULT_BACKGROUND.scale, 0.5, 3),
    positionX: clamp(Number(value.positionX) || DEFAULT_BACKGROUND.positionX, 0, 100),
    positionY: clamp(Number(value.positionY) || DEFAULT_BACKGROUND.positionY, 0, 100),
    overlay: clamp(Number(value.overlay) || DEFAULT_BACKGROUND.overlay, 0, 80)
  };
}

export async function getNewTabBackground(): Promise<NewTabBackground> {
  const saved = normalizeBackground((await backgroundStore.get<PersistedBackground>("background")) ?? {});
  if (!saved.fileName || !saved.mediaType) return DEFAULT_BACKGROUND;

  const filePath = path.join(BACKGROUND_DIRECTORY, saved.fileName);
  const exists = await fs.stat(filePath).catch(() => null);
  if (!exists?.isFile()) {
    await backgroundStore.remove("background");
    return DEFAULT_BACKGROUND;
  }

  return {
    ...saved,
    sourceUrl: `blinker://new-tab-background/${encodeURIComponent(saved.fileName)}`
  };
}

export async function chooseNewTabBackground(): Promise<NewTabBackground | null> {
  const result = await dialog.showOpenDialog({
    title: "Choose new tab background",
    properties: ["openFile"],
    filters: [
      {
        name: "Images and videos",
        extensions: [
          "jpg",
          "jpeg",
          "png",
          "gif",
          "webp",
          "avif",
          "bmp",
          "svg",
          "ico",
          "tif",
          "tiff",
          "mp4",
          "webm",
          "ogv",
          "m4v",
          "mov"
        ]
      },
      { name: "All files", extensions: ["*"] }
    ]
  });

  const sourcePath = result.filePaths[0];
  if (result.canceled || !sourcePath) return null;
  const mediaType = getMediaType(sourcePath);
  if (!mediaType) return null;

  const extension = path.extname(sourcePath).toLowerCase();
  const fileName = `background-${Date.now()}${extension}`;
  await fs.mkdir(BACKGROUND_DIRECTORY, { recursive: true });
  await fs.rm(BACKGROUND_DIRECTORY, { recursive: true, force: true });
  await fs.mkdir(BACKGROUND_DIRECTORY, { recursive: true });
  await fs.copyFile(sourcePath, path.join(BACKGROUND_DIRECTORY, fileName));

  const current = normalizeBackground((await backgroundStore.get<PersistedBackground>("background")) ?? {});
  await backgroundStore.set("background", { ...current, fileName, mediaType });
  return getNewTabBackground();
}

export async function updateNewTabBackground(patch: Partial<Omit<NewTabBackground, "sourceUrl" | "mediaType">>) {
  const current = normalizeBackground((await backgroundStore.get<PersistedBackground>("background")) ?? {});
  await backgroundStore.set("background", normalizeBackground({ ...current, ...patch }));
  return getNewTabBackground();
}

export async function clearNewTabBackground() {
  await fs.rm(BACKGROUND_DIRECTORY, { recursive: true, force: true });
  await backgroundStore.remove("background");
  return DEFAULT_BACKGROUND;
}
