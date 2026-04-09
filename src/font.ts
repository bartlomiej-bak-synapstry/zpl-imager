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

  // Roboto Condensed Bold - closest open-source match to Zebra Font 0
  // (CG Triumvirate Bold Condensed)
  const robotoCondBoldPath = path.join(fontsDir, "RobotoCondensed-Bold.ttf");
  if (fs.existsSync(robotoCondBoldPath)) {
    GlobalFonts.registerFromPath(robotoCondBoldPath, "Roboto Condensed");
  }

  loaded = true;
}
