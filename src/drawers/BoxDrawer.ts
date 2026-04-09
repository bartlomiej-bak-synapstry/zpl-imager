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
    const drawColor = isWhiteColor !== isReverse ? "white" : "black";

    const t = thickness || 1;
    const shouldFill =
      (color && color.toUpperCase() === "F") ||
      t >= Math.min(width, height) / 2;

    const r = rounding ? (rounding * Math.min(width, height)) / 16 : 0;

    ctx.fillStyle = drawColor;

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
        const innerR = Math.max(0, r - t);
        // Cut out inner area using evenodd fill rule
        ctx.roundRect(x + t, y + t, width - 2 * t, height - 2 * t, innerR);
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
}

export default BoxDrawer;
