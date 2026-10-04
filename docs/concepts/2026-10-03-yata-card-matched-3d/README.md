# Tokyo card-matched 3D dishes — 3 October 2026

William asked to keep the Tokyo counter dishes in 3D while matching their existing hand-card drawings: the same cartoon language, vessels, ingredients and generous portions. In particular, Ramen must have a full bowl of thick noodles, rather than a small mound in mostly exposed broth. The current hand illustrations are the visual reference.

## Written art brief

Build fresh stills from modeled geometry. Use saturated card colours, chunky readable food, dark charcoal contours and a small number of deliberate cel-shading tones. Eliminate photographic noise, bump, oily glare and fine-grain surface textures. Preserve the actual 3D vessels and food volume, transparent film, short contact shadow and common camera. Keep the counter layout, hand art, scoring and collection interactions.

| Dish | Existing card | Identity to retain |
| --- | --- | --- |
| Gyoza | `yata-counter-lane-0-v3.webp` | Five crescent dumplings, pleated tops, graphic toasted patches, green garnish, white oval plate with blue rim. |
| Ramen | `yata-counter-lane-1-v3.webp` | Royal blue cream-wave bowl, full thick golden noodles, one large half egg left, large scallion rings centre, large pink-spiral fishcake right, dark green nori at back. |
| Yakitori | `yata-counter-lane-2-v3.webp` | Three densely packed skewers, three chunky chicken pieces and two lime leek sections each, close-fitting charcoal rectangular tray. |
| Pickles | `yata-counter-lane-3-v3.webp` | Chunky yellow half-moons, readable cucumber rounds and faceted pink ginger in a lime square bowl. |
| Takoyaki | `yata-counter-lane-4-v4.webp` | Six generously sized balls in two rows, ivory mayonnaise, green/pink garnish, angular golden paper boat. |
| Dango | `yata-counter-lane-5-v4.webp` | Three skewers with pink, cream and green balls; white square tray with royal blue rim. |

## Provenance

The card files remain unchanged. The earlier v1 models and raster exports are retained. v2 is rendered directly from model code; no earlier raster is edited or fed back into image generation. The production exporter uses lossless WebP so cel boundaries, outlines and alpha are not degraded by lossy compression.

The cel surfaces use normal-directed colour bands, camera-visible emission and a dark diffuse closure for other rays. A bounded elliptical mesh supplies each short contact shadow, fading to zero alpha at its own perimeter. The old Cycles catcher produced a broad ambient alpha rectangle; the v2 models remove it at source. The exporter retains the v2 alpha without the legacy v1 floor subtraction or edge fade.

The exact model brief, commands and final recipe hash are preserved in `MODEL-BRIEF.md`. Each source PNG has an adjacent material and measured-object inventory audit. The Ramen audit requires seventeen thick noodle paths, one large half egg, one fishcake, one nori sheet and eight scallion rings.

## Reproduce from the repository root

```sh
PYTHONDONTWRITEBYTECODE=1 /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python assets/yata/blender/tokyo_toon.py -- --out assets/yata/renders/tokyo-toon-v2 --size 1200 --samples 96
node scripts/yata-dish-renders.mjs tokyo
```

Raw sources are 1200×1200 RGBA PNGs. The versioned WebPs use the existing 720×540 counter frames. `dishRender` resolves v2 throughout the table, Others and inspections. The artwork loading curtain now waits for the six new counter images as well as the existing world and card art.

## Validation

- The final model material and measured-object audits pass for every dish. All six raw PNGs have zero alpha across the outer 32 pixels; the optimized WebPs have transparent margins and the existing 720×540 dimensions.
- SHA-256 verification confirms all six original card files are unchanged, all eighteen new PNG/JSON/WebP files match the reviewed outputs, and all six earlier v1 WebPs remain available. `scope-verify.json` records the final source and geometry-helper hashes.
- The full test suite passes: 907 tests, zero failures, run with `node --experimental-strip-types --test --test-concurrency=4 tests/*.test.mjs`. The initial default-concurrency run exceeded the 100 ms Folio equation timing assertion once; its 21 tests passed in isolation, followed by the complete passing run.
- Typecheck, production build, production-asset/Docker allowlist check and focused lint for the four changed Yata files pass. Global lint reports four errors outside this change: unused `KEYS` in Arena's `moves/duelist.ts`, two semantic-role errors in `coins-table.tsx`, and an unused `isSelf` import in `dial-table.tsx`.
- In connected Chrome, all six v2 table images decoded successfully at 1920×969, 1536×730, 1133×744, 390×844 and 390×664. The image bounds remain inside the viewport and the document dimensions match it. Collected dishes, opponent miniatures including two-serving piles, and the Ramen inspection use v2. The hand continues to use the original card files. `browser-checks.json` records the measured bounds.
- These are browser viewport checks using mouse and keyboard, rather than physical touch-device testing. The viewport override was reset, and the muted local Yata preview remains open.
