import { createCanvas } from "../canvas";
import BaseDrawer from "./BaseDrawer";
import bwipjs from "@bwip-js/node";
import { decodePng } from "../utils";
import { ensureFont } from "../font";
import { ZEBRA_FONTS, type ZebraFont } from "../zebraFont";

/**
 * Draw a glyph from raw grayscale data directly onto canvas ImageData.
 * This avoids PNG encode/decode/compositing precision loss.
 */
function drawGrayGlyph(
  ctx: any, glyph: {w: number; g: string}, x: number, y: number, height: number, canvasW: number
): void {
  const gray = Buffer.from(glyph.g, "base64");
  const imgData = ctx.getImageData(x, y, glyph.w, height);
  const d = imgData.data;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < glyph.w; col++) {
      const gVal = gray[row * glyph.w + col];
      if (gVal < 255) {
        const idx = (row * glyph.w + col) * 4;
        // Composite black (gVal) over existing pixel (white background)
        // result = gVal (the gray value IS the final pixel value)
        d[idx] = gVal;     // R
        d[idx + 1] = gVal; // G
        d[idx + 2] = gVal; // B
        d[idx + 3] = 255;  // fully opaque
      }
    }
  }
  ctx.putImageData(imgData, x, y);
}


const CODE39_PATTERNS: { [key: string]: string } = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn",
  "4": "nnnwwnnnw", "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw",
  "8": "wnnwnnwnn", "9": "nnwwnnwnn",
  A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw",
  E: "wnnnwwnnn", F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn",
  I: "nnwnnwwnn", J: "nnnnwwwnn", K: "wnnnnnnww", L: "nnwnnnnww",
  M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn", P: "nnwnwnnwn",
  Q: "nnnnnnwww", R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn",
  U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw",
  Y: "wwnnwnnnn", Z: "nwwnwnnnn",
  "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn",
  $: "nwnwnwnnn", "/": "nwnwnnnwn", "+": "nwnnnwnwn", "%": "nnnwnwnwn",
  "*": "nwnnwnwnn",
};

// Code 128 bar patterns: each value maps to 6 element widths (bar,space,bar,space,bar,space)
// Values 0-105, plus special: 103=StartA, 104=StartB, 105=StartC, 106=Stop
const CODE128_PATTERNS: number[][] = [
  [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],
  [1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],
  [2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],//10-14
  [1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
  [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],//20-24
  [3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],
  [2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],//30-34
  [1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
  [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1],//40-44
  [1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1],
  [2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],//50-54
  [3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],
  [3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2],//60-64
  [1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4],
  [1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],//70-74
  [2,4,1,2,1,1],[2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1],
  [1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],[1,2,4,1,1,2],//80-84
  [1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],[2,1,2,1,4,1],
  [2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1],//90-94
  [1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],[1,1,3,1,4,1],
  [1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1],[2,1,1,4,1,2],[2,1,1,2,1,4],//100-104
  [2,1,1,2,3,2],[2,3,3,1,1,1,2], // 105=StartC, 106=Stop (7 elements)
];

// EAN-13 encoding tables
const EAN13_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const EAN13_G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const EAN13_R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const EAN13_PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];

/**
 * Encode Code 128 in pure Code B (no subset switching).
 * Verified to match Zebra reference bar patterns via pixel analysis.
 */
function prepareCode128(element: any): void {
  ensureFont();
  const m = element.moduleWidth || 2;
  const heightDots = element.height || 50;
  const printInterp = element.printInterpretation;
  const printAbove = element.printAbove;
  const data = element.text.toString();

  // Pure Code B — each character encoded individually, no Code C optimization
  const values: number[] = [104]; // Start B
  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i);
    values.push(code >= 32 && code <= 127 ? code - 32 : 0);
  }

  // Weighted checksum mod 103
  let checksum = values[0];
  for (let j = 1; j < values.length; j++) {
    checksum += values[j] * j;
  }
  values.push(checksum % 103);
  values.push(106); // Stop (pattern includes terminal bar)

  // Generate bars (Stop pattern includes terminal bar)
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (const val of values) {
    const pattern = CODE128_PATTERNS[val];
    for (let pi = 0; pi < pattern.length; pi++) {
      const barWidth = pattern[pi] * m;
      if (pi % 2 === 0) {
        bars.push({ x, w: barWidth });
      }
      x += barWidth;
    }
  }
  const width = x;
  const bf128 = printInterp ? ZEBRA_FONTS[m] : undefined;
  const fontSize = printInterp ? (bf128 ? bf128.height : Math.max(8, Math.round(heightDots * 0.22))) : 0;
  const textMargin = printInterp ? (bf128 ? m * 3 - 1 : 6) : 0;
  const textAreaH = printInterp ? fontSize + textMargin : 0;

  const use128 = bf128 && data.split("").every((c: string) => bf128.chars[c]);
  element._code128 = {
    bars, width, text: data, fontSize, textMargin, textAreaH,
    printAbove: !!printAbove, bf128: use128 ? bf128 : undefined,
  };
  element.image = null;
  element.renderWidth = width;
  element.renderHeight = heightDots + textAreaH;
}

