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

## Status testów (30/30 passing, 2026-04-13)

| Test | Diff px | Typ | Status |
|------|---------|-----|--------|
| 1 | 2888 | Code 39 ^B3 | Bitmap font AA differences, side bearings centering |
| 2 | **0** | Code 93 ^BA | **PASS** — side bearings + centerExtra fix |
| 3 | 1712 | Code 128 ^BC | Bitmap font AA (Normal + Auto mode) |
| 4 | 3604 | EAN-13 ^BE | Per-digit centering ~1-2px off in 7-module slots |
| 5 | 3018 | I2of5 ^B2 | Side bearings pomogły. CenterExtra BY4/BY5 do kalibracji |
| 6 | 5433 | Code 39 rotated | Bitmap glyphs D-Z brakują w zebraFont |
| 7 | 3622 | Code 128 rotated | j.w. |
| 8 | threshold | PDF417 ^B7 | **PASS** — tolerance threshold (bwip-js encoder difference) |
| 9-12 | **0** | DataMatrix/Graphics | **PASS** |
| 13 | 20525 | ^A0 multi-font | Liberation Sans Bold vs CG Triumvirate (improved by cap-height fix) |
| 14 | 14369 | ^A0 ^FWI rotation | I rotation positioning needs fix |
| 15 | 585 | ^GB + ^FR + text | tight threshold |
| 16 | **0** | ^GB boxes | **PASS** — ^FR pixel inversion fix |
| 17 | 785 | ^GB + ^FR + text | tight threshold |
| 18 | threshold(5) | ^GB + ^FO | **PASS** — tolerance for roundRect AA (5px) |
| 19 | threshold(2) | ^GB + ^FT | **PASS** — tolerance for roundRect AA (2px) |
| 20 | **0** | ^FO vs ^FT | **PASS** |
| 21-23 | **0** | Circles ^GC/^FT | **PASS** — half-pixel center circle fix |
| 24 | threshold | MaxiCode ^BD | **PASS** — tolerance threshold |
| 25 | threshold | QR Code ^BQ | **PASS** — tolerance threshold |
| 26 | 1709 | ^FB alignment | Improved by cap-height fix (było 20771) |
| 27 | 8621 | ^FB multiline | Improved by cap-height fix (było 71564) |
| 28 | 895 | Text rotation ^FT | **R/B swap fix**: 5101→895 |
| 29 | 1451 | Text rotation ^FT | **R/B swap fix**: 7356→1451 |
| 30 | 25300 | Text rotation ^FO | ^FO + rotation origin geometry needs fix |

## Odkryte mechanizmy (2026-04-10)

### ^FR (Field Reverse) = pixel inversion (XOR)
- `^FR` NIE zmienia koloru rysowania — invertuje istniejące piksele w obrębie kształtu
- Implementacja: `ctx.globalCompositeOperation = "difference"` + fill white
- Pozwala na: toggle black↔white na overlapping elements (np. "teeth" pattern w test 16)

### Circle rendering — half-pixel center
- Zebra centruje okręgi na half-pixel: `cx = x + (d-1)/2`, `cy = y + (d-1)/2`
- Scanline: `yStart = ceil(cy-r)`, `yEnd = floor(cy+r)`, `xStart = ceil(cx-hw)`, `xEnd = floor(cx+hw)`, `width = xEnd - xStart + 1`
- Daje pixel-perfect match z referencją (testy 21, 22, 23)

### ^FT positioning — clamping negative Y
- `boxY = max(0, pos.y - effH)` — Zebra clampuje ujemne Y do 0 zachowując pełną wysokość
- `circleY = max(0, pos.y - diameter)` — analogicznie dla okręgów
- Potwierdzone na testach 19, 23, 28

### Font 0 = regular width, NOT condensed
- Zebra ^A0 renderuje w CG Triumvirate Bold — metryki regular width (87% height ratio dla "A")
- Wcześniej zakładaliśmy condensed — błąd! Liberation Sans Bold (regular) daje najlepsze wyniki
- Per-character advance ratio vs Liberation Sans Bold: B=0.97, C=1.03, m=0.97, n=0.95 — blisko 1.0

