# Arena nightly run, 27 September 2026

Nothing is committed. Everything below is in the working tree, ready to
review. Screenshots are in this folder.

## 1. The five remaining collector figures: done

All eight figures are now built into `figures.glb` and show in battle
(`lab-all-figures.png`, `battle-*.png`).

| Figure  | File                  | Triangles | Budget | Notes                                                                                                                                                                                  |
| ------- | --------------------- | --------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cadets  | `figure_archers.py`   | 7,837     | 8k     | Pressure suit, gold visor raised, chrome ray gun with a glowing tip. Aims exactly along +y in the game's blaster pose. Plainer than the Samurai: shallow quilting, a simple face.       |
| Robots  | `figure_imps.py`      | 7,971     | 8k     | Enamelled tin, rivets, dial panel, amber glowing eyes, pincers; the key turns on `spin` about the shaft. Slim legs next to the heavy torso.                                             |
| Cowboy  | `figure_ranger.py`    | 11,814    | 12k    | Duster with lining, vest and star, cartridge belt, revolver, lever-action rifle. The rifle attack in `troops.ts` was changed to the builder's two-handed hold (both fists stay on it). |
| Biplane | `figure_drake.py`     | 13,442    | 14k    | Doped-linen wings with rib tapes, roundels, rigging, rotary cowl, wooden propeller on `spin`, bomb and pilot. The pilot is the weakest part up close.                                  |
| Wizard  | `figure_mage.py`      | 11,932    | 12k    | Cobalt robe, charcoal mantle, beard, tall hat, twisted staff with a glowing crystal, flame in hand. The cast now keeps the staff upright (it used to flip).                             |
| Dino    | `figure_ogre.py`      | 15,997    | 16k    | Extra pass: muscle on thighs, shins and arms, and a tier of small flank scales. The gain shows from the side; from the high game camera it looks much the same.                        |

Each builder rendered front, back, side and game previews plus pose checks
(`work/arena/fig-*/`, git-ignored). The Cowboy's builder found that its
copied `sheet(back=True)` helper made inner skins invisible (the game draws
front faces only) and fixed it in its own kit; the Wizard uses the same
helper. Its hat brim and mantle look whole in the lab and battle shots, but
nobody has checked it closely.

## 2. Card portraits: done, twice

- **v3** (miniatures on bases, detailed product shots, era backdrops): all 16
  generated and picked. Your morning feedback said they were too detailed
  for the game and the characters too small.
- **v4** (the chosen set): the game's own clean 3D look and a close crop,
  so each character fills the card, with a simple blurred era backdrop. All
  16 were accepted on the first generation. Picks: Cadets a, Dino b, Robots
  b, Samurai a, Cowboy a, Biplane b, Wizard b, Meteor a. They're built into
  `public/3d/arena/cards` (`cards-v4-hand-phone.png`).
- Every prompt and pick is recorded in the concept README.
- Codex file problems were caught and fixed: several runs never copied their
  image, and 6 copied the wrong file (1 in v3, 5 in v4, from sessions
  outside the batch). Every saved PNG was matched byte for byte to its own
  session.
- One run (Wizard v3-b) called the image tool twice.

## 3. Library box and setup lid: done, twice

