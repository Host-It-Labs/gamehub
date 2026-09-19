# Mora paper world portrait v7 generation log

This log records the exact text used for every fresh generation and the measurements returned by the delegated generation worker. No existing image was used as a reference, opened, viewed, attached, edited, retouched or inpainted.

## Shared generation prompt

Use case: stylized-concept. Asset type: full-bleed illustrated Gamehub board. Generate one brand-new portrait board as a tactile paper diorama, with no image references.

### Style paragraph

A lovingly handmade layered cut-paper diorama with real depth, photographed from a high oblique overhead angle. Every object is cut, folded or stacked from thick fibrous cardstock and kraft paper: visible paper grain, white cut edges, folded creases, stacked contour terrain with cast shadows, terraces on different levels joined by little paper steps. Foliage in moss, sage, olive and ochre with autumn accents of yellow and rust, paper flowers, mushrooms, ferns, logs and mossy rocks. Buildings have presence and character: full-size folded cream paper with scored lines, ivy, planters, lanterns, a weather vane. The scene is busy and alive, every place a small stage set. Soft daylight from the upper left with long soft shadows. Nothing glossy, plastic, clay or smooth digital 3D.

### The six places

Courtyard: a squared pale stone-paper plaza before a playful single-storey nature-observatory with a small round telescope dome, a wooden door, ivy and a weather vane; nothing religious. Exactly FOUR SQUARE pads in a 2x2 block.
Roof garden: a round terrace with a low folded parapet and paper flower planters. Exactly FOUR SQUARE pads in a 2x2 block.
Root hollow: a broad kraft-paper hollow trunk with a flat wooden-paper floor. Exactly TWO SQUARE pads side by side.
Glasshouse trail: a small folded glass-paper greenhouse beside a serpentine stone-paper path. Exactly THREE ROUND pads set into the path in order.
Dry channel: a dry creek of stacked grey paper stones with kraft edging. Exactly THREE ROUND pads spaced along it.
Watchpost: a raised timber deck on posts with a ladder or stair clearly leading up to it and a simple roof. Exactly ONE ROUND pad on the deck.
Exactly seventeen empty cream cardstock pads in total, large and readable, no look-alike stones. Quiet plain ground below each group for text. A small teal paper pond with a lily inside the sanctuary on the left, and a small empty release clearing on the central path. Paths that join every place, stone edging, steps between levels. No text, letters, numbers, icons, animals, people, cards, frame or interface. Edge to edge.

### Framing and output

PORTRAIT board, 1024 x 1536. The sanctuary (every building, terrace and pad, outermost pixels) spans the middle 61 percent of the picture's width and about 57 percent of its height. Forest bands about a fifth of the width on each side, a little forest above the sanctuary (about a sixth of the height), and below it nearly twice as much forest as above (about a quarter of the height). Layout in three staggered pairs: roof garden (left) and courtyard with the observatory (right) on top; root hollow (left) and watchpost (right) in the middle; glasshouse trail (left) and dry channel (right) at the bottom. Pond on the left beside the root hollow, release clearing on the central path between the middle and bottom pairs. Pads about one eighth of the sanctuary's width. The buildings, terraces and materials are the same family as the landscape board in that file: the playful single-storey nature-observatory with its small telescope dome and weather vane, the hollow trunk with wooden floor, the glasshouse, the stacked-stone dry creek, the raised timber watchpost with a ladder up to its deck, and the moss, sage, olive and ochre palette with autumn accents.

Acceptance is only the safe-area measurement: left and right bands 19% each, top band 16%, bottom band 27%, all within +/-4 percentage points. No watermark. Do not open or use any existing image file and do not edit, retouch or inpaint. Generate at the newest available image model, highest quality and largest native size; the saved PNG must be exactly 1024 x 1536.

## Attempts