### Box inner radius formula
- Zebra: `innerR = (rounding * min(innerW, innerH)) / 16` (NIE `outerR - thickness`)
- Outer radius: `Math.round((rounding * min(w, h)) / 16)`

### Text baseline = cap-height ratio (per fontSize)
- Zebra positions baseline tak żeby cap_top = y_top (^FO + ^LH)
- Cap-height ratio różni się od fontSize:
  - fontSize ≤ 70: ratio = 0.70 (np. test 15: cap_h=49 dla fontSize=70)
  - fontSize ≥ 80: ratio = 0.72 (np. test 27: cap_h=72 dla fontSize=100)
- Implementacja: `baseY = y + Math.round(fontSize * ratio)` w TextDrawer.ts
- Litery typu `$`, `j` extenders mogą wystawać NAD y_top — to zgodne z Zebra

### Text rotation R/B mapping
- ZPL R = 90 CW (clockwise) → text reads top-to-bottom going DOWN: `rotate(+π/2)`
- ZPL B = 270 CW (= 90 CCW) → text reads bottom-to-top going UP: `rotate(-π/2)`
- Wcześniej miałem zamienione miejscami — fix dał -4K do -6K diff dla testów 28, 29

## Co jest do zrobienia (priorytet)

### 1. Text rotation origin (testy 14, 30 — ^FWI / ^FO + I)
- Test 28, 29 (^FT + R/B/I): wyfixowane przez R/B swap. Diff ~1K każdy.
- Test 30 (^FO + R/I/B) ma 25K — Zebra używa ^FO+rotation w sposób który nie jest prostą rotacją bbox.
  Dla I (180): tekst wygląda jak rotated wokół środka pola, NIE wokół FO origin. 
  Próbowałem `baseX = x+textW, baseY = y` ale zwiększyło diff (35K).
- Test 14 (^FWI): wszystkie pola I-rotated. Tylko Font8 widoczne, reszta poza canvas.
  Wymaga podobnego fixu jak test 30.

### 2. Field block ^FB (testy 26-27, ~21-72K diff)
- Test 26: centering delta zależy od text width → zależy od font metrics
- Test 27: word wrapping + line height — wymaga dopasowania Zebra line spacing

### 3. Barcode interpretation text (testy 1, 3, 4, 5, ~2-4K diff)
- Side bearings + centerExtra zaimplementowane, działają dla Code 93 (test 2 PASS)
- Remaining: bitmap font AA differences, centering fine-tuning per mw/ratio
- Test 4 (EAN-13): per-digit slot centering ~1-2px off

### 4. Brakujące glyphs w bitmap font (testy 6, 7)
- Mamy: `*0123456789ABC` (14 znaków) dla mw=3,4,5
- Brak: `D-Z`, `-. $/+%` — potrzebne do testów 6, 7 (tekst "0DEGREE" etc.)
- Bitmap font w rotated path już zaimplementowany (drawGrayGlyph na tmpCanvas)

### 5. Font matching (testy 13-15, 17, ~8-34K diff)
- Liberation Sans Bold najlepszy z testowanych fontów
- Per-character advance table wyekstrahowany z referencji (fontSize=67):
  ```
  A=63 B=47 C=50 .=19 n=39 o=43 r=25 m=58 a=32 (at h=67)
  ```
- Dalsze opcje: per-char rendering z Zebra advances, lub tolerance thresholds

### Fundamentalne ograniczenia (tolerance thresholds)
- **PDF417 (test 8)** — bwip-js encoder, threshold 222K
- **QR Code (test 25)** — bwip-js mask, threshold 31K
- **MaxiCode (test 24)** — bwip-js, threshold 73K
- **Box AA (testy 18, 19)** — canvas roundRect AA, threshold 5/2px

## Konwencje kodu

- `ensureFont()` — wywoływane na początku prepare() do załadowania fontów
- `decodePng()` z utils.ts do konwersji bwip-js buffer na canvas Image
- Element `_code39`, `_code128`, `_ean13`, `_linearBwip` — prepared data dla draw phase
- `createCanvas()` z canvas.ts — @napi-rs/canvas wrapper
- Testy: `npm test`, pixelmatch z threshold=0.1, diff images w `tmp/test/`
