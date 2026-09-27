# Nox Chart: production plates (26 September 2026)

William chose the Chart mockup (`../nox-chart-desktop-v1.png`) and asked for
it to be implemented, board and interface both. These are the empty
environment plates: the pictorial treasure-map sea with the play surface (a
flat navy rectangle inside a cream-and-red rope rim) at the centre, no cards,
tags, text or interface. Geometry is briefed to the accepted Nox footprint
(seat ring inside x 251–1292, y 155–697 of 1536x1024; x 72–953, y 177–989 of
1024x1536) so the approved framing still applies.

Generated with `codex exec -m gpt-6-luna` (reasoning effort low), built-in
`$imagegen`, one image per run, fresh from text, no reference images
(`../gen.sh`). Prompts: `nox-chart-landscape-v1.txt`,
`nox-chart-portrait-v1.txt`, `nox-chart-portrait-v2.txt`.

Acceptance: rope-rim band fractions against the brief within ±4 points
(landscape top 0.15, bottom 0.32, left 0.16, right 0.16; portrait top 0.115,
bottom 0.356, left 0.07, right 0.07), and a flat surface (luminance standard
deviation inside the rim, measured with the session's `measure-rope.mjs`).

| File | Rope rim (x, y, w, h) | Bands t / b / l / r | Surface sd | Result |
| --- | --- | --- | --- | --- |
| `public/art/nox-chart-landscape-v1-a.png` | 246, 169, 1044, 507 | 0.165 / 0.340 / 0.160 / 0.160 | 6.0 | bands pass; dark vignette baked into the surface |
| `public/art/nox-chart-landscape-v1-b.png` | 247, 189, 1042, 496 | 0.185 / 0.331 / 0.161 / 0.161 | 1.7 | **pass**, flat |
| `public/art/nox-chart-portrait-v1-a.png` | 62, 217, 898, 645 | 0.141 / 0.439 / 0.061 / 0.063 | 13.4 | fail: bottom band; black vignette |
| `public/art/nox-chart-portrait-v1-b.png` | 61, 213, 903, 657 | 0.139 / 0.434 / 0.060 / 0.059 | 1.2 | fail: bottom band (surface drawn wide) |
| `public/art/nox-chart-portrait-v2-a.png` | 70, 220, 883, 722 | 0.143 / 0.387 / 0.068 / 0.069 | 1.0 | **pass**, flat |
| `public/art/nox-chart-portrait-v2-b.png` | 78, 208, 868, 750 | 0.135 / 0.376 / 0.076 / 0.076 | 3.3 | pass, slightly less even than v2-a |

The v1 portrait prompt asked for a "TALL rectangle" while its numbers
describe a nearly square one (881x812); both attempts drew a wide one. The
v2 prompt says "almost square, height about nine tenths of the width, bottom
edge at about two thirds of the picture". Portrait v1-b's Codex run did not
copy its image (no output_hint); it was recovered from the Codex cache.

Portrait v2-b's Codex run called the image tool twice (two PNGs in session
cache); the saved file is the one it copied.

**Chosen:** landscape `nox-chart-landscape-v1-b.png`, portrait
`nox-chart-portrait-v2-a.png` (the first passes, and the flattest surfaces).

## Covers

Prompts: `../covers/nox-chart-square-v1.txt`, `nox-chart-square-v2.txt`,
`nox-chart-wide-v1.txt`. Same style paragraph as the plates, title "Nox"
generated into the art.

| File | Size | Title | Framing | Result |
| --- | --- | --- | --- | --- |
| `public/art/box-nox-chart-v1-a.png` | 1254x1254 | "NoX", capital X | title upper middle | fail: title casing |
| `public/art/box-nox-chart-v1-b.png` | 1254x1254 | "NOX", capitals | title upper middle | fail: title casing |
| `public/art/box-nox-chart-v2-a.png` | 1254x1254 | not reviewed | | kept; the Codex run did not copy it (recovered from the cache) |
| `public/art/box-nox-chart-v2-b.png` | 1254x1254 | "Nox" exact, cream with a red offset shadow | title inside the central 84%, galleon, skull island, X route, compass rose | **pass**, chosen |
| `public/art/box-nox-chart-wide-v1-a.png` | 1536x1024 | "Nox" exact | title 36-58% of height; compass rose half below the 75% crop line | fail: subject cut |
| `public/art/box-nox-chart-wide-v1-b.png` | 1536x1024 | "Nox" exact | title 36-58%; galleon, compass, serpent and skull island inside the kept band; the moon's top and the X island's base shaved (decorative) | **pass**, chosen |

The v2 square prompt spells out the casing ("a capital N followed by a
lowercase o and a lowercase x ... never NOX"). Wide v1-a's Codex run did not
copy its image; it was recovered from the cache. Delivery files:
`box-nox-blind-v2.webp` (1024 square, q90) with its 320/640/spine
derivatives, `box-nox-wide-v2.webp` and `-768` (the 3:1 middle band);
new names because the server caches `-vN.webp` files as immutable.
