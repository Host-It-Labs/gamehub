# Mora: Sunset Motel and Glacier Dam (29 September 2026)

Two new Mora boards, each with six habitats, its own creatures and its own
twelve Sanctuary Goals:

- **Sunset Motel** (`desert`, intermediate, 3 rounds, 23 spaces): a roadside
  desert motel taken back by the desert.
- **Glacier Dam** (`alpine`, advanced, 4 rounds, 28 spaces): a mountain hydro
  dam taken back by snow and alpine plants.

Scoring is in [the board rules](../../mora-board-rules.md).

## Generation

Every image is a fresh text-only generation (newest Luna, low effort, one image
per run, `gen.sh`). No reference images, no edits. Prompts are assembled from
`head.txt` + `style-<world>.txt` + `places-<world>.txt` +
`frame-<world>-<orientation>.txt`; the full prompts are the `prompt-*.txt` files.
Creature sheets: `prompt-creatures-<world>.txt`. Run logs are in `logs/`.

Two variants per image:

| Image | a | b | In the game |
| --- | --- | --- | --- |
| Motel landscape | `mora-motel-landscape-v1-a` (23 pads) | `…-v1-b` (23 pads) | a |
| Motel portrait | `mora-motel-portrait-v1-a` (23 pads, white haze on the left and bottom edges) | `…-v1-b` (23 pads) | b, extended |
| Dam landscape | `mora-dam-landscape-v1-a` (28 pads) | `…-v1-b` (28 pads) | a |
| Dam portrait | `mora-dam-portrait-v1-a` (28 pads) | `…-v1-b` (28 pads) | b, extended |
| Motel creatures | `mora-paper-motel-atlas-v1-a` | `…-v1-b` | a |
| Dam creatures | `mora-paper-dam-atlas-v1-a` | `…-v1-b` | b |

Side by side: `compare-boards.jpg`, `compare-creatures.jpg`. The goal
pictures for all four boards: `goal-icons.png`.

Several runs failed on network timeouts and were retried as new generations
(`logs/*-fail-*.log`). Two parallel runs got no `output_hint` and one copied
another run's newest image: `mora-dam-landscape-v1-b.png` was first a copy of the
Motel portrait b. Both real images were recovered from each run's own
`~/.codex/generated_images/<session id>/` folder. Check each output's size and
checksum after parallel runs.

## Integration

`build.mjs` holds the measured pad centres, labels, Release point, landmark
boxes and animation masks, and writes `lib/games/{motel,dam}{,-portrait}-art.json`
and the optimized WebPs (`--write`). Pads were found with
`scripts/measure-pads.mjs` (the Motel's warmer cream needed a tuned threshold),
completed by eye and checked on overlays.

- Landscape play boxes: Motel 537, Dam 545 source px tall. Both cover every
  desktop window in `scripts/check-board-cover.mjs`.
- The generator spread the portrait places wider than the brief asked (about
  12–93% of the width), so on a phone's cover scale they did not fit. The
  portrait plates are therefore extended with their own mirrored scenery
  (`scripts/extend-paper-world.mjs`, then `extend-paper-world-sides.mjs`):
  Motel b +300 above, +370 below, +60 each side (1144 × 2206); Dam b +100 above,
  +350 below, +130 each side (1284 × 1986). They cover every enforced phone and
  portrait tablet window; creatures are about 26 px (Motel) and 27 px (Dam) on a
  390 × 844 phone (Floodline: 28).
- On phones, a few outer edges of landmarks are cropped: the Motel pool's outer
  rim and room wall (up to about 50 source px), and the Dam reservoir's outer ice
  edge, cable car cabin and ice arch (up to about 40). Every pad, label and
  Release stays inside the stage. These boards are therefore not in the strict
  phone landmark test.
- Portrait labels are one short line each (phones allow about 18 characters);
  the full rule stays in the habitat inspection.

## Balance (medium bots, 80 boards, `scripts/mora-balance.mjs 4 <set>`)

| Board | Average score | Releases per board |
| --- | --- | --- |
| Observatory | 37 | 0.3 |
| Floodline | 48 | 1.8 |
| Sunset Motel | 50 | 0.07 |
| Glacier Dam | 68 | 0.2 |

The first Motel rules scored 36 with 4.6 releases per board: the Sign ("4 each
of your most common species") lost points whenever another species overtook
it, and was the losing habitat in every one of 112 sampled releases. It now
points at the Pool (4 if its species is in the Pool, else 1). The Road, the
Garage and the Pool give 1 for a creature that misses their condition, and the
Rooms accept one or two species. The Summit hut is capped at 4 per creature.
