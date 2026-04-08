import { GlobalFonts } from "./canvas";
import path from "path";
import fs from "fs";

let loaded = false;

export function ensureFont(): void {
  if (loaded) return;

  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const fontsDir = path.join(__dirname, "..", "fonts");

  const normalFontPath = path.join(fontsDir, "DejaVuSans.ttf");
  const monoFontPath = path.join(fontsDir, "DejaVuSansMono.ttf");

  if (fs.existsSync(normalFontPath)) {
    GlobalFonts.registerFromPath(normalFontPath, "DejaVu Sans");
  }
  if (fs.existsSync(monoFontPath)) {
    GlobalFonts.registerFromPath(monoFontPath, "DejaVu Sans Mono");
  }

  // System bold variants
  const boldPath = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
  const condensedBoldPath =
    "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf";
  if (fs.existsSync(boldPath)) {
    GlobalFonts.registerFromPath(boldPath, "DejaVu Sans Bold");
  }
  if (fs.existsSync(condensedBoldPath)) {
    GlobalFonts.registerFromPath(condensedBoldPath, "DejaVu Sans Condensed Bold");
  }

  loaded = true;
}
