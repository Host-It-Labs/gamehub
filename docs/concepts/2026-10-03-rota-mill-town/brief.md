# Rota as a mill town (3 October 2026)

William on the picture-book Rota: three squares of rail between two things
"just seems weird", cars drive up to stations and vanish, cars are as big as
the houses, cars sink into hills and trains drive through each other. "It
shouldn't feel toy-like" (it is not an easy game), and when someone builds a
loop of road the board should fill up around it "so it kind of builds up to
be a town". He chose this world: a **mill town**.

## The world

The board is a cleared district in the middle of a northern industrial town,
about 1950. The town around it already exists; its streets and its railway
arrive at the edge of the site (the exits). Roads are cobbled **streets**
with flagstone pavements, and terraced houses grow along them. Rail is a
**works railway**: mills, warehouses, coal drops and sheds grow along it, so
a short piece of rail is a siding serving a factory and a shunting engine
works it. Stations are **goods stations**: a lorry backs up to one side, a
wagon stands at the other, crates go across. Overpasses are brick road
bridges over a cutting. Centre squares grow civic buildings.

Look: Victorian red-brown brick, blue-grey slate, sandstone dressings, soot,
painted doors and window frames, warm gas-lamp glow, late golden-hour sun
with chimney smoke. Grown-up and handsome rather than toy-like: true
proportions, crisp bevelled edges, real window reveals, chimney stacks with
pots, gutters and downpipes. In game, every surface is drawn as a flat
colour in three hard light tones with dark ink outlines (toon), so
silhouette and colour carry everything; small detail that only shows in a
photoreal render is wasted.

## Scale (one table, every model)

**One grid square is 25 m = 1 Blender metre.** Build everything at true size
divided by 25. The numbers live in `lib/games/rota/scale.ts`.

| Thing | True size | Model units |
| --- | --- | --- |
| Street (setts + pavements) | 10 m | 0.40 wide (carriageway 0.30) |
| Track gauge (widened) | — | wheels at ±0.045, rail top 0.038 |
| Car | 4 × 1.75 × 1.5 m | 0.16 × 0.07 × 0.06 |
| Lorry | 6.5 m, 3 m tall | 0.26 × 0.10 × 0.12 |
| Terraced house, 2 storeys | 5 m frontage, 6.5 m deep, eaves 5.5 m, ridge 7.8 m | 0.20 × 0.26, eaves 0.22, ridge 0.31 |
| Terraced house, 3 storeys | eaves 8.3 m, ridge 10.5 m | eaves 0.33, ridge 0.42 |
| Mill, 4–5 storeys | 20 × 8.5 m, 12 m eaves | 0.80 × 0.34, eaves 0.46–0.5 |
| Mill chimney | 25 m | 1.0 tall |
| Gas lamp | 3.5 m | 0.14 |

Existing vehicles (`vehicles.py`) already fit this scale at 1:1 and are kept.

## Conventions (same as the earlier brief)

- One root empty per asset, named exactly as listed, at its **footprint
  centre**, base on z = 0 (parts touching the ground sink 2–3 mm), meshes as
  children. Asset names must be unique across all of Rota's .glb files.
- **The front faces −Y** (towards the street or the track). Width runs
  along X. A building's footprint must stay inside the listed size: the game
  packs them edge to edge, so terraces in a row must abut seamlessly (party
  walls flush with ±X, no overhang past ±X except eaves of at most 0.004).
- Materials `"<family>:<tint>"` via `kit.material`, tints registered with
  `kit.tint`. Families as before (`brick`, `slate`, `stone`, `plaster`,
  `wood`, `paint`, `metal`, `glass`, `glow`, `roof`, `cobble`, `rock`,
  `foliage`, ...). Windows use `glass` (the game draws them as a lit sky
  blue); lamp lenses use `glow:lamp`.
- Bake AO (`kit.bake_ao`), bevel edges, build with `building_kit.py`
  (`Build`, `walls`, `window`, `door`, `gable_roof`, `chimney`, `plinth`,
  `band_course`, `downpipe` ...), exactly as `buildings.py` does.
- **Budgets** (many instances on screen at once): terrace modules and small
  props ≤ 1200 triangles, shops and pubs ≤ 2000, civic buildings and mills
  ≤ 4500, the outcrop ≤ 6000. Whole file under 3 MB.
- Script layout like `buildings.py`: `ASSETS` registry with `@asset`, a
  `main()` taking `-- out.glb [preview.png]` and `ROTA_ONLY=a,b`, a size and
  triangle report, and preview renders from the game's angle (elevation 55,
  azimuth 0 and 30) next to a 1-square reference grid **and a 0.16 car box**.

Run headless:

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
      --python assets/rota/blender/<script>.py -- assets/rota/build/<script>.glb \
      docs/concepts/2026-10-03-rota-mill-town/previews/<script>.png

## Asset list

### `town.py` → `assets/rota/build/town.glb`

Terraces (front −Y on the pavement line, w × d, eaves / ridge):

- `terrace_a`: 0.20 × 0.26, 0.22 / 0.31. Red-brown brick, slate roof
  pitched along X, door on the left with a fanlight and stone step, a sash
  window beside it, two upstairs windows, stone sills and lintels, a
  chimney stack straddling the right party wall (half a stack, so two
  neighbours make one), gutter.
