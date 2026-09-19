# Observatory wide v7 dimensional iteration

Fresh single-scene corrective generation using built-in imagegen on2026-09-16. Asset `public/art/observatory-wide-v7.png`, **1536 ×1024** landscape3:2. Previously visually inspected v6 served as style/layout reference with a requested1.7× camera pullback; no manual image compositing or repeated panels. Existing artwork is preserved.

## Inspection and successful dimension target

The sanctuary is now small enough for a **384 ×256px physical3:2 gameplay crop**, exactly25% of the fullsource width andheight. Recommended **sourcepixelcrop x560,y368,width384,height256**. Normalized: **x36.45833333%,y35.9375%,width25%,height25%**. Fullscene extends fourtimes cropwidth/height. Nurserycenters are49pxbelow crop top, leaving room for standees. Padgroups remain in correct4/4/2/3/3/1capacities. Treehousewoodlandleft andfarmvalleyright flowcontinuously through upper/lower terrain.

This is a dimensionaliteration candidate, not a highresolutionfinalasset: playablecrop has only384nativepixels ofwidth. Native output is1536 ×1024, not4K. No fakeupscale. The distanttopmountains include a small skyband. Some nearestforeground depthblur remains despite prompt requesting sharpentireimage. Browser/touch/layout are unverified.

## Slot geometry

Visually measuredapproximately ±1.5px in fullsource1536 ×1024. Convert to boardpercent with `x=(pixelX-560)/384*100`, `y=(pixelY-368)/256*100`.

| Habitat | Source pixel centers | Source percent centers |
| --- | --- | --- |
| nursery | 645, 417; 669, 417; 639, 430; 665, 430 | 41.992, 40.723; 43.555, 40.723; 41.602, 41.992; 43.294, 41.992 |
| courtyard | 732, 477; 769, 477; 732, 496; 769, 496 | 47.656, 46.582; 50.065, 46.582; 47.656, 48.438; 50.065, 48.438 |
| grove | 599, 562; 634, 565 | 38.997, 54.883; 41.276, 55.176 |
| trail | 722, 576; 757, 585; 794, 583 | 47.005, 56.250; 49.284, 57.129; 51.693, 56.934 |
| terraces | 854, 477; 884, 516; 883, 550 | 55.599, 46.582; 57.552, 50.391; 57.487, 53.711 |
| lookout | 850, 433 | 55.339, 42.285 |

Suggested sourcepixelbounds and labelcenters (notbrowserverified):

| Habitat | Bounds x/y/width/height(px) | Label center x/y(px) |
| --- | --- | --- |
| Nursery | 619 /399 /67 /47 | 652 /400 |
| Courtyard | 707 /459 /85 /51 | 750 /460 |
| Grove | 576 /546 /78 /35 | 615 /547 |
| Trail | 698 /560 /116 /43 | 756 /560 |
| Terraces | 830 /458 /78 /109 | 853 /459 |
| Lookout | 829 /417 /43 /27 | 850 /417 |

## Exact prompt

```text
Create a fresh composition based on this reference scene, as if CAMERA ZOOMS OUT 1.7 TIMES. Landscape1536x1024. The entire referenceimage should occupy only the MIDDLE60%WIDTH AND MIDDLE60%HEIGHT of newcanvas, with NEW coherent paperland extending a further20% ofcanvas on allfour sides. IMPORTANT: the central sanctuary must be MUCH SMALLER than shown in reference. It should appear only60%of its current pixelwidth/height. Do not simply reproduce its framing. Keep same dimensional handcrafted cardstock style throughout newlandscape. No imagewithinimage rectangle, no framedboard, no fadedseams: single continuous landscape.

The reference sanctuary has exactly17 blankcreaturepads in6habitats. Retain their relative arrangement but make all17fit inside a384pixelwide by256pixelhigh centralrectangle of1536x1024finalimage. This means the entire sanctuary is onlyONEQUARTER imagewidth. Place its padgroup footprint x576..960pixels,y330..586pixels. Observatory green dome behind central4courtyardpads, upperleft4nurserypads, lowerleft2treegrovepads, lowercenter3trailpads,right3terracedpads,upperright1lookoutpad. No extra pads.

The remaining THREEQUARTERS ofimagewidth should be genuine richpaperterrain: wide woodland/treehouses/windingpaths left and farmvalleys/meadows/fields/farmbuildings right. Additional hugepaperhills/forest area above and paperforeground/streams/plants below. The sanctuary must not dominate the composition. Create new broader countryside for a gameworld background, miniature central landmark plus extensivecontinuous terrain. Papertexture and simple chunky foldedpaperconstruction like reference. Sharp acrosswholeimage, no depthblur. No text/UI/cards/animals/standees/numbers/logos. No repeatedsanctuary, no vignette, no blankborders. The point of thisimage is a significantly wider camera with sanctuary only25% of fullwidth.
```

Cache source: `/Users/williamguinaudie/.codex/generated_images/01a0aae0-5e47-76c3-b776-02292d8df58b/exec-792d791d-c929-44bd-add2-b2334584fc8c.png`.

