/*
 * VirtualPrinter is a light‑weight state holder used during ZPL parsing.
 * It models the temporary state of a Zebra printer as it interprets
 * commands one by one.  Only a subset of the original C# fields are
 * implemented here, just enough to support the basic rendering
 * functionality implemented in this Node port.  Additional flags and
 * properties can be added in the future to widen support.
 */

class VirtualPrinter {
  constructor() {
    this.reset();
  }

  /**
   * Resets the printer state to its defaults.  This should be called
   * at the beginning of each label (^XA) to ensure that leftover
   * state from a previous label does not bleed into the next one.
   */
  reset() {
    // Positioning for the next element
    this.nextPosition = null;
    // Default font settings (ZPL font 0 at 10 dots high)
    this.fontName = '0';
    this.fontHeight = 10;
    this.fontWidth = 0;
    this.orientation = 'N'; // N = normal, R = rotate 90°, I = 180°, B = 270°
    // Barcode defaults
    this.barcodeModuleWidth = 2;
    this.barcodeRatio = 3;
    this.barcodeHeight = 50;
    // Temporary storage for the next barcode command
    this.pendingBarcode = null;
    // Current label home offset
    this.labelHome = { x: 0, y: 0 };

    // Indicates whether the next drawable element should be printed in reverse (inverted).
    this.reverseNext = false;

    // Field block formatting for multi‑line text (set by ^FB).  When non‑null
    // this object stores width, lines, lineSpacing, alignment and indent.
    this.fieldBlock = null;

    // Default field orientation for subsequent fields (^FW).  When set,
    // overrides the orientation property of fonts and barcodes.
    this.fieldOrientation = null;

    // Graphics store keyed by download name (e.g. "R:SAMPLE.PNG").  Each
    // entry contains an object with data Buffer and optional metadata such
    // as width and height.  Populated by ~DG, ~DY and similar commands.
    this.graphics = {};
  }

  /**
   * Sets the origin for the next drawable element.  In ZPL this is
   * typically done with ^FO or ^FT commands.  The coordinates are
   * specified relative to the label home (if set).  When a bottom flag
   * is provided the Y coordinate will be measured from the bottom
   * (not currently implemented – reserved for future enhancements).
   *
   * @param {number} x The X coordinate in dots
   * @param {number} y The Y coordinate in dots
   * @param {boolean} [bottom=false] Whether the Y coordinate is relative to the bottom
   */
  /**
   * Sets the origin for the next drawable element.  In addition to the
   * coordinate and bottom flag, an optional origin type may be
   * supplied.  ZPL distinguishes between ^FO (Field Origin), which
   * positions the top‑left corner of the field at the given
   * coordinates, and ^FT (Field Text), which positions the baseline
   * of the text at the given coordinates.  When parsing ^FO the
   * origin type should be 'top-left'.  When parsing ^FT it should be
   * 'baseline'.  If omitted, the origin defaults to 'top-left'.
   *
   * @param {number} x The X coordinate in dots
   * @param {number} y The Y coordinate in dots
   * @param {boolean} [bottom=false] Whether the Y coordinate is relative to the bottom
   * @param {string} [originType='top-left'] Either 'top-left' or 'baseline'
   */
  setNextPosition(x, y, bottom = false, originType = 'top-left') {
    this.nextPosition = {
      x: x,
      y: y,
      bottom: !!bottom,
      originType: originType || 'top-left'
    };
  }

  /**
   * Clears the pending position so subsequent elements revert to the
   * current cursor position.  This mirrors how ZPL resets the cursor
   * after each ^FS (field separator).
   */
  clearNextPosition() {
    this.nextPosition = null;
  }

  /**
   * Sets the default alphanumeric font for subsequent text.  ZPL
   * encodes the font name and orientation in the command itself.  The
   * width and height are optional; if not supplied the printer’s
   * defaults will be used.
   *
   * @param {string} fontName Single character font designator (e.g. '0', 'A')
   * @param {string} orientation One of 'N', 'R', 'I', 'B'
   * @param {number} height Height in dots
   * @param {number} width Width in dots (optional)
   */
  setFont(fontName, orientation, height, width = 0) {
    this.fontName = fontName;
    // If a default field orientation has been set (^FW), merge it with
    // the supplied orientation.  Otherwise use the provided value.
    if (this.fieldOrientation) {
      this.orientation = this.fieldOrientation;
    } else {
      this.orientation = orientation || 'N';
    }
    if (typeof height === 'number' && !isNaN(height) && height > 0) {
      this.fontHeight = height;
    }
    if (typeof width === 'number' && !isNaN(width) && width >= 0) {
      this.fontWidth = width;
    }
  }

