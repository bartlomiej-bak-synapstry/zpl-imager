import BaseDrawer from "./BaseDrawer";

class CircleDrawer extends BaseDrawer {
  async prepare(element: any): Promise<void> {
    element.renderWidth = element.diameter;
    element.renderHeight = element.diameter;
  }

  draw(ctx: any, element: any): void {
    const { x, y, diameter, thickness, color } = element;
    const radius = diameter / 2;
    const cx = x + radius;
    const cy = y + radius;

    const t = thickness || 1;
    const shouldFill = t === 0 || color === "F" || t >= radius;

    if (shouldFill) {
      // Filled circle: pixel-perfect using distance check
      this.fillCircle(ctx, cx, cy, radius);
    } else {
      // Border circle: fill outer, clear inner
      this.fillCircle(ctx, cx, cy, radius);
      this.clearCircle(ctx, cx, cy, radius - t);
    }
  }

  private fillCircle(ctx: any, cx: number, cy: number, radius: number): void {
    ctx.fillStyle = "black";
    const r = Math.round(radius);
    const icx = Math.round(cx);
    const icy = Math.round(cy);
    for (let dy = -r; dy <= r; dy++) {
      const halfWidth = Math.round(Math.sqrt(r * r - dy * dy));
      ctx.fillRect(icx - halfWidth, icy + dy, halfWidth * 2, 1);
    }
  }

  private clearCircle(ctx: any, cx: number, cy: number, radius: number): void {
    if (radius <= 0) return;
    ctx.fillStyle = "white";
    const r = Math.round(radius);
    const icx = Math.round(cx);
    const icy = Math.round(cy);
    for (let dy = -r; dy <= r; dy++) {
      const halfWidth = Math.round(Math.sqrt(r * r - dy * dy));
      ctx.fillRect(icx - halfWidth, icy + dy, halfWidth * 2, 1);
    }
  }
}

export default CircleDrawer;
