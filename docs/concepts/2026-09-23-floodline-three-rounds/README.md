# Floodline Station, three rounds (23 September 2026)

Floodline became Mora's longer intermediate world: three rounds of six creatures
(18 kept, 108-creature supply) instead of two. The board was regenerated from
scratch with room for them: 23 spaces instead of 16.

| Habitat | Shape | Spaces | Rule |
| --- | --- | ---: | --- |
| Rock pools | square | 5 | Exact pair 7 each · lone 1 · a third of a species spoils its pair |
| Nesting beach | square | 5 | All different: 3 each · any repeat: 1 each |
| Mangrove roots | square | 3 | Three of one species 12 · otherwise 1 each |
| Pier | round | 4 | Filled in order; 2 each · A–B–A–B +6 |
| Sea cave | round | 4 | Echo: 1 per creature of its species in your other habitats, max 3 each |
| Lighthouse | round | 2 | 4 each if its species lives nowhere else (the other lamp included) |

Die groups are unchanged (square = pools, beach, mangrove; round = pier, cave,
lighthouse; Big homes = pools, beach, pier, cave, which at Floodline are the
four-or-more-space habitats).

## Generation

Four fresh built-in imagegen generations through Codex, no reference images,
prompt text only: `style.txt` + `landscape.txt` / `portrait.txt` in this folder
(the exact text sent). Outputs 1536×1024 and 1024×1536 PNG.

| Variant | Path | Spaces counted by eye | Notes |
| --- | --- | --- | --- |
| landscape a | `public/art/mora-floodline-landscape-v5-a.png` | 23 (5/5/3/4/4/2) | Sea cave rock touches the left edge; thin bottom band. Not used. |
| landscape b | `public/art/mora-floodline-landscape-v5-b.png` | 23 (5/5/3/4/4/2) | **Accepted.** Wide foreground band for the dock; lighthouse top sits high (y≈20), like the previous accepted board (y≈40). |
| portrait a | `public/art/mora-floodline-portrait-v5-a.png` | 23 | Rock pools touch the left edge. Not used. |
| portrait b | `public/art/mora-floodline-portrait-v5-b.png` | 23 | **Accepted.** Three staggered pairs; release sandbar in the centre. |

The pad detector (`LOOSE=1 node scripts/measure-pads.mjs`) found 18 of 23
(landscape) and 14 of 23 (portrait); the rest were placed by eye and checked
with a red-ring overlay on the source before writing
`lib/games/floodline-art.json` and `lib/games/floodline-portrait-art.json`.
`tests/observatory-layout.test.mjs` passes the framing checks on every listed
device for both orientations. Checked in the running game (isolated worktree,
built-in browser): 800×600 landscape pane and 375×812 phone emulation, with one
placement played. Touch input was not tested.

## Balance

Bot self-play (`medium`, 2–6 seats, 12 seeds each), using a scratch variant
of `scripts/mora-balance.mjs` that also counts goal completion and releases
per die face.

- Floodline points per creature by habitat now range 2.8–3.1 (before: 2.4–4.4
  with Pier and Nesting beach dominating, Mangrove and Sea cave neglected).
- Die face "Empty" became "Emptiest" (least-crowded habitat with room; any
  empty one still qualifies). On Floodline's third round, "Empty" forced a
  release on 22% of non-roller turns; now 0%.
- Goals were re-priced by how often bots complete them when drawn: +3 for
  roughly 75%+ completion, up to +6 for about 25–40%.
