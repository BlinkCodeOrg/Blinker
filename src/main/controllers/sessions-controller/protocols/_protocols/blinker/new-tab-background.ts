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
      const file = await fs.readFile(filePath);
      return c.body(bufferToArrayBuffer(file), 200, { "Content-Type": getContentType(filePath) });
    } catch {
      return c.text("Background not found", 404);
    }
  });
}
