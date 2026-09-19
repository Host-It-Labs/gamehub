# Observatory composition calibration

This is the measured v18 integration, not a universal pixel recipe. Run `node --experimental-strip-types scripts/measure-observatory-framing.mjs` after any source/crop/camera change. Static fixtures approximate layout: advanced view uses a300px column; runtime reads the actual viewport and hand position. Live browser/touch acceptance is separate.

## Source allocation

- Native source1536×1024; logical crop822×548 at372,220, i.e.53.52% of source width and height; crop area28.64% of source area.
- v17 landmark union820×424 at377,335:53.39% source width,41.41% source height,22.11% bounding area. This left too much upper scenery.
- v18 landmark union864×488 at326,242:56.25% width,47.66% height,26.81% bounding area. Useful bounding height increases15.09%, width5.37%, area21.2%; highest landmark moves93px upward. Bounding area is not painted-pixel coverage.
- Requested intermediate target870×485 was26.83% source area, not31%; use arithmetic, not estimated percentages.
- Native slot widths remain roughly48–57px, comparable to v17. This improves composition allocation, not native image resolution. No upscale is claimed as recovered detail.

## Camera equations and limits

Let source scale s=displayedBoardWidth/cropWidth. Source(px,py) maps to (boardX+(px-cropLeft)*s, boardY+(py-cropTop)*s). Full source starts at(boardX-cropLeft*s,boardY-cropTop*s). Invert this relation to obtain the viewport's visible source rectangle.

Normal desktop uses the preferred cover width but caps it so the entire measured landmark union, plus12source-pixel lower text allowance, fits between headerBottom80px and dockTop−24px. Maximum width is `(dockTop-24-80)*cropWidth/(landmarkBottom+12-landmarkTop)`. Offset is clamped between the top-landmark and bottom-clearance constraints. This replaces forcing every source landmark below y335 merely to satisfy a short desktop. Remaining source-edge coverage is independently tested. Phone/tablet/advanced-view rules remain separate.

Sampling density is `cropWidth/displayedBoardWidth` native pixels per CSS pixel, divided by DPR for native pixels per device pixel. Below1 means enlargement; exporting larger dimensions does not recover detail.

## Closer landscape framing and browser zoom (latest)

Normal desktop and landscape tablets now share a coverage-aware frame. Preferred scale is8% above the prior fit; actual scale is bounded by minimum full-source coverage and maximum complete-landmark fit. Landmark bottom includes12source pixels for captions, lower screen edge is dockTop−24. Header clearance defaults80px; only when source coverage conflicts, it can reclaim spare clearance down to44px. An impossible interval remains explicitly detectable through `coveragePossible`. No source stretching, repeated scenery or image regeneration is used to cover CSS-sizing errors.

Browser zoom shrinks the effective CSS viewport and may cross1280px or500px breakpoints. Recompute for element/window/visualViewport resize. Fixtures include1512×850 at100%,110%,125%,150% zoom and side-rail coverage at200%/250%; iPad Mini1133×744 and iPad Pro1194×834/1366×1024; source boundaries and full landmarks are tested together. Phone side rails and portrait horizontal exploration retain their separate fitting rules. Advanced view still scales to its remaining column.

## Current measurements

```text
{
  "source": [
    1536,
    1024
  ],
  "crop": {
    "left": 372,
    "top": 220,
    "width": 822,
    "height": 548
  },
  "landmarkUnion": [
    326,
    242,
    864,
    488
  ],
  "landmarkWidthRatio": 0.5625,
  "landmarkHeightRatio": 0.4765625,
  "landmarkBoundingAreaRatio": 0.26806640625
}
┌─────────┬───────────────┬──────────┬────────────┬─────────────┬────────────────┬─────────────────────────┬──────────────────────────┐
│ (index) │ viewport      │ advanced │ boardWidth │ landmarkTop │ landmarkBottom │ nativePixelsPerCssPixel │ nativePixelsPerDpr2Pixel │
├─────────┼───────────────┼──────────┼────────────┼─────────────┼────────────────┼─────────────────────────┼──────────────────────────┤
│ 0       │ '1008x566.67' │ false    │ 550.2      │ 80          │ 406.6          │ 1.494                   │ 0.747                    │
│ 1       │ '1008x566.67' │ true     │ 375.5      │ 106         │ 329            │ 2.189                   │ 1.095                    │
│ 2       │ '1209.6x680'  │ false    │ 660.2      │ 80          │ 472            │ 1.245                   │ 0.623                    │
│ 3       │ '1209.6x680'  │ true     │ 486        │ 135.4       │ 423.9          │ 1.691                   │ 0.846                    │
│ 4       │ '1194x834'    │ false    │ 809.8      │ 80          │ 560.8          │ 1.015                   │ 0.508                    │
│ 5       │ '1194x834'    │ true     │ 648.8      │ 167.5       │ 552.7          │ 1.267                   │ 0.633                    │
│ 6       │ '1366x1024'   │ false    │ 1068.5     │ 116.9       │ 751.3          │ 0.769                   │ 0.385                    │
│ 7       │ '1366x1024'   │ true     │ 868.8      │ 207.6       │ 723.4          │ 0.946                   │ 0.473                    │
│ 8       │ '1280x720'    │ false    │ 802.3      │ 80          │ 556.3          │ 1.025                   │ 0.512                    │
│ 9       │ '1280x720'    │ true     │ 533.4      │ 143.9       │ 460.5          │ 1.541                   │ 0.771                    │
│ 10      │ '1440x900'    │ false    │ 998.7      │ 80          │ 672.9          │ 0.823                   │ 0.412                    │
│ 11      │ '1440x900'    │ true     │ 739.4      │ 181.8       │ 620.7          │ 1.112                   │ 0.556                    │
│ 12      │ '1512x850'    │ false    │ 956.8      │ 80          │ 648            │ 0.859                   │ 0.43                     │
│ 13      │ '1512x850'    │ true     │ 688.9      │ 171.4       │ 580.4          │ 1.193                   │ 0.597                    │
│ 14      │ '1912x952'    │ false    │ 1124.5     │ 80          │ 747.6          │ 0.731                   │ 0.365                    │
│ 15      │ '1912x952'    │ true     │ 821.8      │ 193.4       │ 681.2          │ 1                       │ 0.5                      │
│ 16      │ '3440x1440'   │ false    │ 1926.8     │ 80          │ 1223.9         │ 0.427                   │ 0.213                    │
│ 17      │ '3440x1440'   │ true     │ 1428.5     │ 297.4       │ 1145.5         │ 0.575                   │ 0.288                    │
│ 18      │ '1133x744'    │ false    │ 690.2      │ 87.3        │ 497.1          │ 1.191                   │ 0.595                    │
│ 19      │ '1133x744'    │ true     │ 548        │ 148.6       │ 473.9          │ 1.5                     │ 0.75                     │
│ 20      │ '568x320'     │ false    │ 324        │ 60.7        │ 253            │ 2.537                   │ 1.269                    │
│ 21      │ '844x390'     │ false    │ 531        │ 32.2        │ 347.5          │ 1.548                   │ 0.774                    │
│ 22      │ '932x430'     │ false    │ 591        │ 33.8        │ 384.7          │ 1.391                   │ 0.695                    │
└─────────┴───────────────┴──────────┴────────────┴─────────────┴────────────────┴─────────────────────────┴──────────────────────────┘
```
