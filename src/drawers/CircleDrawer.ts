import BaseDrawer from "./BaseDrawer";

/**
 * Drawer for graphic circles (^GC).  Circles are defined by a
 * diameter, thickness and colour.  A thickness of 0 means the
 * circle should be filled.  Colour 'B' or 'W' selects the stroke
 * colour; we only support drawing in black for simplicity.  The
 * circle is drawn with its top‑left corner at (x,y).  In ZPL the
 * origin is the top‑left of the circle.
 */
class CircleDrawer extends BaseDrawer {
  async prepare(element) {
    element.renderWidth = element.diameter;
    element.renderHeight = element.diameter;
  }

  draw(ctx, element) {
    const { x, y, diameter, thickness, color } = element;
    const radius = diameter / 2;
    const cx = x + radius;
    const cy = y + radius;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    if (thickness === 0 || color === "F") {
      ctx.fillStyle = "black";
      ctx.fill();
    } else {
      ctx.lineWidth = thickness;
      ctx.strokeStyle = "black";
      ctx.stroke();
    }
    ctx.closePath();
    ctx.restore();
  }
}

export default CircleDrawer;
