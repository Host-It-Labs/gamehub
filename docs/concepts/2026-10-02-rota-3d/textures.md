# Rota textures (2 October 2026)

Fifteen tiled families for the model-railway diorama, two fresh variants each
(`-a`, `-b`), generated one image per Codex run (newest Luna, low effort,
built-in image generation), saved under `assets/rota/textures/` as
`<family>-v1-<variant>.png`. Each run's own
`~/.codex/generated_images/<session id>/` folder was checked to hold exactly
one PNG with the same sha256 as the saved file. Failed attempts keep a
`-fail-N` suffix. Processing: `node scripts/rota-textures.mjs` writes the
seamless albedo, normal and ORM WebP tiles to `public/3d/rota/tex/` and the
manifest `lib/games/rota/textures.json`, plus the seamless 1024 px
`assets/rota/textures/<family>.png` for Blender previews.

## Prompts

Every prompt is the shared style paragraph followed by the family's material
paragraph, sent exactly as written below (both variants of a family use the
same prompt).

### grass

> A seamless, tileable, top-down orthographic texture swatch for a premium stylised 3D miniature (a hand-built model railway diorama in warm late-afternoon light), evenly lit with no cast shadows or vignette, no perspective, no objects, no text, no border, square, highest quality, largest native size; crisp clean detail that stays readable when tiled at small scale; slightly stylised hand-painted realism (not photographic noise, not flat cartoon). The pattern continues across all four edges so opposite edges match when repeated, with even density and brightness over the whole square and no single focal feature. Material: model-railway static grass flock seen straight from above, a fresh sage-and-olive meadow of countless fine upright fibres forming tiny tufts, a few paler straw-coloured fibres and rare tiny white and yellow flowers scattered evenly; gentle tonal variation in small clusters but no big patches, no bare soil, no stones. Colours: soft sage green, muted olive and a little warm straw; not lime, not neon, not blue-green.

### field

> A seamless, tileable, top-down orthographic texture swatch for a premium stylised 3D miniature (a hand-built model railway diorama in warm late-afternoon light), evenly lit with no cast shadows or vignette, no perspective, no objects, no text, no border, square, highest quality, largest native size; crisp clean detail that stays readable when tiled at small scale; slightly stylised hand-painted realism (not photographic noise, not flat cartoon). The pattern continues across all four edges so opposite edges match when repeated, with even density and brightness over the whole square and no single focal feature. Material: a ploughed farm field with straight furrow rows running vertically from top to bottom, evenly spaced, about twelve rows across the square; warm brown earth with soft crumbly clods along the ridges and slightly darker damp soil in the troughs, faint rows of tiny green shoots along the ridge tops. Colours: warm umber and sienna brown with sparse soft green.

### asphalt

> A seamless, tileable, top-down orthographic texture swatch for a premium stylised 3D miniature (a hand-built model railway diorama in warm late-afternoon light), evenly lit with no cast shadows or vignette, no perspective, no objects, no text, no border, square, highest quality, largest native size; crisp clean detail that stays readable when tiled at small scale; slightly stylised hand-painted realism (not photographic noise, not flat cartoon). The pattern continues across all four edges so opposite edges match when repeated, with even density and brightness over the whole square and no single focal feature. Material: a fine dark charcoal road surface, smooth tarmac with subtle fine aggregate grain of tiny grey and slightly lighter stone flecks, faint uneven wear and very soft tonal mottling; absolutely no lane markings, no lines, no cracks wider than a hair, no manholes, no puddles. Colours: charcoal grey around #3a3d42 on average, neutral to very slightly cool.

### ballast

> A seamless, tileable, top-down orthographic texture swatch for a premium stylised 3D miniature (a hand-built model railway diorama in warm late-afternoon light), evenly lit with no cast shadows or vignette, no perspective, no objects, no text, no border, square, highest quality, largest native size; crisp clean detail that stays readable when tiled at small scale; slightly stylised hand-painted realism (not photographic noise, not flat cartoon). The pattern continues across all four edges so opposite edges match when repeated, with even density and brightness over the whole square and no single focal feature. Material: fine railway ballast, densely packed small angular crushed-stone gravel chips of similar size filling the whole square, each chip with a lit facet and a darker facet, tiny gaps between chips; no rails, no sleepers, no weeds. Colours: warm mid grey with a few beige, brown and darker grey chips mixed evenly.

