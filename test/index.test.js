import { describe, test } from "node:test";

import { PNG } from "pngjs";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import pixelmatch from "pixelmatch";
import { render } from "../index.ts";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

describe("ZPL to PNG visual regression", () => {
    const zplDir = path.join(__dirname, "resources", "zpl");
    const pngDir = path.join(__dirname, "resources", "png");
    const diffDir = path.join(__dirname, "..", "tmp", "test");

    // Per-test tolerance for known encoder limitations (bwip-js vs Zebra firmware)
    const maxDiffPixels = {
        "8":  222000,  // PDF417: bwip-js produces different codeword patterns
        "24": 73000,   // MaxiCode: bwip-js different module layout
        "25": 31000,   // QR Code: bwip-js different mask pattern selection
    };

    const zplFiles = fs.readdirSync(zplDir).filter((f) => f.endsWith(".zpl"));

    zplFiles.forEach((zplFile) => {
        const testNum = path.basename(zplFile, ".zpl");
        const pngFile = `${testNum}.png`;
        const zplPath = path.join(zplDir, zplFile);
        const refPngPath = path.join(pngDir, pngFile);
        const genPngPath = path.join(diffDir, `${testNum}.png`);
        const diffPngPath = path.join(diffDir, `${testNum}_diff.png`);

        test(`ZPL ${zplFile} matches reference PNG`, async () => {
            // Wczytaj referencyjny PNG
            const refPng = PNG.sync.read(fs.readFileSync(refPngPath));
            // Wczytaj ZPL
            const zpl = fs.readFileSync(zplPath, "utf8");
            // Wygeneruj PNG z ZPL
            const genPngBuffer = await render(zpl, {
                width: refPng.width,
                height: refPng.height
            });
            const genPng = PNG.sync.read(genPngBuffer);
            fs.writeFileSync(genPngPath, genPngBuffer);

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
            const threshold = maxDiffPixels[testNum] || 0;
            assert.ok(numDiffPixels <= threshold,
                `${zplFile}: ${numDiffPixels} diff pixels (max allowed: ${threshold})`);
        });
    });
});
