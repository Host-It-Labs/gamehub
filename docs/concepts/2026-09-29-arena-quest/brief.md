# Arena: eight new troops, Quest, a new loading screen (29 September 2026)

William's request, all of it at once:

1. A real loading screen that looks good: no technical text (no megabytes,
   no "opens from this device"), just art and a clear progress bar.
2. The game is too bright: bring it down a little. Make the textures look
   better.
3. Walks still look stiff ("a stick up their ass"). The Cowboy's coat
   animates badly while he walks: fix it.
4. Eight new troops, each a unique character with its own role, not a
   variant of an existing one. Models at least as good as the current ones.
   Diverse characters.
5. Two sections: **Versus** (the current 1 v 1 and 2 v 2) and **Quest**, a
   roguelite played solo or with a friend: upgrade troops, win new ones,
   different every run.

## The eight new troops

Stats are in `lib/games/arena/cards.ts`; mechanics in `engine.ts`. Every
troop is a figure from a different era, in the same polished cartoon style
as the current figures (bold chunky shapes, clean readable silhouette,
expressive painted face, hand-painted resin look). Four women, four men,
varied origins.

| Id        | Name      | Cost | Role (what makes it unique)                                                | Figure                                                                                                                                                                                                                                  |
| --------- | --------- | ---- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pirate    | Pirate    | 3    | Cheap, fast cutlass; leaps at the first enemy it sees, first hit doubled   | A swaggering Afro-Caribbean pirate woman, golden age of sail: black tricorne hat over a team-colour bandana, long braid, white shirt with rolled sleeves, striped sash, long waistcoat, knee boots, gold hoop earring, a curved cutlass in her right hand, a flintlock pistol tucked in the sash. |
| viking    | Viking    | 4    | Spins a long axe round, hitting everyone near him; faster below half HP    | A big, broad Norse warrior: round iron helmet with a nose guard (no horns), huge braided ginger beard, fur-trimmed shoulders, team-colour tunic, leather belt, wrapped legs, a long two-handed bearded axe.                              |
| gladiator | Gladiator | 3    | A big shield soaks the first 650 damage, then the short sword fights on    | A North African Roman gladiator: crested bronze helmet with a team-colour plume, a tall curved rectangular team-colour shield with a bronze boss, a short straight sword, leather arm guard, a pleated leather-strip kilt (`skirtL`/`skirtR` parts), sandals with greaves. |
| medic     | Medic     | 3    | Never attacks; heals friendly troops around her every second              | A South Asian field medic, 1940s: cream cap and armband with a **green** cross (never a red cross), khaki shirt and skirt over trousers, a big leather satchel, raises a glowing green tonic flask.                                  |
| miner     | Miner     | 3    | Can be played anywhere on the field: digs there for 2 s, then pops up     | A cheerful stocky Latino miner, early 1900s: hard hat with a brass headlamp, big moustache, dusty team-colour shirt, denim dungarees, suspenders, heavy boots, a pickaxe on his shoulder.                                                  |
| balloon   | Balloon   | 5    | Slow air tank that only goes for towers; heavy bombs; crashes with a bang | A hot-air balloon with a striped team-colour envelope, rope netting, a wicker basket with sandbags and a small bomb rack; in it a white-haired elderly aviatrix with round goggles and a long scarf who drops the bombs.              |
| inventor  | Inventor  | 4    | Lightning jumps to three enemies and stuns each for half a second         | A young Black woman inventor, 1950s retro-futurist: white lab coat, big brass goggles on her forehead, two round hair puffs, team-colour gloves, a backpack Tesla coil with a glowing ball on top, a copper zapper wand.              |
| gunner    | Gunner    | 4    | Wheels a small cannon that outranges towers; slow and helpless up close   | A Napoleonic artilleryman with big grey sideburns: tall black shako with a team-colour plume, short dark jacket with team-colour cuffs and epaulettes, white trousers, black gaiters, pushing a small bronze field cannon on two wooden spoked wheels (`wheels` part). |

Silhouettes must not repeat: no second long coat (the Cowboy has it), no
second pointed hat (Wizard), no second samurai-like armour.

## Part contract for new figures

Same as `figures.py`: an empty named after the id at the feet, facing +y,
jointed children `<id>.<part>` with origins on their joints and no rest
rotation. Parts (`components/game/arena/moves/types.ts`, `PartName`):
`legL legR` (knees and ankles are split off by `articulation.py`; a figure
may also carry its own `kneeL/kneeR/footL/footR`), `torso`, `head`,
`armL armR` (optional elbows `foreL foreR` as their children), `weapon`
(child of an arm, pivot in the fist), `offhand`, `skirtL skirtR` (kilts
and coat tails hanging from the waist, children of the torso), `cape`,
`shield`, `wheels`, `basket`, `spin`, `tail`, `jaw`, `extra`.

- One file per figure, `assets/arena/blender/figure_<id>.py` (with a
  private `figure_<id>_kit.py` if needed), `build()` returns the root.
  Reuse `kit.py`, `face_paint.py`, `articulation.py`; read an existing
  figure (`figure_duelist.py`, `figure_ranger.py`) for scale, materials
  (`resin`, `lacquer`, `gilt`, `hide`, `weave` families; `team`, `team2`,
  `team3` tints), face painting and the preview workflow.
- Scale: human figures stand about as tall as the Samurai and Cowboy
  (heads at about 1.2 in Blender units). Triangle budget about the same as
  the current figures (print it with the figure's FIGURE line).
- Preview: `ARENA_FIGURES=<id> /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python assets/arena/blender/figures.py -- - work/arena/fig-<id>/<id>.png <id>`
  renders front, back, side and the game's high camera.

## Moves

Each new troop animates in `components/game/arena/moves/<id>.ts` (contract
in `moves/types.ts`, registered in `moves/index.ts`). `troops.ts` already
does the walk for every legged figure; `pose` adds the attack, idle and any
special part (the Balloon's sway, the Gunner's wheels, the Viking's spin,
the Pirate's leap arc from `unit` state, the Miner's `arrive` rising out of
the ground).

## Rules for everyone working on this

- Never commit, push or open PRs. Leave everything in the working tree.
- Touch only the files your task names. Other agents are editing
  `troops.ts`, `engine.ts`, `world.ts` and the art at the same time.
- Never run `scripts/arena-assets.mjs` without `--only=`, and only with the
  part your task owns (`--only=figures` for the walk task, `--only=none
  --textures` for textures, `--only=cards` for card art). Check afterwards
  that `lib/games/arena/assets.json` still lists everything else.
- Format only your own files: `npx oxfmt <paths>` (never `npm run format`).
- The dev server runs at http://localhost:3017 (`/arena/lab` lines up every
  troop; `?mode=walk|attack|idle`). For animated checks use headless Chrome
  with `--enable-gpu --use-angle=metal --mute-audio` on a private debugging
  port (97xx; check it is free), and `window.arenaDebug` in battles.
