import * as PImage from "pureimage";

import BaseDrawer from "./BaseDrawer";

/**
 * Drawer for ZPL ^GFA bitmap graphics.
 * Supports monochrome bitmaps encoded inline in ZPL.
 */
class GfaDrawer extends BaseDrawer {
  async prepare(element: any): Promise<void> {
    // Parse GFA bitmap data
    const { width, height, bytesPerRow, bitmapData } = element;
    // Create a PureImage bitmap
    const img = PImage.make(width, height);
    const ctx = img.getContext("2d");
    // Fill white
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);
    // Draw pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const byteIndex = y * bytesPerRow + Math.floor(x / 8);
        const bitIndex = 7 - (x % 8);
        const byte = bitmapData[byteIndex];
        const isBlack = ((byte >> bitIndex) & 1) === 1;
        if (isBlack) {
          ctx.fillStyle = "black";
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    element.image = img;
    element.renderWidth = width;
    element.renderHeight = height;
  }

  draw(ctx: any, element: any): void {
    console.log("draw oimage");
    const { x, y, image } = element;
    if (!image) return;
    ctx.drawImage(image, x, y, element.renderWidth, element.renderHeight);
  }
}

export default GfaDrawer;
