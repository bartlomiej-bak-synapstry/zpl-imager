import BaseDrawer from "./BaseDrawer";

/**
 * Drawer for graphic boxes (^GB).  Boxes can be drawn either filled
 * or outlined.  The `color` property of the element determines
 * whether to fill ('F') or stroke ('B' or 'W').  The `thickness`
 * property controls the line width for outlines.
 */
class BoxDrawer extends BaseDrawer {
  async prepare(element) {
    // Nothing to do; dimensions are already provided
    element.renderWidth = element.width;
    element.renderHeight = element.height;
  }

  draw(ctx, element) {
    const { x, y, width, height, thickness, color } = element;
    ctx.save();
    // Determine fill vs stroke.  A box is filled when:
    // - colour code is 'F' (explicit fill), or
    // - thickness is greater than or equal to the width or height (solid bar),
    //   because a border thickness equal to dimension produces a solid bar.
    // Determine if the box should be filled.  Fill when:
    // - colour code is 'F' (explicit fill), or
    // - thickness is greater than or equal to both the width and height (solid square)
    // For thin horizontal/vertical lines (where thickness >= width XOR thickness >= height), we stroke.
    const shouldFill =
      (color && color.toUpperCase() === "F") ||
      (thickness >= width && thickness >= height);
    // Determine draw colours taking reverse mode into account
    // A reverse flag may be present on the element (added by analyser)
    const isReverse = !!element.reverse;
    const fillColour = isReverse ? "white" : "black";
    const strokeColour = isReverse ? "white" : "black";
    if (shouldFill) {
      ctx.fillStyle = fillColour;
      ctx.fillRect(x, y, width, height);
    } else {
      ctx.lineWidth = thickness || 1;
      ctx.strokeStyle = strokeColour;
      ctx.strokeRect(x, y, width, height);
    }
    ctx.restore();
  }
}

export default BoxDrawer;
