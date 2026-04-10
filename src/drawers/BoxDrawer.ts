import BaseDrawer from "./BaseDrawer";

class BoxDrawer extends BaseDrawer {
  async prepare(element: any): Promise<void> {
    element.renderWidth = element.width;
    element.renderHeight = element.height;
  }

  draw(ctx: any, element: any): void {
    const { x, y, width, height, thickness, color, rounding } = element;
    ctx.save();

    const isReverse = !!element.reverse;
    const isWhiteColor = color && color.toUpperCase() === "W";

    const t = thickness || 1;
    const shouldFill =
      (color && color.toUpperCase() === "F") ||
      t >= Math.min(width, height) / 2;

    const r = rounding ? Math.round((rounding * Math.min(width, height)) / 16) : 0;

    if (isReverse) {
      // ^FR: invert pixels within the box shape (XOR via difference compositing)
      ctx.globalCompositeOperation = "difference";
      ctx.fillStyle = "white";
    } else {
      const drawColor = isWhiteColor ? "white" : "black";
      ctx.fillStyle = drawColor;
    }

    if (shouldFill) {
      if (r > 0) {
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, r);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, width, height);
      }
    } else {
      // Draw border only — do NOT clear interior (ZPL is additive)
      if (r > 0) {
        // Rounded border: use clip path to draw only the border region
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, r);
        const innerW = width - 2 * t;
        const innerH = height - 2 * t;
        const innerR = rounding ? Math.max(0, (rounding * Math.min(innerW, innerH)) / 16) : 0;
        // Cut out inner area using evenodd fill rule
        ctx.roundRect(x + t, y + t, innerW, innerH, innerR);
        ctx.fill("evenodd");
      } else {
        // Draw 4 border rectangles (no interior clearing)
        // Top
        ctx.fillRect(x, y, width, t);
        // Bottom
        ctx.fillRect(x, y + height - t, width, t);
        // Left
        ctx.fillRect(x, y + t, t, height - 2 * t);
        // Right
        ctx.fillRect(x + width - t, y + t, t, height - 2 * t);
      }
    }
    ctx.restore();
  }

  private invertRect(ctx: any, x: number, y: number, w: number, h: number): void {
    const imgData = ctx.getImageData(x, y, w, h);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i];       // R
      d[i + 1] = 255 - d[i + 1]; // G
      d[i + 2] = 255 - d[i + 2]; // B
      // Alpha stays the same
    }
    ctx.putImageData(imgData, x, y);
  }
}

export default BoxDrawer;
