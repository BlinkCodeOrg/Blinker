import { BLINKER_DATA_DIR } from "@/modules/paths";
import { bufferToArrayBuffer, getContentType } from "@/modules/utils";
import fs from "fs/promises";
import path from "path";
import { HonoApp } from ".";

const BACKGROUND_DIRECTORY = path.join(BLINKER_DATA_DIR, "new-tab-background");

export function registerNewTabBackgroundRoutes(app: HonoApp) {
  app.get("/new-tab-background/:fileName", async (c) => {
    const fileName = path.basename(decodeURIComponent(c.req.param("fileName")));
    if (!fileName || fileName !== decodeURIComponent(c.req.param("fileName"))) {
      return c.text("Invalid background path", 400);
    }

    const filePath = path.join(BACKGROUND_DIRECTORY, fileName);
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) return c.text("Background not found", 404);

      const contentType = getContentType(filePath);
      const range = c.req.header("range");

      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match) return c.text("Invalid range", 416);

        const start = match[1] ? Number.parseInt(match[1], 10) : 0;
        const end = match[2] ? Math.min(Number.parseInt(match[2], 10), stat.size - 1) : stat.size - 1;
        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= stat.size) {
          return c.text("Range not satisfiable", 416, { "Content-Range": `bytes */${stat.size}` });
        }

        const length = end - start + 1;
        const handle = await fs.open(filePath, "r");
        try {
          const chunk = Buffer.alloc(length);
          await handle.read(chunk, 0, length, start);
          return c.body(bufferToArrayBuffer(chunk), 206, {
            "Accept-Ranges": "bytes",
            "Content-Length": String(length),
            "Content-Range": `bytes ${start}-${end}/${stat.size}`,
            "Content-Type": contentType
          });
        } finally {
          await handle.close();
        }
      }

      const file = await fs.readFile(filePath);
      return c.body(bufferToArrayBuffer(file), 200, {
        "Accept-Ranges": "bytes",
        "Content-Length": String(stat.size),
        "Content-Type": contentType
      });
    } catch {
      return c.text("Background not found", 404);
    }
  });
}
