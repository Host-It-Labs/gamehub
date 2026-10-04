# Arena: the first seven troops, more flair (3 October 2026)

William's request: the seven troops of the starting deck (Cadets `archers`,
Dino `ogre`, Robots `imps`, Samurai `duelist`, Cowboy `ranger`, Biplane
`drake`, Wizard `mage`) need **more animation, more personality and higher
quality models**. Walks still look stiff. Examples he gave: the Wizard's
cape should move naturally and flap, not hang stuck; the Dino's feet look
tiny for its body and its walk is not great. "Really work on them so they
look much better, feel a lot better, more high quality."

Read first: `docs/arena.md` (Build and Runtime sections),
`components/game/arena/moves/types.ts` (the animation contract),
`lib/games/arena/gait.ts` (gait presets), one good newer troop for reference
(`moves/pirate.ts`, `moves/viking.ts`, `figure_pirate.py`).

## Who owns what

One agent per troop. You own exactly these files and edit nothing else:

| Troop   | Files                                                                             |
| ------- | --------------------------------------------------------------------------------- |
| any id  | `assets/arena/blender/figure_<id>.py`, `figure_<id>_kit.py`, `components/game/arena/moves/<id>.ts` |

Shared files are read-only for you (`troops.ts`, `moves/types.ts`,
`moves/index.ts`, `gait.ts`, `kit.py`, `figures.py`, `articulation.py`,
`wind.ts`, `materials.ts`, `view.ts`, `world.ts`). If you need a change
there, do not make it: describe it exactly in your final report (what,
where, why) and work around it meanwhile. Other agents are editing their
own troops at the same time in the same working tree; never run
`git stash`, `git checkout --`, a formatter over the whole repo
(`npm run format`), or anything that rewrites files you do not own. Format
your own TS with `npx oxfmt <your files>`. Never commit or push.

## What is new since this morning (shared, already built)

- **Each of the seven has its own `moves/<id>.ts`** with its old style,
  carriage and per-troop code moved over unchanged (the Dino's tail and
  jaw, the Robots' key, the Biplane's flight). Add a `pose(c, p)` or extend
  it. A joint your pose asks for with `c.want(...)` is yours: the shared
  code no longer overwrites torso, head, arms, weapon, offhand, tail or jaw
  you claimed (it still writes the ones you leave alone from `p`).
- **Soft joints for secondary motion**: new optional parts `hat`, `beard`,
  `hair`, `neck`, `tail2`, `tail3`, `cape2`, `antenna`, `sleeveL`,
  `sleeveR`, `handL`, `handR`, `extra2` (plus the existing `cape`,
  `skirtL`/`skirtR`, `tail`, `foreL`/`foreR`). Build them in Blender as
  `<id>.<part>` joints with the origin on the pivot, parented to what they
  hang from (a `tail2` under the `tail`, a `hat` under the `head`, a `cape`
  under the `torso`). They rest unless your pose asks for them.
