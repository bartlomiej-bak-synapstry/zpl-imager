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

  // Zebra Font 0: Liberation Sans Bold as closest match to CG Triumvirate Bold
  // (regular width, not condensed — Zebra ^A0 uses non-condensed metrics)
  const font0Path = path.join(fontsDir, "LiberationSans-Bold.ttf");
  if (fs.existsSync(font0Path)) {
    GlobalFonts.registerFromPath(font0Path, "Roboto Condensed");
  }

  loaded = true;
}
