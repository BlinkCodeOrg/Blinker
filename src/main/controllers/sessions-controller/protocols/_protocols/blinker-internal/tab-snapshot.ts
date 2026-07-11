import { bufferToArrayBuffer, generateID } from "@/modules/utils";
import { HonoApp } from ".";

// In-memory JPEG snapshots keyed by UUID.
const snapshotStore = new Map<string, Buffer>();
const snapshotExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Evict snapshots older than 30s (safety net if removeSnapshot is never called).
const SNAPSHOT_TTL_MS = 30_000;

// JPEG quality — encoding is much faster and more consistent than PNG.
const SNAPSHOT_JPEG_QUALITY = 62;

// Max pixel width; wider images are downscaled proportionally before encoding.
const SNAPSHOT_MAX_WIDTH = 1440;

/**
 * Stores a NativeImage snapshot (downscaling if wider than SNAPSHOT_MAX_WIDTH)
 * and returns a UUID for retrieval via `blinker-internal://tab-snapshot?id={uuid}`.
 */
export function storeSnapshot(image: Electron.NativeImage): string {
  const id = generateID();
  const size = image.getSize();

  let toEncode = image;
  if (size.width > SNAPSHOT_MAX_WIDTH) {
    const scale = SNAPSHOT_MAX_WIDTH / size.width;
    toEncode = image.resize({
      width: SNAPSHOT_MAX_WIDTH,
      height: Math.round(size.height * scale)
    });
  }

  const jpegBuffer = toEncode.toJPEG(SNAPSHOT_JPEG_QUALITY);
  snapshotStore.set(id, jpegBuffer);
  const expiryTimer = setTimeout(() => removeSnapshot(id), SNAPSHOT_TTL_MS);
  expiryTimer.unref();
  snapshotExpiryTimers.set(id, expiryTimer);
  return id;
}

export function removeSnapshot(id: string): void {
  snapshotStore.delete(id);
  const expiryTimer = snapshotExpiryTimers.get(id);
  if (expiryTimer) clearTimeout(expiryTimer);
  snapshotExpiryTimers.delete(id);
}

export function registerTabSnapshotRoutes(app: HonoApp) {
  app.get("/tab-snapshot", (c) => {
    const id = c.req.query("id");
    if (!id) {
      return c.text("No snapshot ID provided", 400);
    }

    const jpegBuffer = snapshotStore.get(id);
    if (!jpegBuffer) {
      return c.text("Snapshot not found", 404);
    }

    const arrayBuffer = bufferToArrayBuffer(jpegBuffer);
    return c.body(arrayBuffer, 200, {
      "Content-Type": "image/jpeg",
      "Cache-Control": "no-store"
    });
  });
}
