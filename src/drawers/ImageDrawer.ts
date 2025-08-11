import BaseDrawer from "./BaseDrawer";
import { decodePng } from "../utils";

/**
 * Drawer for downloaded and recalled graphics.  Images may be stored
 * using ~DY (download PNG) or ~DG (download GRF) commands.  When
 * recalled via ^IM or ^XG a new element is created with the
 * associated graphic data.  This drawer decodes supported formats
 * (currently PNG only) and draws them with optional scaling and
 * orientation.
 */
class ImageDrawer extends BaseDrawer {
  async prepare(element) {
    // If no graphic data was attached, nothing to prepare
    const graphic = element.graphic;
    element.image = null;
    element.renderWidth = 0;
    element.renderHeight = 0;
    if (!graphic) {
      return;
    }
    try {
      if (graphic.type === "png" && graphic.data) {
        // Decode PNG buffer into a pureimage bitmap
        const img = await decodePng(graphic.data);
        element.image = img;
        element.renderWidth = img.width * (element.scaleX || 1);
        element.renderHeight = img.height * (element.scaleY || 1);
      } else if (graphic.data) {
        // Attempt to decode as PNG even if type unspecified
        const img = await decodePng(graphic.data);
        element.image = img;
        element.renderWidth = img.width * (element.scaleX || 1);
        element.renderHeight = img.height * (element.scaleY || 1);
      } else {
        // Not supported (e.g., GRF ASCII).  Skip.
      }
    } catch (ex) {
      // Decoding failed; leave image null
    }
  }

  draw(ctx, element) {
    const { image, x, y, scaleX, scaleY, orientation } = element;
    if (!image) {
      return;
    }
    const sx = scaleX || 1;
    const sy = scaleY || 1;
    ctx.save();
    if (orientation === "R") {
      // Rotate 90° clockwise
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(
        image,
        0,
        0,
        image.width,
        image.height,
        0,
        0,
        image.width * sx,
        image.height * sy
      );
    } else if (orientation === "I") {
      // Rotate 180°
      ctx.translate(x, y);
      ctx.rotate(Math.PI);
      ctx.drawImage(
        image,
        0,
        0,
        image.width,
        image.height,
        0,
        0,
        image.width * sx,
        image.height * sy
      );
    } else if (orientation === "B") {
      // Rotate 90° counter‑clockwise
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(
        image,
        0,
        0,
        image.width,
        image.height,
        0,
        0,
        image.width * sx,
        image.height * sy
      );
    } else {
      // No rotation
      ctx.drawImage(image, x, y, image.width * sx, image.height * sy);
    }
    ctx.restore();
  }
}

export default ImageDrawer;
