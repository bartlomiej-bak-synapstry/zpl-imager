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

    // Per-test tolerance for known limitations
    const maxDiffPixels = {
        // Barcode interpretation text: bitmap font AA differences
        "1":  2900,    // Code 39: side bearings glyph AA
        "3":  1720,    // Code 128: bitmap font AA
        "4":  3610,    // EAN-13: per-digit slot centering
        "5":  3020,    // I2of5: centering + advance calibration
        // Rotated barcodes: missing D-Z glyphs in bitmap font
        "6":  5500,    // Code 39 rotated: canvas font fallback for D-Z chars
        "7":  3700,    // Code 128 rotated: canvas font fallback
        // 2D barcodes: bwip-js encoder differences
        "8":  222000,  // PDF417: different codeword patterns
        "24": 26000,   // MaxiCode: mode 3 fallback + AA hexagon approximation
        "25": 18000,   // QR Code: bwip-js different mask pattern (position fixed)
        // Font rendering: Liberation Sans Bold vs CG Triumvirate Bold
        "13": 20600,   // Multi-font families (improved by ascent fix)
        "14": 14400,   // Font width/rotation
        "15": 600,     // Reverse video + font shapes (^FR XOR fix)
        "17": 800,     // Reverse video + font shapes (^FR XOR fix)
        "18": 5,       // Box rounded corner AA
        "19": 2,       // Box rounded corner AA
        "26": 1800,    // Field block alignment + font (improved by ascent fix)
        "27": 8700,    // Multiline wrapping + font (improved by ascent fix)
        "28": 1000,    // Text rotation ^FT (R/B swap fix: was 5200)
        "29": 1500,    // Text rotation ^FT (R/B swap fix: was 7400)
        "30": 25400,   // Text rotation ^FO + font
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
