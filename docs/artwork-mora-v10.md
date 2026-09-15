# Mora sanctuary v10

Generated from a fresh text-only prompt with the built-in image generation tool on 2026-09-14. Existing generated board art was not supplied as a reference or edit target. Creature artwork was inspected only to understand the rounded painterly fantasy style. This replaces the visual direction with a continuous dimensional woodland sanctuary, without a river or card panels.

## Files

- Master: `public/art/mora-sanctuary-v10.png`, 1536 × 1024.
- Runtime: `public/art/mora-sanctuary-v10.webp`, same dimensions, WebP quality 88, 641884 bytes.
- Original generation: `/Users/williamguinaudie/.codex/generated_images/01a0a085-93c6-7be3-bb18-47cbdff0f0d8/exec-b7bc46bb-f3a5-45ba-b960-3b6afbab4793.png`.

## Visual QA and geometry

Inspected the returned image. Exactly seventeen large empty creature spaces are visibly integrated into six habitats: four moss nests, four meadow clearings, two root hollows, three trail terraces, three mushroom-grove nests, one raised lookout. The wooden compost basket is integrated into the upper-right rim. No creatures or words are printed; no central water. Small pathway stones are decorative and visually distinct from creature spaces.

Coordinates below are percentages from the image top-left. These are visual placement guides; labels and tokens must be checked in the rendered game. Habitat bounds include their terrain, not just the spaces. Label locations identify the least-obstructive nearby terrain; brief readable live typography may still require a light shadow or understated backing.

| Habitat | Slot centers (x,y) | Terrain bounds (left,top,width,height) | Suggested label center |
| --- | --- | --- | --- |
| Herd | (11.4,18.4), (24.4,18.2), (11.3,29), (24.8,29) | (4,12,29,27) | (19,37) |
| Variety | (52,17.2), (44.4,24.5), (59.4,24.9), (52.3,34.2) | (39,11,27,31) | (52,41) |
| Pairs | (79,28.2), (89,28.3) | (73,20,24,21) | (85,39) |
| Trail | (10,51.9), (15.9,65), (28.6,69.6) | (2,45,34,37) | (24,79) |
| Shared grove | (45.6,63.9), (58.6,64.7), (51.8,76.2) | (39,48,27,39) | (52,85) |
| Lookout | (84.2,67.4) | (74,54,22,32) | (84,81) |

Standard resting-space ellipses are approximately 9–11% wide and 7–9% tall. The lookout resting ellipse is approximately 14% wide and 11% tall. Basket center: (95,9.7); approximate hit bounds: (90.5,3.7,9,12). Live creature token centers can sit slightly above the ground centers to account for their feet/baseline. Keep hover and focus outlines restrained so the environment remains visible.

## Final prompt

+Use case: stylized-concept. Create a completely NEW premium illustrated board-game environment, landscape 3:2, high-resolution 1536x1024 or larger. It is an immersive warm miniature woodland creature sanctuary, viewed from a high near-top-down three-quarter camera so the entire playable terrain is clear. Beautiful dimensional painterly 3D storybook game art: softly rounded stone and roots, rich moss greens, amber sunlight, lavender flowers, tactile broad brush shading, polished silhouettes. This is an actual magical place with personality, NOT a diagram, UI, cards, panels, a grid, or a word-based board.

The sanctuary houses cute leaf-covered deer, fluffy cloud birds, ember foxes, rounded stone-backed animals, moon rabbits and floating teal finned creatures; DO NOT DRAW ANY CREATURES, people, pieces or tokens. All seventeen resting spaces stay empty for live creatures added by the game. No water or river anywhere; dry winding paths connect habitats.

Compose SIX visually distinct, organic, UNEQUAL and staggered habitats covering nearly all the image, with only a thin decorative forest rim. Each empty creature resting space must be individually legible as a shallow oval moss-lined nest, flat stone terrace or smooth root hollow physically built into the terrain, not an outlined UI circle. EXACT counts:
1. Upper left: large amber-and-moss herd clearing, EXACTLY FOUR roomy shallow ground nests arranged two by two, centered approximately at x=15%,29% and y=23%,37%. Each is separate.
2. Upper middle: flower meadow, EXACTLY FOUR pale grassy resting spaces arranged a loose diamond around x=52%, y=30%. Four, not five.
3. Upper right: aged twisting tree roots make EXACTLY TWO adjacent empty root hollows around x=76%,88%, y=32%. Smaller habitat.
4. Lower left: a curved elevated dry trail with EXACTLY THREE broad stepping-stone resting terraces, centered near (12%,70%), (24%,77%), (32%,65%). These are the only large stepping stones, with tiny connecting gravel clearly different.
5. Lower middle: cozy lilac mushroom grove with EXACTLY THREE empty moss nests in a triangle near (46%,65%),(59%,65%),(53%,79%).
6. Lower right: solitary elevated lookout, EXACTLY ONE large broad empty flat stone ledge centered near (80%,75%), surrounded by low ferns, overlooking the scene.

Seventeen large usable resting spaces in total: 4 + 4 + 2 + 3 + 3 + 1. Maintain generous empty centers and enough spacing for creature tokens; no decorative extra circles or empty nests that look playable. Habitats differ in elevation, shape, size, edging, vegetation and color while all belong to the same continuous forest environment. Keep unobstructed pale natural earth beside each group for a compact runtime rule label; do not print text or fake lettering. Small wooden compost basket with leaf scraps integrated into the extreme upper-right forest rim around (94%,12%), separate from the twin root hollows; it is the discard location, clearly visible and reachable. No border frames, no captions, no lettering, no watermark. Avoid flat UI boxes, regular six-card layout, huge central empty space, large foreground trees blocking areas. Detail should enrich the outer edges and boundaries, leaving all 17 resting-space interiors clean and clear.