/**
 * Prepare Code 39 barcode data for direct drawing.
 */
function prepareCode39(element: any): void {
  ensureFont();
  const narrow = element.moduleWidth || 2;
  const ratio = element.ratio || 2;
  const heightDots = element.height || 50;
  const printInterp = element.printInterpretation;
  const printAbove = element.printAbove;

  const data = element.text.toString().toUpperCase();
  const encoded = "*" + data + "*";

  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (let idx = 0; idx < encoded.length; idx++) {
    const ch = encoded[idx];
    const pat = CODE39_PATTERNS[ch] || CODE39_PATTERNS["-"];
    for (let i = 0; i < pat.length; i++) {
      const moduleWidth = (pat[i] === "w" ? ratio : 1) * narrow;
      if (i % 2 === 0) {
        bars.push({ x, w: moduleWidth });
      }
      x += moduleWidth;
    }
    if (idx < encoded.length - 1) x += narrow;
  }
  const width = x;

  // Use bitmap font metrics if available, else fallback formula
  const bf = printInterp ? ZEBRA_FONTS[narrow] : undefined;
  const fontSize = printInterp ? (bf ? bf.height : Math.max(8, Math.round(heightDots * 0.22))) : 0;
  // Reference margins: BY3=9, BY4=11, BY5=14 ≈ narrow * 3
  const textMargin = printInterp ? (bf ? narrow * 3 - 1 : 6) : 0;
  const textAreaH = printInterp ? fontSize + textMargin : 0;

  // Preload glyph images for bitmap text rendering
  // glyphs will be loaded lazily in draw() — just mark that bf is available
  const useGlyphs = bf && encoded.split("").every((c: string) => bf.chars[c]);

  element._code39 = {
    bars, width, encoded, fontSize, textMargin, textAreaH,
    printAbove: !!printAbove, bf: useGlyphs ? bf : undefined,
  };
  element.image = null;
  element.renderWidth = width;
  element.renderHeight = heightDots + textAreaH;
}

/**
 * Prepare EAN-13 barcode with guard bar extensions and per-digit text positioning.
 */
function prepareEAN13(element: any): void {
  ensureFont();
  const m = element.moduleWidth || 2;
  const heightDots = element.height || 50;
  const printInterp = element.printInterpretation;

  const raw = element.text.toString().replace(/\D/g, '');
  const digits = raw.split('').map(Number);
  // Ensure 12 data digits
  while (digits.length < 12) digits.push(0);
  if (digits.length > 12) digits.length = 12;

  // Calculate check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  digits.push((10 - (sum % 10)) % 10);

  const firstDigit = digits[0];
  const parity = EAN13_PARITY[firstDigit];

  // Guard bars extend BELOW normal data bars (measured from Zebra reference)
  const GUARD_EXT: {[k:number]:number} = {1:8, 2:11, 3:16, 4:22, 5:28};
  const guardExt = GUARD_EXT[m] || 5 * m + Math.floor(m / 2);
  const guardH = heightDots + guardExt;

  type BarInfo = { x: number; w: number; h: number };
  const bars: BarInfo[] = [];
  let x = 0;

  const addBars = (pattern: string, h: number) => {
    for (const ch of pattern) {
      if (ch === '1') bars.push({ x, w: m, h });
      x += m;
    }
  };

  // Start guard (tall — extends below data bars)
  addBars('101', guardH);
  // Left 6 digits (normal height = heightDots)
  for (let i = 0; i < 6; i++) {
    const d = digits[i + 1];
    addBars(parity[i] === 'L' ? EAN13_L[d] : EAN13_G[d], heightDots);
  }
  // Center guard (tall)
  addBars('01010', guardH);
  // Right 6 digits (normal height)
  for (let i = 0; i < 6; i++) {
    addBars(EAN13_R[digits[i + 7]], heightDots);
  }
  // End guard (tall)
  addBars('101', guardH);

  const totalBarWidth = x; // 95 * m

  const bf = printInterp ? ZEBRA_FONTS[m] : undefined;
  const fontSize = printInterp ? (bf ? bf.height : m * 6 + 1) : 0;
  // Text starts at dataBarBottom + margin (overlaps guard bar extension area)
  const textMargin = bf ? bf.margin : m * 3 - 1;
  // Total height = max of (guard extension, text area from data bar bottom)
  const textAreaH = printInterp ? Math.max(guardExt, textMargin + fontSize) : guardExt;

  element._ean13 = {
    bars,
    totalBarWidth,
    digits: digits.map(String).join(''),
    fontSize,
    guardExt,
    textMargin,
    m,
  };
  element.image = null;
  element.renderWidth = totalBarWidth;
  element.renderHeight = heightDots + textAreaH;
}

