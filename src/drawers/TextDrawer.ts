import { createCanvas } from "../canvas";
import BaseDrawer from "./BaseDrawer";
import { ensureFont } from "../font";

class TextDrawer extends BaseDrawer {
  async prepare(element: any): Promise<void> {
    ensureFont();
    const tmp = createCanvas(1, 1);
    const ctx = tmp.getContext("2d");
    const fontSize = element.height || 10;
    const fontFace =
      element.fontName && element.fontName.toString().toUpperCase() === "0"
        ? "Roboto Condensed"
        : "DejaVu Sans Mono";
    ctx.font = `bold ${fontSize}px '${fontFace}'`;
    const metrics = ctx.measureText(element.text || "");
    let scaleX = 1;
    if (element.fontName && element.fontName.toString().toUpperCase() === "0") {
      if (
        element.width &&
        element.width > 0 &&
        element.height &&
        element.height > 0
      ) {
        scaleX = element.width / element.height;
      }
    }
    element.scaleX = scaleX;
    element.renderWidth = metrics.width * scaleX;
    element.renderHeight = fontSize;
  }

  draw(ctx: any, element: any): void {
    const { x, y, text, height, orientation, originType, scaleX } = element;
    ctx.save();
    if (element.reverse) {
      // ^FR: invert pixels under text glyphs (XOR via difference compositing)
      ctx.globalCompositeOperation = "difference";
      ctx.fillStyle = "white";
    } else {
      ctx.fillStyle = "black";
    }
    const fontSize = height || element.renderHeight || 10;
    const fontFace =
      element.fontName && element.fontName.toString().toUpperCase() === "0"
        ? "Roboto Condensed"
        : "DejaVu Sans Mono";
    ctx.font = `bold ${fontSize}px '${fontFace}'`;
    let baseX = x;
    let baseY = y;
    if (!originType || originType === "top-left") {
      // Zebra positions baseline so cap_top = y_top (^FO + ^LH).
      // Cap-height ratio: ≤70px → 0.70, ≥80px → 0.72 (empirical).
      const ratio = fontSize >= 80 ? 0.72 : 0.70;
      baseY = y + Math.round(fontSize * ratio);
    }
    const sx = scaleX || 1;
    if (element.blockWidth && element.blockAlign) {
      const tmp = ctx.measureText(text);
      const actual = tmp.width * sx;
      const blockWidth = element.blockWidth;
      let delta = 0;
      const align = element.blockAlign.toUpperCase();
      if (align === "C") {
        delta = (blockWidth - actual) / 2;
      } else if (align === "R") {
        delta = blockWidth - actual;
      }
      baseX += delta;
    }
    const drawText = () => {
      ctx.fillText(text, 0, 0);
    };
    if (orientation === "R") {
      ctx.translate(baseX, baseY);
      ctx.rotate(Math.PI / 2);
      ctx.scale(sx, 1);
      drawText();
    } else if (orientation === "I") {
      ctx.translate(baseX, baseY);
      ctx.rotate(Math.PI);
      ctx.scale(sx, 1);
      drawText();
    } else if (orientation === "B") {
      ctx.translate(baseX, baseY);
      ctx.rotate(-Math.PI / 2);
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
