import { loadImage } from "./canvas";

export async function decodePng(buffer: Buffer): Promise<any> {
  return loadImage(buffer);
}
