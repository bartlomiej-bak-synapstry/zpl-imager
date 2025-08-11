import PImage from 'pureimage';

/**
 * BaseDrawer is an abstract helper that defines the interface for
 * element‑specific drawers.  Every drawer should expose two
 * asynchronous methods:
 *
 *  - prepare(element): performs any asynchronous preprocessing needed
 *    to draw the element (e.g. measuring text, generating barcode
 *    images).  It may attach `renderWidth` and `renderHeight` to
 *    the element object for later use.
 *
 *  - draw(ctx, element): draws the element onto the provided
 *    PureImage 2D context at its x/y coordinate.  The context
 *    originates at the top left of the canvas.  Orientation
 *    transformations are handled at this level if necessary.
 */
class BaseDrawer {
  /**
   * Optionally perform asynchronous preprocessing for the element.
   * The default implementation does nothing.  Subclasses may
   * override this if they need to compute sizes or load resources.
   *
   * @param {object} element Element definition
   * @returns {Promise<void>}
   */
  async prepare(element) {
    // no‑op by default
  }

  /**
   * Draw the element on the provided context.  This method must be
   * implemented by subclasses.
   *
   * @param {CanvasRenderingContext2D} ctx 2D drawing context from pureimage
   * @param {object} element Element definition with x, y and size properties
   */
  /* eslint-disable no-unused-vars */
  draw(ctx, element) {
    throw new Error('draw() not implemented');
  }
  /* eslint-enable no-unused-vars */
}

export default BaseDrawer;