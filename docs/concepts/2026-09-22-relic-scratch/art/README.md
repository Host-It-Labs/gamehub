# Relic scratch atelier artwork

Fresh artwork generated on 22 September 2026 with the built-in
`image_gen.imagegen` tool. The three initial images used independent written
briefs; no previous game or cover images were opened or supplied as references.
The dedicated portrait composition is not a crop of the landscape.

The visual language is a tactile midnight ticket-printing atelier: continuous
petrol-teal leather, warm cream paper, worn copper/brass, marigold lamplight,
coral/sage ink, textured paper and curled foil. The cover has the exact title
**Relic**, generated once inside the image, and two partially scratched moon
tickets. It is a full-bleed illustration with no box mockup or interface.

## Production exports

All production files use WebP quality 86. Desk plates and the main cover retain
native generated resolution; only the responsive cover variants are resized.

| File | Actual size | Bytes |
| --- | --- | ---: |
| `public/art/relic/scratch-desk-landscape-v1.webp` | 1536 × 1024 | 307730 |
| `public/art/relic/scratch-desk-portrait-v1.webp` | 1024 × 1536 | 355848 |
| `public/art/optimized/box-relic-scratch-v1.webp` | 1254 × 1254 | 472494 |
| `public/art/optimized/box-relic-scratch-v1-320.webp` | 320 × 320 | 41384 |
| `public/art/optimized/box-relic-scratch-v1-640.webp` | 640 × 640 | 147322 |
| `public/art/optimized/box-relic-scratch-v1-960.webp` | 960 × 960 | 294216 |
| `public/art/optimized/box-relic-scratch-v1-spine.webp` | 150 × 1254 | 57094 |

The cover request was 1024 × 1024; the generator returned 1254 × 1254.
The spine uses the leftmost 150 source pixels, following the existing Relic
cover export convention. Sources, prompts and production outputs have SHA-256
hashes in `provenance.json`. Reproduce exports from the repository root with
`node docs/concepts/2026-09-22-relic-scratch/art/export.mjs`.

## Geometry and art review

These are decorative background plates, with **zero painted gameplay targets**
and **zero protected landmarks**. Every prop is expendable peripheral decoration.
The play surface is straight-down and parallel to the screen, with one light
from the upper left and shadows to the lower right. The app should draw its own
paper ticket above the central teal field.

- Landscape intended calm rectangle: x269–1267, y179–845 (middle 65% of each
  dimension). The inspected rectangle is continuous teal except tiny peripheral
  ink/foil slivers at its extreme right corners. No meaningful prop or target
  occupies the ticket area.
- Portrait calm rectangle: x77–947, y292–1275 (middle 85% width, y19–83%).
  The inspected rectangle is uninterrupted teal texture.
- The first desk results had a brush/roller extending too far into the lower
  clear region. One targeted placement correction per orientation moved the
  objects outward; both initial results and exact correction prompts are kept.
- The full outputs were visually reviewed. The exported 160px cover thumbnail
  was also reviewed: **Relic** is correctly spelled and readily readable; both
  tickets remain recognizable. `cover-thumbnail-160.png` and the two clear-region
  crops preserve that static QA evidence.

These are static plates. No scenery animation masks or separate animation
layers are supplied. This source-art and thumbnail review does not establish
browser rendering, live viewport fit, touch behavior, gameplay alignment or
audio acceptance. Registries, manifests and runtime code are outside this
artwork task's scope.
