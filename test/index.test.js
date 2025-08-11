import { describe, test } from "node:test";

import { PNG } from "pngjs";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import pixelmatch from "pixelmatch";
import { render } from "../index.ts";

describe("ZPL to PNG visual regression", () => {
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const zplDir = path.join(__dirname, "resources", "zpl");
    const pngDir = path.join(__dirname, "resources", "png");
    const diffDir = path.join(__dirname, "..", "tmp", "test");

    const zplFiles = fs.readdirSync(zplDir).filter((f) => f.endsWith(".zpl"));

    zplFiles.forEach((zplFile) => {
        const testNum = path.basename(zplFile, ".zpl");
        const pngFile = `${testNum}.png`;
        const zplPath = path.join(zplDir, zplFile);
        const refPngPath = path.join(pngDir, pngFile);
        const diffPngPath = path.join(diffDir, `${testNum}.png`);

        test(`ZPL ${zplFile} matches reference PNG`, async () => {
            // Wczytaj ZPL
            const zpl = fs.readFileSync(zplPath, "utf8");
            // Wygeneruj PNG z ZPL
            const genPngBuffer = await render(zpl);
            const genPng = PNG.sync.read(genPngBuffer);
            // Wczytaj referencyjny PNG
            const refPng = PNG.sync.read(fs.readFileSync(refPngPath));
            // Sprawdź rozmiar
            assert.equal(genPng.width, refPng.width, `Width mismatch for ${zplFile}`);
            assert.equal(genPng.height, refPng.height, `Height mismatch for ${zplFile}`);
            // Porównaj obrazy
            const diff = new PNG({ width: genPng.width, height: genPng.height });
            const numDiffPixels = pixelmatch(
                genPng.data,
                refPng.data,
                diff.data,
                genPng.width,
                genPng.height,
                { threshold: 0.1, diffColor: [255, 0, 0] }
            );
            if (numDiffPixels > 0) {
                // Zapisz diff PNG do pliku
                const diffBuffer = PNG.sync.write(diff);
                fs.writeFileSync(diffPngPath, diffBuffer);
            }
            assert.equal(numDiffPixels, 0);
        });
    });
});
