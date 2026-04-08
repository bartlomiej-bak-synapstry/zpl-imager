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
    const clearColor = isWhiteColor !== isReverse ? "black" : "white";

    const t = thickness || 1;
    const shouldFill =
      (color && color.toUpperCase() === "F") ||
      t >= Math.min(width, height) / 2;

    const r = rounding ? (rounding * Math.min(width, height)) / 16 : 0;

    if (shouldFill) {
      ctx.fillStyle = drawColor;
      if (r > 0) {
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, r);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, width, height);
      }
    } else {
      // Draw inward border: fill outer, then clear inner
      ctx.fillStyle = drawColor;
      if (r > 0) {
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, r);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, width, height);
      }
      ctx.fillStyle = clearColor;
      const innerR = Math.max(0, r - t);
      if (innerR > 0) {
        ctx.beginPath();
        ctx.roundRect(x + t, y + t, width - 2 * t, height - 2 * t, innerR);
        ctx.fill();
      } else {
        ctx.fillRect(x + t, y + t, width - 2 * t, height - 2 * t);
      }
    }
    ctx.restore();
  }
}

export default BoxDrawer;