/**
 * Rotate a canvas by the specified ZPL orientation using pixel manipulation.
 * Returns a new canvas with the rotated content.
 * R = 90° CW, I = 180°, B = 90° CCW (270° CW)
 */
function rotateCanvas(srcCanvas: any, orient: string): any {
  const sw = srcCanvas.width;
  const sh = srcCanvas.height;
  const srcCtx = srcCanvas.getContext("2d");
  const srcData = srcCtx.getImageData(0, 0, sw, sh);
  const src = srcData.data;

  let dw: number, dh: number;
  if (orient === "R" || orient === "B") {
    dw = sh; dh = sw; // swapped
  } else {
    dw = sw; dh = sh; // same (I = 180°)
  }

  const dstCanvas = createCanvas(dw, dh);
  const dstCtx = dstCanvas.getContext("2d");
  const dstData = dstCtx.createImageData(dw, dh);
  const dst = dstData.data;

  for (let dy = 0; dy < dh; dy++) {
    for (let dx = 0; dx < dw; dx++) {
      let sx: number, sy: number;
      if (orient === "R") {
        // 90° CW: dst(dx,dy) = src(dy, sh-1-dx)
        sx = dy; sy = sh - 1 - dx;
      } else if (orient === "I") {
        // 180°: dst(dx,dy) = src(sw-1-dx, sh-1-dy)
        sx = sw - 1 - dx; sy = sh - 1 - dy;
      } else {
        // B = 90° CCW: dst(dx,dy) = src(sw-1-dy, dx)
        sx = sw - 1 - dy; sy = dx;
      }
      const si = (sy * sw + sx) * 4;
      const di = (dy * dw + dx) * 4;
      dst[di] = src[si];
      dst[di + 1] = src[si + 1];
      dst[di + 2] = src[si + 2];
      dst[di + 3] = src[si + 3];
    }
  }

  dstCtx.putImageData(dstData, 0, 0);
  return dstCanvas;
}

