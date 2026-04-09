import { createCanvas } from "../canvas";
import BaseDrawer from "./BaseDrawer";
import bwipjs from "@bwip-js/node";
import { decodePng } from "../utils";
import { ensureFont } from "../font";

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

  const fontSize = printInterp ? Math.max(8, Math.round(heightDots * 0.22)) : 0;
  const textMargin = printInterp ? 6 : 0;
  const textAreaH = printInterp ? fontSize + textMargin : 0;

  element._code39 = {
    bars, width, encoded, fontSize, textMargin, textAreaH,
    printAbove: !!printAbove,
  };
  element.image = null;
  element.renderWidth = width;
  element.renderHeight = heightDots + textAreaH;
}

/**
 * Apply ZPL rotation transform on canvas context.
 * ZPL rotation semantics (from ^FO origin):
 *  N: right and down
 *  R: down and right (axes swapped)
 *  I: left and up (both negated)
 *  B: down and left (swap + negate x)
 */
function applyZplRotation(ctx: any, orient: string): void {
  if (orient === "R") ctx.transform(0, 1, 1, 0, 0, 0);
  else if (orient === "I") ctx.transform(-1, 0, 0, -1, 0, 0);
  else if (orient === "B") ctx.transform(0, 1, -1, 0, 0, 0);
}

class BarcodeDrawer extends BaseDrawer {
  async prepare(element: any): Promise<void> {
    ensureFont();

    // Code 39: direct bar calculation (pixel-perfect)
    if (element.codeType === "code39") {
      try {
        prepareCode39(element);
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
      opts.scale = m;
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

    // Code93 specifics
    if (element.codeType === "code93") {
      opts.includestartstop = false;
      opts.includecheck = false;
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
        const fontSize = printInterp ? Math.max(8, Math.round(heightDots * 0.22)) : 0;
        const textMargin = printInterp ? 6 : 0;
        const textAreaH = printInterp ? fontSize + textMargin : 0;

        element._linearBwip = {
          barsImg: img,
          fontSize,
          textMargin,
          textAreaH,
          printAbove: !!element.printAbove,
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
      ctx.translate(x, y);
      applyZplRotation(ctx, orient);
      const yOff = isBaseline ? -h : 0;
      ctx.drawImage(image, 0, yOff, w, h);
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
        ctx.save();
        ctx.fillStyle = "black";
        ctx.font = `${fontSize}px 'DejaVu Sans Mono'`;
        const m = ctx.measureText(encoded);
        ctx.fillText(
          encoded,
          elX + (width - m.width) / 2,
          printAbove
            ? elY + fontSize
            : barY + heightDots + textMargin + fontSize - 2
        );
        ctx.restore();
      }
    } else {
      // Rotated: compose to temp canvas, then apply ZPL rotation
      // ZPL rotation is a transpose (swap x/y), but text placement
      // must be flipped: for R/B, text goes to "above" side on temp canvas
      // so it ends up on the correct side after transpose.
      const flipText = (orient === "R" || orient === "B");
      const textOnTop = flipText ? !printAbove : !!printAbove;

      const tmpCanvas = createCanvas(width, totalH);
      const tmpCtx = tmpCanvas.getContext("2d");
      // Transparent background - don't paint white over existing elements
      const barY = textOnTop && fontSize ? textAreaH : 0;
      tmpCtx.fillStyle = "black";
      for (const bar of bars) {
        tmpCtx.fillRect(bar.x, barY, bar.w, heightDots);
      }
      if (fontSize > 0) {
        tmpCtx.fillStyle = "black";
        tmpCtx.font = `${fontSize}px 'DejaVu Sans Mono'`;
        const m = tmpCtx.measureText(encoded);
        tmpCtx.fillText(
          encoded,
          (width - m.width) / 2,
          textOnTop
            ? fontSize
            : barY + heightDots + textMargin + fontSize - 2
        );
      }
      // Apply ZPL rotation (transpose-based transform)
      ctx.save();
      ctx.translate(elX, elY);
      applyZplRotation(ctx, orient);
      const yOff = isBaseline ? -totalH : 0;
      ctx.drawImage(tmpCanvas, 0, yOff);
      ctx.restore();
    }
  }

  private drawLinearBwip(ctx: any, element: any): void {
    let { x: elX, y: elY, orientation } = element;
    const { barsImg, fontSize, textMargin, textAreaH, printAbove } =
      element._linearBwip;
    const heightDots = element.height || 50;
    const imgW = barsImg.width;
    const orient = orientation || "N";
    const isBaseline = element.originType === "baseline";
    // ^FT baseline for N orientation: shift up by total height
    if (isBaseline && orient === "N") {
      elY -= heightDots + textAreaH;
    }

    if (orient !== "N") {
      // Rotated: compose to temp canvas then apply ZPL rotation
      ctx.save();
      const totalH = heightDots + (fontSize > 0 ? textAreaH : 0);
      // For R/B, flip text position so it ends up on correct side after transform
      const flipText = (orient === "R" || orient === "B");
      const textOnTop = flipText ? !printAbove : !!printAbove;

      const tmpCanvas = createCanvas(imgW, totalH);
      const tmpCtx = tmpCanvas.getContext("2d");
      const barY = textOnTop && fontSize ? textAreaH : 0;
      // Draw bars stretched to heightDots
      tmpCtx.drawImage(barsImg, 0, barY, imgW, heightDots);
      if (fontSize > 0) {
        tmpCtx.fillStyle = "black";
        tmpCtx.font = `${fontSize}px 'DejaVu Sans Mono'`;
        const m = tmpCtx.measureText(element.text);
        tmpCtx.fillText(
          element.text,
          (imgW - m.width) / 2,
          textOnTop
            ? fontSize
            : barY + heightDots + textMargin + fontSize - 2
        );
      }
      ctx.translate(elX, elY);
      applyZplRotation(ctx, orient);
      // ^FT baseline: shift in rotated coordinate space
      const yOff = isBaseline ? -totalH : 0;
      ctx.drawImage(tmpCanvas, 0, yOff);
      ctx.restore();
      return;
    }

    // Normal orientation
    const barY = elY + (printAbove && fontSize ? textAreaH : 0);
    ctx.drawImage(barsImg, 0, 0, barsImg.width, barsImg.height,
      elX, barY, imgW, heightDots);

    if (fontSize > 0) {
      ctx.save();
      ctx.fillStyle = "black";
      ctx.font = `${fontSize}px 'DejaVu Sans Mono'`;
      const metrics = ctx.measureText(element.text);
      const tx = elX + (imgW - metrics.width) / 2;
      ctx.fillText(
        element.text,
        tx,
        barY + heightDots + textMargin + fontSize - 2
      );
      ctx.restore();
    }
  }
}

export default BarcodeDrawer;
