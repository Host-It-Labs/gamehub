# Arena roster rework: every remaining figure, Sumo again, better motion

8 October 2026. The user's request, close to verbatim:

> We're reworking all the models in the Arena game so they feel more high
> quality and animated. The ones we've worked on (the dinosaur, the samurai,
> the sumo) do feel better, but they could be better animated. Continue
> until this is done on all the other models, at good quality. The Sumo is
> not too bad, but his arms feel like a robot's: not natural in the way they
> sit on his body, and when he fights the way they move, even the way he
> moves generally, doesn't feel right or high quality.

Half of the 3D work goes to Codex, half to Claude (see Ownership).

## Since the night of 8–9 October (read first)

- **One Blender job at a time on the whole Mac, two at most.** Four parallel
  sculpt builds reached ~51 GB on this 36 GB machine and froze it. Keep sculpt
  and subdivision resolution moderate (a master that builds in a few GB),
  check memory after your first build (`ps -o rss= -p <pid>`), and never run
  Blender jobs in parallel from one agent. A `pacer` plugin may hold a heavy
  command until memory allows; a held call just waits.
- **Codex's sandbox cannot launch Blender** (Metal init exits 139) or reach
  localhost. Codex writes sources and `commands.md`; the root runs those
  Blender commands and puts the renders in the figure's folder for Codex to
  open. Don't build workarounds that escape the sandbox.
- **Arms: use `components/game/arena/moves/reach.ts`.** `reach(c, side, goal)`
  poses an arm by where the wrist goes, where the elbow points and which way
  the palm faces, solving shoulder, elbow hinge and wrist from the figure's
  rest bones (`c.rest`), splitting the palm's roll between forearm and wrist
  and keeping Euler goals continuous. `moves/sumo.ts` is the worked example
  (REST, GUARD, CHAMBER, SLAP goals blended per frame). Hand-tuned Euler
  angles on a bind pose are what made the old arms robotic. Import it as
  `from './reach.ts'` (with the extension): some tests load moves files
  through Node's own type stripping, which needs it.
- **Tests and memory:** never compare three.js objects with `assert.equal`
  (a failure makes Node diff two whole scene graphs: 45–57 GB on 9 October,
  from a stale Medic expectation). Compare names. Run Arena tests one file
  at a time (`node --test --test-concurrency=1 <file>`).
- **Crouches:** a negative `p.lift` now bends the knees on planted feet (it
  used to lift the feet off the solver beyond a few centimetres).
- **Review harness:** `scripts/arena-troop-review.mjs` uses the stand-alone
  Arena lab (`scripts/arena-lab`, port 3027, started automatically), steps a
  stopped clock so frames are evenly spaced (`--realtime` to film the free
  clock), and takes `--eval "<js>"` (e.g. live-tuning a moves file that reads
  `window.__arenaTune`). Lab cameras: `cam=front|side|back|three|game|gameback`,
  `zoom`, `turn`; modes include `march` (straight ahead) and `circle`.

## Mandatory skill

Every agent doing modeling, rigging, materials or animation reads and follows
[high-fidelity-3d](/Users/williamguinaudie/.codex/skills/high-fidelity-3d/SKILL.md)
before starting. Read [docs/arena.md](../../arena.md) (Art and build) and
[moves/types.ts](../../../components/game/arena/moves/types.ts) too.

## What already exists

- Rebuilt on 4 October (skinned, sculpted, own runtime copy): Dino `ogre`,
  `sumo`, Cowboy `ranger`, Samurai `duelist`, Wizard `mage`, `gladiator`,
  `medic`; `viking` (rigid parts). Their review records are in
  `docs/concepts/2026-10-04-arena-*`. The quality bar to beat is
  `work/arena/2026-10-04-vgm/three-runtime-front.jpg` (Viking, Gladiator,
  Medic in the game). New figures must be at least that good in the game.
- Still the old blocky toys (capsule limbs, mitten hands, ball heads): the
  seventeen figures below. They are what this round replaces.
- Identity reference for every troop: its current card portrait
  (`assets/arena/cards/card-<id>-<pick>.png`, pick in `CARD_ART` in
  `scripts/arena-assets.mjs`) and its written subject in
  `docs/concepts/2026-10-01-arena-draft/portraits.md`. Keep the identity
  (who they are, costume, props, palette, team-blue garments); the portraits
  are richer than the current models, so match them more closely, not less.
  Portraits are not regenerated in this round unless the root asks.

## Ownership