class BarcodeDrawer extends BaseDrawer {
  async prepare(element: any): Promise<void> {
    ensureFont();

    // Code 39: direct bar calculation (pixel-perfect)
    if (element.codeType === "code39") {
      try {
        prepareCode39(element);
        // (glyphs drawn directly from raw gray data, no preload needed)
        return;
      } catch (err) { /* fallthrough to bwip-js */ }
    }

    // Code 128: Normal mode → direct Code B (matches Zebra), Auto → bwip-js
    if (element.codeType === "code128" && !element.options?.code128auto) {
      try {
        prepareCode128(element);
        return;
      } catch (err) { /* fallthrough to bwip-js */ }
    }

    // EAN-13: direct bar drawing with guard bar extensions
    if (element.codeType === "ean13") {
      try {
        prepareEAN13(element);
        return;
      } catch (err) { /* fallthrough to bwip-js */ }
    }

    const heightDots = element.height || 50;
    const m = element.moduleWidth || 2;
    const printInterp = element.printInterpretation;

    let barcodeText = element.text;

    // MaxiCode modes 2/3: restructure data for bwip-js
    // ZPL format: postal(9)country(3)service(3)message
    // bwip-js format: postal\x1Dcountry\x1Dservice\x1Dmessage
    if (element.codeType === "maxicode") {
      const mode = element.options?.mode;
      if ((mode === 2 || mode === 3) && barcodeText.length >= 15) {
        const postal = barcodeText.substring(0, 9);
        const country = barcodeText.substring(9, 12);
        const service = barcodeText.substring(12, 15);
        const message = barcodeText.substring(15);
        barcodeText = postal + "\x1D" + country + "\x1D" + service + "\x1D" + message;
      }
    }

    const opts: any = {
      bcid: element.codeType,
      text: barcodeText,
      includetext: false,
    };

    // Scale settings per barcode type
    const is2D = element.codeType === "qrcode" ||
      element.codeType === "datamatrix" ||
      element.codeType === "maxicode";
    let qrMagnification = 0;

    if (element.codeType === "pdf417") {
      // PDF417: use pdf417compact for truncated mode
      if (element.options?.truncated) {
        opts.bcid = "pdf417compact";
      }
      opts.scale = m;
      // Convert Zebra rowheight (in dots) to bwip-js rowheight (in module widths)
      if (element.options?.rowheight) {
        opts.rowheight = element.options.rowheight / m;
        delete element.options.rowheight; // don't pass twice via merge
      }
      // Remove truncated from options (already handled via bcid)
      if (element.options?.truncated) {
        delete element.options.truncated;
      }
    } else if (element.codeType === "qrcode") {
      // QR: bwip-js has 2px/module at scale=1. Generate at scale=1,
      // then scale output to match ZPL magnification (1px/module).
      qrMagnification = element.options?.scale || m;
      opts.scale = 1;
    } else if (element.codeType === "datamatrix") {
      // DataMatrix: same 2× issue as QR. Generate at scale=1, rescale on render.
      qrMagnification = element.options?.scale || m;
      opts.scale = 1;
    } else if (element.codeType === "maxicode") {
      opts.scale = element.options?.scale || m;
    } else {
      opts.scaleX = m;
      opts.scaleY = m;
    }

    if (!is2D && element.codeType !== "pdf417") {
      const heightMm = (heightDots * 25.4) / (72 * m);
      opts.height = heightMm;
    }

    // Ratio for I2of5
    if (element.ratio && element.codeType === "interleaved2of5") {
      const r = (element.ratio - 1) / (2 - 1);
      opts.barratio = r;
      opts.spaceratio = r;
    }

    // Code93: Zebra always adds check digits
    if (element.codeType === "code93") {
      opts.includecheck = true;
      opts.includecheckintext = false;
    }

    // Merge custom options (excluding scale which was already handled)
    if (element.options) {
      const { scale: _s, ...rest } = element.options;
      Object.assign(opts, rest);
    }

    try {
      const buffer = await bwipjs.toBuffer(opts);
      const img = await decodePng(buffer);

      if (is2D || element.codeType === "pdf417") {
        element.image = img;
        if (qrMagnification > 0) {
          element.renderWidth = Math.round(img.width * qrMagnification / 2);
          element.renderHeight = Math.round(img.height * qrMagnification / 2);
        } else {
          element.renderWidth = img.width;
          element.renderHeight = img.height;
        }
      } else {
        // Linear barcode: store bars image, render text separately
        const bfLinear = printInterp ? ZEBRA_FONTS[m] : undefined;
        const fontSize = printInterp ? (bfLinear ? bfLinear.height : m * 6 + 1) : 0;
        const textMargin = printInterp ? (bfLinear ? bfLinear.margin : m * 3 - 1) : 0;
        const textAreaH = printInterp ? fontSize + textMargin : 0;

        const interpText = element.text.toString();
        const useBfLinear = bfLinear && interpText.split('').every((c: string) => bfLinear.chars[c]);

        // Per-type centering correction: text centered over barW + extra, not imgW
        const centerExtraMap: {[type: string]: {[mw: number]: number}} = {
          code93:           {3: 4, 4: 9, 5: 9},
          interleaved2of5:  {3: 6, 4: 8, 5: 10},
        };
        const centerExtra = centerExtraMap[element.codeType]?.[m] || 0;

        element._linearBwip = {
          barsImg: img,
          fontSize,
          textMargin,
          textAreaH,
          printAbove: !!element.printAbove,
          bf: useBfLinear ? bfLinear : undefined,
          interpText,
          centerExtra,
        };
        element.image = null;
        element.renderWidth = img.width;
        element.renderHeight = heightDots + textAreaH;
      }
    } catch (err) {
      element.renderWidth = (element.text ? element.text.length : 1) * m * 10;
      element.renderHeight = heightDots;
      element.image = null;
    }
  }

