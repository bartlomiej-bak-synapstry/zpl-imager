import PImage from 'pureimage';
import { Readable } from 'stream';

/**
 * Decode a PNG buffer into a PureImage bitmap.  Many drawers use
 * bwip‑js to generate barcodes which return a PNG buffer.  This
 * helper wraps the buffer in a readable stream and leverages
 * pureimage’s decodePNGFromStream API.
 *
 * @param {Buffer} buffer PNG image data
 * @returns {Promise<any>} A pureimage bitmap
 */
export async function decodePng(buffer) {
  const stream = Readable.from(buffer);
  return PImage.decodePNGFromStream(stream);
}

