# Rota

A roll-and-draw route game, built on 29–30 September 2026 at William's
request: "highly inspired by" the Railroad Ink family of games, with its own
name, look, maps, extensions and scoring numbers. Everyone rolls the same dice
each round and draws roads and rails on their own survey sheet, all at once.
Internal id `rota`, public name **Rota** (short, easy to say in most
languages). It sits in the library's Strategy section.

## Rules in one screen

- **Dice.** Each round rolls three route dice (road or rail: straight, bend,
  fork) and one junction die (overpass, station, corner station). Everyone
  uses the same four. With **Rivers** a fifth, optional river die joins.
- **Placing.** A piece goes on an empty square and must join an exit or a
  route of the same kind; no side may meet a different kind (a road never
  runs into a rail). Pieces turn and flip. The four route and junction dice
  must be placed whenever they can be; one that fits nowhere is lost. Undo
  takes back the last piece until Done.
- **Specials.** Six specials (crossroads, rail cross, two halts, grand
  station, junction): at most one a round, three a match, each once.
- **Scoring**, after the last round:
  - each network scores for the exits it links: `4 × (exits − 1)` from two
    exits, plus 4 for linking every exit on the map;
  - the longest road and the longest rail score a point a square (a simple
    path, each square once);
  - each built centre square scores 1;
  - each loose road or rail end costs 1: into open ground, a blank side, the
    map edge away from an exit, the sea or rubble. River ends never count.
- **Ties**: most points, then fewer loose ends.

## Maps (content sets)

| Map | Level | Size | Rounds | Twist |
| --- | --- | --- | --- | --- |
| Meadow | Beginner | 7×7 | 7 | Twelve exits, a 3×3 centre. |
| Harbour | Intermediate | 7×7 | 7 | Sea takes the lower-right corner (six squares); two piers are exits into it. |
| Ridge | Intermediate | 7×7 | 7 | Four peaks take only a straight road or rail: a tunnel, 2 points. |
| Capital | Advanced | 8×8 | 8 | Sixteen exits, a twelve-square centre. |

Every map balances road and rail exits (six and six, eight and eight).

## Extensions (each one mechanic, any combination)

- **Rivers**: a fifth, optional die of river pieces and road and rail
  bridges. A river starts at the edge or the sea or runs on from one you drew,
  and never meets a road or a rail except on a bridge. The longest river
  scores 2 a square, and 3 more if it leaves the map at both ends.
- **Plans**: three plans are drawn from twelve (Across, Corners, Stations,
  Highway, Main line, Full row, Full column, Loop, Hub, Centre, Both lines,
  Tidy). Complete one by the end of a round and score its first value (7–10)
  if nobody finished it in an earlier round, its later value (3–5) otherwise.
  Everyone who finishes in that same first round scores the first value.
- **Mills** (id `towns`): three mill sites (four on Capital), the same on
  every sheet, never on the edge, the centre or terrain, never touching. A
  mill site takes only a junction piece (an overpass, a station or a special
  station). Each mill scores a point per exit its network links, up to 5.
- **Rockfall**: from round 2 until the round before last, a rock is aimed at
  one square, marked in red on every sheet. If that square is still empty at
  the end of the round it becomes rubble: nothing can be built there and ends
  facing it are loose.

## Play

- **Solo**: 1–6 seats, you and up to five bots (easy, medium, hard), saved on
  this device (`gamehub.rota.v1`). Bots build their round in the background
  from what they may see; their round in progress stays hidden, as at a table.
- **Learn**: a practice sheet on Meadow with a five-step coach (pick a die,
  turn it, place all four, a special, loose ends), then a real match.
- **Online**: the table admin opens Rota's box at a table and presses Play;
  everyone at the table is seated, bots fill the chosen seat count, and the
  table moves on to `/rota/<token>`. Rooms live in SQLite (`rota_rooms`,
  created on first use, no migration) and survive a restart. Each seat builds
  in private (others see only locked-in rounds) and locks with Done; the round
  resolves once every seat has, then the next dice roll. There is no Next
  button: nothing waits once the choices are locked, as in Mora's picks. A
  person away 45 seconds has a bot build their round; they take the seat back
  on return. Bots think on a worker thread. The table admin starts another
  match from the results and has the shared Table button.

## Code

- `lib/games/rota/pieces.ts`: pieces, orientations, dice faces, specials.
- `lib/games/rota/maps.ts`: the four maps, town and rockfall sites.
- `lib/games/rota/board.ts`: placement legality, loose ends, networks,
  longest paths (exact, step-bounded) and the bots' quick estimate.
- `lib/games/rota/score.ts`: scoring, the twelve plans, and `scoreParts`,
  the workings the points panel shows (tap the score block).
- `lib/games/rota/engine.ts`: state, moves (`place`, `special`, `turn`,
  `undo`, `done`, `reopen`), round resolution, observation, validation.
- `lib/games/rota/bot.ts`: beam search over the round (width 2/3/8 by level)
  against a heuristic that prices loose ends by whether they can still
  close; each seat leans slightly differently.
- `server/rota.ts`, `server/rota-bot-worker.ts`: online rooms.
- `lib/games/rota/routes.ts`: each piece's paths inside its square (straights,
  quarter bends, stubs to a station), the one height profile of every route
  surface (`liftAt`: the overpass deck, the cutting under it, river
  bridges), the exits' runs off the board (streets out of the picture, rails
  into a tunnel mouth), and the drivable network.