### brick

> A seamless, tileable, top-down orthographic texture swatch for a premium stylised 3D miniature (a hand-built model railway diorama in warm late-afternoon light), evenly lit with no cast shadows or vignette, no perspective, no objects, no text, no border, square, highest quality, largest native size; crisp clean detail that stays readable when tiled at small scale; slightly stylised hand-painted realism (not photographic noise, not flat cartoon). The pattern continues across all four edges so opposite edges match when repeated, with even density and brightness over the whole square and no single focal feature. Material: a flat brick wall face in running bond, small warm red-orange bricks laid in straight horizontal courses, every course offset by half a brick, about sixteen courses top to bottom and an exact whole number of courses and bricks so the pattern repeats cleanly; thin recessed cream mortar joints, bricks with slight per-brick tone variation and softly worn edges. Colours: red-orange and rust brick, cream mortar.

### roof

> A seamless, tileable, top-down orthographic texture swatch for a premium stylised 3D miniature (a hand-built model railway diorama in warm late-afternoon light), evenly lit with no cast shadows or vignette, no perspective, no objects, no text, no border, square, highest quality, largest native size; crisp clean detail that stays readable when tiled at small scale; slightly stylised hand-painted realism (not photographic noise, not flat cartoon). The pattern continues across all four edges so opposite edges match when repeated, with even density and brightness over the whole square and no single focal feature. Material: a terracotta clay roof of overlapping curved tiles laid in straight horizontal rows, about ten rows top to bottom and a whole number of rows so the pattern repeats cleanly, each tile with a soft rounded profile and a slightly darker lower edge where it overlaps the row below; gentle weathering, slight per-tile tone variation. Colours: warm terracotta orange, soft rust and a few sun-bleached paler tiles.

### slate

> A seamless, tileable, top-down orthographic texture swatch for a premium stylised 3D miniature (a hand-built model railway diorama in warm late-afternoon light), evenly lit with no cast shadows or vignette, no perspective, no objects, no text, no border, square, highest quality, largest native size; crisp clean detail that stays readable when tiled at small scale; slightly stylised hand-painted realism (not photographic noise, not flat cartoon). The pattern continues across all four edges so opposite edges match when repeated, with even density and brightness over the whole square and no single focal feature. Material: a slate roof of flat rectangular slate tiles laid in straight horizontal rows, every row offset by half a tile, about twelve rows top to bottom and a whole number of rows so the pattern repeats cleanly, each slate with a thin darker gap at its lower edge and subtle split-stone surface; slight per-slate tone variation. Colours: blue-grey and cool charcoal slate with a few softer grey-violet slates.

### plaster

> A seamless, tileable, top-down orthographic texture swatch for a premium stylised 3D miniature (a hand-built model railway diorama in warm late-afternoon light), evenly lit with no cast shadows or vignette, no perspective, no objects, no text, no border, square, highest quality, largest native size; crisp clean detail that stays readable when tiled at small scale; slightly stylised hand-painted realism (not photographic noise, not flat cartoon). The pattern continues across all four edges so opposite edges match when repeated, with even density and brightness over the whole square and no single focal feature. Material: a flat cream rendered wall plaster, smooth lime render with a soft hand-trowelled texture of gentle overlapping sweeps, very faint fine sand grain and subtle tonal variation; no cracks, no stains, no bricks showing, no windows. Colours: warm cream and soft ivory with very slight buff variation.

### wood

> A seamless, tileable, top-down orthographic texture swatch for a premium stylised 3D miniature (a hand-built model railway diorama in warm late-afternoon light), evenly lit with no cast shadows or vignette, no perspective, no objects, no text, no border, square, highest quality, largest native size; crisp clean detail that stays readable when tiled at small scale; slightly stylised hand-painted realism (not photographic noise, not flat cartoon). The pattern continues across all four edges so opposite edges match when repeated, with even density and brightness over the whole square and no single focal feature. Material: weathered painted timber planks running vertically from top to bottom, about eight planks across the square, each plank the same width with a thin dark gap between planks, soft painted surface with faint wood grain showing through worn paint and a few knots; no nail heads in rows, no hinges. Colours: soft warm grey-brown, weathered taupe with slight per-plank tone variation.

### stone