- **Motion signals** on the context: `c.accel` (speeding up along the
  facing, world units/s²), `c.lateral` (sideways, + to its right),
  `c.vertical` (the body's up/down acceleration), `c.turn` (rad/s, + left),
  `c.idleFor` (seconds stood idle, for timed fidgets), `c.flinch`, `c.time`
  and `c.memo` (per-troop scratch numbers kept between frames: Moves objects
  are shared by every troop of a card, so per-troop state goes in
  `c.memo`). Drive soft parts from them so they lag, swing and settle: a
  hanging part swings back when the body speeds up and forward when it
  stops, an upright part (a hat tip, an antenna) the other way, both swing
  outwards in turns and bounce with `vertical`.
- **Per-troop springs**: `stiff` and `damping` on Moves (per joint) override
  the defaults (STIFF in troops.ts, damping 0.62). Cloth and tails want low
  stiffness and damping around 0.3–0.45 so they overshoot and settle.
- **Rippling cloth**: material family `drape` (Blender material
  `"drape:<tint>"`, looks like `weave`). After the mesh's final UV pass and
  any join, call `kit.drape(obj)` (see its docstring in `kit.py`): the
  drape faces get a second UV set `Wave` with freedom 0 at the seam to 1 at
  the hem (by default down the object's own z; pass `top`, `bottom` or a
  `free(co)` function), and the game ripples them along the part's own -y
  (behind the figure for an unrotated part), with waves running down and
  across, more while the troop moves, turns, strikes or is hit. Give the
  cloth vertices to bend (about 10 rows seam to hem). Only drape faces
  move; it works on a part that joins cloth with other pieces, but a cloth
  that should also swing as a whole wants its own joint (`cape`) on top of
  the ripple. Check the exported part still has two UV sets.
- Towers are now drawn larger (not your concern, but the far views look
  different from yesterday's screenshots).

## Build and look

Build only your figure into a dev GLB (about 15–60 s; four Cycles previews
are rendered when a preview path is given):

```
ARENA_FIGURES=<id> /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
  --python assets/arena/blender/figures.py -- public/3d/arena/dev/<id>.glb \
  <your scratch dir>/<id>.png <id>
```

That writes `<id>-front.png`, `-back.png`, `-side.png`, `-game.png` and
prints `FIGURE <id>: N triangles, parts [...]`. `public/3d/arena/dev` is not
tracked.

See it move in the game's own renderer: the dev server already runs at
`http://localhost:3017` (shared, hot reloading; do not start or stop it).
The lab lines up your troop for both sides:
`http://localhost:3017/arena/lab?only=<id>&figures=/3d/arena/dev/<id>.glb&mode=walk`
(`mode=attack`, `mode=idle`, or none to alternate every four seconds; `far`
for the game's own framing). `window.arenaLab = { view, m }` in the page:
`view.setCamera([x,y,z],[tx,ty,tz],fov)` aims a close camera. With one
troop lined up, the blue one stands about world (0, 0, 5) facing −z and the
red one about (0, 0, 2.4) facing +z, each marching a little forward and
back: `[6, 2, 3.7] → [0, 1, 3.7]` sees both side on, `[3, 2.6, 8.5] →
[0, 1.2, 3.4]` the blue one's back and the red one's front, experiment (a figure is roughly 2.5 world units tall). To check motion at
match-length clock times, `window.arenaLab.view.world.clock.time = 3000`.

The desktop Browser pane freezes animation; use headless Chrome. A small
driver is at
`/private/tmp/claude-501/-Users-williamguinaudie-Documents-code-gamehub/f89fe560-cacb-427f-9f88-7196d2af4d94/scratchpad/shot.mjs`:
copy it into your own scratch dir and run

```
CDP_PORT=<your port> SHOTS=4 GAP=250 node shot.mjs "<lab url>" 900x700 out.png 16 "window.arenaLab.view.setCamera([3,2.6,8.5],[0,1.2,3.4],34); 1"
```

(url, size, output, seconds to wait for load, optional JS run before the
shots; `SHOTS`/`GAP` take a burst so you can judge motion). It launches
its own muted headless Chrome with the Metal GPU on your port and leaves it
running for the next call: **use only your own port** and kill that Chrome
when you are done (`pkill -f "remote-debugging-port=<port>"`). A burst of
frames is the only way to judge motion: look at several, at walk, attack
and idle, from the front, side, back and the game's high camera.

## The bar

- Keep each character's identity, palette and silhouette (the card
  portraits `assets/arena/cards/card-<id>-v7-*.png` show them; the card art
  stays). Improve, do not redesign. Cartoony, bright, clean, chunky
  (docs/DESIGN.md Arena sections, memory: cartoon, not realistic).
- **Higher quality model**: better proportions and silhouette from the
  game's high camera, smoother curved surfaces where it is faceted, crisper
  details that read at game size (bevels, trims, layered clothing, hands
  that read), no interpenetration or gaps in motion, no floating parts.
  Triangle budget: about +35% at most over today (archers 12.4k → 15k each,
  imps 9.9k → 12k each, ogre 18.4k → 25k, others ~16k → 21k).
- **More animation and personality**: a proper idle (breathing, weight
  shifts, a fidget or two timed with `c.idleFor`/`c.memo`, each troop its
  own), anticipation and follow-through on attacks, a deploy entrance with
  character (`arrive`) if it suits, a reaction to being hit, secondary
  motion on everything soft (capes, coat tails, hats, beards, tails,
  antennae, straps, scarves).
- **Walks that are not stiff**: tune the gait (`style.gait` with changes)
  and add what the shared walk lacks in your pose: counter-rotation, head
  and tail follow-through, a bit of bob in shoulders and weapon, loose
  wrists and elbows. Judge pace by limb speed, not ground speed: the
  figures are drawn ~2.4× their footprint, so large figures moving at real
  timings look like slow motion (`cadence` ~2 steps/s). Never make a troop
  move faster over the ground (the engine sets that).
- Shader and time rules: never multiply time by a changing rate
  (`sin(t * (a + b*x))` jumps as t grows); keep rates fixed and change
  amplitudes, or accumulate a phase in `c.memo`.
- Performance: troops are batched per material; prefer reusing your
  existing materials over adding new ones. A new joint costs a matrix per
  troop, which is fine.
- Run `node --experimental-strip-types --test tests/arena*.test.mjs` before
  you finish (it should stay green) and `npx tsc --noEmit -p .` for your
  files.

## Report

End with: what you changed in the model and the motion (short list), the
triangle count before and after, the joints the figure now has, paths to
your best before/after screenshots (front close-up, walk burst, attack,
idle, game camera), anything you could not get right, and any shared-code
change you need (exact).
