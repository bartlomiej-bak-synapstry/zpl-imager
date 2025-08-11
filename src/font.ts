import * as PImage from "pureimage";

import path from "path";

// Internal memoisation to ensure fonts are only loaded once.
let loaded = false;
let registration;

/**
 * Ensures that the bundled DejaVuSans font is registered with
 * pureimage.  Many drawers rely on this font for measuring and
 * drawing text.  Registration is performed lazily on first call.
 *
 * @returns {Promise<void>}
 */
export async function ensureFont() {
  if (loaded) {
    return;
  }
  // Register normal and bold variants of DejaVu Sans.  The bold
  // variant is loaded from the system fonts to avoid bundling
  // additional files.  If the bold font cannot be loaded the
  // fallback will be the normal font.
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const normalFontPath = path.join(__dirname, "..", "fonts", "DejaVuSans.ttf");
  const boldFontPath = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
  const condensedBoldPath =
    "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf";
  const normalReg = PImage.registerFont(normalFontPath, "DejaVu Sans");
  const boldReg = PImage.registerFont(boldFontPath, "DejaVu Sans Bold");
  const condensedBoldReg = PImage.registerFont(
    condensedBoldPath,
    "DejaVu Sans Condensed Bold"
  );
  await normalReg.load();
  try {
    await boldReg.load();
  } catch (err) {
    // If bold cannot be loaded, ignore; the normal font will be used
  }
  try {
    await condensedBoldReg.load();
  } catch (err) {
    // If condensed bold cannot be loaded, ignore
  }
  loaded = true;
}