v4 picks: `box-arena-square-v4-a` and `box-arena-wide-v4-b`. Both show the
diorama on its plinth, the Samurai and Wizard against the red Dino and
Biplane over the bridges, and a brass "Arena", spelled correctly. The wide
one keeps its title and subjects inside the 30–70% band. They're served
under the old `v1` names (Arena hasn't shipped) and show in the library
and setup box (`library-desktop.png`, `setup-lid-phone.png`).

## 4. Troops stuck on their own towers: fixed

- **Cause:** a troop walking straight at its bridge hit its own small
  tower. The push-out went straight back along the centre line, so on the
  tower's x line (common, since drops snap to half tiles) it cancelled the
  step exactly and the troop stopped for good.
- **Fix:** `skirt()` in `engine.ts` turns a step that would enter a standing
  tower into its tangent, towards the goal (dead ahead: towards the middle).
- **Numbers:**
  - 396 named spots: 40 late, 32 never arrived. Now 0.
  - An 18,900-spot grid: 66 late. Now 0.
- **Bridges too:** two same-side Dinos jammed each other at a bridge, and
  opposing Dinos deadlocked head-on. `laneShove()` makes them queue, or pass
  on the bridge.
  - Stalled walkers in 60 bot matches: 139 → 2. The 2 left are Robots
    waiting on the bank while a Dino holds the bridge; not fixed.
- **Tests:** two added. Both fail before the fix and pass after.
- Deterministic maths only; the lockstep and checksum tests are unchanged
  and green.

## 5. X-ray silhouettes: done

After the main render, the troop batches are drawn on their own camera
layer twice:

1. into the stencil where they are seen;
2. flat and translucent with an inverted depth test where they are not,
   once per pixel.

Each instance carries a batch colour: white in the main pass, its team's
silhouette colour in the x-ray pass. So the materials stay shared and yours
show blue and the enemy's red, as you see them. The placement ghost has its
own layer and shows through too. Tower guards never do.

The renderer now asks for a stencil buffer (`world.ts`). Cost: about +150
draw calls and +250k triangles in a 9-troop battle (every troop material
per team, twice). Frame rate is unchanged (below). See
`xray-behind-towers-desktop.png`.

## 6. Placement: done

- **Under the tray:** while dragging, the tray fades to 25% (no blur).
  Anywhere but the card row counts as a field point, so a card dropped over
  the tray lands behind your king (`drag-under-tray-phone*.png`). Back over
  the cards, the tray returns to full opacity and letting go cancels.
- **Snap to legal:** `nearestLegal(m, side, card, x, y)` in `engine.ts`
  searches the half-tile grid, with a deterministic tie-break, and has a
  test. Drops and taps both use it. The ghost stands on the snapped spot
  with a faint line back to the finger (`drag-snap-from-river-phone.png`:
  a drop on the river lands at y 14.5).
- **Also fixed:** the ghost now uses the collector figures (it used the old
  toys).
- The server still checks `canPlayAt`.

## 7. Cameras and scale: done

- **Desktop:** 38° → 33° (40° lens).
- **Phones:** 63° → 59°. The far king still reaches the top edge and every
  drop tile stays visible.
- **Figure scale:** `troopScale(lens, phone)` draws figures at 1.75× on
  wide screens, 2.3× on portrait phones and 1.95× in tall windows
  elsewhere. Their rings, shots, strides, hop, lunge and health bars scale
  with them (bars via the `--figure` CSS variable).
- **Guards and towers:** guards grow 60% as much; towers keep their size.
- **Sharpness:** phones render at pixel ratio 3 at DPR 3 (measured).
- **Tests and docs:** the camera test and `docs/arena.md` "Screen" are
  updated.

## 8. Scenery: done

- **More of everything:**
  - Trees: 97 → 250, in groves that thicken with distance. Trees more than
    50 m out use new `-far` models (about 1.2k instead of 2.9k triangles).
  - Bushes: 13 → 225 (hedges along the walls).
  - Rocks: about 122.
  - Also 5 crags, logs, stumps, paddock fences and camp clutter.
- **Fewer tufts and flowers**, on purpose: they were as costly as trees.
- **Kept clear:** the field, the stream, the camps and your own end.
- **Phones:** keep 0.55 density and skip what their camera never sees.
- Props were rebuilt to `props-79b6418a.glb`.

## Measurements

Headless Chrome with the GPU, Apple Silicon, 4 s samples, 7–10 troops on
the field.

| View                    | Pixel ratio | fps | Draw calls | Triangles | X-ray off: calls / triangles |
| ----------------------- | ----------- | --- | ---------- | --------- | ---------------------------- |
| Desktop 1440×900, DPR 2 | 2 (held)    | 60  | 576–621    | 2.50–2.57M | 446–465 / 2.28–2.33M        |
| Phone 390×844, DPR 3    | 3 (held)    | 60  | 548–551    | 1.32–1.33M | 388–391 / 1.05–1.07M        |

- **Before tonight** (the scenery agent's baseline, same camera, x-ray off):
  - desktop: 502 calls, 2.02M triangles, 11.8 ms GPU;
  - phone: 470 calls, 1.48M triangles, 5.5 ms GPU.
- **After scenery** (x-ray off): desktop GPU 13.4 ms; phone 5.3–5.5 ms.
- **Headroom:** about 3 ms on desktop at DPR 2.
- **Download:** the manifest is 51.6 MiB across both texture tiers; one
  device fetches about 31 MB.
  - `figures.glb`: 5.5 MiB (all eight figures)
  - `props.glb`: 2.9 MiB
  - cards: 327 KiB

## Weaker or skipped

- **Plainer figures:** the Cadets and Robots have less sculpted detail than
  the Samurai (tight 8k budgets). The Biplane pilot is simple close up.
- **Wizard skins:** unchecked for the invisible-skin issue (see item 1).
- **X-ray cost:** the draw-call count is the main cost. A cheaper version
  would need troop-only material clones writing the stencil in the main
  pass.
- **Remaining stall:** Robots waiting beside a bridge that a Dino holds
  (`steer` aims them into the water).
- **Old props file:** the old `props-ca9113d8.glb` was copied back into
  `public/3d/arena/models/` after the build script deleted it. It's
  unreferenced and needn't be committed.
- **Debug artifact:** the battle screenshots' hands can show the same card
  twice; the screenshot script overwrites hand slots.

## Ready to commit (nothing committed)

- **Engine:** `lib/games/arena/engine.ts` (`skirt`, `laneShove`,
  `nearestLegal`), `lib/games/arena/layout.ts` (lenses, `troopScale`),
  `lib/games/arena/assets.json`, `tests/arena.test.mjs`
- **Runtime:** `components/game/arena/` `troops.ts` (scale, x-ray tags,
  rifle and cast poses), `view.ts` (x-ray pass, scale), `effects.ts`
  (ghost: figures, scale, tether; shot scale), `arena-game.tsx` (drop and
  snap, `--figure`), `arena.css` (tray fade, bars), `world.ts` (stencil,
  scatter)
- **Figure sources:** `assets/arena/blender/figures.py`, `figure_archers*.py`,
  `figure_imps*.py`, `figure_ranger*.py`, `figure_drake*.py`,
  `figure_mage*.py`, `figure_ogre*.py`, `props.py`
- **Artwork:** `assets/arena/cards/card-*-v3-{a,b}.png` and
  `card-*-v4-{a,b}.png`, `assets/arena/concepts/box-arena-{square,wide}-v3-*`
  and `-v4-*`
- **Built output:** `public/3d/arena/models/figures-e65fd298.glb`,
  `props-79b6418a.glb`, `public/3d/arena/cards/*`,
  `public/art/optimized/box-arena-*-v1*.webp`, `lib/artwork-previews.json`,
  `.dockerignore` (production allowlist)
- **Scripts:** `scripts/arena-assets.mjs` (v4 picks)
- **Docs:** `docs/arena.md`, `docs/DESIGN.md`,
  `docs/concepts/2026-09-26-arena-retheme/README.md`, this folder

## Checks

- `npm test`: 611 of 611 pass.
- `npx tsc --noEmit -p .`: clean.
- `npx oxlint components/game/arena lib/games/arena`: clean.
- Only changed files were formatted, with `npx oxfmt`.

## Questions for William

1. Are the v4 cards and covers close enough to the game's look, or should
   they go further toward flat, simple shapes?
2. Phone troops at 2.3×: the Dino now fills a lot of its lane. Keep it, or
   scale per troop (big troops grow less)?
3. X-ray colour and strength: soft light-blue and light-red at 42%. Want an
   outline look instead of a filled silhouette?
4. Should the Cadets and Robots get a second pass toward the Samurai's
   detail, or is the game-size read enough?