> A seamless, tileable, top-down orthographic texture swatch for a premium stylised 3D miniature (a hand-built model railway diorama in warm late-afternoon light), evenly lit with no cast shadows or vignette, no perspective, no objects, no text, no border, square, highest quality, largest native size; crisp clean detail that stays readable when tiled at small scale; slightly stylised hand-painted realism (not photographic noise, not flat cartoon). The pattern continues across all four edges so opposite edges match when repeated, with even density and brightness over the whole square and no single focal feature. Material: a dry-laid wall of cut stone blocks for walls and bridges, rectangular ashlar blocks of slightly varied lengths laid in straight horizontal courses, about eight courses top to bottom, thin dark joints, each block with softly chipped edges and gentle sandstone grain. Colours: warm grey sandstone with honey and buff tones.

### rock

> A seamless, tileable, top-down orthographic texture swatch for a premium stylised 3D miniature (a hand-built model railway diorama in warm late-afternoon light), evenly lit with no cast shadows or vignette, no perspective, no objects, no text, no border, square, highest quality, largest native size; crisp clean detail that stays readable when tiled at small scale; slightly stylised hand-painted realism (not photographic noise, not flat cartoon). The pattern continues across all four edges so opposite edges match when repeated, with even density and brightness over the whole square and no single focal feature. Material: a natural mountain rock face seen flat on, grey stone with subtle horizontal strata bands, fine cracks and fractured facets, small patches of pale sage and ochre lichen scattered evenly; no grass, no sky, no ledges with depth. Colours: warm and cool mid greys with sage and ochre lichen accents.

### foliage

> A seamless, tileable, top-down orthographic texture swatch for a premium stylised 3D miniature (a hand-built model railway diorama in warm late-afternoon light), evenly lit with no cast shadows or vignette, no perspective, no objects, no text, no border, square, highest quality, largest native size; crisp clean detail that stays readable when tiled at small scale; slightly stylised hand-painted realism (not photographic noise, not flat cartoon). The pattern continues across all four edges so opposite edges match when repeated, with even density and brightness over the whole square and no single focal feature. Material: model-railway clump-foam tree foliage seen straight from above, a dense mass of many small rounded leaf clusters, each cluster a soft bumpy ball of tiny leaf flecks with lit tops and slightly darker gaps between clusters, filling the whole square evenly; no branches, no sky gaps, no flowers. Colours: mid green leaning olive and sage, lighter yellow-green tips, deeper green in the gaps; not lime, not blue-green.

### bark

> A seamless, tileable, top-down orthographic texture swatch for a premium stylised 3D miniature (a hand-built model railway diorama in warm late-afternoon light), evenly lit with no cast shadows or vignette, no perspective, no objects, no text, no border, square, highest quality, largest native size; crisp clean detail that stays readable when tiled at small scale; slightly stylised hand-painted realism (not photographic noise, not flat cartoon). The pattern continues across all four edges so opposite edges match when repeated, with even density and brightness over the whole square and no single focal feature. Material: tree bark with strong vertical grain, long fissured ridges running from top to bottom, deep narrow grooves between rounded bark plates, subtle fine fibres; no moss patches, no knots dominating. Colours: warm grey-brown and umber with lighter grey ridge tops.

### sand

> A seamless, tileable, top-down orthographic texture swatch for a premium stylised 3D miniature (a hand-built model railway diorama in warm late-afternoon light), evenly lit with no cast shadows or vignette, no perspective, no objects, no text, no border, square, highest quality, largest native size; crisp clean detail that stays readable when tiled at small scale; slightly stylised hand-painted realism (not photographic noise, not flat cartoon). The pattern continues across all four edges so opposite edges match when repeated, with even density and brightness over the whole square and no single focal feature. Material: fine beach sand seen straight from above, very fine even grain with subtle shallow wind ripples running gently across the square, a few scattered slightly darker grains; no shells, no footprints, no pebbles, no water. Colours: warm pale golden beige and soft cream sand.

### cobble

> A seamless, tileable, top-down orthographic texture swatch for a premium stylised 3D miniature (a hand-built model railway diorama in warm late-afternoon light), evenly lit with no cast shadows or vignette, no perspective, no objects, no text, no border, square, highest quality, largest native size; crisp clean detail that stays readable when tiled at small scale; slightly stylised hand-painted realism (not photographic noise, not flat cartoon). The pattern continues across all four edges so opposite edges match when repeated, with even density and brightness over the whole square and no single focal feature. Material: a street of small rounded cobblestones packed closely in loose rows, each stone a softly domed rounded rectangle with a lit top and slightly darker edges, narrow dark gritty joints between stones, stones of similar size filling the whole square evenly; no kerbs, no drains. Colours: warm grey stones with a few beige, buff and darker grey stones mixed evenly.

