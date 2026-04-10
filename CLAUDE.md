# ZPL Imager

ZPL (Zebra Programming Language) to PNG rendering library. Celem jest pixel-perfect reprodukcja wyjścia firmware Zebra.

## Architektura

Pipeline: `ZPL string` → `ZplAnalyzer` (parser) → `elements[]` → `Drawers` (canvas rendering) → `PNG buffer`

- **ZplAnalyzer.ts** — parser ZPL. Obsługuje ^FO/^FT positioning, ^BY module width, ^B3/^BA/^BC/^BE/^B2/^B7/^BQ/^BX barcode commands, ^GB boxes, ^A0 fonts, ^FB field blocks.
- **BarcodeDrawer.ts** — centralny plik renderingu kodów kreskowych (~750 linii). Trzy ścieżki renderowania:
  1. **Direct drawing** (Code 39 `prepareCode39`, Code 128B `prepareCode128`, EAN-13 `prepareEAN13`) — pixel-perfect bar patterns
  2. **bwip-js** (`_linearBwip`) — Code 93, Code 128 Auto, I2of5 i inne liniowe
  3. **bwip-js 2D** — QR, DataMatrix, MaxiCode, PDF417
- **zebraFont.ts** — bitmap font Zebra: raw grayscale glyph data z anti-aliasingiem. Znaki: `*0-9ABC` dla mw=3,4,5. Pola: `w` (glyph width), `bw` (binary width), `a` (advance legacy), `dx` (offset), `lb`/`rb` (side bearings), `g` (base64 gray data).
- **BoxDrawer.ts** — ^GB z additive borders (4 prostokąty), evenodd fill dla rounded.
- **TextDrawer.ts** — ^A0 font rendering z Roboto Condensed Bold.

## Kluczowe mechanizmy

### Barcode interpretation text
- **Bitmap font** — `zebraFont.ts` zawiera wyekstrahowane glyphs z referencyjnych obrazów Zebra. `drawGrayGlyph()` renderuje surowe wartości szarości bezpośrednio na ImageData (bez PNG encode/decode).
- **Side bearings** — `lb` (left bearing) i `rb` (right bearing) per glyph. Advance = `bw(char) + rb(char) + lb(next)`. Używane TYLKO w `drawCode39` (kalibrowane z Code 39 referencji). `drawLinearBwip` i Code 128 używają legacy `a` field.
- **Trailing narrow** — Code 39 centruje tekst nad `barWidth + narrow`, nie `barWidth`. Pole `trailingNarrow` w `_code39` data.
- **Font sizing** — rozmiar czcionki interpretacyjnej zależy od module width (^BY), NIE od bar height. ZEBRA_FONTS[mw] daje dokładne wartości. Fallback: `mw * 6 + 1`.

### EAN-13 (direct rendering)
- Guard bar extensions zmierzone z referencji: `{1:8, 2:11, 3:16, 4:22, 5:28}` pikseli ponad data bar height.
- Text Y = dataBarBottom + margin (tekst nakłada się na guard bar extension area).
- Per-digit slot positioning: 7 modules per digit, bitmap font centered w slocie.
- First digit to the left of start guard bars.

### Rotacje barcode
- `rotateCanvas()` — pixel-level ImageData manipulation (R=90CW, I=180, B=90CCW). Canvas transforms powodowały mirroring tekstu.

### ^FO vs ^FT
- ^FO = top-left origin, offset by ^LH
- ^FT = baseline origin, absolute (NOT offset by ^LH)
- ^GB z ^FT: `boxY = pos.y - effH`

## Status testów (5/30 passing, 2025-04-10)