One owner per figure. An owner edits only its own files: `figure_<id>.py`,
new private helpers `figure_<id>_*.py` (and `assets/arena/blender/runtime/<id>-runtime-v*.blend`),
`components/game/arena/moves/<id>.ts`, and evidence under
`work/arena/2026-10-08-roster/<id>/`. Do not edit shared files: `kit.py`,
`figures.py`, `figure_folk_kit.py`, `articulation.py`, `face_rig.py`,
`troops.ts`, `moves/types.ts`, `moves/index.ts`, `materials.ts`, `faces.ts`,
`assets.json`, `scripts/arena-assets.mjs`, any `public/3d/arena/models/*`.
Need a shared change? Write it in your report (or `work/arena/2026-10-08-roster/<id>/requests.md`);
the root (Claude, main thread) makes shared changes and integrates figures
into the shipped bundle. Never `git stash`, `git checkout --` or revert
anyone else's edits; other sessions (Rota, Diner, library) are editing this
tree at the same time.

| Figure | Card name | Owner |
| --- | --- | --- |
| `diver` | Diver | Codex A |
| `firefighter` | Firefighter | Codex A |
| `explorer` | Explorer | Codex A |
| `linebacker` | Linebacker | Codex B |
| `drummer` | Drummer | Codex B |
| `guard` | tower archer (stands on the small towers) | Codex B |
| `beekeeper` + `bee` | Beekeeper and her bees | Codex C |
| `jetpack` | Jetpack | Codex C |
| motion pass: `viking`, `gladiator`, `medic`, `mage` | | Codex C (after its figures) |
| `pirate` | Pirate | Claude |
| `miner` | Miner | Claude |
| `inventor` | Inventor | Claude |
| `archers` | Cadets (two per card, a woman and a man) | Claude |
| `gunner` | Gunner (with his cannon) | Claude |
| `imps` | Robots (three per card) | Claude |
| `drake` | Biplane and pilot | Claude |
| `balloon` | Balloon and aviatrix | Claude |
| `sumo` rework, motion pass: `ogre`, `duelist`, `ranger`; shared runtime | | Claude (root) |

## The figure contract (unchanged unless noted)

- Blender: +Y forward, Z up. An empty named `<id>` at the feet; parts or
  bones named `<id>.<part>` with origins/heads on the anatomical pivot, part
  names from `PartName` in `moves/types.ts`. three.js drops the dot.
- Skinned figures use common-axis bone frames: every bone points +Z with
  its local axes equal to the root's (see `make_rig` in
  `figure_sumo_sculpt.py`), so the runtime's radians mean the same thing as
  for rigid parts (+x raises an arm or leg forward). Rigid parts are fine
  for hard props and armour; organic bodies, sleeves and trousers that bend
  should be connected skin.
- **New optional joints (8 October), supported by the root in troops.ts:**
  `chest` (upper spine: child of `torso`, which becomes the lower back/abdomen;
  `head`/`neck`, `clavL`/`clavR` and the arms hang from `chest`) and
  `clavL`/`clavR` (shoulder girdle at the sternoclavicular end, child of
  `chest` or `torso`, parent of `armL`/`armR`). The runtime splits torso
  bends between `torso` and `chest`, and moves the clavicles with the arm
  (shrug as the arm rises past the shoulder, protraction on a forward
  reach, retraction on a pull back). Every new human figure should have
  them and weight the trapezius, deltoid and upper chest to them.
- Faces: separate `<id>eyeL/R`, `<id>pupilL/R` (child of its eye),
  `<id>browL/R`, `<id>mouth` controls in centred surface frames, attached
  to the head (see `attach_faces` in `figure_sumo_sculpt.py`); `faces.ts`
  blinks and squints them. Expressions: focused and determined in action,
  never grinning at the viewer.
- Materials `<family>:<tint>`; `team`, `team2`, `team3` follow the side.
  Families in `materials.ts` (skin, hair, reptile, weave, hide, resin,
  lacquer, gilt, tin, chrome, paint, beech, felt, drape, …). Pigment and AO
  go to the single `COLOR_0` channel (see the Dino export failure in the
  quality-rebuild review). No textures inside the figures GLB.
- Size: keep each figure's current native height and footprint within
  about ±8% (measure the current export first). Multi-unit cards keep
  their spacing (`formation` in `lib/games/arena/cards.ts`).
- Runtime budget per figure: about 20–30k triangles (Cadets ≤ 18k each,
  Robots ≤ 12k each, bee ≤ 1.5k, Biplane and Balloon ≤ 32k including the
  vehicle). Keep the detailed master separately; the normal build loads a
  frozen runtime copy (as `figure_sumo.py` does) or builds quickly enough.
- **Rest pose = the natural relaxed stance**, not an A- or T-pose: upper
  arms hang against the flanks, elbows softly bent 10–20°, hands relaxed
  beside the thighs with palms facing in, weight on both feet. Skin must
  still deform cleanly for an arm raised forward to ~120° and sideways to
  ~100°, elbows to ~140°, knees to ~120°. This is the Sumo's main defect.

## Motion

`components/game/arena/moves/<id>.ts` is rewritten for every reworked
figure (read the existing one first; keep ability timings, windup and
gameplay). The shared walk plants feet and swings arms; the troop's `pose`
gives it a personality:

- Idle: breathing in the chest, small weight shifts, an occasional fidget
  timed by `idleFor` (stops under reduced motion).
- Walk: pick and tune the gait (`style.gait`) and `carriage`; arms swing
  from relaxed shoulders with a lagging elbow and a loose wrist, never held
  out stiffly. Props are carried with intent (two hands where the portrait
  shows it).
- Attack: anticipation (a wind-up that loads the hips and shoulders),
  a fast readable strike that lands on the hit, follow-through, a settling
  recovery. Drive strikes from the legs and hips through the chest to the
  hand. Elbows never bend backwards; hands keep their grip; props stay
  attached and clear of the body.
- Hit reaction, deployment (`arrive`) and secondary motion (hair, cloth,
  straps, antennae) with mass-appropriate springs (`stiff`, `damping`).
- Judge pace by limb speed, not ground speed (see docs/arena.md and the
  memory of 2 October: big figures moving at real-person timings read as
  slow motion).

## Review (each owner, before handing over)

1. Blender: neutral clay front, side, rear, three-quarter and the game
   camera (about 55° down), face and hand close-ups, and extreme poses
   (arm forward up, arm out, deep elbow and knee bends, the attack's
   extreme). Then the material three-quarter.
2. Build a single-figure dev GLB:
   `ARENA_FIGURES=<id> /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python assets/arena/blender/figures.py -- public/3d/arena/dev/<id>-<version>.glb`
3. In the real renderer: `node scripts/arena-troop-review.mjs --id <id> --figures /3d/arena/dev/<id>-<version>.glb --mode walk|attack|idle|deploy --cam front|side|back|three|game --out work/arena/2026-10-08-roster/<id>/<name>.jpg`
   writes a frame sheet from headless Chrome at a close camera on the
   running dev server (port 3017; pass `--port` for your own). Open and
   look at every sheet. The lab page itself is
   `/arena/lab?only=<id>&single&cam=three&figures=/3d/arena/dev/<file>.glb&mode=attack`.
4. Write `work/arena/2026-10-08-roster/<id>/review.md`: what you looked
   at, concrete failures you fixed, what still falls short. Passing tests
   is not visual acceptance.

Disk is nearly full (about 30 GB free): keep evidence as JPG sheets, keep
one detailed master `.blend` and one runtime `.blend` per figure, delete
your own superseded intermediates, and stay under about 300 MB of evidence
per figure. Don't write large files into the repo outside your folders.

## Integration (root only)

The root merges each accepted figure root into a new hashed figures
bundle, preserving every other root's bytes, updates
`lib/games/arena/assets.json`, runs the Arena tests
(`node --test tests/arena-*.test.mjs`), reviews the figure in the real
game at phone, tablet and desktop sizes, and records it here.

## Integration log

- **9 October, Sumo motion (root):** arms by `reach`, low ready stance,
  tsuppari with a follow-up slap, waddle, shiko idle and landing; shared
  crouch and arm-guard changes. Record: `work/arena/2026-10-08-roster/sumo/review.md`.
  No model change yet (clavicles and the inner-thigh AO are queued).
- **9 October, Bee (Codex C, Blender run by root):** 1,460 triangles, shaped
  cuticle, six legs, four wings, team mark on the thorax; Codex's hover,
  bank, sting and recovery motion. Merged with `scripts/arena-merge-figures.mjs`
  into `figures-63db0477.glb` (every other root byte-identical); the figure
  test's swarm cap is now 1.5k.
- **9 October, Sumo girdle (root):** `figure_sumo_girdle.py` adds `chest`,
  `clavL`, `clavR` bones and weights to the frozen runtime copy and lifts
  the inner-thigh occlusion; the runtime's shoulder rhythm now moves his
  shoulders.
- **9 October, Miner (Claude agent) and Pirate (Claude agent):** sculpted
  connected skins with clean necklines, rigs with chest/clavicles and face
  controls, reach-driven motion (Miner 29,351 triangles; Pirate 29,626).
  Merged into `figures-48cccbe3.glb` with their moves files. Tests: the
  September file's mock context now reads `rest` from the shipped figure,
  its continuity check compares the instants either side of the hit, and
  every three.js-node `assert.equal` in the Arena tests compares names.
  `materials.ts` ignores Blender's `.001` duplicate suffixes.
- **9 October, Firefighter (Codex A, Blender run by root):** 28,704
  triangles; brass helmet, moustache, buttoned jacket, hose and nozzle held
  in two hands through reach. Merged with its moves into the current
  bundle. `figure_firefighter.py` still needs switching to the frozen copy so
  a full build reproduces it. The October test's old-geometry grip check now
  covers the Explorer only; the Firefighter's grip is checked by its probe.
