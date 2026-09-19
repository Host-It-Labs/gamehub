# Observatory paperland tall v5

Generated fresh with built-in imagegen on 2026-09-16 as one continuous **portrait2:3 scene,1024 ×1536px**. Asset: `public/art/observatory-paperland-tall-v5.png`. Existing v4 and the repository copy `docs/concepts/2026-09-16/observatory-paper-style-reference.png` were visually inspected and supplied solely as material/layout references. No editing, outpainting, duplicated panels or image compositing.

## Visual inspection

Exact requested tall orientation. The central sanctuary remains horizontally prominent, with substantial new mountains, woodland, waterways and countryside above, and a long coherent stream, paths, papercut foliage and meadow below. Cardstock construction matches the accepted v4. All17 blank pads appear in the correct six groups. The scene reaches every edge; topmost edge has a very small pale gap between mountain tips rather than the requested completely sky-free edge. No UI or creatures. Actual output is1024 ×1536, not a higher-resolution source.

## Measured geometry

A close physical3:2 crop containing allpads is **source pixel x145,y475,width720,height480**. Source normalized bounds are **x14.16015625%,y30.92447917%,width70.3125%,height31.25%**. Architectural dome and towers intentionally extend above this crop into the full source. The crop is for target coordinate mapping, not clipping the full rendered illustration.

If creature standees need additional upper headroom, use **x125,y445,width780,height520**, also exactly3:2. This places the nursery pad centers66px below the crop top instead of36px. Final crop selection belongs to integrated layout review; do not hide the full scene outside the crop.

Centers measured visually to approximately ±2px. Convert sourcepixel to closecropboard percentage with `x=(pixelX-145)/720*100`, `y=(pixelY-475)/480*100`.

| Habitat | Source pixel centers | Source percent centers |
| --- | --- | --- |
| nursery | 257, 511; 318, 510; 253, 547; 318, 546 | 25.098, 33.268; 31.055, 33.203; 24.707, 35.612; 31.055, 35.547 |
| courtyard | 474, 670; 562, 670; 476, 711; 564, 711 | 46.289, 43.620; 54.883, 43.620; 46.484, 46.289; 55.078, 46.289 |
| grove | 195, 837; 275, 845 | 19.043, 54.492; 26.855, 55.013 |
| trail | 459, 883; 537, 908; 621, 905 | 44.824, 57.487; 52.441, 59.115; 60.645, 58.919 |
| terraces | 763, 667; 811, 755; 805, 832 | 74.512, 43.424; 79.199, 49.154; 78.613, 54.167 |
| lookout | 758, 557 | 74.023, 36.263 |

Suggested label and habitat bounds are in **source pixels**, not board percentages:

| Habitat | Bounds x/y/width/height(px) | Label center x/y(px) |
| --- | --- | --- |
| Nursery | 215 /480 /140 /92 | 285 /485 |
| Courtyard | 429 /636 /180 /107 | 518 /642 |
| Grove | 151 /800 /168 /82 | 235 /808 |
| Trail | 414 /850 /251 /90 | 540 /855 |
| Terraces | 713 /631 /141 /235 | 760 /636 |
| Lookout | 710 /525 /95 /53 | 758 /530 |

Bounds and labels are proposed integration geometry, not browser-verified UI. Coordinates can be adjusted to leave room for physical creature bases and labels. No browser or touch checks performed.

## Exact prompt

```text
Generate a completely NEW original PORTRAIT illustration. Output aspect ratio MUST BE 2:3 PORTRAIT, 1024pixels wide by1536pixels tall (or larger exact2:3). The attached landscape references are ONLY for paper MATERIALS and central sanctuary geography. Do NOT copy their landscape aspect ratio. This output MUST be tall, with much more landscape ABOVE AND BELOW a compact central sanctuary. No outpainting/editing; fresh single unified coherent scene.

A handcrafted miniature wildlife sanctuary reclaimed from an abandoned observatory, built entirely of thick cut textured cardstock. Keep reference image1's beautiful dimensional layered paper trees, folded green oxidized dome, ivory cardboard architecture, stacked cardboard cliffs, crisp papercut foliage and warm handmade style. Camera elevated three-quarter, clear floor spaces. Sage/jade/moss/ochre/blush paper with directional warm light. Individual chunky paper tree silhouettes, not realistic tiny aerial forest.

PORTRAIT COMPOSITION STRICT:
Top35% of tallimage: genuine illustrated layered paper hills, woodlands and winding paths, no empty sky. No placement pads.
Middle approximately29% of tallimage (y35%..64%): the COMPLETE playable sanctuary, WIDE and compact horizontally, occupies x16%..81%. This central gameplay area has a physical3:2 rectangle shape on this portrait2:3 canvas. Keep all17 empty creature pads within this central rectangle. Observatory architecture may project upward slightly but creature spaces MUST stay in middle29% of image height.
Bottom36%: generous illustrated paper foreground, meadows, a stream, footpaths, flowers, ferns, paper rocks and low hills. No placement pads.
Left and right of central sanctuary: moderate woodland/treehouses left, modest folded-paper farmvalley/fields/farmhouse right.
Do NOT spread the sanctuary and pads vertically throughout the portrait. It must stay a compact landscape-shaped grouping in the MIDDLE of the tall scene. The much taller scene supplies real scenery above and below.

Exactly SEVENTEEN roomy blank pale ivory oval pads in six distinct linked physical habitats, with allpads inside x16..81%,y35..64%:
- upper-left raised nursery FOUR pads in2x2, center ofgroup(30%,39%).
- central courtyard FOUR pads in2x2 infront ofdome, center ofgroup(49%,48%).
- lower-left hollowtree grove TWO adjacent pads, center ofgroup(28%,58%).
- lower-middle greenhouse/gardentrail THREE pads gently curving, center ofgroup(50%,61%).
- rightsteppedterraces THREE pads vertically staggered center ofgroup(73%,49%).
- upper-right lookout ONE pad near(72%,38%).
Pads blank,noicons. No extra pads. Stairs, terraces, natural paperground connect allhabitats. No building orfoliage occludes pads.
Strong centralgreen dome, charming layeredcarvedpaperarchitecture like references. Substantial continuous terrain and hills above, streams meadows paths plants below. Everyedge fully illustrated, no repetition, no copiedpatches, no fade, no solidgreenmargin, no vignette, no frame or rectangular boardedge, no tabletop. NO creatures, animals, people, gamepieces,cards, interface,text,numbers,symbols,logos. No photoreal countryside, glossyplastic, aerialminiaturization orhundredsoftinytrees.
Remember exact portrait2:3 orientation with sanctuary confined to central landscape3:2 block, abundant new scenery above and below.
```

Cache provenance: `/Users/williamguinaudie/.codex/generated_images/01a0aae0-5e47-76c3-b776-02292d8df58b/exec-7487da4b-b7a5-45ae-b1cf-d27e1750d711.png`.


## Runtime integration

The selected crop is **left125, top445, width780, height520 pixels**, leaving headroom for standees. `lib/games/observatory-art.json` is the shared source of image dimensions, crop bounds and runtime paths. The full 1024 ×1536 portrait is rendered as the scene; a generated 780 ×520 crop serves miniatures and the initial board placeholder. It is not painted alongside the full scene. Measured pad centers are retained, while labels are placed below their creature groups.

The separately scaled CSS background has been removed. SVG and WebGL use the same full-source transform; SVG is hidden after WebGL becomes ready and restored if it fails. The tall source provides real top/bottom scenery instead of a second copy. Typical portrait board scale is retained; landscape may zoom and scroll uniformly to cover the wider screen.
