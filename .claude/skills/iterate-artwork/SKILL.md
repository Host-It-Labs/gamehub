---
name: iterate-artwork
description: Put newly generated board artwork candidates in front of the user for a visual comparison in the running game, without wiring them into gameplay. Use when new candidate images for a board (for example mora-paper-world-*-vN-a/b.png) have landed in public/art and the user wants to look at them and pick one. Pairs with imagegen-brief (which produces the images) and precedes the real integration.
---

# Iterate artwork: look first, wire later

The goal of this step is a quick visual look at candidates in the real table, at both orientations, with the real UI around them. It is **not** integration. Do not measure pads, labels, landmarks, crops or animation masks, do not write or edit metadata under `lib/games/`, and do not touch tests. Pads and rings will not line up on candidates with a new layout; that is expected and irrelevant at this stage.

## Steps

1. **Register the candidates as image-only variants** in `lib/games/observatory-variants.json`: one entry per candidate with `id`, `orientation`, `label`, `source` and the three optimized paths. Never remove the currently accepted entry.
2. **Generate the optimized files** with `node scripts/optimize-paper-worlds.mjs`. It writes the full scene plus the board and overview crops for every registered variant using the accepted geometry's crop boxes. Wrong crops on new layouts are fine for a look.
3. **Make sure the switcher is mounted.** `components/game/art-variant-switcher.tsx` is a floating control that lists the registered variants for the current orientation and remembers the pick in the browser. It is rendered by `solo.tsx` and `match.tsx` for the Observatory. If it was removed after a previous round, add the `<ArtVariantSwitcher/>` line back.
4. **Tell the user** which labels appear in the switcher and remind them the pads won't align on new layouts.

## When the user picks one

Only then do the integration: measure the chosen image with `scripts/measure-pads.mjs` (use `LOOSE=1` for greyer cream) and by eye from crops, write its geometry into the JSON files under `lib/games/`, rerun the optimizer, and run the framing and artwork tests. Remove the losing variants from the registry and the switcher line from the tables.