## Results

| image | session id | sha256 | result | notes |
| --- | --- | --- | --- | --- |
| `grass-v1-a.png` | 01a0fe01-0e07-71f0-8128-155f603cf4ef | `b51ead79880be5ea35eb0c577c2e7f208a6e6b34bbf693a97d70ed0c18b1117c` | pass | 1254², dense even flock, small white and yellow flowers; olive-yellow (mean #747926) |
| `grass-v1-b.png` | 01a0fe01-c933-7772-8031-be696df53122 | `e4b6dc1048df1f496892030f86ddcdbf40986393a331993a990de3cad7f37904` | pass | 1254², slightly coarser tufts and larger flowers (mean #73782a) |
| `field-v1-a.png` | 01a0fe01-c934-7311-8f55-2f6c72c7c32d | `1060a211b70cc095da95f972aefe2defd6bacd952cefffe17ea37c14762d0ead` | pass | 1254², ten neat furrows with shoots, but rows lean a few degrees off vertical |
| `field-v1-b.png` | 01a0fe01-c930-7cb0-95a5-0db42c2bfd5e | `55edcc4852850d9b2050e27bcb6b876c8437ebc708fb4efc3128c47574a24144` | pass | 1254², eleven straighter vertical furrows. The run made two images in its own session folder (Luna called the tool twice); the one it reported (exec-d8357d73…) was kept |
| `asphalt-v1-a.png` | 01a0fe01-c92f-70c1-bc75-89342c3f371d | `5cffc6a3f04cf43271b659aa41d9cbf8dde331dae4cad4c003bc0f9f3898bac5` | pass | 1254², even fine aggregate, faint diagonal hatching; mean #505051 (lighter than the #3a3d42 target) |
| `asphalt-v1-b.png` | 01a0fe01-c930-78f2-b38d-91bd8beb4f43 | `098819c63770f6915468971fb7b0fe1ef6ad8afc4f5fe507c74caa73bef74279` | pass | 1254², natural aggregate with soft wear mottling; mean #4b4c4d |
| `ballast-v1-a.png` | 01a0fe02-8894-7830-87d8-74c01f998e8b | `0a65611137d8a5b82c082a9dc568496c52e00d22dcec5e3237393af29dfb60f3` | pass | 1254², angular chips, quite brown/orange mix (mean #8e7a68) |
| `ballast-v1-b.png` | 01a0fe02-940e-7c20-a2d5-b57b6716b90f | `7fff926477bb04383720600fab510fba98c9942d1cf7cddba81fdb272328dca8` | pass | 1254², warmer grey angular chips, closer to railway ballast (mean #84776a) |
| `brick-v1-a.png` | 01a0fe02-a8fa-7392-b258-c71d50205564 | `a42fd038d63589f03658e0ffc4875dca3063c1f6e54c986733c24350392027b2` | pass | 1254², very regular running bond, ~16.5 horizontal courses, cream mortar; saturated orange (mean #c26943) |
| `brick-v1-b.png` | 01a0fe02-f125-79d1-93e5-7db2541af390 | `c8ddf80a61a65b7841cd4c29aea80c4297e92ecf0a3ea14348ff27a66b86103c` | pass | 1254², ~21 smaller courses, running bond slightly less regular (mean #bf6b44) |
| `roof-v1-a.png` | 01a0fe02-f80e-7a21-988f-943dadfe06b3 | `caecac3628386d40a49b4ed2737ffc0da8183f3e393318d6150094f8821b7b11` | pass | 1254², eight clean rows of curved tiles in straight columns. The run made two images in its own session folder; the reported one (exec-12104a3d…) was kept |
| `roof-v1-b.png` | 01a0fe03-506e-73b2-a60e-81633b74a20b | `cc75f5d74615ed4a0296e316846b6bf872e2f933f21c1a26f74d88ae8a3ffce2` | pass | 1254², eight rows, stronger pale sun-bleached tiles that would repeat visibly |
| `slate-v1-a.png` | 01a0fe03-59e3-7442-a2cf-04f4ac99dfcb | `c73f35355dc17c51f695170a1bf3d8cc34b979dd70f8df72ea5abe05161c76c4` | pass | 1254², ~11.5 regular half-offset rows, blue-grey with grey-violet slates (mean #575d65) |
| `slate-v1-b.png` | 01a0fe03-7230-7ab0-9063-90164e9c6d3b | `6a484b2f7da3f3acf8e05a0bfa4e75f37c0f0acd7cc0b6514ae36e1cbaa22802` | pass | 1254², ~11 rows, slightly bluer (mean #585d68) |
| `plaster-v1-a.png` | 01a0fe03-cfa4-71b2-b5d4-005fa6ad3170 | `8c880b9df3dac30382a1bd32a77ae63678152db3c16fffb25cbff68b134446ca` | pass | 1254², soft trowel sweeps, warm cream (mean #eeddbc), a little yellow |
| `plaster-v1-b.png` | 01a0fe04-1053-7473-898d-338592a6b30f | `553280358ad252f69ee87351c05881f6f5cf48b73dffc97d014a500bd9a59ff7` | pass | 1254², softer, more even trowel texture, warm cream |
| `wood-v1-a.png` | 01a0fe04-2f0f-7263-af76-1d7816cceda6 | `b0e9b86de7bd43e398ce3f1d0c662b6b71e7f17f04d0b688f3c58d28693bf3c5` | pass | 1254², eight vertical planks, weathered grey-brown, several prominent knots |
| `wood-v1-b.png` | 01a0fe04-35e7-7503-934d-8b6180e5c100 | `eb245cd57642b23b546d40c92169ca174dc344fde80c2fe8df1c9026fae1d891` | pass | 1254², eight vertical planks, evener grain and fewer knots |
| `stone-v1-a.png` | 01a0fe04-4aa0-7d42-a37c-412fe7bc0c1a | `015a24fed53c6f5f8a0f0be6fbe6687734bfcf83ff52a79b93590d96707e1802` | pass | 1254², ~10.5 horizontal ashlar courses, warm grey and honey sandstone |
| `stone-v1-b.png` | 01a0fe04-8b23-7433-987d-47451830984f | `94bf14456885ce26f5cc9bd2496f9e36b7a4561d73176e32e3dcc1a76e603dc3` | pass | 1254², eight larger courses, more orange honey blocks |
| `rock-v1-a.png` | 01a0fe04-e4d3-7613-bde9-441d3e9bfe48 | `d90b9c0e9fc9195213984cae80bbf6605eae02dcc639ee718f70c734cda3099b` | pass | 1254², horizontal strata, grey with sage and ochre lichen (mean #8e806f) |
| `rock-v1-b.png` | 01a0fe05-0e50-7e72-b307-374361ec35b8 | `05c1db250773afa6be1c69e1a77f92172d116d0f6cbcf1b502002704d53c2726` | pass | 1254², busier lichen with bright orange rosettes. The run made two images in its own session folder; the reported one (exec-2e82875a…) was kept |
| `foliage-v1-a.png` | 01a0fe05-1d9d-7e42-bcc2-82f073563716 | `542a29898c0ee7f5ffe2ea669d3bf4588df9d3a799da994bbe27bd5588ecaf1d` | pass | 1254², dense clump-foam clusters with dark gaps; yellow-lime (mean #50631e), toned in processing |
| `foliage-v1-b.png` | 01a0fe05-6057-7e32-852e-a1302c30b7d4 | `959e2f758c353d40216e29407d86fea961537d40259d43728ffb65bc5bbc9b32` | pass | 1254², evener clusters, same lime lean (mean #526421) |
| `bark-v1-a.png` | 01a0fe05-61bf-7ff3-b845-4b256c500dd8 | `90bd4bb16953ab61267d0e184be59e0abe0c3157eb3931edea7bdcd8a68e0241` | pass | 1254², vertical fissured plates, grey-brown |
| `bark-v1-b.png` | 01a0fe05-b238-78c0-aca7-993e6592b323 | `bece488209b926aad42641ccf52a813ba49180af44799ba1ae8ea99e405bf0e9` | pass | 1254², vertical plates, warmer orange grooves |
| `sand-v1-a.png` | 01a0fe05-ec4f-7d31-ba8a-5ded610cf519 | `c432bca73530ba73e1c5dcd853948ed9f202a51f6f11551394d2d88949224b33` | pass | 1254², calm horizontal ripples, golden (mean #e1b980). The run made two images in its own session folder; the reported one (exec-2ad39bb4…) was kept |
| `sand-v1-b.png` | 01a0fe06-0ab7-7de0-9a44-d21d4444e14e | `3f51018899de4ec8e43affd95623e3d591bdb5aa83464b8bfddfd8ba55731e5a` | pass | 1254², stronger diagonal ripples, a little more orange |
| `cobble-v1-a.png` | 01a0fe06-277c-7760-9990-10ebe9baf881 | `9de5fb6e57cf05e968c307900036ed1a21eb4cad86fdefc9df7a72c9cc5a5472` | pass | 1254², rounded setts in half-offset rows, warm grey with beige (mean #8b7966) |
| `cobble-v1-b.png` | 01a0fe06-83e0-7e41-b411-8413ce3ce724 | `3fe0039a0c321045065e89918bddc88d968a2cf54267959fb6ab3a4e8cdd9e24` | pass | 1254², same layout, more rust and orange stones. The image tool returned no output_hint and left two images in the run's own folder; the first by name (exec-d20af9c7…) was kept |

All 30 first generations passed review (square 1254 px, no text, objects,
perspective, cast shadows or vignette, reads as the material), so no retries
and no `-fail-N` files. Five runs (field-v1-b, roof-v1-a, rock-v1-b,
sand-v1-a, cobble-v1-b) left two PNGs in their own session folder because
Luna called the image tool twice; the wrapper refused them and the file Luna
reported (or, for cobble-v1-b, which reported none, the first by name) was
copied by hand from that run's own folder and its sha256 recorded above.

## Picks and processing

`node scripts/rota-textures.mjs [--only=<family>] [--tiles]`. Seam fixes:
**fade** cross-fades the edges with a half-shifted copy; **ramp** spreads
only the tone step; **fit** crops the axis to a whole number of the measured
pattern period, starting at a joint, then ramps; **joints** cuts every course
at its own vertical joints (rows of units with no common width). Tone is a
per-channel multiplier applied before anything is derived. 3×3 contact
sheets of the processed albedo are in `tiles/<family>.png`.

| family | pick | why | seams (u / v) | tone | mean after |
| --- | --- | --- | --- | --- | --- |
| grass | grass-v1-a | finer, evener flock | fade / fade | 0.9, 1, 1.7 (yellow-olive to sage) | #687940 |
| field | field-v1-b | straighter vertical furrows | fit (9 furrows) / fade | – | #724928 |
| asphalt | asphalt-v1-b | natural aggregate, no hatching | fade / fade | 0.78, 0.8, 0.86 (to charcoal) | #3a3c42 |
| ballast | ballast-v1-b | greyer, less orange chips | fade / fade | – | #84776a |
| brick | brick-v1-a | very regular running bond | fit (5 periods) / fit (7 courses) | 0.88, 0.9, 0.95 | #ab5f40 |
| roof | roof-v1-a | fewer bleached tiles | fit (9 columns) / fit (6 rows) | 0.92, 0.92, 0.95 | #ad603d |
| slate | slate-v1-a | regular rows | joints / fit (10 rows, ~9 kept) | – | #565c64 |
| plaster | plaster-v1-b | softer, evener trowel | fade / fade | 0.96, 0.96, 0.97 | #e5d6bb |
| wood | wood-v1-b | evener grain, fewer knots | fit (7 planks) / fade | – | #8e7e6e |
| stone | stone-v1-a | more, smaller courses | joints / fit (7 courses kept) | – | #b19a7a |
| rock | rock-v1-a | calmer lichen | fade / fade | – | #8e806e |
| foliage | foliage-v1-a | clearer clusters | fade / fade | 0.95, 1, 1.75 (lime to olive-sage) | #4b6234 |
| bark | bark-v1-a | greyer, less orange | fade / ramp (a fade ghosted a band) | – | #715e4c |
| sand | sand-v1-a | calmer ripples | fade / fade | 0.97, 0.97, 1.08 | #dab38a |
| cobble | cobble-v1-a | warm grey, fewer rust stones | fit (8) / fit (6 rows) | – | #8a7965 |
