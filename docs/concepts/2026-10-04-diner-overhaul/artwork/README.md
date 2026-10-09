# Diner cover art, 4 October 2026

Two independent cover illustrations replace the first Diner cover direction.
The direction is hand-inked gouache with warm adult human expressions and
deliberate cherry enamel, cream paint, mint vinyl and brushed chrome. The
title is generated inside each painting, spelled exactly **Diner**. A tiny
purple goo detail hints at the mimic mechanic without making the people
uncanny.

All candidates were generated with the built-in `image_gen` tool from written
briefs only. No source image or previous candidate was passed as a reference.
The complete, exact briefs are preserved in `prompts/`. Source PNGs were
copied into `sources/`; the built-in originals are also retained in the
generator's default directory.

## Chosen art and sources

| Candidate | Actual source | Decision |
| --- | --- | --- |
| `box-diner-square-v2-a.png` | 1254 × 1254 PNG | Chosen square. Clear lettering and three appealing, expressive adults. The brief asked for 1024 square; the tool returned 1254 square, and the original dimensions are preserved. |
| `box-diner-wide-v2-a.png` | 1536 × 1024 PNG | Rejected for setup delivery. The server's hair starts around 20% of source height, outside the safe middle band. A centred 3:1 crop would cut the hair. The source and prompt are retained. |
| `box-diner-wide-v2-b.png` | 1536 × 1024 PNG | Chosen wide. A shallower row of bust portraits and a lower title fit the setup crop. This was a new text-only generation with a revised composition brief. |

Chosen originals have native-resolution WebP companions at quality 94:
`sources/box-diner-square-v2-a-native.webp` and
`sources/box-diner-wide-v2-b-native.webp`.

## Delivery files

All production files are new version-2 siblings. Version-1 art is preserved.

| Public path | Dimensions | WebP quality |
| --- | --- | --- |
| `/art/optimized/box-diner-blind-v2.webp` | 1024 × 1024 | 90 |
| `/art/optimized/box-diner-blind-v2-640.webp` | 640 × 640 | 88 |
| `/art/optimized/box-diner-blind-v2-320.webp` | 320 × 320 | 88 |
| `/art/optimized/box-diner-blind-v2-spine.webp` | 64 × 1024 | 88 |
| `/art/optimized/box-diner-wide-v2.webp` | 1536 × 512 | 86 |
| `/art/optimized/box-diner-wide-v2-768.webp` | 768 × 256 | 86 |

The square is uniformly downsampled to the repository's 1024-square cover
footprint. The spine is the leftmost 64-pixel strip of that square delivery.
The wide delivery is the source's centre band, with source crop
`{ left: 0, top: 256, width: 1536, height: 512 }`. No painting, stretching,
compositing, title replacement or image-generation edits were performed.
Exports use Sharp for mechanical crop, resize and WebP compression only.

`measurements-v2.json` records exact dimensions and file sizes.
`preview-manifest-entries-v2.json` contains only the two new preview/srcSet
entries for integration into `lib/artwork-previews.json`. The artwork task
did not edit that shared manifest or `lib/games/box-covers.ts`.

## Art review

- Title spelling is correct on both chosen sources, with exactly one title
  and no extra lettering.
- The square title remains readable at 160 × 160, saved in
  `review/diner-square-160.png`.
- The 768 × 256 wide production cover retains all title letters, complete
  character heads, tray and food. The title and faces are separate silhouettes.
- A shorter setup lid can trim the 3:1 band to 80% of its height. The more
  demanding source crop `{ left: 0, top: 307, width: 1536, height: 410 }`
  still preserves the complete title, hair/head silhouettes, food and tray.
  This review is saved at 768 × 205 in
  `review/diner-wide-short-lid-768.png`.
- Full-bleed coverage, warm expressions and distinct enamel/chrome/vinyl
  materials were inspected in the chosen sources and delivery crops.

These are static image and export checks. Browser integration and touch
behavior are verified by the parent implementation task.

## Built-in generation provenance

All outputs originated in
`/Users/williamguinaudie/.codex/generated_images/01a10773-579c-71c3-be16-859cf2d6f96a/`:

| Preserved source | Original generator filename | Exact prompt |
| --- | --- | --- |
| `sources/box-diner-square-v2-a.png` | `exec-b60c3e5c-55bd-4e38-a6c3-6b421a146d36.png` | `prompts/diner-square-v2-a.txt` |
| `sources/box-diner-wide-v2-a.png` | `exec-ab60e30d-5a2b-443f-85ea-2c62a33961d2.png` | `prompts/diner-wide-v2-a.txt` |
| `sources/box-diner-wide-v2-b.png` | `exec-90af214c-c97f-4b8c-8773-bdf0ef72c27d.png` | `prompts/diner-wide-v2-b.txt` |
