# Artwork v7 — 2026-09-09

Final assets generated FROM SCRATCH with the built-in image generation tool using text prompts only. No final call supplied referenced_image_paths or num_last_images_to_include. The existing Yatai cover was inspected manually to describe its style in words. Earlier edit-based candidates were replaced following the user correction; none are used as inputs or final assets. Tide had two independent fresh candidates, with the cleaner cel-shaded candidate selected. Originals remain in the generation directory; versioned PNG copies are stored in `public/art` for compression and integration.

## Provenance

All generated originals are under `/Users/williamguinaudie/.codex/generated_images/01a0873a-aecc-7670-ac05-3a7f4ec71728/`.

| Workspace output | Generated original | Generation |
| --- | --- | --- |
| `public/art/tide-cover-v7.png` | `exec-d3d5c7ae-0c05-421a-874d-2e77ec7eead6.png` | Fresh text only |
| `public/art/grove-cover-v7.png` | `exec-3a179b6c-61d0-4377-9dce-cc21125ca677.png` | Fresh text only |
| `public/art/grove-board-v7.png` | `exec-5af52fa6-91af-40d6-ad97-5308f9365dd5.png` | Fresh text only |

Each output is 1536 × 1024. Tide preserves the cream title and three-card fan while replacing realistic storm microdetail with broader rounded cloud masses. Grove retains its title, six creatures, and habitat palette with rounder creatures and broader painted shading.

## Board layout and rules

The board has no baked-in creatures. Six clearings have irregular vegetation/rock boundaries and connected paths. Top row, left to right: Harmony Hollow (0), Rainbow Ridge (1), Moonlit Pairs (2). Bottom row: Lookout (3), Odd Garden (4), Quiet Glade (6). Riverbank (5) spans the middle horizontally.

The prompt requested top 0–42%, river 42–56%, bottom 56–100%. Visual inspection shows the generated river is somewhat higher, approximately 38–54%, with its label centered around 45.5%. Align interactive regions to the actual image rather than treating requested percentages as exact output. Column centers remain approximately 17%, 50%, and 83%; top clearings center around 22% height, bottom around 74%.

Labels were checked visually against `lib/games/trio/engine.ts`:

| Zone | Embedded text |
| --- | --- |
| Harmony Hollow | Largest group / 1 / 3 / 6 / 10 |
| Rainbow Ridge | 3 per species / 4 species: +4 |
| Moonlit Pairs | Pair: 7 · Single: 1 / 3 or 4 alike: 0 |
| Lookout | 5 each / species only here |
| Odd Garden | 4 per species / with odd count |
| Quiet Glade | One alone: 8 / 2 or 3: 0 |
| Riverbank | 1 each |

Labels are near upper edges of clearings with centers free for pieces. These are short reminders; full accessible engine rules remain necessary, especially clarifying that Harmony Hollow counts one species and Lookout compares species across the rest of the board. Raster labels need in-app small-screen readability verification. No browser/device QA was performed as part of asset generation.

## Yatai food tokens — fresh generation

The cover remains unchanged. Source sheet `public/art/yatai-food-v7.png` was generated fresh from text with no image input, using generated original `exec-06e45c30-bc66-4e18-89c6-9b30caf5f9cb.png` in the same generation directory above. The PNG has genuine transparency; its hidden RGB background is not part of the visible token artwork. A flattened contact sheet was inspected to verify this.

Generation prompt: Create a BRAND NEW game asset sprite sheet from scratch with transparent background. Landscape canvas 1536x1024 divided into an invisible precise 3 columns by 2 rows grid of 512x512 square cells. EXACTLY SIX isolated Japanese night-market food illustrations, one per cell. No grid lines, no borders, no text, no shadows beyond each isolated item, no decorations between cells. Each item fully contained with wide empty transparent 60px margins on all sides. Items centered at x256,768,1280 and y256,768. Top-left: one round warm ivory steamed MOON BUN with a small crescent stamp and subtle folds. Top-center: BERRY FIZZ in a short round clear glass, rosy purple drink, 3 rounded berries and simple bubbles, no long straw. Top-right: CLOUD CAKE, a soft rounded little cream sponge cake with cloud-shaped whipped cream and one berry. Bottom-left: one plump golden dumpling with attractive broad folded pleats. Bottom-center: LANTERN TEA, a rounded ivory ceramic cup with blue leaf motif filled with green tea, no steam outside cell. Bottom-right: STAR SKEWER, three golden rounded star-shaped grilled dumplings on one short diagonal wooden skewer. Style consistent across all six: beautiful polished rounded hand-painted CEL-SHADED illustration, broad clean warm color shapes and 3-tone dimensional shading, like illustrated food on a premium Japanese street-food board game cover. Medium-simple detail, appetizing shapes, smooth surfaces, NOT realistic, no photographic texture, no grain, no microscopic toppings, no character faces. Three-quarter view. Subject diameter approximately 300px in each 512px square cell. Background transparent with absolutely no straight horizontal lines at cell boundaries or anywhere. These will be cropped into six standalone game tokens. Fresh text-only generation; no editing existing images.

The six 512px cells were extracted and resized to 384px square using Sharp, then encoded as WebP quality 86 with alpha quality 100. Use standalone `<img>` elements with object-fit contain rather than sprite background positions, eliminating adjacent-row line leakage. Files `food-0-v7.webp` through `food-5-v7.webp` map directly to engine food kind indices: Moon bun, Berry fizz, Cloud cake, Dumpling, Lantern tea, Star skewer. The extracted artwork was visually checked on a cream background: clean separate silhouettes, no boundary lines, and no clipped food. Generation requested broad stylized shading; rendered drink/cake retain some painted detail but have illustrated outlines and rounded forms.
