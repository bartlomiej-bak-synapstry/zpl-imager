import { createCanvas } from "./canvas";
import type { RenderOptions } from "../index";
import { ensureFont } from "./font";
import { getDrawer } from "./drawerFactory";

export async function drawElements(
  elements: any[],
  options: RenderOptions = {}
): Promise<Buffer> {
  ensureFont();

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
    let width = el.renderWidth || el.width || 0;
    let height = el.renderHeight || el.height || 0;
    const orient = el.orientation || "N";
    let rotW = width;
    let rotH = height;
    if (orient === "R" || orient === "B") {
      rotW = height;
      rotH = width;
    }
    const ex = el.x + rotW;
    const ey = el.y + rotH;
    if (ex > maxX) maxX = ex;
    if (ey > maxY) maxY = ey;
  }

  const margin = 4;
  let canvasWidth = Math.ceil(maxX + margin);
  let canvasHeight = Math.ceil(maxY + margin);

  if (options.width && options.width > 0) canvasWidth = options.width;
  if (options.height && options.height > 0) canvasHeight = options.height;

  const canvas = createCanvas(
    canvasWidth > 0 ? canvasWidth : 1,
    canvasHeight > 0 ? canvasHeight : 1
  );
  const ctx = canvas.getContext("2d");

  // Fill background white
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Draw each element
  for (const el of elements) {
    const drawer = getDrawer(el.type);
    if (drawer && typeof drawer.draw === "function") {
      drawer.draw(ctx, el);
    }
  }

  // Encode to PNG
  return canvas.toBuffer("image/png") as Buffer;
}
