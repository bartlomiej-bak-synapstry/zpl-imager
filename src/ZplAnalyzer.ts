import VirtualPrinter from "./VirtualPrinter";

/**
 * Splits a raw ZPL string into individual commands.  Commands are
 * delimited by either a caret (^) or tilde (~) at the start of each
 * command.  Vertical whitespace is stripped out to mirror the
 * behaviour of Zebra printers, which ignore newlines.
 *
 * @param {string} zpl ZPL data containing zero or more commands
 * @returns {string[]} Array of commands including their leading ^ or ~
 */
export function splitZplCommands(zpl) {
  if (!zpl || typeof zpl !== "string") {
    return [];
  }
  // remove vertical whitespace characters
  const clean = zpl.replace(/[\n\v\f\r]+/g, "");
  const commands = [];
  let buffer = "";
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === "^" || c === "~") {
      if (buffer.length > 0) {
        commands.push(buffer);
        buffer = "";
      }
    }
    buffer += c;
  }
  if (buffer.length > 0) {
    commands.push(buffer);
  }
  return commands;
}

/**
 * Parses a ZPL string and produces a list of label descriptions.  Each
 * label contains an array of element definitions that can later be
 * rendered into an image.  This parser intentionally supports only
 * a subset of the ZPL II command set – enough to cover common
 * scenarios such as drawing text, barcodes and boxes.  Unrecognised
 * commands are ignored.
 *
 * @param {string} zplString ZPL document consisting of one or more labels
 * @returns {Array<{elements: any[]}>} List of label objects with elements
 */