  draw(ctx: any, element: any): void {
    if (element._code39) {
      this.drawCode39(ctx, element);
      return;
    }
    if (element._code128) {
      element._code39 = {
        ...element._code128,
        encoded: element._code128.text,
        bf: element._code128.bf128,
        useSideBearings: false,
      };
      this.drawCode39(ctx, element);
      return;
    }
    if (element._ean13) {
      this.drawEAN13(ctx, element);
      return;
    }
    if (element._linearBwip) {
      this.drawLinearBwip(ctx, element);
      return;
    }
    // 2D codes (QR, DataMatrix, MaxiCode, PDF417 with image)
    const { x, y, image, orientation } = element;
    if (!image) return;

    const w = element.renderWidth;
    const h = element.renderHeight;
    const orient = orientation || "N";
    const isBaseline = element.originType === "baseline";

    ctx.save();
    // Disable interpolation for pixel-perfect barcode scaling
    ctx.imageSmoothingEnabled = false;
    if (orient === "N") {
      const dy = isBaseline ? y - h : y;
      ctx.drawImage(image, x, dy, w, h);
    } else {
      // Scale image to render size first, then rotate pixels
      const tmpCanvas = createCanvas(w, h);
      const tmpCtx = tmpCanvas.getContext("2d");
      tmpCtx.imageSmoothingEnabled = false;
      tmpCtx.drawImage(image, 0, 0, w, h);
      const rotated = rotateCanvas(tmpCanvas, orient);
      // ^FT baseline: anchor at "base of barcode" rotates with content
      // N: bottom-left → shift up (handled above: elY -= totalH)
      // R: rotates to top-left → no offset
      // I: rotates to top-right → shift left by width
      // B: rotates to bottom-right → shift left AND up
      const dx = isBaseline ? (orient === "I" || orient === "B" ? -rotated.width : 0) : 0;
      const dy = isBaseline ? (orient === "B" ? -rotated.height : 0) : 0;
      ctx.drawImage(rotated, x + dx, y + dy);
    }
    ctx.restore();
  }

