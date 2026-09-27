# Lucky — factory machines that show their intakes (26 September 2026)

Fresh text-only generations with Codex `$imagegen` (newest Luna at low
effort, via `.claude/skills/artwork/newest-luna.mjs`), two variants, both
launched in parallel by `run.sh`, one image per Codex call. The exact prompt
is in `prompts.mjs` (the size line is prepended by `run.sh`); Codex logs are
kept as `log-*.txt`. Source PNGs live in the art archive
(`../gamehub-art-archive/public/art/lucky/factory/machines-v2-*.png`), not in
git. Delivery sprites are written by `scripts/optimize-lucky-factory-art.mjs`
with `LUCKY_SUFFIX=-v2`.

## Brief

William: some machines accept tickets from several sides, but the v1 art
shows one input on one side, so they read as one-sided. Redraw the sheet so
the art shows where tickets can enter, following the rules in
`lib/games/relic/factory.ts`:

- Output is always on the facing side, the right (east) edge of the sprite.
- Scratch bot, Stamper, Gilder, Bundler: intakes left, top and bottom;
  output right.
- Cashier: intakes on all four edges; no output (it sells).
- Splitter: intakes left, top and bottom; deals out right, top and bottom in
  turn. Keeps the round brass turntable with arrows.
- Printer: no intake; output right only; the other three edges closed.
- Lamp, Ink well, Charm: boosters; no tickets at all, boost every touching
  neighbour, so four-way symmetric with no slot, chute or lip on any edge
  (v1's lamp and ink well wrongly had an output lip on the right).

One visual language across the sheet: an intake is a recessed dark slot
with a thin brass lip and a small cream ticket-guide notch, identical on
every intake edge; an output is a protruding cherry-red enamel chute with a
cream ticket poking out, right edge only. Same style paragraph, layout and
order as the accepted v1 sheet (`docs/concepts/2026-09-25-lucky-factory`).

## Log

| Attempt       | File                                 | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| machines a #1 | machines-v2-a.png (1536×1024, alpha) | PASS: ten separate machines in a 5×2 grid (10 blobs, no stray pieces), clean alpha (63% clear, 1.7% partial, no halo on teal), true plan view, square plates, no text. Cherry-red frames on cream plates. Intakes: printer none (L/T/B closed), bot L/T/B, cashier L/T/R/B with no chute, splitter L/T/B, stamper L/T/B, gilder L/T/B, bundler L/T/B; red chute with ticket on the right of printer, bot, splitter, stamper, gilder, bundler only. Lamp (glowing bulb in a green dome), ink well (four drops, diagonal quill) and charm (four corner tassels) are four-way symmetric with no slot, chute or lip. |
| machines b #1 | machines-v2-b.png (1536×1024, alpha) | PASS: same checks (10 blobs, 61% clear, 1.7% partial, no halo, plan view, no text). Brass-trimmed cream plates; the red chute is the only red on any edge. Same intake pattern on every machine as A. Flaws: the printer's drive gear pokes out past the left edge of its plate, and the lamp reads as a green domed gem with a brass cross rather than a lamp.                                                                                                                                                                                                                                                  |

Both runs made one image each (one PNG in each Codex session folder,
`01a0ddfe-3697-…` for A and `01a0ddfe-36b0-…` for B). Codex's own copy to
the art archive was refused by its workspace sandbox; `run.sh` then copied
the session's single PNG. Gutters between neighbours are about 28–30 px
(~9% of a 307 px cell, under the 12% asked) and the bundler sits 6 px (A) /
8 px (B) from the right canvas edge; no slicing cut crosses a machine.

## Chosen

**A** (`machines-v2-a.png`). Both pass the intake brief. A keeps the
printer's three closed edges clean (B's gear pokes out of the left edge),
its lamp reads as a glowing lamp, and the cherry-red frame keeps v1's
cream/cherry/gold palette and gives every tile a firm outline on the teal
floor. B's red chute stands out more against its brass trim; it is the
ready alternative (`LUCKY_MACHINES=machines-v2-b.png`).

## Delivery

`LUCKY_MACHINES=machines-v2-a.png LUCKY_SUFFIX=-v2 node scripts/optimize-lucky-factory-art.mjs`
writes only the ten machine sprites as `public/art/lucky/factory/<kind>-v2.webp`
(192×192, common square of 297 source px, same trimming and centring as v1);
the v1 sprites, `floor.webp` and `belt.webp` are untouched. Each sprite is
centred on its whole box, chute included, so on the six machines with a
chute the square plate sits about 8–14 px (of 192) left of the sprite
centre, while the cashier and the three boosters are centred.
