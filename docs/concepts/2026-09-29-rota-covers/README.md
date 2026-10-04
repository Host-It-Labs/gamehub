# Rota covers, 29 September 2026

Library square cover and wide setup-lid cover for Rota, the new roll-and-write
route-building game. Direction: a surveyor's cyanotype blueprint on a drafting
desk at night (Prussian-blue sheet, white-ink plan-view survey, gold-ink towns,
one warm brass lamp from the top-left). Nothing here is integrated yet.

## Generation

Fresh text-only generations, one image per Codex invocation, two variants
(`-a`, `-b`) per image, all four launched in parallel. No reference images, no
edits. Model `gpt-6-luna` (newest Luna from `.claude/skills/artwork/newest-luna.mjs`),
low reasoning effort, codex-cli 0.157.1, stdin closed:

```bash
codex exec --skip-git-repo-check --sandbox workspace-write -m gpt-6-luna -c model_reasoning_effort='"low"' '$imagegen Call the built-in image generation tool exactly once with the prompt below, exactly as written. It is final: do not rewrite, restructure, expand or shorten it, and do not ask questions. The output_hint field of the result names the saved PNG: print only that field, never the image data, then copy that file to the exact absolute path: <OUT>. Never call the image tool a second time. Prompt: <PROMPT>' < /dev/null
```

After each run the wrapper checks that the run's own `~/.codex/generated_images/<session id>/`
folder holds exactly one PNG and that the saved file matches it by hash.

Outputs: `public/art/box-rota-v1-a.png`, `public/art/box-rota-v1-b.png`
(square) and `public/art/box-rota-wide-v1-a.png`, `public/art/box-rota-wide-v1-b.png`
(landscape, to be cut to 3:1 keeping y 30–70%).

## Prompt: square cover (both variants, exact)

```text
Create a square 1024x1024 board-game box cover illustration, full bleed to all four edges, no border, no frame, no mat, no box mockup, no interface, no gameplay screenshot.

Style: a surveyor's cyanotype blueprint lying on a dark wooden drafting desk at night. The sheet is deep Prussian-blue cyanotype paper with subtle paper grain and faint soft mottling, drawn with crisp, confident white-ink linework in true aerial plan view, as seen straight from above: a landscape survey of highways drawn as double lines with dashed centre lines, railway lines drawn as a line with regular cross sleepers, a small station where a road meets a railway, one overpass where a road crosses above a railway, a winding river in fine parallel white lines with two small bridges, three or four small towns drawn as clusters of tiny houses in warm gold ink, hills as concentric white contour lines, one snowy mountain peak with a tunnel mouth where the railway enters it, and a coastline with a sea of fine wave hatching and a harbour with two piers. A few physical drafting objects rest at the edges of the sheet, lit by one warm brass desk lamp from the top-left, which casts a soft warm pool of golden light over the upper-left of the blue sheet and long soft shadows toward the bottom-right: a brass drafting compass, an ivory six-sided die whose top face is printed with a single blue curved road bend, a red pencil, and a clear set square. Warm lamp gold against cool blue gives the picture depth. Confident, elegant, graphic illustration with a considered limited palette of Prussian blue, white ink, gold ink, brass and one red accent; sleek and uncluttered, not busy, not photoreal, no people.

Composition: the blueprint sheet fills the whole square edge to edge, with the drafting desk and objects appearing only as slivers along the edges and corners (compass near the top-left under the lamp glow, the die and red pencil near the bottom-right, the set square overlapping the left edge). Across the centre of the square, the game title "ROTA" is lettered as large custom white-ink engineering stencil capitals, drawn as part of the survey itself: a railway line with sleepers and a highway with a dashed centre line run into and through the letters, and the letters sit on a faint drafting grid with thin dimension ticks. The title spans about 70 percent of the width, is bold and clearly legible even at thumbnail size, and is spelled exactly R-O-T-A, four letters: R, O, T, A.

Text rule: the only letters anywhere in the image are the four letters ROTA of the title. No other words, no labels, no place names, no numbers, no scale bar text, no legend, no title block, no signature, no watermark. The die shows only the road bend, no pips or numbers.
```