  /**
   * Returns a copy of the current font configuration.  The returned
   * object can safely be mutated by callers without affecting the
   * underlying state.
   */
  getFont() {
    return {
      name: this.fontName,
      // If a default field orientation is set (^FW), propagate it to the
      // font orientation when queried.
      orientation: this.fieldOrientation || this.orientation,
      height: this.fontHeight,
      width: this.fontWidth
    };
  }

  /**
   * Adjusts the barcode defaults.  The module width and ratio
   * determine the thickness of narrow and wide bars in most linear
   * symbologies.  The height is used if the barcode command omits it.
   *
   * @param {number} moduleWidth Width of a narrow bar (dots)
   * @param {number} ratio Ratio between wide bar and narrow bar
   * @param {number} height Height of the barcode in dots
   */
  setBarcodeDefaults(moduleWidth, ratio, height) {
    if (typeof moduleWidth === 'number' && moduleWidth > 0) {
      this.barcodeModuleWidth = moduleWidth;
    }
    if (typeof ratio === 'number' && ratio > 0) {
      this.barcodeRatio = ratio;
    }
    if (typeof height === 'number' && height > 0) {
      this.barcodeHeight = height;
    }
  }

  /**
   * Marks the next drawable element to be printed in reverse.  This
   * property is consumed when the next element is created.
   */
  setReverseNext() {
    this.reverseNext = true;
  }

  /**
   * Retrieves and clears the reverse flag for the next element.
   * @returns {boolean}
   */
  consumeReverseNext() {
    const flag = this.reverseNext;
    this.reverseNext = false;
    return flag;
  }

  /**
   * Stashes the parameters of a barcode command until its data (^FD)
   * arrives.  ZPL splits the barcode definition into two pieces – a
   * ^B? command that describes the type and basic styling followed by
   * a ^FD that provides the encoded data.  This method captures the
   * first part.
   *
   * @param {object} barcodeSpec An object containing type, height, orientation and other options
   */
  setPendingBarcode(barcodeSpec) {
    this.pendingBarcode = barcodeSpec;
  }

  /**
   * Clears any previously stored barcode specification.
   */
  clearPendingBarcode() {
    this.pendingBarcode = null;
  }

  /**
   * Sets the label home position.  In ZPL this is done with ^LH and
   * offsets subsequent ^FO commands by the given amount.
   *
   * @param {number} x Home X offset in dots
   * @param {number} y Home Y offset in dots
   */
  setLabelHome(x, y) {
    this.labelHome = { x: x || 0, y: y || 0 };
  }

  /**
   * Defines the formatting for the next text field block.  See ^FB in ZPL.
   * @param {number} width Maximum width of the block in dots
   * @param {number} lines Maximum number of lines (0 for unlimited)
   * @param {number} lineSpacing Additional spacing between lines in dots
   * @param {string} align One of 'L', 'C', 'R', 'J'
   * @param {number} indent Hanging indent in dots
   */
  setFieldBlock(width, lines, lineSpacing, align, indent) {
    this.fieldBlock = {
      width: width || 0,
      lines: lines || 0,
      lineSpacing: lineSpacing || 0,
      align: (align || 'L').toUpperCase(),
      indent: indent || 0
    };
  }

  /** Clears the currently defined field block formatting. */
  clearFieldBlock() {
    this.fieldBlock = null;
  }

  /**
   * Sets the default field orientation for subsequent text and barcodes.  The
   * value persists until reset or overridden by another ^FW command.
   * @param {string} orientation One of 'N','R','I','B'
   */
  setFieldOrientation(orientation) {
    const o = (orientation || '').toUpperCase();
    if (o === 'N' || o === 'R' || o === 'I' || o === 'B') {
      this.fieldOrientation = o;
    }
  }

  /**
   * Saves a graphic definition in memory.  The key should include the
   * device prefix (e.g. "R:") and filename.  The value is an object
   * containing at least a Buffer under the 'data' property and may
   * include width, height and type (e.g. 'png').
   * @param {string} key The download name (device and filename)
   * @param {object} graphic Graphic information with data Buffer and metadata
   */
  saveGraphic(key, graphic) {
    if (key) {
      this.graphics[key] = graphic;
    }
  }

  /** Retrieves a graphic previously saved with saveGraphic. */
  getGraphic(key) {
    return this.graphics[key];
  }
}

export default VirtualPrinter;