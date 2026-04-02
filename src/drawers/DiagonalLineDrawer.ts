import BaseDrawer from "./BaseDrawer";

class DiagonalLineDrawer extends BaseDrawer {
  /**
   * Drawer for graphic diagonal lines (^GD).  Lines are specified by
   * width, height, thickness and colour.  The line is drawn from the
   * top‑left corner to the opposite corner (positive slope) if both
   * width and height are positive.  For simplicity we ignore the
   * optional line colour and always draw in black.
   */
  async prepare(element: any): Promise<void> {
    element.renderWidth = element.width;
    element.renderHeight = element.height;
  }

  draw(ctx: any, element: any): void {
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
