import { createCanvas, loadImage } from "../canvas";
import BaseDrawer from "./BaseDrawer";
import { decodePng } from "../utils";

/**
 * Decode ZPL compressed GRF data into a hex string.
 */
function decodeCompressedGrf(data: string, bytesPerRow: number): string {
  const hexCharsPerRow = bytesPerRow * 2;
  const rows: string[] = [];
  let currentRow = "";
  let i = 0;

  while (i < data.length) {
    const ch = data[i];
    if (ch === ",") {
      currentRow = currentRow.padEnd(hexCharsPerRow, "0");
      rows.push(currentRow);
      currentRow = "";
      i++;
    } else if (ch === "!") {
      currentRow = currentRow.padEnd(hexCharsPerRow, "F");
      rows.push(currentRow);
      currentRow = "";
      i++;
    } else if (ch === ":") {
      if (rows.length > 0) {
        rows.push(rows[rows.length - 1]);
      } else {
        rows.push("0".repeat(hexCharsPerRow));
      }
      i++;
    } else if (ch >= "G" && ch <= "Y") {
      const count = ch.charCodeAt(0) - "F".charCodeAt(0);
      i++;
      if (i < data.length) {
        currentRow += data[i].repeat(count);
        i++;
      }
    } else if (ch >= "g" && ch <= "z") {
      const count = (ch.charCodeAt(0) - "f".charCodeAt(0)) * 20;
      i++;
      if (i < data.length) {
        currentRow += data[i].repeat(count);
        i++;
      }
    } else if (/[0-9A-Fa-f]/.test(ch)) {
      currentRow += ch;
      i++;
      if (currentRow.length >= hexCharsPerRow) {
        rows.push(currentRow.substring(0, hexCharsPerRow));
        currentRow = "";
      }
    } else {
      i++;
    }
  }

  if (currentRow.length > 0) {
    currentRow = currentRow.padEnd(hexCharsPerRow, "0");
    rows.push(currentRow);
  }

  return rows.join("");
}

/**
 * Create a canvas from GRF hex data.
 */
function createGrfImage(
  hexData: string,
  bytesPerRow: number,
  totalBytes: number
): any {
  const width = bytesPerRow * 8;
  const height = Math.ceil(totalBytes / bytesPerRow);
  const bitmapData = Buffer.from(hexData, "hex");
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
  return canvas;
}

class ImageDrawer extends BaseDrawer {
  async prepare(element: any): Promise<void> {
    const graphic = element.graphic;
    element.image = null;
    element.renderWidth = 0;
    element.renderHeight = 0;
    if (!graphic) return;

    try {
      if (graphic.data) {
        const img = await decodePng(graphic.data);
        element.image = img;
        element.renderWidth = img.width * (element.scaleX || 1);
        element.renderHeight = img.height * (element.scaleY || 1);
      } else if (
        graphic.dataString &&
        graphic.bytesPerRow &&
        graphic.totalBytes
      ) {
        const raw = graphic.dataString.replace(/[\s\r\n]+/g, "");
        let hexData: string;
        if (/[G-Yg-z,:!]/.test(raw)) {
          hexData = decodeCompressedGrf(raw, graphic.bytesPerRow);
        } else {
          hexData = raw.replace(/[^0-9A-Fa-f]/g, "");
        }
        const img = createGrfImage(
          hexData,
          graphic.bytesPerRow,
          graphic.totalBytes
        );
        element.image = img;
        element.renderWidth = img.width * (element.scaleX || 1);
        element.renderHeight = img.height * (element.scaleY || 1);
      }
    } catch (ex) {
      // Decoding failed; leave image null
    }
  }

  draw(ctx: any, element: any): void {
    const { image, x, y, scaleX, scaleY, orientation } = element;
    if (!image) return;

    const sx = scaleX || 1;
    const sy = scaleY || 1;
    const w = image.width * sx;
    const h = image.height * sy;

    ctx.save();
    if (orientation === "R") {
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(image, 0, 0, w, h);
    } else if (orientation === "I") {
      ctx.translate(x, y);
      ctx.rotate(Math.PI);
      ctx.drawImage(image, 0, 0, w, h);
    } else if (orientation === "B") {
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(image, 0, 0, w, h);
    } else {
      ctx.drawImage(image, x, y, w, h);
    }
    ctx.restore();
  }
}

export default ImageDrawer;
