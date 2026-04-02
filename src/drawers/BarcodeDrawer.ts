import * as PImage from "pureimage";

import BaseDrawer from "./BaseDrawer";
import bwipjs from "@bwip-js/node";
import { decodePng } from "../utils";
import { ensureFont } from "../font";

// Code 39 patterns for each supported character.  Each entry is a
// nine‑character string composed of 'n' (narrow) and 'w' (wide)
// elements.  Bars are drawn on even indices and spaces on odd
// indices.  Patterns are taken from public domain references for
// Code 39.
const CODE39_PATTERNS: { [key: string]: string } = {
  "0": "nnnwwnwnn",
  "1": "wnnwnnnnw",
  "2": "nnwwnnnnw",
  "3": "wnwwnnnnn",
  "4": "nnnwwnnnw",
  "5": "wnnwwnnnn",
  "6": "nnwwwnnnn",
  "7": "nnnwnnwnw",
  "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
  A: "wnnnnwnnw",
  B: "nnwnnwnnw",
  C: "wnwnnwnnn",
  D: "nnnnwwnnw",
  E: "wnnnwwnnn",
  F: "nnwnwwnnn",
  G: "nnnnnwwnw",
  H: "wnnnnwwnn",
  I: "nnwnnwwnn",
  J: "nnnnwwwnn",
  K: "wnnnnnnww",
  L: "nnwnnnnww",
  M: "wnwnnnnwn",
  N: "nnnnwnnww",
  O: "wnnnwnnwn",
  P: "nnwnwnnwn",
  Q: "nnnnnnwww",
  R: "wnnnnnwwn",
  S: "nnwnnnwwn",
  T: "nnnnwnwwn",
  U: "wwnnnnnnw",
  V: "nwwnnnnnw",
  W: "wwwnnnnnn",
  X: "nwnnwnnnw",
  Y: "wwnnwnnnn",
  Z: "nwwnwnnnn",
  "-": "nwnnnnwnw",
  ".": "wwnnnnwnn",
  " ": "nwwnnnwnn",
  $: "nwnwnwnnn",
  "/": "nwnwnnnwn",
  "+": "nwnnnwnwn",
  "%": "nnnwnwnwn",
  "*": "nwnnwnwnn",
};

/**
 * Generate a Code 39 barcode image using pureimage instead of bwip‑js.  ZPL
 * specifies a narrow module width and a ratio (wide/narrow).  The input
 * element must provide `text`, `moduleWidth`, `ratio`, `height`,
 * `printInterpretation` and `printAbove`.  Star start/stop characters are
 * automatically added to the encoded string.  A quiet zone of ten narrow
 * modules is added to the left and right.  A human‑readable line is
 * rendered beneath (or above) the bars if requested.
 *
 * @param {object} element
 * @returns {Promise<object>} PImage image object containing the barcode
 */
async function generateCode39Image(element: any): Promise<any> {
  await ensureFont();
  const narrow = element.moduleWidth || 2;
  const ratio = element.ratio || 2; // default narrow to wide ratio
  const heightDots = element.height || 50;
  const text = element.text || "";
  const printInterp = element.printInterpretation;
  const printAbove = element.printAbove;
  // Encode string with start/stop delimiters.  Convert to uppercase as Code 39
  // defines patterns for uppercase letters only.  Unsupported characters are
  // replaced with a dash as a fallback.
  const data = text.toString().toUpperCase();
  let encoded = "*";
  for (const ch of data) {
    encoded += ch;
  }
  encoded += "*";
  // Compute total width in pixels: sum of modules for each character plus
  // inter‑character gaps and quiet zones.  Each character consists of 9
  // modules; wide modules have width = ratio * narrow.  There is a one
  // narrow module gap between characters except after the last character.
  const quietModules = 10;
  let totalModules = 0;
  for (let i = 0; i < encoded.length; i++) {
    const ch = encoded[i];
    const pat = CODE39_PATTERNS[ch] || CODE39_PATTERNS["-"];
    for (const c of pat) {
      totalModules += c === "w" ? ratio : 1;
    }
    // Add inter‑character gap after every character except the last
    if (i < encoded.length - 1) {
      totalModules += 1;
    }
  }
  // quiet zone is not drawn, only used for width calculation if needed
  const width = Math.ceil(totalModules * narrow);
  // Determine bar height and text height.  Reserve about 25% of the total
  // height for human readable text when requested.  A small margin of 4
  // dots separates the bars from the text.  When printInterpretation is
  // false, the full height is used for bars.
  let barHeight = heightDots;
  // Monospace font, proporcjonalny rozmiar do wysokości kodu
  let fontSize = printInterp ? Math.round(heightDots * 0.35) : 0;
  const margin = 12;
  let textHeight = printInterp ? fontSize + margin : 0;
  // Jeśli tekst pod kodem, powiększ obraz o textHeight
  let canvasHeight = heightDots;
  let barY = 0;
  let textY = 0;
  if (printInterp && !printAbove) {
    canvasHeight = heightDots + textHeight;
    barY = 0;
    textY = heightDots + fontSize; // tekst pod kodem, poniżej słupków
  } else if (printInterp && printAbove) {
    canvasHeight = heightDots + textHeight;
    barY = textHeight;
    textY = fontSize; // tekst nad kodem
  }
  // Create canvas
  const img = PImage.make(width || 1, canvasHeight || 1);
  const ctx = img.getContext("2d");
  // Background white
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, width, canvasHeight);
  // Draw bars
  ctx.fillStyle = "black";
  let x = 0;
  for (let idx = 0; idx < encoded.length; idx++) {
    const ch = encoded[idx];
    const pat = CODE39_PATTERNS[ch] || CODE39_PATTERNS["-"];
    for (let i = 0; i < pat.length; i++) {
      const moduleWidth = (pat[i] === "w" ? ratio : 1) * narrow;
      if (i % 2 === 0) {
        // bar
        ctx.fillRect(Math.floor(x), barY, Math.ceil(moduleWidth), barHeight);
      }
      x += moduleWidth;
    }
    // inter‑character gap (space)
    if (idx < encoded.length - 1) {
      x += narrow;
    }
  }
  // Draw human readable text
  if (printInterp && fontSize > 0) {
    ctx.fillStyle = "black";
    ctx.font = `${fontSize}px Zebra Mono 9x5`;
    const metrics = ctx.measureText(encoded);
    const textWidth = metrics.width;
    const tx = (width - textWidth) / 2;
    let ty = textY;
    ctx.fillText(encoded, tx, ty);
  }
  return img;
}

