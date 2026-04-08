import { createCanvas } from "../canvas";
import BaseDrawer from "./BaseDrawer";

class GfaDrawer extends BaseDrawer {
  async prepare(element: any): Promise<void> {
    const { width, height, bytesPerRow, bitmapData } = element;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const byteIndex = y * bytesPerRow + Math.floor(x / 8);
        const bitIndex = 7 - (x % 8);
        if (byteIndex < bitmapData.length) {
          const byte = bitmapData[byteIndex];
          const isBlack = ((byte >> bitIndex) & 1) === 1;
          if (isBlack) {
            const pi = (y * width + x) * 4;
            pixels[pi] = 0;
            pixels[pi + 1] = 0;
            pixels[pi + 2] = 0;
            pixels[pi + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    element.image = canvas;
    element.renderWidth = width;
    element.renderHeight = height;
  }

  draw(ctx: any, element: any): void {
    const { x, y, image } = element;
    if (!image) return;
    ctx.drawImage(image, x, y, element.renderWidth, element.renderHeight);
  }
}

export default GfaDrawer;
