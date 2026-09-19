# Observatory paperland v4

Fresh single-scene generation with built-in imagegen on 2026-09-16. Source: `public/art/observatory-paperland-v4.png` (**1536 × 1024**, largest resolution requested). References: user-provided `/Users/williamguinaudie/Downloads/Codex Image 16 Sept 2026, 16_34_56.png` and `public/art/observatory-paperland-v3.png`, both used for **style/material**, not edit targets. No earlier image was edited or outpainted. The v3 reference had been visually inspected as the preceding generated result.

## Inspection and geometry

The fresh scene retains v3's tactile thick paper foliage, layered ivory construction, folded dome and stacked cardboard terrain. Surrounding woodland/treehouses, farmland, hills and foreground are substantially more visible than v3. All seventeen blank pads are visible in six correct-capacity groups. There are no solid green margins or faded perimeter. Actual resolution is1536 ×1024.

Recommended playable crop: **x17.5%, y17.5%, width65%, height65%**, same3:2 ratio. This contains all pads (left grove pad's left edge is close to the crop edge). Dome and surrounding habitat architecture extend into the background above/around the crop, deliberately continuing as the one full-scene image. Do not interpret the crop as containing every architectural extremity. If hit regions need further left padding, an alternative is x16.5%,y16.5%,width67%,height67%.

Coordinates are source pixels and percentages measured visually to approximately ±2px. Transform to recommended cropped-board coordinates with `x=(sourceX-17.5)/0.65`, `y=(sourceY-17.5)/0.65`.

| Habitat | Source pixel centers | Source percent centers |
| --- | --- | --- |
| nursery | 388, 209; 476, 209; 381, 251; 475, 250 | 25.260, 20.410; 30.990, 20.410; 24.805, 24.512; 30.924, 24.414 |
| courtyard | 696, 401; 806, 400; 692, 450; 808, 449 | 45.313, 39.160; 52.474, 39.063; 45.052, 43.945; 52.604, 43.848 |
| grove | 318, 597; 410, 604 | 20.703, 58.301; 26.693, 58.984 |
| trail | 674, 642; 771, 673; 880, 666 | 43.880, 62.695; 50.195, 65.723; 57.292, 65.039 |
| terraces | 1095, 375; 1167, 480; 1142, 561 | 71.289, 36.621; 75.977, 46.875; 74.349, 54.785 |
| lookout | 1101, 243 | 71.680, 23.730 |

| Habitat | Suggested bounds x/y/width/height (%) | Suggested label center x/y (%) |
| --- | --- | --- |
| Nursery | 21.7 / 17.5 / 13 / 10.5 | 28.2 / 17.8 |
| Courtyard | 41.2 / 36 / 15 / 12 | 48.7 / 36.4 |
| Grove | 17.5 / 54.5 / 13 / 10.5 | 24 / 55 |
| Trail | 39.9 / 59.5 / 21.7 / 10.5 | 50.7 / 59.9 |
| Terraces | 67.6 / 32.8 / 13 / 25.5 | 71.2 / 33.2 |
| Lookout | 67.7 / 20.1 / 8 / 6.7 | 71.7 / 20.5 |

These label locations are proposals, not validated browser layout. Terrace hit-region bounds cover a tall irregular group and should avoid blocking other DOM controls. No browser, touch or final composed UI checks performed.

## Exact prompt

```text
Generate a NEW original single landscape illustration from scratch, not an edit or outpainting. 3:2 aspect ratio, largest supported resolution. Attached image1 is material reference, image2 is material/style reference too. Retain their excellent tangible handmade paper miniature style but CHANGE composition to a somewhat wider view with more countryside around the sanctuary.

Essential materials: thick cut cardstock edges, chunky folded tree silhouettes, textured layered paper leaves, pale cardboard stone walls, stacked cardboard cliffs, ivory observatory with folded oxidized green dome. Clearly HANDCRAFTED PAPER DIORAMA, restrained graphic detail, warm directional light. Not realistic aerial countryside, no tiny thousands of distant trees. No tabletop, no UI, no animals/creatures, no text.

CRITICAL layout: precisely frame the COMPLETE sanctuary with all17 placement spaces inside central65% of image: x17.5%..82.5%, y17.5%..82.5%. There must be a CONTINUOUS illustrated scenery margin at least17.5% wide on left AND right, and17.5% tall at top AND bottom. Pull camera back moderately compared image2: show20% more genuine surroundings on every side. The leftmost playable pad must NEVER be left ofx22%, rightmost NEVER right ofx78%. Do NOT make left grove extend to x10%. Do NOT make sanctuary fill80% width. Entire dome, lookout and all gameplay architecture sits within middle65%. Still a readable close paper model, not a distant aerial map.

Exactly17 generously empty plain ivory oval pads distributed into six connected physical habitats around a central domed observatory. Centers below refer to percentage across/full image:
UPPER-LEFT NURSERY:4 pads in2x2 group, centers near(27%,29%),(33%,29%),(27%,35%),(33%,35%).
CENTRAL COURTYARD:4 pads in2x2 group, centers near(45%,45%),(52%,45%),(45%,51%),(52%,51%), located in front of large central observatory dome.
LOWER-LEFT HOLLOW-TREE GROVE:2 pads sideby side near(25%,65%) and(32%,65%).
LOWER-CENTRAL GREENHOUSE TRAIL:3 pads in gentle curve near(43%,69%),(50%,72%),(57%,70%).
RIGHT STEPPED TERRACES:3 pads vertically staggered near(72%,44%),(74%,53%),(72%,62%).
UPPER-RIGHT LOOKOUT:1 pad near(72%,29%).
All pads blank no symbols. All visible not blocked by architecture. Humanbuilt habitat spaces use physical stairs, walls and railings, connected by terrain and paths.

Scenery surrounds whole central65% sanctuary without a visible boundary. LEFT surrounding17.5%: large chunky paper woodland with treehouses and winding path. RIGHT surrounding17.5%: simplified folded-paper meadow valley, little farmhouse, hedgerow and field. TOP surrounding17.5%: paper hills and forest scenery, no blank sky. BOTTOM surrounding17.5%: layered ferns and flowers, meandering stream and paper terrain. Every edge full of real coherent illustrated landscape, NO faded solid green margin, NO vignette, NO rectangular board edge. Remain close enough that every tree is a clear constructed paper object, not a realistic countryside. Distinct restrained sage/moss/jade/ochre/blush paper colors. Crisp readable habitats, no heavy blur.

```

Cache provenance: `/Users/williamguinaudie/.codex/generated_images/01a0aae0-5e47-76c3-b776-02292d8df58b/exec-c692c5e2-df81-4953-8534-ec2d52134c51.png`.


## Integrated crop

The runtime uses **x16%, y13%, width65%, height65%**. This keeps the same moderate framing but shifts the crop upward and slightly left, leaving headroom for nursery standees and space around the grove. Habitat labels sit below their creature groups so they do not overlap the upper portion of occupied standees. Exact DOM bounds and labels are in `lib/games/trio/mora-map.ts`; source slot centers above are unchanged.

The user's style reference is retained in `docs/concepts/2026-09-16/observatory-paper-style-reference.png`. The generated scene was visually reviewed before integration.
