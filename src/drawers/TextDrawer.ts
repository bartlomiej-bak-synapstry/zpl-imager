import BaseDrawer from "./BaseDrawer";
import PImage from "pureimage";
import { ensureFont } from "../font";

/**
 * Drawer for plain text elements.  Text in ZPL is drawn using
 * various fonts; for simplicity we support only DejaVu Sans at
 * arbitrary heights and optional widths.  Orientation may be
 * specified using N,R,I,B for normal, rotated 90°, inverted 180°
 * and rotated 270° respectively.
 */
class TextDrawer extends BaseDrawer {
  async prepare(element) {
    // Ensure font is loaded before measuring
    await ensureFont();
    // Create a temporary canvas for measurement
    const tmp = PImage.make(1, 1);
    const ctx = tmp.getContext("2d");
    const fontSize = element.height || 10;
    // Choose bold font for designator '0', else normal
    // Choose a heavier, condensed font for designator '0' to better
    // approximate the appearance of ZPL font 0.  Fall back to the
    // regular bold if the condensed variant is unavailable.
    const fontFace =
      element.fontName && element.fontName.toString().toUpperCase() === "0"
        ? "DejaVu Sans Condensed Bold"
        : "DejaVu Sans";
    ctx.font = `${fontSize}pt '${fontFace}'`;
    const metrics = ctx.measureText(element.text || "");
    // Determine a horizontal scaling factor for certain fonts.  ZPL
    // font "0" (OCRA) has a relatively narrow aspect ratio compared
    // to DejaVu Sans Bold.  To better approximate the original ZPL
    // appearance we compress the width of these glyphs slightly.  If
    // the element has a specific width set (>0) we compute the scale
    // from width/height; otherwise use a default factor for font 0.
    let scaleX = 1;
    if (element.fontName && element.fontName.toString().toUpperCase() === "0") {
      if (
        element.width &&
        element.width > 0 &&
        element.height &&
        element.height > 0
      ) {
        scaleX = element.width / element.height;
      } else {
        // default compression factor for font 0: tuned by eye to approximate
        // the narrow aspect ratio of Zebra font 0.  A value around 0.65
        // compresses the glyph width sufficiently for large strings like
        // 'CA' to fit within their cells.
        scaleX = 0.65;
      }
    }
    element.scaleX = scaleX;
    // Render width is scaled width; height is raw height (dots)
    element.renderWidth = metrics.width * scaleX;
    element.renderHeight = fontSize;
  }

  draw(ctx, element) {
    const { x, y, text, height, orientation, originType, scaleX } = element;
    ctx.save();
    ctx.fillStyle = "black";
    const fontSize = height || element.renderHeight || 10;
    // Choose bold for designator '0'
    const fontFace =
      element.fontName && element.fontName.toString().toUpperCase() === "0"
        ? "DejaVu Sans Condensed Bold"
        : "DejaVu Sans";
    ctx.font = `${fontSize}pt '${fontFace}'`;
    // Determine the baseline position based on origin type.  When
    // originType is 'top-left', the provided y coordinate specifies
    // the top of the text box, so the baseline is y + height.  When
    // 'baseline', the y coordinate already specifies the baseline.
    let baseX = x;
    let baseY = y;
    if (!originType || originType === "top-left") {
      baseY = y + fontSize;
    }
    // Use horizontal scaling factor if provided
    const sx = scaleX || 1;
    // Adjust horizontal position for field block alignment if applicable.
    if (element.blockWidth && element.blockAlign) {
      // Measure the text width using current font settings.  Note we need to
      // apply the same scaling factor when comparing to block width.
      const tmp = ctx.measureText(text);
      const actual = tmp.width * sx;
      const blockWidth = element.blockWidth;
      let delta = 0;
      const align = element.blockAlign.toUpperCase();
      if (align === "C") {
        delta = (blockWidth - actual) / 2;
      } else if (align === "R") {
        delta = blockWidth - actual;
      } else if (align === "J") {
        // For justification we leave as left align for now (no extra spacing)
        delta = 0;
      } else {
        // Left alignment; no offset
        delta = 0;
      }
      baseX += delta;
    }
    // Handle orientation.  We rotate about the base point then draw
    // the text at the origin.  Apply scaling after rotation to
    // compress characters horizontally.  To simulate a heavier weight
    // for ZPL font 0 we draw the text twice with a small offset.
    const drawText = () => {
      // When using font 0, double‑draw for extra weight
      if (
        element.fontName &&
        element.fontName.toString().toUpperCase() === "0"
      ) {
        // Draw multiple times with small offsets to simulate a heavier
        // weight.  Offsets are limited to 0 or 1 pixel so that the
        // letterforms remain legible but appear bolder.  This helps
        // approximate the thick strokes of Zebra font 0 as seen in
        // printed labels.
        ctx.fillText(text, 0, 0);
        ctx.fillText(text, 1, 0);
        ctx.fillText(text, 0, 1);
      } else {
        ctx.fillText(text, 0, 0);
      }
    };
    if (orientation === "R") {
      ctx.translate(baseX, baseY);
      ctx.rotate(-Math.PI / 2);
      ctx.scale(sx, 1);
      drawText();
    } else if (orientation === "I") {
      ctx.translate(baseX, baseY);
      ctx.rotate(Math.PI);
      ctx.scale(sx, 1);
      drawText();
    } else if (orientation === "B") {
      ctx.translate(baseX, baseY);
      ctx.rotate(Math.PI / 2);
      ctx.scale(sx, 1);
      drawText();
    } else {
      ctx.translate(baseX, baseY);
      ctx.scale(sx, 1);
      drawText();
    }
    ctx.restore();
  }
}

export default TextDrawer;
