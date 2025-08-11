import BaseDrawer from "./BaseDrawer";

/**
 * Drawer for graphic diagonal lines (^GD).  Lines are specified by
 * width, height, thickness and colour.  The line is drawn from the
 * top‑left corner to the opposite corner (positive slope) if both
 * width and height are positive.  For simplicity we ignore the
 * optional line colour and always draw in black.
 */
class DiagonalLineDrawer extends BaseDrawer {
  async prepare(element) {
    element.renderWidth = element.width;
    element.renderHeight = element.height;
  }

  draw(ctx, element) {
    const { x, y, width, height, thickness } = element;
    ctx.save();
    ctx.lineWidth = thickness || 1;
    ctx.strokeStyle = "black";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y + height);
    ctx.stroke();
    ctx.closePath();
    ctx.restore();
  }
}

export default DiagonalLineDrawer;