  private drawCode39(ctx: any, element: any): void {
    let { x: elX, y: elY, orientation } = element;
    const { bars, width, encoded, fontSize, textMargin, textAreaH, printAbove } =
      element._code39;
    const heightDots = element.height || 50;
    const orient = orientation || "N";
    const totalH = heightDots + textAreaH;
    const isBaseline = element.originType === "baseline";

    if (orient === "N") {
      if (isBaseline) elY -= totalH;
      const barY = elY + (printAbove && fontSize ? textAreaH : 0);
      ctx.fillStyle = "black";
      for (const bar of bars) {
        ctx.fillRect(elX + bar.x, barY, bar.w, heightDots);
      }
      if (fontSize > 0) {
        // Try raw grayscale glyph rendering, fallback to canvas font
        const bf39 = element._code39.bf;
        let drawn = false;
        if (bf39) {
          const textY = printAbove ? elY : barY + heightDots + bf39.margin;
          const useSB = element._code39.useSideBearings !== false;
          let binTotalW = 0;
          if (useSB) {
            // Side bearings: advance = bw + rb + lb(next)
            for (let ci = 0; ci < encoded.length; ci++) {
              const g = bf39.chars[encoded[ci]];
              const nextG = ci < encoded.length - 1 ? bf39.chars[encoded[ci + 1]] : null;
              binTotalW += nextG ? g.bw + g.rb + nextG.lb : g.bw;
            }
          } else {
            // Legacy advance for Code 128 etc.
            for (let ci = 0; ci < encoded.length; ci++) {
              const g = bf39.chars[encoded[ci]];
              binTotalW += (ci < encoded.length - 1) ? g.a : g.bw;
            }
          }
          const narrow = element.moduleWidth || 2;
          const trailing = element._code39.trailingNarrow !== undefined
            ? element._code39.trailingNarrow : narrow;
          const centerW = useSB ? width + trailing : width;
          let bx = elX + (centerW - binTotalW) / 2;
          for (let ci = 0; ci < encoded.length; ci++) {
            const g = bf39.chars[encoded[ci]];
            drawGrayGlyph(ctx, g, Math.round(bx) - g.dx, textY, bf39.height, width);
            if (useSB) {
              const nextG = ci < encoded.length - 1 ? bf39.chars[encoded[ci + 1]] : null;
              bx += nextG ? g.bw + g.rb + nextG.lb : g.bw;
            } else {
              bx += g.a;
            }
          }
          drawn = true;
        }
        if (!drawn) {
          ctx.save();
          ctx.fillStyle = "black";
          ctx.font = `${fontSize}px 'DejaVu Sans Mono'`;
          const m = ctx.measureText(encoded);
          ctx.fillText(encoded, elX + (width - m.width) / 2,
            printAbove ? elY + fontSize : barY + heightDots + textMargin + fontSize - 2);
          ctx.restore();
        }
      }
    } else {
      // Rotated: compose to temp canvas in normal orientation, then rotate pixels
      // Canvas must be wide enough for both bars AND interpretation text
      let canvasW = width;
      let barOffsetX = 0;
      if (fontSize > 0) {
        const mc = createCanvas(1, 1).getContext("2d");
        mc.font = `${fontSize}px 'DejaVu Sans Mono'`;
        const textW = mc.measureText(encoded).width;
        if (textW > width) {
          canvasW = Math.ceil(textW) + 4;
          barOffsetX = Math.floor((canvasW - width) / 2);
        }
      }
      const tmpCanvas = createCanvas(canvasW, totalH);
      const tmpCtx = tmpCanvas.getContext("2d");
      const barY = printAbove && fontSize ? textAreaH : 0;
      tmpCtx.fillStyle = "black";
      for (const bar of bars) {
        tmpCtx.fillRect(barOffsetX + bar.x, barY, bar.w, heightDots);
      }
      if (fontSize > 0) {
        const bf39 = element._code39.bf;
        if (bf39) {
          // Bitmap font rendering on temp canvas (same as Normal path)
          const textY = printAbove ? 0 : barY + heightDots + bf39.margin;
          const useSB = element._code39.useSideBearings !== false;
          let binTotalW = 0;
          if (useSB) {
            for (let ci = 0; ci < encoded.length; ci++) {
              const g = bf39.chars[encoded[ci]];
              const nextG = ci < encoded.length - 1 ? bf39.chars[encoded[ci + 1]] : null;
              binTotalW += nextG ? g.bw + g.rb + nextG.lb : g.bw;
            }
          } else {
            for (let ci = 0; ci < encoded.length; ci++) {
              const g = bf39.chars[encoded[ci]];
              binTotalW += (ci < encoded.length - 1) ? g.a : g.bw;
            }
          }
          const narrow = element.moduleWidth || 2;
          const trailing = element._code39.trailingNarrow !== undefined
            ? element._code39.trailingNarrow : narrow;
          const centerW = useSB ? width + trailing : width;
          let bx = barOffsetX + (centerW - binTotalW) / 2;
          for (let ci = 0; ci < encoded.length; ci++) {
            const g = bf39.chars[encoded[ci]];
            drawGrayGlyph(tmpCtx, g, Math.round(bx) - g.dx, textY, bf39.height, canvasW);
            if (useSB) {
              const nextG = ci < encoded.length - 1 ? bf39.chars[encoded[ci + 1]] : null;
              bx += nextG ? g.bw + g.rb + nextG.lb : g.bw;
            } else {
              bx += g.a;
            }
          }
        } else {
          tmpCtx.fillStyle = "black";
          tmpCtx.font = `${fontSize}px 'DejaVu Sans Mono'`;
          const m = tmpCtx.measureText(encoded);
          tmpCtx.fillText(encoded, (canvasW - m.width) / 2,
            printAbove ? fontSize : barY + heightDots + textMargin + fontSize - 2);
        }
      }
      // Pixel-perfect rotation (avoids text mirroring from canvas transforms)
      const rotated = rotateCanvas(tmpCanvas, orient);
      // ^FT baseline: anchor at "base of barcode" rotates with content
      // N: bottom-left → shift up (handled above: elY -= totalH)
      // R: rotates to top-left → no offset
      // I: rotates to top-right → shift left by width
      // B: rotates to bottom-right → shift left AND up
      const dx = isBaseline ? (orient === "I" || orient === "B" ? -rotated.width : 0) : 0;
      const dy = isBaseline ? (orient === "B" ? -rotated.height : 0) : 0;
      // Compensate for barOffsetX: after rotation the offset maps to different axes
      let drawX = elX + dx;
      let drawY = elY + dy;
      if (barOffsetX > 0) {
        if (orient === "N" || orient === "I") drawX -= barOffsetX;
        else if (orient === "R") drawY -= barOffsetX;
        else if (orient === "B") drawY += barOffsetX;
      }
      ctx.drawImage(rotated, drawX, drawY);
    }
  }