## Prompt: wide cover (both variants, exact)

```text
Create a landscape 1536x1024 board-game lid cover illustration, full bleed to all four edges, no border, no frame, no mat, no box mockup, no interface, no gameplay screenshot.

Style: a surveyor's cyanotype blueprint lying on a dark wooden drafting desk at night. The sheet is deep Prussian-blue cyanotype paper with subtle paper grain and faint soft mottling, drawn with crisp, confident white-ink linework in true aerial plan view, as seen straight from above: a landscape survey of highways drawn as double lines with dashed centre lines, railway lines drawn as a line with regular cross sleepers, a small station where a road meets a railway, one overpass where a road crosses above a railway, a winding river in fine parallel white lines with two small bridges, three or four small towns drawn as clusters of tiny houses in warm gold ink, hills as concentric white contour lines, one snowy mountain peak with a tunnel mouth where the railway enters it, and a coastline with a sea of fine wave hatching and a harbour with two piers. A few physical drafting objects rest at the edges of the sheet, lit by one warm brass desk lamp from the top-left, which casts a soft warm pool of golden light over the upper-left of the blue sheet and long soft shadows toward the bottom-right: a brass drafting compass, an ivory six-sided die whose top face is printed with a single blue curved road bend, a red pencil, and a clear set square. Warm lamp gold against cool blue gives the picture depth. Confident, elegant, graphic illustration with a considered limited palette of Prussian blue, white ink, gold ink, brass and one red accent; sleek and uncluttered, not busy, not photoreal, no people.

Composition: this image will be cropped to a thin horizontal band, keeping only the middle strip from 30 percent to 70 percent of the image height. Put the game title and every main subject inside that middle strip. The top 30 percent and bottom 30 percent of the image must hold only expendable continuous blueprint sheet with plain contour lines and wave hatching, and dark desk wood, with nothing important there. In the middle strip: the game title "ROTA" is lettered in the horizontal centre as large custom white-ink engineering stencil capitals, drawn as part of the survey itself, with a railway line with sleepers and a highway with a dashed centre line running horizontally into and through the letters; the letters are about 28 percent of the image height tall and sit fully within the middle strip with clear space above and below them. To the left of the title in the same strip: the brass compass in the warm lamp glow and a small gold-ink town with a station where the road meets the railway. To the right of the title in the same strip: the overpass, the river with a bridge, the snowy peak with its tunnel, the harbour piers, and the ivory die with the blue road bend and the red pencil resting on the sheet. The spelling of the title is exactly R-O-T-A, four letters: R, O, T, A, bold and clearly legible.

Text rule: the only letters anywhere in the image are the four letters ROTA of the title. No other words, no labels, no place names, no numbers, no scale bar text, no legend, no title block, no signature, no watermark. The die shows only the road bend, no pips or numbers.
```

## Attempts and verification

| File | Result | Size | Title | Notes |
| --- | --- | --- | --- | --- |
| `box-rota-v1-a.png` | Pass, **chosen** | 1254×1254 | ROTA, legible at thumbnail size | Clean corners; rail and road run through the letters. Delivered at 1024² by `scripts/optimize-rota-art.mjs`. |
| `box-rota-v1-b.png` | Fail | 1254×1254 | ROTA, legible | A small signature-like mark in the bottom-right corner (the brief forbids signatures). Kept for reference. |
| `box-rota-wide-v1-a.png` | Not generated | – | – | The generation run stopped (usage limit) before this image landed. |
| `box-rota-wide-v1-b.png` | Pass, **chosen** | 1536×1024 | ROTA, centred in the middle band | Clean corners. The model drew two faint horizontal guide lines at rows 253 and 772, just outside the 256–768 band the 3:1 lid keeps, so the cut drops them. |