- `terrace_b`: like `terrace_a` but door on the right and a canted bay window
  downstairs.
- `terrace_tall`: 0.20 × 0.26, three storeys, 0.33 / 0.42. Sandstone
  dressings, maybe a basement area railing.
- `cottage`: 0.20 × 0.22, 0.13 / 0.20. A low one-and-a-half-storey
  workers' cottage with dormer. The game uses it where a tall house would
  hide the street behind it from the camera.
- `shop`: 0.20 × 0.26, 0.22 / 0.31. Like `terrace_a` with a painted
  shopfront (fascia, big window, recessed door) and a striped awning.
- `lockup`: 0.20 × 0.20, single storey, ridge 0.13. A brick workshop or
  stable with a big plank door.
- `corner_pub`: 0.26 × 0.26, two storeys, 0.24 / 0.33. Its door is on a
  chamfered corner at (−X, −Y): it stands where two streets meet. Glazed
  tiles at ground floor, a hanging sign, lamps.
- `corner_shop`: 0.24 × 0.24, as `corner_pub` but a corner shop, smaller.

Civic (centre squares, front −Y):

- `town_hall`: 0.50 × 0.38, two tall storeys (eaves 0.36) and a clock
  tower to 0.72, sandstone, steps, columns.
- `market_hall`: 0.50 × 0.34, iron and glass with a brick front, 0.34.
- `chapel`: 0.30 × 0.40, gable to the front, round-arched windows, 0.40.
- `bank`: 0.26 × 0.26, classical sandstone, 0.32.
- `school`: 0.46 × 0.30, Board school, tall windows, a bell cote, 0.34.

Back yards and the finished town (all low, they sit on empty squares):

- `yard_wall`: 0.20 long × 0.012 × 0.045 tall, along X, brick with coping.
- `privy`: 0.045 × 0.045 × 0.055, brick with a plank door.
- `washing_line`: 0.18 long along X, two posts 0.06 tall and a few sheets.
- `allotment`: 0.40 × 0.40, ≤ 0.06 tall: beds in rows, a tiny shed, a
  water butt, canes.
- `bandstand`: 0.16 across, 0.13 tall, iron and a red roof.
- `bench`: 0.04 long. `gas_lamp`: 0.012 base, 0.14 tall, glowing lantern.

### `works.py` → `assets/rota/build/works.glb`

Works beside a track (front −Y faces the rail: loading doors, a canopy or a
platform on that side):

- `mill_big`: 0.80 × 0.34, five storeys (eaves 0.48, ridge 0.54), rows of
  tall windows, a stair tower with a water tank at one end, the name band
  in pale stone, sooty brick. No chimney (it stands separately).
- `mill_small`: 0.42 × 0.30, three storeys (eaves 0.32).
- `warehouse_rail`: 0.42 × 0.28, eaves 0.26, loading doors on each floor
  with a hoist beam, a canopy over the rail side.
- `works_shed`: 0.30 × 0.24, sawtooth north-light roof, ridge 0.20.
- `coal_drops`: 0.30 × 0.16, ≤ 0.12, a raised stone staithe with chutes and
  coal heaps.
- `engine_shed`: 0.46 × 0.30, two arched doors, smoke vents, 0.26.
- `water_tower`: 0.12 × 0.12, iron tank on brick, 0.32.
- `chimney`: 0.08 square base, 1.0 tall, tapering, a stone cap and bands.
- `gasholder`: 0.42 across, 0.30, guide frame of iron columns and girders.
- `yard_crane`: 0.12 base, jib to 0.36, iron.

Goods stations (the piece's road and rail stop at its walls):

- `goods_shed`: 0.40 × 0.40, 0.30 tall. Brick shed with a big door and a
  timber canopy on **all four sides** (a lorry or a wagon may come from any
  side), a raised loading edge, crates and sacks.
- `goods_grand`: 0.50 × 0.50, 0.42, with a travelling crane over one side.

The town's edges and the maps' fixed things:

- `hoarding`: 1.0 long along X, 0.06 tall, timber site fence with faded
  posters (the site boundary; the game scales it along X).
- `tunnel_rail`: a stone portal facing −Y at y = 0 (opening 0.17 wide and
  0.24 tall over z = 0), set in a grassed embankment mound that runs back
  along +Y for 1.4 and is 1.1 wide and 0.38 tall, with wing walls. Trains
  drive into it and are hidden inside.
- `outcrop_a`, `outcrop_b`: a gritstone outcrop filling one square
  (1.0 × 1.0, ≤ 0.34 tall), heather and rock, with a straight bore along Y
  through its middle and a stone portal on both faces (opening 0.36 wide
  and 0.24 tall). Ridge's tunnels.
- `subsidence`: 0.80 × 0.80, ≤ 0.12: collapsed ground, broken brick and
  timbers in a pit, ringed by a rough timber fence (Rockfall's rubble).
- `wharf_crane`: Harbour's quayside crane, 0.14 base, jib to 0.42.
- `mill_site`: 0.80 × 0.80, ≤ 0.02 apart from its chimney: the cleared
  footings of a mill with a standing `chimney` in one corner (the Mills
  extension's sites, before they are built).

## Previews

Renders go to `docs/concepts/2026-10-03-rota-mill-town/previews/`. Check
each asset there beside the reference square and car box before it ships.