- `lib/games/rota/scale.ts`: the mill town's one scale (a square is 25 m):
  street, track, junction and building sizes.
- `lib/games/rota/traffic-sim.ts`: the traffic as pure motion (holds on
  squares, look-ahead spacing, goods-shed calls, three-point turns,
  arriving and leaving out of sight).
- `lib/games/rota/growth.ts`: the town that grows round the routes.
- `components/game/rota/`: the table, the drawn sheet (the fallback without
  WebGL), piece art, rules, setup box, solo and online controllers,
  `rota.css`; `rota-board.tsx` mounts the 3D board and lays the squares over
  it; `rota-lab.tsx` is the dev bench at `/rota/lab`
  (`?map=harbour&rounds=4&ext=rivers,towns&seats=3`); in development
  `window.rotaLab` plays your round (`auto`), plans it (`plan`) or plays
  one move (`play`), which the library footage driver
  (`scripts/reels/games/rota.mjs`) uses to place pieces on camera.
- `components/game/rota/three/`: the 3D board. `world.ts` (scene, camera
  framing inside the stage, the DOM overlay's matrix3d, lights, per-square
  rebuilds, traffic and town updates once dropped pieces land, snapshots
  for Others, taken straight down), `routes-mesh.ts` (swept streets, tracks, bridges, the
  cutting, wharves), `ground.ts` (the heightfield and the ground's shader:
  the site, the old town's street grid, the moors, the cutting's opening),
  `traffic.ts` (models on the simulation's poses), `growth.ts` (the town,
  instanced), `scenery.ts` (the old town and the moors; an unbroken terrace rings
  the site so only the exits touch the board), `smoke.ts`,
  `materials.ts`, `ink.ts`, `assets.ts`, `icons.ts` (3D pieces for the dice
  faces).
- `components/game/rota/three/surfaces.ts`: resolution-independent material
  detail shared by the grid, streets and town; filtered joints, grain and
  relief over the mill town's toon colours. Models retain their physical
  UV scale; generated/merged surfaces use world coordinates.
- `lib/games/rota/quality.ts`: high-quality startup, bounded screen density
  and automatic three-level rendering adaptation from sustained frame times.
  It changes shadows, antialiasing, density and fine surface detail, while
  preserving the town, camera, controls and traffic simulation.
  A lost GPU context restores with the low tier's buffers, then recovers
  cautiously from sustained headroom.
- Art: Blender scripts in `assets/rota/blender` (`rkit.py` over Arena's kit;
  `town.py`, `works.py`, `vehicles.py`, `nature.py`, `buildings.py`).
  `node scripts/rota-assets.mjs [--blender] [--only=town,works]` builds and
  hashes the models and writes `lib/games/rota/assets.json`. One grid square
  is one Blender metre (25 m); see
  `docs/concepts/2026-10-03-rota-mill-town/brief.md`.
- `scripts/optimize-rota-art.mjs`: cover delivery files.
- Tests: `tests/rota.test.mjs` (rules, scoring, every map and extension with
  bots), `tests/rota-routes.test.mjs` (route paths and the network),
  `tests/rota-traffic.test.mjs` (minutes of traffic on bot-built sheets: no
  overlaps, nothing appearing or vanishing in view, nobody stuck),
  `tests/rota-growth.test.mjs` (the town stays in its squares and off the
  routes, is deterministic, lines a loop inside and out),
  `tests/rota-online.test.mjs` (launch, privacy, idempotent commands,
  away seats, a whole match, restart), `tests/rota-quality.test.mjs`
  (dense phones, pixel budgets, slow clients, recovery and hysteresis).

## Balance (bot simulations, not proof of human balance)

Hard bots, four seats, eight matches each, 30 September 2026. Averages:

| Setup | Total | Exits | Road | Rail | Centre | Loose | Extension |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Meadow | 41.1 | 23.8 | 7.7 | 10.4 | 7.9 | −8.7 | – |
| Harbour | 42.2 | 26.5 | 7.2 | 10.1 | 7.7 | −9.3 | – |
| Ridge | 42.3 | 21.9 | 7.3 | 10.8 | 7.3 | −9.6 | tunnels 4.6 |
| Capital | 46.2 | 27.8 | 7.9 | 11.4 | 9.7 | −10.5 | – |
| Meadow + Rivers | 48.0 | | | | | | river 9.5 |
| Meadow + Plans | 49.9 | | | | | | plans 12.0 |
| Meadow + Towns | 46.2 | | | | | | towns 9.4 |
| Meadow + Rockfall | 38.7 | | | | | | −2.4 overall |
| Meadow + all four | 62.8 | | | | | | river 7.7, towns 8.1, plans 11.4 |

Bot levels on Meadow: easy 24, medium 37, hard 41. The four maps land within
five points of each other; Capital is a little higher as the bigger board.

Tuning decisions made from these runs:

- Rivers first scored 1 a square of the longest river: worth about 3, not
  enough to spend squares on. Now 2 a square (+3 for leaving the map at both
  ends), worth about 9.
- Towns first scored a flat 4 when linked to any exit: nearly free (+10.4).
  Now a town square takes only a junction piece and scores the exits its
  network links, up to 5: the same average but a wider spread (36–63), so the
  junction die becomes a real choice.
- Bots at one level built identical sheets from the shared dice (three hard
  bots tied at 67). Each seat now leans slightly differently and hard bots
  keep a little noise.

Limits: bots plan one round at a time and undervalue long-range plans, so a
thoughtful person should beat hard bots; the numbers measure these bots, not
people.
