import { analyze } from "./src/ZplAnalyzer";
import { drawElements } from "./src/ZplElementDrawer";

export interface RenderOptions {
  width?: number;
  height?: number;
}

/**
 * Renders one or more labels from a ZPL document into PNG buffers.  The
 * analyser splits the input into individual labels and returns an
 * array of label objects.  Each label object contains the raw
 * element definitions as parsed as well as a convenience method to
 * render itself to a PNG.  The top‑level render function will
 * return the buffer for the first label in the document.  For
 * documents containing multiple ^XA/^XZ sections you should call
 * analyse() directly and render each label separately.
 *
 * @param {string} zpl A string of ZPL commands
 * @returns {Promise<Buffer>} PNG buffer containing the rendered label
 */

/**
 * Renders one or more labels from a ZPL document into PNG buffers.  The
 * analyser splits the input into individual labels and returns an
 * array of label objects.  Each label object contains the raw
 * element definitions as parsed as well as a convenience method to
 * render itself to a PNG.  The top‑level render function will
 * return the buffer for the first label in the document.  For
 * documents containing multiple ^XA/^XZ sections you should call
 * analyse() directly and render each label separately.
 *
 * @param {string} zpl A string of ZPL commands
 * @param {object} [options] Opcjonalne parametry renderowania
 * @param {number} [options.width] Szerokość wynikowego PNG (w pikselach)
 * @param {number} [options.height] Wysokość wynikowego PNG (w pikselach)
 * @returns {Promise<Buffer>} PNG buffer containing the rendered label
 */
export async function render(
  zpl: string,
  options: RenderOptions = {}
): Promise<Buffer> {
  const labels = analyze(zpl);
  if (!labels || labels.length === 0) {
    throw new Error("No labels were detected in the supplied ZPL");
  }
  // Render the first label by default
  const buffer = await drawElements(labels[0].elements, options);
  return buffer;
}

export { analyze, drawElements };
