import BarcodeDrawer from "./drawers/BarcodeDrawer";
import BoxDrawer from "./drawers/BoxDrawer";
import CircleDrawer from "./drawers/CircleDrawer";
import DiagonalLineDrawer from "./drawers/DiagonalLineDrawer";
import ImageDrawer from "./drawers/ImageDrawer";
import TextDrawer from "./drawers/TextDrawer";

/**
 * Returns an instance of the appropriate drawer class for the given
 * element type.  If a specific drawer is not found the method
 * returns undefined.  New element types can be added here as the
 * parser and renderer are extended.
 *
 * @param {string} type Element type identifier
 * @returns {BaseDrawer|undefined}
 */
export function getDrawer(type) {
  switch (type) {
    case "text":
      return new TextDrawer();
    case "box":
      return new BoxDrawer();
    case "barcode":
      return new BarcodeDrawer();
    case "circle":
      return new CircleDrawer();
    case "diagonal":
      return new DiagonalLineDrawer();
    case "image":
      return new ImageDrawer();
    default:
      return undefined;
  }
}
