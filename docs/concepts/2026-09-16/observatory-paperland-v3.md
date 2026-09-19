# Observatory paperland v3

Fresh single-scene generation with built-in imagegen on 2026-09-16. Source: `public/art/observatory-paperland-v3.png` (**1536 × 1024**, despite requesting largest supported resolution). Reference `/Users/williamguinaudie/Downloads/Codex Image 16 Sept 2026, 16_34_56.png` was visually inspected and provided as a **style/material reference**, not an edit target. No prior panorama was edited or outpainted.

## Inspection and limitations

The result strongly follows the supplied reference's tactile cut cardstock trees, thick leaf edges, folded dome, layered ivory architecture and physical stepped habitats. Seventeen blank pads are visible. The scene has continuous woodland left and a small farmland area right, with no vignette or flat margin.

**Composition variance:** the requested middle 60% sanctuary was not honored. Actual pad bounds span approximately x10–85%, y16–75%. Do not apply a 60% crop: it clips habitats. Recommended safe proportional crop: **x8%, y8%, width80%, height80%**, same 3:2 aspect ratio. This scene therefore offers less surrounding scenery than requested; the user/parent must review before integrating. The dome itself extends above that crop; full-scene rendering still displays it. No browser or touch validation.

The following centers are measured visually to approximately ±2 px. Source percentages use the full1536 ×1024 image. For the suggested 80% crop, transform `x=(sourceX-8)/0.8`, `y=(sourceY-8)/0.8`.

| Habitat | Source pixel centers | Source percent centers |
| --- | --- | --- |
| nursery | 300, 194; 402, 189; 296, 240; 405, 236 | 19.531, 18.945; 26.172, 18.457; 19.271, 23.438; 26.367, 23.047 |
| courtyard | 700, 408; 824, 408; 696, 459; 826, 459 | 45.573, 39.844; 53.646, 39.844; 45.313, 44.824; 53.776, 44.824 |
| grove | 205, 610; 300, 621 | 13.346, 59.570; 19.531, 60.645 |
| trail | 700, 681; 799, 718; 917, 739 | 45.573, 66.504; 52.018, 70.117; 59.701, 72.168 |
| terraces | 1151, 330; 1249, 450; 1242, 586 | 74.935, 32.227; 81.315, 43.945; 80.859, 57.227 |
| lookout | 1197, 197 | 77.930, 19.238 |

| Habitat | Approximate bounds x/y/width/height (%) | Suggested label center x/y (%) |
| --- | --- | --- |
| Nursery | 15 / 15.5 / 16 / 11 | 23 / 15.8 |
| Courtyard | 41 / 36.2 / 17 / 13 | 49.5 / 36.8 |
| Grove | 9 / 56 / 15 / 10 | 16.5 / 56.4 |
| Trail | 41 / 63 / 23 / 13 | 52 / 63.2 |
| Terraces | 71 / 29 / 15 / 32 | 75 / 29.4 |
| Lookout | 74 / 16 / 9 / 6 | 78 / 16.3 |

Labels are suggested UI placements and need layout review. Terrace bounds intentionally cover all three vertically separated terraces, and may require narrower individual hit areas if they overlap architecture.

## Exact prompt

```text
Use case: stylized-concept. Asset: 3:2 landscape game environment, largest supported high resolution.

Create an entirely NEW single continuous scene using the attached image ONLY AS A STYLE AND MATERIAL REFERENCE. The reference's handcrafted paper miniature aesthetic is crucial: thick visibly cut cardstock edges, layered paper leaves, individual folded-paper tree silhouettes, flat painted paper surfaces, chipped ivory cardboard stonework, a striking folded pale green observatory dome, stacked cardboard cliffs, physically constructed stairs and railings. Warm handcrafted diorama with restrained simplified decorative detail. This must look like a close-up of a tactile model, NOT a realistic aerial countryside photograph, NOT sprawling thousands of tiny detailed trees. No creatures, animal standees, cards, text, interface or tabletop from the reference.

Composition: elevated three-quarter camera, enough top-down view to clearly expose placement floors. One strong large abandoned domed observatory in the middle, with reachable stepped habitats and paper woodland reclaiming the infrastructure. The complete playable sanctuary occupies the middle SIXTY PERCENT of width and middle SIXTY PERCENT of height, approximately x20..80%, y20..80%. This is a close, readable miniature, with MODERATE additional landscape beyond it: layered chunky paper forest on left, simple folded-paper meadow valley and a small farmhouse/field on right, paper plants and a path in foreground, cut-paper hills and foliage at back. All landscape flows continuously to every image edge. No blank margins. No hard rectangular board boundary. NO wide aerial vista or horizon of thousands of buildings.

Within the central x20..80%,y20..80% area create exactly SEVENTEEN large empty pale ivory round or gently oval stone placement pads, naturally built into six DISTINCT connected habitats. Large enough to place creature pieces later; pads completely blank:
- upper-left raised nursery: FOUR pads in a two-by-two arrangement.
- central observatory courtyard in front of dome: FOUR pads in a two-by-two arrangement.
- lower-left sheltered hollow tree grove: TWO adjacent pads.
- lower-middle garden/greenhouse winding trail: THREE pads in a gentle sequence.
- right stepped terraces: THREE vertically staggered pads.
- upper-right high lookout: ONE pad.
No extra circles or pads. Strong visual separation of these physical spaces through cardstock elevation, stairs, foliage and building shapes, never separated UI boxes. Tall architecture must not occlude any pad. The observatory dome must retain readable large-scale charming paper construction like the reference.

Materials: sage, moss and desaturated jade cardstock foliage mixed with cream, ochre and blush cutouts; creamy layered cardboard limestone architecture; tiny deliberate paper ivy and blossoms; folded roof panels. Soft warm directional light makes paper thickness and folds visible. Keep every habitat crisp, no heavy depth-of-field blur. Understated grown-up crafted aesthetic.
Avoid: photorealistic landscape, plastic 3D toys, glossy foliage, detailed realistic trees, excessive microscopic decoration, green empty border, dark vignette, dark edges, frame, visible table outside model, floating island, cut-out rectangular map, UI, any writing, icons, numbers, creatures or hands.
```

Generated cache source: `/Users/williamguinaudie/.codex/generated_images/01a0aae0-5e47-76c3-b776-02292d8df58b/exec-da6e34cb-ed0d-44ff-b383-2357bc08593a.png`.

