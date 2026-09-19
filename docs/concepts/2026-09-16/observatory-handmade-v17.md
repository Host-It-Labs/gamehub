# Observatory handmade v17

Built-in generation, native1536×1024. Original style reference: `/Users/williamguinaudie/Downloads/Codex Image 16 Sept 2026, 16_34_56.png`. Fresh v15 followed by composition correction v16 and local root-hollow correction v17; no API, no upscaling. Source: `public/art/observatory-handmade-v17.png`.

## Generation intent and review

Paper diorama with layered cardstock masonry, tactile cut edges, pale cream/moss/coral/ochre and soft physical shadows. Entire roofs and identifiable habitat silhouettes must survive actual desktop crops, not merely placement pads. Exactly17 slots. Six distinct habitats; especially continuous dry rocky channel versus compact timber Watchpost.

v15 failed requested safe geometry; v16 corrected upper silhouettes but root's first slot straddled logical crop used for miniature. v17 shrinks/moves only the root hollow to fit both its pads within crop. Other five habitats visually retain geometry. Whole output was visually reviewed, not browser tested. No additional generation needed.

## v17 exact edit brief

Precise local edit ONLY of lower-left tree-root hollow and its TWO blank paper oval slots. Preserve other FIVE habitats, slots, roofs and size. Keep1536×1024. Replace tree hollow with smaller narrower arch inside x380..610,y520..715. Two cream slots near445,650 and535,650. Fill vacated area ordinary shrubs/path. Do not recompose/zoom or change other habitats. Exactly17 total. Match handmade cut-cardstock. No text or creatures.

## Source coordinates (visual measurement)

- Dome roof top:359. Roof-garden arch top335. Watchpost roof top380.
- Courtyard slots746,536;826,535;744,571;824,571. Label785,597. Full observatory/courtyard bounds615,357,329,249.
- Roofgarden slots460,418;526,418;459,448;525,448. Label488,488. Full bounds377,335,246,211.
- Root hollow slots450,661;514,662. Label482,697. Full structural arch/clearing bounds380,552,205,161 (decorative foliage above/left expendable).
- Glasshouse slots715,704;788,706;861,706. Label788,741. Full bounds641,604,291,155.
- Drychannel slots1017,567;1055,619;1093,679. Label1094,723. Full bounds935,500,262,246.
- Watchpost slot1069,455. Label1077,493. Full bounds1000,380,150,169.

All17 slots stay inside existing logical crop372,220,822,548. Full silhouettes must additionally be tested against actual visible scene and UI masks. Native slot widths approximately50–60px.

## Integration and acceptance

v17 is active. Existing source/crop dimensions and camera code are preserved. `mora-map.ts` contains final label/hit bounds; `observatory-art.json` contains complete protected landmark bounds (root bounds include crown clearance fromy532). Automated fixtures verify whole landmark visibility and80px top clearance on non-phone landscape layouts. Export quality94 with no upscale. No live browser/touch check.
