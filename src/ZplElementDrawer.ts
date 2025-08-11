import * as PImage from "pureimage";

import { ensureFont } from "./font";
import { getDrawer } from "./drawerFactory";
import stream from "stream";

/**
 * Computes and draws a collection of ZPL elements on a canvas.  The
 * renderer delegates drawing of individual element types to specific
 * drawer classes.  All elements are first prepared (to compute
 * dimensions and load resources) and then rendered onto a canvas
 * large enough to contain the union of their bounding boxes.  A
 * small margin is added around the content to prevent clipping.
 *
 * @param {Array<object>} elements List of element definitions produced by the analyser
 * @returns {Promise<Buffer>} A PNG buffer of the rendered label
 */
export async function drawElements(elements) {
  // Load the shared font (needed for measurement)
  await ensureFont();
  // Prepare all elements (compute sizes, generate images)
  for (const el of elements) {
    const drawer = getDrawer(el.type);
    if (drawer && typeof drawer.prepare === "function") {
      await drawer.prepare(el);
    }
  }
  // Determine extents considering orientation
  let maxX = 0;
  let maxY = 0;
  for (const el of elements) {
    // Determine width/height after rotation
    let width = el.renderWidth;
    let height = el.renderHeight;
    if (!width || !height) {
      // Some elements might not set render dimensions; default to 0
      width = el.width || 0;
      height = el.height || 0;
    }
    const orient = el.orientation || "N";
    let rotW = width;
    let rotH = height;
    if (orient === "R" || orient === "B") {
      rotW = height;
      rotH = width;
    } else if (orient === "I") {
      rotW = width;
      rotH = height;
    }
    const ex = el.x + rotW;
    const ey = el.y + rotH;
    if (ex > maxX) maxX = ex;
    if (ey > maxY) maxY = ey;
  }
  const margin = 4;
  const canvasWidth = Math.ceil(maxX + margin);
  const canvasHeight = Math.ceil(maxY + margin);
  // Avoid zero dimension canvas
  const img = PImage.make(
    canvasWidth > 0 ? canvasWidth : 1,
    canvasHeight > 0 ? canvasHeight : 1
  );
  const ctx = img.getContext("2d");
  // Fill background white
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  // Draw each element using its drawer
  for (const el of elements) {
    const drawer = getDrawer(el.type);
    if (drawer && typeof drawer.draw === "function") {
      drawer.draw(ctx, el);
    }
  }
  // Encode to PNG
  const chunks = [];
  const writable = new stream.Writable({
    write(chunk, encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  await PImage.encodePNGToStream(img, writable);
  return Buffer.concat(chunks);
}