| Test | Diff px | Barcode | Status |
|------|---------|---------|--------|
| 1 | 2888 | Code 39 ^B3 | Side bearings kerning. Remaining: ~2px centering + glyph AA. |
| 2 | 1630 | Code 93 ^BA | Bitmap font OK. Advances z Code 39 nie matchują Code 93 kerning. |
| 3 | 1751 | Code 128 ^BC | Top 3 (Normal): bitmap font. Bottom 3 (Auto): bitmap font via linearBwip. |
| 4 | 3604 | EAN-13 ^BE | Direct bars + guard ext + bitmap font. Glyph centering w slotach ~1-2px off. |
| 5 | 7218 | I2of5 ^B2 | Bitmap font, "5" advance=12 (artefakt Code 39). Centering shifted ~3px. |
| 6 | 127334 | Code 39 rotated | Rotated barcodes, text font size poprawiony. |
| 7 | 81472 | Code 128 rotated | j.w. |
| 8 | 221025 | PDF417 ^B7 | Fundamentalnie inny encoder (bwip-js vs Zebra). |
| 9 | 0 | DataMatrix ^BX | PASS |
| 10-12 | 0 | Text/boxes | PASS |
| 13-14 | 34K/14K | ^A0 font text | Font rendering differences (Roboto vs Zebra). |
| 15-17 | 810-16K | ^GB boxes | Border rendering, rounded corners. |
| 18-19 | 17/11K | ^GB + ^FO/^FT | Box positioning z ^FT baseline. |
| 20 | 0 | ? | PASS |
| 21-23 | 17-15K | Nested elements | Positioning/overlap. |
| 24 | 72K | UPS MaxiCode ^BD | bwip-js rendering. |
| 25 | 30K | QR Code ^BQ | Different mask pattern (bwip-js vs Zebra). |
| 26-30 | 20-80K | Text + boxes | Font + box rendering combined. |

## Co jest do zrobienia (priorytet)

### Barcode interpretation text — poprawki advance/kerning
**Problem**: font Zebry ma context-dependent kerning. Advance "3"→"A" = 15px, ale "3"→"4" = 18px. Side bearing model (lb/rb) działa idealnie dla Code 39 (test 1), ale wymaga osobnej kalibracji per barcode type.

**Podejście do naprawy testów 2, 3, 5:**
1. Zmierzyć advance values z referencji test 2 (Code 93), test 3 (Code 128), test 5 (I2of5) — dane już zebrane w tej sesji
2. Dla każdego barcode type: obliczyć lb/rb z par znaków w referencji
3. W `drawLinearBwip` i Code 128: użyć type-specific lb/rb zamiast legacy `a`
4. Wyznaczyć centering width correction per type (analogia do `+narrow` w Code 39)

**Dane referencyjne (już zmierzone):**
```
Code 93 BY3 "123ABC":   advances: 17,18,15,20,18,14  centerW=barW+5
Code 128 BY3 "ABC12345": advances: 20,18,20,17,18,18,18,12  centerW≈barW
I2of5 BY3 "123456789012": advances: 17,18,18,18,19,17,19,18,17,19,17,12  centerW=barW+7
```

### Brakujące glyphs w bitmap font
- Mamy: `*0123456789ABC` (14 znaków) dla mw=3,4,5
- Brak: `D-Z`, `-. $/+%`, mw=1,2 (potrzebne do pełnego pokrycia)
- Ekstrakcja: przygotować ZPL z pełnym zestawem znaków → Labelary → wyekstrahować glyphs

### EAN-13 (test 4)
- Glyphs wyekstrahowane z I2of5 (test 5), nie z EAN-13 (test 4) — lekko inne pixel values
- Centering per-digit w 7-module slots jest ~1-2px off vs referencja
- Do poprawy: wyekstrahować glyphs bezpośrednio z EAN-13 referencji

### Rotowane barcode (testy 6, 7)
- Tekst rotowany renderowany canvas font (nie bitmap) — glyph differences
- Bitmap font w rotated path wymaga compose na tmpCanvas → drawGrayGlyph → rotateCanvas

### Box rendering (testy 15-19)
- ^GB thickness expansion, rounded corners (^GB...,,radius)
- ^FT baseline positioning dla boxów

### Fundamentalne ograniczenia (nie da się naprawić)
- **PDF417 (test 8)** — bwip-js encoder produkuje inny pattern niż Zebra (~220K diff)
- **QR Code (test 25)** — bwip-js używa innego mask pattern selection (~30K diff)
- **MaxiCode (test 24)** — j.w.

## Konwencje kodu

- `ensureFont()` — wywoływane na początku prepare() do załadowania fontów
- `decodePng()` z utils.ts do konwersji bwip-js buffer na canvas Image
- Element `_code39`, `_code128`, `_ean13`, `_linearBwip` — prepared data dla draw phase
- `createCanvas()` z canvas.ts — @napi-rs/canvas wrapper
- Testy: `npm test`, pixelmatch z threshold=0.1, diff images w `tmp/test/`