  private drawEAN13(ctx: any, element: any): void {
    let { x: elX, y: elY, orientation } = element;
    const { bars, totalBarWidth, digits, fontSize, guardExt, textMargin, m } =
      element._ean13;
    const heightDots = element.height || 50;
    const orient = orientation || "N";
    const isBaseline = element.originType === "baseline";
    const textAreaH = fontSize > 0 ? Math.max(guardExt, textMargin + fontSize) : guardExt;
    const totalH = heightDots + textAreaH;

    if (orient !== "N") {
      const tmpCanvas = createCanvas(totalBarWidth, totalH);
      const tmpCtx = tmpCanvas.getContext("2d");
      tmpCtx.fillStyle = "black";
      for (const bar of bars) {
        tmpCtx.fillRect(bar.x, 0, bar.w, bar.h);
      }
      if (fontSize > 0) {
        // Text at dataBarBottom + margin (heightDots + textMargin from top)
        this.drawEAN13Text(tmpCtx, 0, heightDots + textMargin, digits, m, fontSize);
      }
      const rotated = rotateCanvas(tmpCanvas, orient);
      // ^FT baseline: anchor at "base of barcode" rotates with content
      // N: bottom-left → shift up (handled above: elY -= totalH)
      // R: rotates to top-left → no offset
      // I: rotates to top-right → shift left by width
      // B: rotates to bottom-right → shift left AND up
      const dx = isBaseline ? (orient === "I" || orient === "B" ? -rotated.width : 0) : 0;
      const dy = isBaseline ? (orient === "B" ? -rotated.height : 0) : 0;
      ctx.drawImage(rotated, elX + dx, elY + dy);
      return;
    }

    if (isBaseline) elY -= totalH;

    ctx.fillStyle = "black";
    for (const bar of bars) {
      ctx.fillRect(elX + bar.x, elY, bar.w, bar.h);
    }

    if (fontSize > 0) {
      // Text at dataBarBottom + margin
      this.drawEAN13Text(ctx, elX, elY + heightDots + textMargin, digits, m, fontSize);
    }
  }

  /**
   * Draw EAN-13 text: first digit to the left, 6 digits under left half, 6 under right half.
   */
  private drawEAN13Text(
    ctx: any, barX: number, textY: number, digits: string, m: number, fontSize: number
  ): void {
    const bf = ZEBRA_FONTS[m];
    const allInBf = bf && digits.split('').every((c: string) => bf.chars[c]);

    if (allInBf && bf) {
      // Bitmap font: position each digit centered in its 7-module slot
      const slotW = 7 * m;

      // First digit to the left of start guard
      const g0 = bf.chars[digits[0]];
      drawGrayGlyph(ctx, g0, barX - m - g0.bw - g0.dx, textY, bf.height, g0.w);

      // Left 6 digits
      for (let i = 0; i < 6; i++) {
        const g = bf.chars[digits[i + 1]];
        const slotX = barX + (3 + i * 7) * m;
        const cx = slotX + Math.round((slotW - g.bw) / 2);
        drawGrayGlyph(ctx, g, cx - g.dx, textY, bf.height, g.w);
      }

      // Right 6 digits
      for (let i = 0; i < 6; i++) {
        const g = bf.chars[digits[i + 7]];
        const slotX = barX + (50 + i * 7) * m;
        const cx = slotX + Math.round((slotW - g.bw) / 2);
        drawGrayGlyph(ctx, g, cx - g.dx, textY, bf.height, g.w);
      }
    } else {
      // Canvas font fallback (BY1/BY2 where no bitmap font exists)
      ctx.save();
      ctx.fillStyle = "black";
      ctx.font = `${fontSize}px 'DejaVu Sans Mono'`;
      ctx.textBaseline = "top";
      ctx.textAlign = "center";

      const digitW = ctx.measureText("0").width;
      ctx.fillText(digits[0], barX - digitW / 2 - m, textY);

      for (let i = 0; i < 6; i++) {
        const cx = barX + (3 + i * 7 + 3.5) * m;
        ctx.fillText(digits[i + 1], cx, textY);
      }

      for (let i = 0; i < 6; i++) {
        const cx = barX + (50 + i * 7 + 3.5) * m;
        ctx.fillText(digits[i + 7], cx, textY);
      }

      ctx.restore();
    }
  }