Verified 30 September 2026 by viewing each result, its four corners at full resolution and the lid's 3:1 band. The PNG sources were moved to the art archive beside the repo (`../gamehub-art-archive/public/art/`); `scripts/optimize-rota-art.mjs` reads them from there.

## Square cover v2 (30 September 2026): a heavier title

The v1-a title reads at full size but is thin blue-on-blue on the library shelf (about 170 px). Two fresh generations (`box-rota-v2-a.png`, `box-rota-v2-b.png`) with a calmer middle band and a heavy solid-white title, same model and command. Exact prompt:

```text
Create a square 1024x1024 board-game box cover illustration, full bleed to all four edges, no border, no frame, no mat, no box mockup, no interface, no gameplay screenshot.

Style: a surveyor's cyanotype blueprint lying on a dark wooden drafting desk at night. The sheet is deep Prussian-blue cyanotype paper with subtle paper grain and faint soft mottling, drawn with crisp, confident white-ink linework in true aerial plan view, as seen straight from above: a landscape survey of highways drawn as double lines with dashed centre lines, railway lines drawn as a line with regular cross sleepers, a small station where a road meets a railway, one overpass where a road crosses above a railway, a winding river in fine parallel white lines with two small bridges, three or four small towns drawn as clusters of tiny houses in warm gold ink, hills as concentric white contour lines, one snowy mountain peak with a tunnel mouth where the railway enters it, and a coastline with a sea of fine wave hatching and a harbour with two piers. A few physical drafting objects rest at the edges of the sheet, lit by one warm brass desk lamp from the top-left, which casts a soft warm pool of golden light over the upper-left of the blue sheet and long soft shadows toward the bottom-right: a brass drafting compass, an ivory six-sided die whose top face is printed with a single blue curved road bend, a red pencil, and a clear set square. Warm lamp gold against cool blue gives the picture depth. Confident, elegant, graphic illustration with a considered limited palette of Prussian blue, white ink, gold ink, brass and one red accent; sleek and uncluttered, not busy, not photoreal, no people.

Composition: the blueprint sheet fills the whole square edge to edge, with the drafting desk and objects appearing only as slivers along the edges and corners (compass near the top-left under the lamp glow, the die and red pencil near the bottom-right, the set square overlapping the left edge). The busy survey detail stays toward the edges; the middle band behind the title is calm, mostly plain deep blue paper with only faint contour lines, so the title stands out.

Title: across the centre of the square, the game title "ROTA" in very large, very heavy, bold solid white capital letters, like thick engineering stencil capitals filled in solid white ink, each letter stroke as thick as a highway, with a thin warm-gold outline and a soft dark shadow beneath so the word pops off the blue paper. A railway line with sleepers runs along the baseline under the letters. The title spans about 80 percent of the width and about 30 percent of the height, and must stay instantly legible when the whole image is shrunk to a 150-pixel thumbnail. It is spelled exactly R-O-T-A, four letters: R, O, T, A.

Text rule: the only letters anywhere in the image are the four letters ROTA of the title. No other words, no labels, no place names, no numbers, no scale bar text, no legend, no title block, no signature, no artist mark, no monogram, no watermark in any corner. The die shows only the road bend, no pips or numbers.
```

| File | Result | Size | Title | Notes |
| --- | --- | --- | --- | --- |
| `box-rota-v2-a.png` | Pass, **chosen** (replaces v1-a) | 1254×1254 | ROTA, heavy and legible at 150 px | Clean corners; one image in its Codex run folder. |
| `box-rota-v2-b.png` | Fail | 1254×1254 | ROTA, legible | Tiny numerals on the set square's scale (the brief allows no numbers). |

Both sources moved to the art archive; `scripts/optimize-rota-art.mjs` reads `box-rota-v2-a.png`.