export function analyze(zplString) {
  const commands = splitZplCommands(zplString);
  const printer = new VirtualPrinter();
  const labels = [];
  let currentElements = [];

  const pushLabel = () => {
    if (currentElements.length > 0) {
      // copy the array to avoid accidental mutation
      labels.push({ elements: currentElements.slice() });
    } else {
      labels.push({ elements: [] });
    }
    currentElements = [];
    printer.clearPendingBarcode();
    printer.clearNextPosition();
  };

  for (let rawCmd of commands) {
    const cmd = rawCmd.trim();
    if (cmd.length < 2) {
      continue;
    }
    // Handle label start (^XA) and end (^XZ)
    if (/^\^XA/i.test(cmd)) {
      // start new label; reset state
      printer.reset();
      currentElements = [];
      continue;
    }
    if (/^\^XZ/i.test(cmd)) {
      pushLabel();
      continue;
    }
    // Determine the command prefix (two characters after ^ or ~)
    const prefix = cmd.substring(1, 3).toUpperCase();
    switch (prefix) {
      case "FO": {
        // Field Origin – origin at top‑left of field
        const paramString = cmd.substring(3);
        const parts = paramString.split(",");
        const x = parseInt(parts[0], 10) || 0;
        const y = parseInt(parts[1], 10) || 0;
        const bottom =
          parts.length > 2 ? parts[2].trim().toUpperCase() === "B" : false;
        printer.setNextPosition(
          printer.labelHome.x + x,
          printer.labelHome.y + y,
          bottom,
          "top-left"
        );
        break;
      }
      case "FT": {
        // Field Text – origin at baseline of text
        const paramString = cmd.substring(3);
        const parts = paramString.split(",");
        const x = parseInt(parts[0], 10) || 0;
        const y = parseInt(parts[1], 10) || 0;
        const bottom =
          parts.length > 2 ? parts[2].trim().toUpperCase() === "B" : false;
        printer.setNextPosition(
          printer.labelHome.x + x,
          printer.labelHome.y + y,
          bottom,
          "baseline"
        );
        break;
      }
      case "LH": {
        // Label Home
        const paramString = cmd.substring(3);
        const parts = paramString.split(",");
        const x = parseInt(parts[0], 10) || 0;
        const y = parseInt(parts[1], 10) || 0;
        printer.setLabelHome(x, y);
        break;
      }
      case "BY": {
        // Barcode module defaults
        // ^BYw,r,h
        const paramString = cmd.substring(3);
        const parts = paramString.split(",");
        const moduleWidth = parseInt(parts[0], 10);
        const ratio = parts.length > 1 ? parseFloat(parts[1]) : undefined;
        const height = parts.length > 2 ? parseInt(parts[2], 10) : undefined;
        printer.setBarcodeDefaults(moduleWidth, ratio, height);
        break;
      }
      case "GB": {
        // Graphic Box
        // ^GBw,h,t,c,r (width, height, thickness, color, rounding)
        const paramString = cmd.substring(3);
        const parts = paramString.split(",");
        const w = parseInt(parts[0], 10) || 0;
        const h = parts.length > 1 ? parseInt(parts[1], 10) : 0;
        const t = parts.length > 2 ? parseInt(parts[2], 10) : 1;
        const c = parts.length > 3 ? parts[3].trim().toUpperCase() : "B";
        // create box element
        const pos = printer.nextPosition || { x: 0, y: 0 };
        currentElements.push({
          type: "box",
          x: pos.x,
          y: pos.y,
          width: w,
          height: h,
          thickness: t,
          color: c,
          reverse: printer.consumeReverseNext(),
        });
        printer.clearNextPosition();
        break;
      }
      case "FR": {
        // Field Reverse on/off.  Toggle reverse mode.
        // Mark the next element for reverse printing
        printer.setReverseNext();
        break;
      }
      case "CF": {
        // Change default font and size: ^CFa,h,w
        const paramString = cmd.substring(3);
        // Font designator may be absent; if omitted, defaults to previous
        const parts = paramString.split(",");
        // Example: ^CF0,60 -> font '0', height 60
        // If first part contains a letter or digit, treat as font designator.  If blank, leave font unchanged.
        let fontDesignator = null;
        if (parts[0] && parts[0].trim().length > 0) {
          fontDesignator = parts[0].trim().charAt(0);
        }
        // Height and width may follow
        let height;
        let width;
        if (parts.length > 1) {
          const h = parseInt(parts[1], 10);
          if (!isNaN(h)) {
            height = h;
          }
        }
        if (parts.length > 2) {
          const w = parseInt(parts[2], 10);
          if (!isNaN(w)) {
            width = w;
          }
        }
        // Apply font settings: orientation remains unchanged (default N)
        printer.setFont(
          fontDesignator || printer.fontName,
          printer.orientation || "N",
          height,
          width
        );
        break;
      }
      case "FW": {
        // Field orientation: ^FWo
        // Example: ^FWB sets default orientation to 270° for subsequent fields.
        const paramString = cmd.substring(3).trim();
        if (paramString && paramString.length > 0) {
          const o = paramString.charAt(0).toUpperCase();
          printer.setFieldOrientation(o);
        }
        break;
      }
      case "FB": {
        // Field Block: ^FBw,h,s,a,j
        // width, number of lines, line spacing, alignment, hanging indent
        const paramString = cmd.substring(3);
        const parts = paramString.split(",");
        const width = parts.length > 0 ? parseInt(parts[0], 10) : 0;
        const lines = parts.length > 1 ? parseInt(parts[1], 10) : 0;
        const spacing = parts.length > 2 ? parseInt(parts[2], 10) : 0;
        const align =
          parts.length > 3 && parts[3].trim().length > 0
            ? parts[3].trim().charAt(0).toUpperCase()
            : "L";
        const indent = parts.length > 4 ? parseInt(parts[4], 10) : 0;
        printer.setFieldBlock(width, lines, spacing, align, indent);
        break;
      }
      case "IM": {
        // Image recall: ^IMd:o.x,mx,my
        // Pull the graphic out of storage and queue an image element
        const paramString = cmd.substring(3);
        const parts = paramString.split(",");
        const fileSpec = parts[0] ? parts[0].trim() : "";
        const mx =
          parts.length > 1 && parts[1] !== undefined && parts[1] !== ""
            ? parseFloat(parts[1])
            : 1;
        const my =
          parts.length > 2 && parts[2] !== undefined && parts[2] !== ""
            ? parseFloat(parts[2])
            : 1;
        const pos = printer.nextPosition || {
          x: printer.labelHome.x,
          y: printer.labelHome.y,
        };
        const graphic = printer.getGraphic(fileSpec);
        currentElements.push({
          type: "image",
          x: pos.x,
          y: pos.y,
          scaleX: isNaN(mx) ? 1 : mx,
          scaleY: isNaN(my) ? 1 : my,
          reverse: printer.consumeReverseNext(),
          orientation: printer.fieldOrientation || "N",
          graphic: graphic || null,
        });
        printer.clearNextPosition();
        // Clear field block after image recall
        printer.clearFieldBlock();
        break;
      }
      case "DG": {
        // Download graphic: ~DGd:o.x,totalBytes,bytesPerRow,data
        // When prefixed with ~, the command begins with "~DG"; prefix here is DG
        // Extract the data after the command
        const paramString = cmd.substring(3);
        // name,total,bytesPerRow,data
        // We split only on the first three commas; the remainder is the data which may contain commas
        const first = paramString.indexOf(",");
        const second = first >= 0 ? paramString.indexOf(",", first + 1) : -1;
        const third = second >= 0 ? paramString.indexOf(",", second + 1) : -1;
        if (first >= 0 && second >= 0 && third >= 0) {
          const name = paramString.substring(0, first).trim();
          const total =
            parseInt(paramString.substring(first + 1, second), 10) || 0;
          const bytesPerRow =
            parseInt(paramString.substring(second + 1, third), 10) || 0;
          const data = paramString.substring(third + 1);
          // Store raw graphic data.  The actual decoding is deferred to the image drawer.
          printer.saveGraphic(name, {
            totalBytes: total,
            bytesPerRow: bytesPerRow,
            dataString: data,
          });
        }
        break;
      }
      case "DY": {
        // Download PNG: ~DYd:o.x,f,b,x,t,w,data
        // Example: ~DYR:SAMPLE.PNG,P,P,1618,,89504E47...
        const paramString = cmd.substring(3);
        const parts = paramString.split(",");
        if (parts.length >= 6) {
          const name = parts[0].trim();
          // f,b,x,t,w are ignored here; the last part is hex data
          // The data may include commas if empty strings appear before the last value
          const dataParts = parts.slice(5);
          const dataHex = dataParts.join(",");
          try {
            const buffer = Buffer.from(dataHex.trim(), "hex");
            printer.saveGraphic(name, { data: buffer, type: "png" });
          } catch (ex) {
            // ignore decode errors; store raw string
            printer.saveGraphic(name, { dataString: dataHex.trim() });
          }
        }
        break;
      }
      case "XG": {
        // Recall graphic: ^XGd:o.x,mx,my
        const paramString = cmd.substring(3);
        const parts = paramString.split(",");
        const fileSpec = parts[0] ? parts[0].trim() : "";
        const mx =
          parts.length > 1 && parts[1] !== undefined && parts[1] !== ""
            ? parseFloat(parts[1])
            : 1;
        const my =
          parts.length > 2 && parts[2] !== undefined && parts[2] !== ""
            ? parseFloat(parts[2])
            : 1;
        const pos = printer.nextPosition || {
          x: printer.labelHome.x,
          y: printer.labelHome.y,
        };
        const graphic = printer.getGraphic(fileSpec);
        currentElements.push({
          type: "image",
          x: pos.x,
          y: pos.y,
          scaleX: isNaN(mx) ? 1 : mx,
          scaleY: isNaN(my) ? 1 : my,
          reverse: printer.consumeReverseNext(),
          orientation: printer.fieldOrientation || "N",
          graphic: graphic || null,
        });
        printer.clearNextPosition();
        // Clear field block after image recall
        printer.clearFieldBlock();
        break;
      }
      case "GC": {
        // Graphic Circle: ^GCd,t,c,r
        const paramString = cmd.substring(3);
        const parts = paramString.split(",");
        const d = parseInt(parts[0], 10) || 0;
        const t = parts.length > 1 ? parseInt(parts[1], 10) : 0;
        const c = parts.length > 2 ? parts[2].trim().toUpperCase() : "B";
        const pos = printer.nextPosition || { x: 0, y: 0 };
        currentElements.push({
          type: "circle",
          x: pos.x,
          y: pos.y,
          diameter: d,
          thickness: t,
          color: c,
          reverse: printer.consumeReverseNext(),
        });
        printer.clearNextPosition();
        break;
      }
      case "GD": {
        // Graphic Diagonal Line: ^GDw,h,t,c
        const paramString = cmd.substring(3);
        const parts = paramString.split(",");
        const w = parseInt(parts[0], 10) || 0;
        const h = parts.length > 1 ? parseInt(parts[1], 10) : 0;
        const t = parts.length > 2 ? parseInt(parts[2], 10) : 1;
        const c = parts.length > 3 ? parts[3].trim().toUpperCase() : "B";
        const pos = printer.nextPosition || { x: 0, y: 0 };
        currentElements.push({
          type: "diagonal",
          x: pos.x,
          y: pos.y,
          width: w,
          height: h,
          thickness: t,
          color: c,
          reverse: printer.consumeReverseNext(),
        });
        printer.clearNextPosition();
        break;
      }
      case "FD": {
        // Field Data
        // Text or barcode data
        const text = cmd.substring(3);
        const pos = printer.nextPosition || {
          x: printer.labelHome.x,
          y: printer.labelHome.y,
        };
        // If a barcode command preceded, create barcode element
        if (printer.pendingBarcode) {
          const bc = printer.pendingBarcode;
          const element = {
            type: "barcode",
            x: pos.x,
            y: pos.y,
            codeType: bc.codeType,
            text: text,
            height: bc.height || printer.barcodeHeight,
            moduleWidth: bc.moduleWidth || printer.barcodeModuleWidth,
            ratio: bc.ratio || printer.barcodeRatio,
            options: bc.options || {},
            orientation: bc.orientation || "N",
            printInterpretation: bc.printInterpretation,
            printAbove: bc.printAbove,
          };
          currentElements.push(element);
          printer.clearPendingBarcode();
        } else {
          // Normal or field block text field.  Determine the coordinate origin type from the
          // next position.  When originType is 'top-left', the y value
          // specifies the top of the text; when 'baseline', the y value
          // specifies the baseline.  If not provided, assume 'top-left'.
          const font = printer.getFont();
          const originType =
            (printer.nextPosition && printer.nextPosition.originType) ||
            "top-left";
          const block = printer.fieldBlock;
          if (block) {
            /*
             * When a field block (^FB) is active the data may contain explicit
             * line breaks (encoded as "\&") and must also be wrapped to fit
             * within the specified block width.  Furthermore, if the caller
             * provides a maximum number of lines greater than the actual
             * number of wrapped lines the text should be vertically centred
             * within the block.  Zebra printers wrap words based on the
             * available width and break on spaces when possible.  The
             * algorithm here implements a simple approximation: it assumes
             * an average character width of 60% of the font height and
             * compresses the width for font '0' using the same scale
             * applied in the TextDrawer.  This yields a reasonable fit for
             * most test cases (e.g. test 27 where "Second line" wraps
             * into two lines when the block is narrow).  If there is no
             * whitespace in the text or a single word is longer than the
             * maximum width it will be placed on its own line.
             */
            // Split on explicit line breaks first
            const rawParts = text.split(/\\&/);
            const wrappedLines = [];
            const fontHeight = font.height || 10;
            // Estimate horizontal scale for font 0 (OCRA) as used in TextDrawer
            let scaleX = 1;
            if (font.name && font.name.toString().toUpperCase() === "0") {
              // Use the same default compression factor as TextDrawer
              scaleX = 0.65;
              if (
                font.width &&
                font.width > 0 &&
                font.height &&
                font.height > 0
              ) {
                scaleX = font.width / font.height;
              }
            }
            // Compute approximate character width in dots
            const charWidth = fontHeight * 0.6 * scaleX;
            const maxChars =
              block.width > 0
                ? Math.floor(block.width / (charWidth || 1))
                : Infinity;
            for (const raw of rawParts) {
              // Break the raw string into words and accumulate
              const words = raw.split(/\s+/);
              let line = "";
              for (let i = 0; i < words.length; i++) {
                const word = words[i];
                // Determine the prospective length if we add this word
                const prospective = line.length > 0 ? line + " " + word : word;
                if (
                  maxChars !== Infinity &&
                  prospective.length > maxChars &&
                  line.length > 0
                ) {
                  // Push the current line and start a new one
                  wrappedLines.push(line);
                  line = word;
                } else {
                  line = prospective;
                }
              }
              // Push any remaining text on the current line
              wrappedLines.push(line);
            }
            // Limit the number of lines to the block specification if provided
            const actualLineCount = wrappedLines.length;
            const maxLines =
              block.lines && block.lines > 0
                ? Math.min(block.lines, actualLineCount)
                : actualLineCount;
            // Compute vertical offset to centre the lines within the block if
            // the number of allowed lines exceeds the number of wrapped lines.
            let offsetY = 0;
            if (
              block.lines &&
              block.lines > 0 &&
              block.lines > actualLineCount
            ) {
              const totalHeight =
                actualLineCount * (fontHeight + block.lineSpacing) -
                block.lineSpacing;
              const availableHeight =
                block.lines * (fontHeight + block.lineSpacing) -
                block.lineSpacing;
              offsetY = Math.floor((availableHeight - totalHeight) / 2);
            }
            for (let i = 0; i < maxLines; i++) {
              const line = wrappedLines[i];
              // indent subsequent lines by the hanging indent
              const xOffset = i === 0 ? 0 : block.indent || 0;
              currentElements.push({
                type: "text",
                x: pos.x + xOffset,
                y: pos.y + offsetY + i * (fontHeight + block.lineSpacing),
                text: line,
                height: fontHeight,
                width: font.width,
                fontName: font.name,
                orientation: font.orientation,
                originType: originType,
                blockWidth: block.width,
                blockAlign: block.align,
              });
            }
            // Clear the field block once used
            printer.clearFieldBlock();
          } else {
            currentElements.push({
              type: "text",
              x: pos.x,
              y: pos.y,
              text: text,
              height: font.height,
              width: font.width,
              fontName: font.name,
              orientation: font.orientation,
              originType: originType,
            });
          }
        }
        printer.clearNextPosition();
        break;
      }
      case "FS": {
        // Field Separator
        // Clear any pending state; in this implementation we just clear the position
        printer.clearNextPosition();
        printer.clearPendingBarcode();
        break;
      }
      default: {
        // Handle barcode and font commands.  Barcode commands start with 'B'; font commands start with 'A'.
        if (prefix[0] === "B") {
          // Determine barcode type based on the second character
          const second = prefix[1];
          // Extract the substring after the two-character prefix (e.g. "B3").
          // The command begins with a caret (^) and two characters that
          // denote the command (e.g. 'B3').  Characters after these three
          // positions (index 3) contain the orientation and other
          // parameters.  Using substring(3) avoids leaving the designator
          // character in the parameter list, which previously caused
          // offsets (e.g. treating '3' as part of the first parameter).
          let afterPrefix = cmd.substring(3);
          // Determine orientation.  If the first non-comma character is in N,R,I,B, use it.
          let orientation = "N";
          let restParams = afterPrefix;
          // Skip any leading commas
          while (restParams.startsWith(",")) {
            restParams = restParams.substring(1);
          }
          if (/^[NRIB]/i.test(restParams.charAt(0))) {
            orientation = restParams.charAt(0).toUpperCase();
            restParams = restParams.substring(1);
            if (restParams.startsWith(",")) {
              restParams = restParams.substring(1);
            }
          }
          // Split remaining parameters on commas.  Empty strings are preserved to maintain positional meaning.
          const params = restParams.length > 0 ? restParams.split(",") : [];
          // Helper to parse integer parameters safely
          const parseIntSafe = (val) => {
            const n = parseInt(val, 10);
            return isNaN(n) ? undefined : n;
          };
          // Default spec object for linear barcodes
          const spec = {
            codeType: undefined,
            orientation: orientation,
            height: printer.barcodeHeight,
            moduleWidth: printer.barcodeModuleWidth,
            ratio: printer.barcodeRatio,
            options: {},
          };
          // Determine the code type and parse code‑specific parameters
          switch (second) {
            case "C":
              // Code 128 (^BC).  Params: height, printInterpretation (Y/N), printAbove (Y/N), mode
              spec.codeType = "code128";
              if (params.length > 0) {
                const h = parseIntSafe(params[0]);
                if (h !== undefined) spec.height = h;
              }
              // print interpretation line (default true if omitted)
              let pi = true;
              if (params.length > 1) {
                pi = /[Yy]/.test(params[1]);
              }
              spec.printInterpretation = pi;
              let pa = false;
              if (params.length > 2) {
                pa = /[Yy]/.test(params[2]);
              }
              spec.printAbove = pa;
              // Mode (automatic, etc.) is ignored for now (params[3])
              break;
            case "3":
              // Code 39 (^B3).  Params: checkDigit (ignored), height, printInterpretation, printAbove
              spec.codeType = "code39";
              if (params.length > 1) {
                const h = parseIntSafe(params[1]);
                if (h !== undefined) spec.height = h;
              }
              {
                // print interpretation
                let pi39 = true;
                if (params.length > 2) {
                  pi39 = /[Yy]/.test(params[2]);
                }
                spec.printInterpretation = pi39;
                let pa39 = false;
                if (params.length > 3) {
                  pa39 = /[Yy]/.test(params[3]);
                }
                spec.printAbove = pa39;
              }
              break;
            case "E":
            case "8":
              // EAN-13 (^BE or ^B8).  Params: height, printInterpretation, printAbove
              spec.codeType = "ean13";
              if (params.length > 0) {
                const h = parseIntSafe(params[0]);
                if (h !== undefined) spec.height = h;
              }
              {
                let piE = true;
                if (params.length > 1) {
                  piE = /[Yy]/.test(params[1]);
                }
                spec.printInterpretation = piE;
                let paE = false;
                if (params.length > 2) {
                  paE = /[Yy]/.test(params[2]);
                }
                spec.printAbove = paE;
              }
              break;
            case "9":
            case "A":
              // Code 93 (^B9 or ^BA).  Params: height, printInterpretation, printAbove
              spec.codeType = "code93";
              if (params.length > 0) {
                const h = parseIntSafe(params[0]);
                if (h !== undefined) spec.height = h;
              }
              {
                let pi93 = true;
                if (params.length > 1) {
                  pi93 = /[Yy]/.test(params[1]);
                }
                spec.printInterpretation = pi93;
                let pa93 = false;
                if (params.length > 2) {
                  pa93 = /[Yy]/.test(params[2]);
                }
                spec.printAbove = pa93;
              }
              break;
            case "2":
              // Interleaved 2 of 5 (^B2).  Params: height, printInterpretation, printAbove
              spec.codeType = "interleaved2of5";
              if (params.length > 0) {
                const h = parseIntSafe(params[0]);
                if (h !== undefined) spec.height = h;
              }
              {
                let pi2 = true;
                if (params.length > 1) {
                  pi2 = /[Yy]/.test(params[1]);
                }
                spec.printInterpretation = pi2;
                let pa2 = false;
                if (params.length > 2) {
                  pa2 = /[Yy]/.test(params[2]);
                }
                spec.printAbove = pa2;
              }
              break;
            case "Q":
              // QR Code (^BQ).  Params: magnification, error correction level, mask
              spec.codeType = "qrcode";
              // The module size (scale) is first parameter
              if (params.length > 0) {
                const mag = parseIntSafe(params[0]);
                if (mag !== undefined) {
                  spec.options.scale = mag;
                }
              }
              // error correction level (L,M,Q,H)
              if (params.length > 1 && params[1]) {
                spec.options.ecclevel = params[1].trim().toUpperCase();
              }
              // QR codes are matrix symbologies so they do not display interpretation lines
              spec.printInterpretation = false;
              spec.printAbove = false;
              break;
            case "X":
              // Data Matrix (^BX).  Params: height? Actually ^BX indicates scale and error correction; we map to datamatrix
              spec.codeType = "datamatrix";
              // For Data Matrix, scale or module width can be specified as the first parameter
              if (params.length > 0) {
                const scale = parseIntSafe(params[0]);
                if (scale !== undefined) {
                  spec.options.scale = scale;
                }
              }
              spec.printInterpretation = false;
              spec.printAbove = false;
              break;
            case "7":
              // PDF417 (^B7).  Params: module width, security level, columns, rows, row height, truncated flag
              spec.codeType = "pdf417";
              // Default: do not display interpretation line for PDF417
              spec.printInterpretation = false;
              spec.printAbove = false;
              if (params.length > 0) {
                const w = parseIntSafe(params[0]);
                if (w !== undefined) spec.moduleWidth = w;
              }
              if (params.length > 1) {
                const sec = parseIntSafe(params[1]);
                if (sec !== undefined) spec.options.securitylevel = sec;
              }
              if (params.length > 2) {
                const cols = parseIntSafe(params[2]);
                if (cols !== undefined) spec.options.columns = cols;
              }
              if (params.length > 3) {
                const rows = parseIntSafe(params[3]);
                if (rows !== undefined) spec.options.rows = rows;
              }
              if (params.length > 4) {
                const rh = parseIntSafe(params[4]);
                if (rh !== undefined) spec.options.rowheight = rh;
              }
              if (params.length > 5) {
                // Truncated flag (Y/N)
                spec.options.truncated = /[Yy]/.test(params[5]);
              }
              break;
            case "D":
              // Some printers use ^BD for Code 128; treat as Code 128
              spec.codeType = "code128";
              if (params.length > 0) {
                const h = parseIntSafe(params[0]);
                if (h !== undefined) spec.height = h;
              }
              {
                let piD = true;
                if (params.length > 1) {
                  piD = /[Yy]/.test(params[1]);
                }
                spec.printInterpretation = piD;
                let paD = false;
                if (params.length > 2) {
                  paD = /[Yy]/.test(params[2]);
                }
                spec.printAbove = paD;
              }
              break;
            default:
              // Unknown barcode type; do nothing
              break;
          }
          // If a valid code type was identified, enqueue the pending barcode for the next ^FD command
          if (spec.codeType) {
            // Preserve height if user did not override; spec.height already defaulted to printer.barcodeHeight
            printer.setPendingBarcode(spec);
          }
        } else if (prefix[0] === "A") {
          // Font command (^A0,^AA etc).  Extract the font designator and optional orientation/height/width.
          const fontDesignator = prefix[1];
          // Remove the command designator (e.g. "A0") from the start of the
          // command.  After "^A0" the next character, if present, is the
          // optional orientation (N,R,I,B) followed by height and width
          // parameters.  Using substring(3) skips the command letter, the
          // designator and the caret, leaving orientation and parameters.
          let afterPrefix = cmd.substring(3);
          // Skip initial commas
          while (afterPrefix.startsWith(",")) {
            afterPrefix = afterPrefix.substring(1);
          }
          let fontOrientation = "N";
          if (/^[NRIB]/i.test(afterPrefix.charAt(0))) {
            fontOrientation = afterPrefix.charAt(0).toUpperCase();
            afterPrefix = afterPrefix.substring(1);
            if (afterPrefix.startsWith(",")) {
              afterPrefix = afterPrefix.substring(1);
            }
          }
          const fparts = afterPrefix.length > 0 ? afterPrefix.split(",") : [];
          const fheight =
            fparts.length > 0 ? parseInt(fparts[0], 10) : undefined;
          const fwidth =
            fparts.length > 1 ? parseInt(fparts[1], 10) : undefined;
          printer.setFont(fontDesignator, fontOrientation, fheight, fwidth);
        }
        break;
      }
    }
  }
  // Finalise: if commands ended without ^XZ, push the last label
  if (currentElements.length > 0) {
    pushLabel();
  }
  return labels;
}
