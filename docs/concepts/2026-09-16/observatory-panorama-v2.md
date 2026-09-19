# Observatory panorama v2

Generated from scratch on 2026-09-16 using the built-in imagegen tool; no reference image, editing or outpainting. Source: `public/art/observatory-panorama-v2.png`. The requested 3840 × 2560 output was returned as **1536 × 1024**; do not describe it as native 4K.

Generation source: `/Users/williamguinaudie/.codex/generated_images/01a0aae0-5e47-76c3-b776-02292d8df58b/exec-e4fc3697-abd0-45da-9880-b22c1fac3d22.png`.

## Visual inspection and geometry

Reviewed the full generated image. One continuous paper countryside contains forests/treehouses/waterfalls left and a valley of farms, fields, river and mill right. Detailed hills and foreground reach every edge, with no faded green margin. All seventeen pale creature spaces are visible. The artwork is more detailed than the preceding paper illustration and the reduced central map has a native usable width of approximately 614 pixels.

Recommended proportional playable crop: source **x30%, y28%, width40%, height40%** (614.4 × 409.6 px; same 3:2 ratio). This contains all habitats, including some architectural context. Source slot centers were visually measured to approximately ±2 pixels. Convert to cropped-board percentage with `x=(sourceX-30)/0.4`, `y=(sourceY-28)/0.4`.

| Habitat | Source pixel centers (1536 × 1024) | Source percent centers |
| --- | --- | --- |
| nursery | 568, 345; 622, 345; 565, 384; 622, 384 | 36.979, 33.691; 40.495, 33.691; 36.784, 37.500; 40.495, 37.500 |
| courtyard | 750, 433; 823, 434; 748, 484; 823, 483 | 48.828, 42.285; 53.581, 42.383; 48.698, 47.266; 53.581, 47.168 |
| grove | 534, 582; 595, 583 | 34.766, 56.836; 38.737, 56.934 |
| trail | 715, 614; 778, 632; 843, 638 | 46.549, 59.961; 50.651, 61.719; 54.883, 62.305 |
| terraces | 989, 467; 982, 512; 997, 559 | 64.388, 45.605; 63.932, 50.000; 64.909, 54.590 |
| lookout | 958, 334 | 62.370, 32.617 |

Approximate source bounds suitable for habitat hit regions and label placement:

| Habitat | Bounds x/y/width/height (%) | Suggested label center x/y (%) |
| --- | --- | --- |
| Nursery | 33.2 / 30.4 / 9.8 / 10.6 | 38.1 / 30.8 |
| Courtyard | 45.0 / 39.6 / 11.5 / 11.5 | 50.6 / 39.9 |
| Grove | 31.2 / 53.8 / 10.0 / 8.2 | 36.2 / 54.2 |
| Trail | 43.6 / 57.6 / 14.0 / 8.7 | 50.5 / 58.0 |
| Terraces | 61.4 / 42.6 / 6.5 / 15.5 | 64.6 / 43.0 |
| Lookout | 59.4 / 30.3 / 6.6 / 5.5 | 62.7 / 30.5 |

The explicit placement circles have approximately 48–55 px width in the source (7.8–9.0% of the proposed board crop). Label positions are suggested placements, not browser-verified UI acceptance. No browser or touch checks performed.

## Exact generation prompt

```text
Use case: stylized-concept.
Asset type: seamless single-scene full-screen landscape illustration for the Mora Observatory game. Generate completely fresh artwork from scratch. Landscape 3:2, request 3840x2560 or largest supported 3:2 resolution with very crisp fine detail.

A vast, lush countryside constructed entirely from tactile colored paper, sculpted layered cardstock and folded architectural details, viewed from a high, nearly overhead isometric camera. Calm warm afternoon sunlight, creamy pale stone, sage and jade foliage, golden farm fields and dusty terracotta. Confident sophisticated handcrafted storybook miniature, dimensional paper edges and cast shadows, no plastic.

CRITICAL FRAMING: This is a HUGE countryside surrounding a SMALL CENTRAL playable sanctuary. The complete sanctuary including ALL seventeen placement pads fits ONLY in the MIDDLE 40% OF IMAGE WIDTH AND MIDDLE 40% OF IMAGE HEIGHT, from x30% to x70%, y30% to y70%. This central rectangle is not visibly outlined. The landscape surrounding this rectangle fills the remaining 84% of the canvas with genuinely illustrated land. Do not enlarge the sanctuary to fill the image. Leave an enormous amount of meaningful countryside above, below, left and right. View it as a very wide aerial land survey with the observatory village in the middle. The landscape reaches every edge.

Central sanctuary: weathered abandoned astronomical observatory with a small oxidized copper dome, gardens, reclaimed greenhouse, stone terraces, nursery beds, sheltered grove, lookout, winding paths. Wildlife sanctuary awaiting creatures, no animals pictured. Exactly seventeen generously empty pale cream circular/oval stone placement spaces, organized into six visually distinct physical habitats within that central 40% rectangle:
1) Central observatory courtyard: four pads in a tidy two by two cluster around x48..55%, y42..51%.
2) Upper-left nursery: four pads in a two by two cluster around x35..42%, y34..42%.
3) Lower-left sheltered grove: two pads alongside each other around x35..42%, y57..63%.
4) Lower-central greenhouse trail: three pads following a winding gentle line around x46..56%, y58..65%.
5) Right terraced gardens: three pads around x61..66%, y46..59%.
6) Upper-right raised lookout: one pad near x63%, y35%.
These are simple unprinted empty physical placement stones, never diagrams or UI. No extra placement pads elsewhere. Habitats connect organically via small paths, vegetation and terrain.

Outside this central sanctuary, ABUNDANT intricate varied scenery:
LEFT THIRD: dense layered varied-height forests, leafy canopy, winding footpaths, occasional abandoned timber platforms and treehouse shelters, fern gullies, stepped woodland geography.
RIGHT THIRD: broad meandering fertile valley, meadows, tiny farmhouses and barns, hedgerows, differently shaped golden/green tilled fields, orchards, small stream and rural lane.
TOP THIRD: far rolling wooded hills and layered patchwork countryside all the way to the top edge, no blank sky band.
BOTTOM THIRD: richly detailed foreground paper ferns, flowers, shrubs, curved paths, small rustic fence sections, meadow geography transitioning naturally between forest and farm, no empty foreground.
Terrain, shadows, tree crowns and paths flow continuously across the whole illustration. Natural irregular landscape with NO island, NO rectangular board, NO frame, NO vignette or edge fading, NO flat solid margins, NO empty green border. No hard division between central map and surrounding scenery. No typography, labels, numbers, symbols, logos, playing cards, creatures or interface.
```