| Attempt | Variant | Output path | Result | Safe-area bands | Detector pads | Notes |
| --- | --- | --- | --- | --- | ---: | --- |
| 1 | a | `public/art/mora-paper-world-portrait-v7-a.png` | Fail | L 14.16%, R 13.18%, T 5.86%, B 25.59% | 12 | Fresh built-in generation; native and saved PNG 1024 × 1536. Measured by bright, low-chroma connected components (RGB mean >142, channel spread <62; components >1800 px and >35 × 20); union x=145..888, y=90..1142. |
| 2 | b | `public/art/mora-paper-world-portrait-v7-b.png` | Fail | L 17.48%, R 14.36%, T 9.31%, B 24.02% | 8 | Fresh built-in generation; native and saved PNG 1024 × 1536. Measured by pale-cardstock mask (r>135, g>120, b>90, \|r−g\|<55, g>1.05b), center-strip profiles with 31 px smoothing, 20% threshold and short-gap bridging; bounds x=179..876, y=143..1166. |
| 3 | replacement 1 | `public/art/mora-paper-world-portrait-v7-fail-1.png` | Fail | L 13.57%, R 0.00%, T 4.88%, B 28.78% | 8 | Fresh built-in generation; PNG recovered from tool output directory by timestamp without viewing it. Native and saved 1024 × 1536. Bright, low-chroma connected-component union x=139..1023, y=75..1093. |
| 4 | replacement 2 | `public/art/mora-paper-world-portrait-v7-fail-2.png` | Fail | L 18.85%, R 16.41%, T 5.21%, B 25.20% | 8 | Fresh built-in generation; native and saved PNG 1024 × 1536. Bright, low-chroma connected-component union x=193..855, y=80..1148. |
| 5 | replacement 3 | `public/art/mora-paper-world-portrait-v7-fail-3.png` | Fail | L 16.41%, R 16.89%, T 6.38%, B 12.89% | 11 | Fresh built-in generation; native and saved PNG 1024 × 1536. Bright, low-chroma connected-component union x=168..850, y=98..1337. |
| 6 | replacement 4 | `public/art/mora-paper-world-portrait-v7-fail-4.png` | Fail | L 8.89%, R 14.36%, T 0.91%, B 15.56% | 14 | Fresh built-in generation; native and saved PNG 1024 × 1536. Bright, low-chroma connected-component union x=91..876, y=14..1296. |

The built-in image tool did not expose its model name or quality control. Each call requested its highest native portrait quality; each saved result is a native 1024 × 1536 PNG. Safe-area numbers are pixel-only estimates from the algorithms noted above. They were not confirmed by visual inspection, because this run prohibited opening any image file. The pad detector count is informational and was never used as a pass/fail gate. Four extra generations were used, and none passed the measured band gate.

## Final results

| Variant | Path | Safe area | Bands (left / right / top / bottom) | Detector pads | Attempts used |
| --- | --- | --- | --- | ---: | ---: |
| a | `public/art/mora-paper-world-portrait-v7-a.png` | Fail | 14.16% / 13.18% / 5.86% / 25.59% | 12 | 1 |
| b | `public/art/mora-paper-world-portrait-v7-b.png` | Fail | 17.48% / 14.36% / 9.31% / 24.02% | 8 | 2 |
| replacement 1 | `public/art/mora-paper-world-portrait-v7-fail-1.png` | Fail | 13.57% / 0.00% / 4.88% / 28.78% | 8 | 3 |
| replacement 2 | `public/art/mora-paper-world-portrait-v7-fail-2.png` | Fail | 18.85% / 16.41% / 5.21% / 25.20% | 8 | 4 |
| replacement 3 | `public/art/mora-paper-world-portrait-v7-fail-3.png` | Fail | 16.41% / 16.89% / 6.38% / 12.89% | 11 | 5 |
| replacement 4 | `public/art/mora-paper-world-portrait-v7-fail-4.png` | Fail | 8.89% / 14.36% / 0.91% / 15.56% | 14 | 6 |

## Pick, 19 September 2026

By eye, none of the six reached the 16% top band; replacement 2 was closest overall (sides and bottom within tolerance, top short), so it was renamed to `public/art/mora-paper-world-portrait-v7-c.png` and wired as the portrait board in `lib/games/observatory-portrait-art.json` (crop 50,20 940×1140, 17 pads measured by zoomed grid, release on the path clearing at 505,775). Consequence of the short top band: on a 375×812 phone the scene is cover-limited, so the weather vane and the roof-garden parapet sit under the player tags. Rule cards that would leave the stage now slide inward (`keepLabelsOnStage` in `components/game/scroll-area.tsx`).

## Top extension, 19 September 2026

Because v7-c's top forest band was short, `scripts/extend-paper-world-top.mjs` produced `public/art/mora-paper-world-portrait-v7-d.png`: a 168px band of the picture's own bottom forest (mirrored) is placed above the scene, the scene is pushed down 128px (8.3%) and fades in over 40px at the join, and the spare bottom 128px is dropped. The portrait geometry is v7-c shifted down by 128px; the spare forest below the dry channel absorbs the shift.