- **9 October, Diver and Explorer (Codex A, Blender run by root):** merged
  with their moves; the Diver's hose and the Explorer's ruff jolt on a hit.
  The October test's old two-hand grip check is retired (both tools are
  checked by the figures' reach probes).
- **9 October, Beekeeper (Codex C, Blender run by root):** 30,023 triangles
  (budget check allows up to 30.5k); straw hat, pinned-up veil, grey bun,
  framed hive, hooked right-hand grip on the bellows; reach-driven smoker
  puff. Merged with its moves.
- **9 October, Linebacker and Drummer (Codex B, Blender run by root):**
  barrel-chested linebacker with layered pads and leather helmet;
  drummer with tailcoat, shako and a symmetric shouting mouth. Merged with
  their moves. The animation test's Drummer negative control (its old free
  stride entered stone) is retired: the rebuild clears the stone unaided.
  Open: the Linebacker's attack motion barely reads (arms half out).
- **9 October, tower archer (Codex B and G1, Blender run by root):** new
  hooded archer; TowerCrew keeps the bow string on the nock through raise,
  draw, loose and recovery per tower (tests/arena-guard-string.test.mjs).
  Skinned tower copies keep their tower placement. Merged.
- **9 October, Jetpack (Codex C, Blender run by root):** merged with its
  moves. `materials.ts` gains a `glass` family (clear, glossy, 30% opaque, no
  vertex AO): the bubble helmet rendered opaque white without it. The
  scarf jolts on a hit.
- **9 October, Biplane and Balloon (Codex C sources, root built, reviewed and fixed):** merged with their moves. First galleries were rejected for the pilots: ink knuckle lines floating across the gloves, cream cuff rims poking out as spikes, the joined mouth control turning lips and tongue black, and nine white fringe locks spiking over the balloonist's forehead. All fixed in `figure_drake_anatomy.py` (lips now sit on the head; the live mouth is a slim aperture). The balloonist is seated, so the September leg-solver test skips her and her `cape` is now the scarf at her neck.
- **9 October, motion passes (root):** the Linebacker's ordinary hit is now a two-hand punch from a low, loaded set (hips back, hands cocked at the chest, hips fire through the hands); the Dino's bite coils lower, lunges further and shakes harder.
- **9 October, gun muzzles and Cadet looks (root, runtime):** `TroopView.muzzle()` returns a `<id>.muzzle` empty's world position on a unit's own skin copy, and shots leave it (falling back to the chest). A card whose head bone carries `<id>.lookA`/`lookB` shows the second look on every odd unit id. Both wait for the Inventor and Cadets exports.
- **9 October, Gunner and Imps (Codex B sources, root built, reviewed and fixed):** merged with their moves and frozen loaders. The Gunner's first source left the back of his skull bare and ridged; `figure_gunner_sculpt.py` now lays combed silver hair to the nape. Both reducers re-applied corner normals after `object.join` as a flat list, but join does not keep the parts' order, so about half the normals of every joined mesh pointed backwards and the runtime shattered into dark triangles; normals now travel through the join as a corner attribute (`sourceCornerNormal`). The old two-fists-on-the-bar Gunner test was retired: the new Gunner keeps one hand on the trail and signals the shot.
- **9 October, review renders (root):** the Inventor/Cadets review swapped materials with `materials.clear()`, which resets every face to slot 0, so multi-material bodies rendered in their first material (brown coveralls, bald Cadets, cream suits). Face indices are now restored after each swap. Their source models were correct; earlier galleries were misleading. Blender also exits 0 on a Python error unless given `--python-exit-code 1`.
- **9 October, Inventor (Codex A sources, root built, reviewed and fixed):** merged with her moves and the reviewed frozen builder. Her hair puffs broke into pits when reduced; `figure_inventor_dress.py` now builds fewer, larger, softly blended curl clumps. One 8-vertex loose sliver at the wrist failed the connected-skin gate; the stage driver now drops islands that small. Her depth is 61% under the old figure because the old tool stuck far forward; signed as a measured exception, not a rescale. The zap now leaves `inventor.muzzle` (`TroopView.muzzle()`), and her weapon now hangs from `handR`.
- **9 October, Cadets (Codex A sources, root built, reviewed and fixed):** merged with their moves and frozen builder; every odd unit id wears her look. Her face window had the fringe term's sign flipped, so the bob shell covered her whole face; crown volumes spilled over the brow; groove cuts streaked hair across the face; hair is now labelled by a clean per-look hairline. Five shoulder slivers were dropped so the suit is one piece. The hidden look's head group exports at scale 0 and misplaced, so the runtime gives the shown head the other look's transform. Glass meshes (both bubbles) no longer cast shadows. The carried ray gun now bobs with the step and the antenna flourishes at idle; the Cadets animation tests check arm and antenna motion instead of the old free wrist and weapon.
