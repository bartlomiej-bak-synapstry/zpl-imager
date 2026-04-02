import * as PImage from "pureimage";

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

abstract class BaseDrawer {
  async prepare(element: any): Promise<void> {
    // no‑op by default
  }

  abstract draw(ctx: any, element: any): void;
}

export default BaseDrawer;