  private drawLinearBwip(ctx: any, element: any): void {
    let { x: elX, y: elY, orientation } = element;
    const { barsImg, fontSize, textMargin, textAreaH, printAbove, bf, interpText, centerExtra } =
      element._linearBwip;
    const heightDots = element.height || 50;
    const imgW = barsImg.width;
    const orient = orientation || "N";
    const isBaseline = element.originType === "baseline";
    const text = interpText || element.text;
    // ^FT baseline for N orientation: shift up by total height
    if (isBaseline && orient === "N") {
      elY -= heightDots + textAreaH;
    }

    if (orient !== "N") {
      // Rotated: compose to temp canvas then apply ZPL rotation
      ctx.save();
      const totalH = heightDots + (fontSize > 0 ? textAreaH : 0);
      const tmpCanvas = createCanvas(imgW, totalH);
      const tmpCtx = tmpCanvas.getContext("2d");
      const barY = printAbove && fontSize ? textAreaH : 0;
      tmpCtx.drawImage(barsImg, 0, barY, imgW, heightDots);
      if (fontSize > 0) {
        if (bf) {
          // Bitmap font rendering on temp canvas (same as Normal path)
          const textY = printAbove ? 0 : barY + heightDots + bf.margin;
          let binTotalW = 0;
          for (let ci = 0; ci < text.length; ci++) {
            const g = bf.chars[text[ci]];
            const nextG = ci < text.length - 1 ? bf.chars[text[ci + 1]] : null;
            binTotalW += nextG ? g.bw + g.rb + nextG.lb : g.bw;
          }
          const centerW = imgW + (centerExtra || 0);
          let bx = (centerW - binTotalW) / 2;
          for (let ci = 0; ci < text.length; ci++) {
            const g = bf.chars[text[ci]];
            const nextG = ci < text.length - 1 ? bf.chars[text[ci + 1]] : null;
            drawGrayGlyph(tmpCtx, g, Math.round(bx) - g.dx, textY, bf.height, imgW);
            bx += nextG ? g.bw + g.rb + nextG.lb : g.bw;
          }
        } else {
          tmpCtx.fillStyle = "black";
          tmpCtx.font = `${fontSize}px 'DejaVu Sans Mono'`;
          const tm = tmpCtx.measureText(text);
          tmpCtx.fillText(
            text,
            (imgW - tm.width) / 2,
            printAbove
              ? fontSize
              : barY + heightDots + textMargin + fontSize - 2
          );
        }
      }
      const rotated = rotateCanvas(tmpCanvas, orient);
      // ^FT baseline: anchor at "base of barcode" rotates with content
      // N: bottom-left → shift up (handled above: elY -= totalH)
      // R: rotates to top-left → no offset
      // I: rotates to top-right → shift left by width
      // B: rotates to bottom-right → shift left AND up
      const dx = isBaseline ? (orient === "I" || orient === "B" ? -rotated.width : 0) : 0;
      const dy = isBaseline ? (orient === "B" ? -rotated.height : 0) : 0;
      ctx.drawImage(rotated, elX + dx, elY + dy);
      ctx.restore();
      return;
    }

    // Normal orientation
    const barY = elY + (printAbove && fontSize ? textAreaH : 0);
    ctx.drawImage(barsImg, 0, 0, barsImg.width, barsImg.height,
      elX, barY, imgW, heightDots);

    if (fontSize > 0) {
      if (bf) {
        // Bitmap font rendering (pixel-perfect Zebra glyphs)
        const textY = printAbove ? elY : barY + heightDots + bf.margin;
        // Use side bearings model: advance = bw + rb + next.lb
        let binTotalW = 0;
        for (let ci = 0; ci < text.length; ci++) {
          const g = bf.chars[text[ci]];
          const nextG = ci < text.length - 1 ? bf.chars[text[ci + 1]] : null;
          binTotalW += nextG ? g.bw + g.rb + nextG.lb : g.bw;
        }
        const centerW = imgW + (centerExtra || 0);
        let bx = elX + (centerW - binTotalW) / 2;
        for (let ci = 0; ci < text.length; ci++) {
          const g = bf.chars[text[ci]];
          const nextG = ci < text.length - 1 ? bf.chars[text[ci + 1]] : null;
          drawGrayGlyph(ctx, g, Math.round(bx) - g.dx, textY, bf.height, imgW);
          bx += nextG ? g.bw + g.rb + nextG.lb : g.bw;
        }
      } else {
        // Canvas font fallback at correct size
        ctx.save();
        ctx.fillStyle = "black";
        ctx.font = `${fontSize}px 'DejaVu Sans Mono'`;
        const metrics = ctx.measureText(text);
        const tx = elX + (imgW - metrics.width) / 2;
        ctx.fillText(
          text,
          tx,
          printAbove ? elY + fontSize : barY + heightDots + textMargin + fontSize - 2
        );
        ctx.restore();
      }
    }
  }
}

export default BarcodeDrawer;
