import BaseDrawer from "./BaseDrawer";

class CircleDrawer extends BaseDrawer {
  async prepare(element: any): Promise<void> {
    element.renderWidth = element.diameter;
    element.renderHeight = element.diameter;
  }

  draw(ctx: any, element: any): void {
    const { x, y, diameter, thickness, color } = element;
    const r = diameter / 2;
    // Half-pixel center for even diameters matches Zebra's circle rendering
    const cx = x + (diameter - 1) / 2;
    const cy = y + (diameter - 1) / 2;

    const t = thickness || 1;
    const shouldFill = t === 0 || color === "F" || t >= r;

    if (shouldFill) {
      this.fillCircle(ctx, cx, cy, r);
    } else {
      this.fillCircle(ctx, cx, cy, r);
      this.clearCircle(ctx, cx, cy, r - t);
    }
  }

  private fillCircle(ctx: any, cx: number, cy: number, radius: number): void {
    ctx.fillStyle = "black";
    const r2 = radius * radius;
    const yStart = Math.ceil(cy - radius);
    const yEnd = Math.floor(cy + radius);
    for (let py = yStart; py <= yEnd; py++) {
      const dy = py - cy;
      const hw = Math.sqrt(r2 - dy * dy);
      const xStart = Math.ceil(cx - hw);
      const xEnd = Math.floor(cx + hw);
      const width = xEnd - xStart + 1;
      if (width > 0) ctx.fillRect(xStart, py, width, 1);
    }
  }

  private clearCircle(ctx: any, cx: number, cy: number, radius: number): void {
    if (radius <= 0) return;
    ctx.fillStyle = "white";
    const r2 = radius * radius;
    const yStart = Math.ceil(cy - radius);
    const yEnd = Math.floor(cy + radius);
    for (let py = yStart; py <= yEnd; py++) {
      const dy = py - cy;
      const hw = Math.sqrt(r2 - dy * dy);
      const xStart = Math.ceil(cx - hw);
      const xEnd = Math.floor(cx + hw);
      const width = xEnd - xStart + 1;
      if (width > 0) ctx.fillRect(xStart, py, width, 1);
    }
  }
}

export default CircleDrawer;