/**
 * Drawer for barcodes.  This drawer supports a number of barcode
 * symbologies through the bwip‑js library.  The element should
 * specify `codeType` (bwip‑js barcode id), `text`, and optional
 * sizing parameters.  Orientation can be set to N,R,I,B.  Barcode
 * generation is asynchronous so prepare() must be awaited before
 * drawing.
 */
class BarcodeDrawer extends BaseDrawer {
  async prepare(element: any): Promise<any> {
    // First handle Code 39 with a custom renderer.  This implementation
    // generates bars and human text directly using pureimage, yielding
    // more faithful results than bwip‑js.  If generation fails we
    // silently fall back to bwip‑js below.
    if (element.codeType === "code39") {
      try {
        const img = await generateCode39Image(element);
        element.image = img;
        element.renderWidth = img.width;
        element.renderHeight = img.height;
        element._scaleFactor = 1;
        return;
      } catch (err) {
        // Fallback: proceed to bwip‑js if custom generation fails
      }
    }
    const opts: any = {};
    opts.bcid = element.codeType;
    opts.text = element.text;
    if (element.codeType !== "qrcode" && element.codeType !== "datamatrix") {
      const m = element.moduleWidth || 2;
      opts.scaleX = m;
      opts.scaleY = m;
      if (element.height) {
        const heightMm = (element.height * 25.4) / (72 * m);
        opts.height = heightMm;
      }
      // Only Interleaved 2-of-5 needs special ratio mapping here.  Code 39 is
      // handled above.
      if (element.ratio && element.codeType === "interleaved2of5") {
        const X = element.ratio;
        const r = (X - 1) / (2 - 1);
        opts.barratio = r;
        opts.spaceratio = r;
      }
    } else {
      const scale = element.scale || element.moduleWidth || 2;
      opts.scale = scale;
    }
    if (element.options) {
      Object.assign(opts, element.options);
    }
    if (element.printInterpretation) {
      opts.includetext = true;
      opts.textxalign = "center";
    }
    if (element.codeType === "code93") {
      opts.includestartstop = false;
      opts.includecheck = false;
      opts.includecheckintext = false;
    }
    switch (element.orientation) {
      case "R":
        opts.rotate = "R";
        break;
      case "B":
        opts.rotate = "L";
        break;
      case "I":
        opts.rotate = "I";
        break;
      default:
        opts.rotate = "N";
        break;
    }
    try {
      const buffer = await bwipjs.toBuffer(opts);
      element.image = await decodePng(buffer);
      if (
        element.codeType !== "qrcode" &&
        element.codeType !== "datamatrix" &&
        element.height
      ) {
        const imgW = element.image.width;
        const imgH = element.image.height;
        const data = element.image.data;
        let top = -1;
        let bottom = -1;
        for (let y = 0; y < imgH; y++) {
          let rowHasInk = false;
          for (let x = 0; x < imgW; x++) {
            const idx = (y * imgW + x) * 4;
            const rC = data[idx];
            const gC = data[idx + 1];
            const bC = data[idx + 2];
            const aC = data[idx + 3];
            if (aC > 0 && (rC < 200 || gC < 200 || bC < 200)) {
              rowHasInk = true;
              break;
            }
          }
          if (rowHasInk) {
            if (top < 0) top = y;
            bottom = y;
          }
        }
        let scale = 1;
        if (top >= 0 && bottom >= top) {
          const barHeightPx = bottom - top + 1;
          scale = element.height / barHeightPx;
        }
        element.renderWidth = Math.max(1, Math.round(imgW * scale));
        element.renderHeight = Math.max(1, Math.round(imgH * scale));
        element._scaleFactor = scale;
      } else {
        element.renderWidth = element.image.width;
        element.renderHeight = element.image.height;
        element._scaleFactor = 1;
      }
    } catch (err) {
      const estWidth =
        (element.text ? element.text.length : 1) *
        (element.moduleWidth || 2) *
        10;
      element.renderWidth = estWidth;
      element.renderHeight = element.height || 50;
      element.image = null;
    }
  }

  draw(ctx: any, element: any): void {
    const { x, y, image, orientation } = element;
    if (!image) {
      return;
    }
    ctx.save();
    const w = element.renderWidth;
    const h = element.renderHeight;
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

export default BarcodeDrawer;
