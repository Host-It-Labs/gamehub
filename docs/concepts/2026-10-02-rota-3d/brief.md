# Rota in 2.5D: the model railway (2 October 2026)

William: "rethink the design of the route game … 3D elements that we place
on the map … little trains and little cars that go around the map … less
flat and more 3D … the towns should be 3D … 2.5D … high res 3D objects, you
can use Blender … you can completely redesign everything."

The cyanotype survey sheet on a night desk is retired. Rota is now a
**hand-built model railway layout in late-afternoon sun**: a meadow plot of
static-grass flock on a landscape that fills the whole screen, painted resin
buildings with terracotta and slate roofs, clump-foam trees, ballasted track
with real sleepers and steel rails, asphalt roads with kerbs and white
dashes, and little trains and cars that drive every network you build.
Seen from a fixed three-quarter camera (about 55 degrees down, a narrow
lens), with a soft tilt-shift blur on the far and near scenery so the board
reads as a miniature.

Distinct from the other 3D games: Arena is a bright cartoony tower battle in
jade and terracotta clay; Alto is planets in a starry sky. Rota is a sunny
pastoral miniature: sage and olive meadows, cream plaster, brick, terracotta
and blue-grey slate, charcoal asphalt, warm grey ballast, teal water. Clean,
crafted, slightly stylised rather than photoreal; never flat-coloured
primitives.

## Units and conventions (every model)

- **One grid square is one Blender metre.** The ground is z = 0. Blender +Y
  is "north"/forward; the game camera looks from -Y towards +Y, so building
  fronts face **-Y** and vehicles drive towards **+Y**.
- Every asset is one **root empty** named exactly as listed below, at its
  footprint centre with its base on z = 0, its meshes as children. Parts that
  touch the ground sink 2–4 mm below z = 0.
- Materials are named `"<family>:<tint>"` through `kit.material()` (via
  `rkit`), UVs written with `kit.uv_box` / `kit.uv_cylinder` at the Rota
  densities in `rkit.TILE`, AO baked into the `AO` vertex colour layer with
  `kit.bake_ao` (use `rkit.AO_EDGE` so small parts have vertices to hold it).
  Register tints with `kit.tint(name, "#rrggbb")`; the hex travels in the
  material extras.
- Special tints the game replaces at runtime: `body` (each car gets its own
  colour), `team` / `team2` (a train's livery and trim: the sheet owner's
  seat colour, light and dark), `glow` family (lamps, windows at dusk).
- Families: the tiled textures `grass, field, asphalt, ballast, brick, roof,
  slate, plaster, wood, stone, rock, foliage, bark, sand, cobble`; the plain
  families `paint` (glossy lacquer: vehicles, painted trim), `metal` (steel),
  `chrome`, `rubber` (tyres), `glass` (dark glossy windows), `plastic`
  (satin), `glow` (emissive).
- Detail: high, crafted, bevelled edges (`kit.add_bevel`), real windows set
  into walls, door frames, chimneys, gutters, wheels with hubs. Budgets: a
  vehicle ≤ 6k triangles, a house ≤ 3k, a tree ≤ 1.5k (many instances), a
  station ≤ 8k, a big background mountain ≤ 10k.
- Check every model in a real render (`kit.preview`) from the game's angle
  (elevation 55, azimuth 0 and 30) next to a 1-metre grid square before
  calling it done.

## Route geometry the models must fit (built in code, not Blender)

- Road: asphalt 0.30 wide, top at z = 0.012, pale kerbs 0.025 each side,
  lanes ±0.075 from the centre line.
- Rail: ballast 0.24 wide at the base, top at z = 0.022; sleepers
  0.20 × 0.03 every 0.065; rails 0.09 apart, top at z = 0.04.
- River: channel 0.32 wide, water at z = -0.02, bed at -0.05.
- Grid squares meet edge to edge; route ends sit at side midpoints.

## Asset list

Vehicles (`vehicles.py`): `loco_steam` (0.30 long, team livery), `loco_diesel`
(0.30), `coach` (0.27), `wagon_box`, `wagon_tank`, `wagon_logs` (0.25 each);
`car_hatch` (0.15 long, 0.075 wide), `car_sedan` (0.17), `car_retro` (0.15,
round 1950s), `van` (0.18), `bus` (0.27), `lorry` (0.25), `tractor` (0.12);
boats `ferry` (0.55), `sailboat` (0.22), `fishing_boat` (0.26). Track width
for trains: wheels at ±0.045. Wheels as separate child meshes named
`wheel*` so the game can spin them.

Buildings (`buildings.py`): `station` (footprint 0.34 × 0.34, ≤ 0.26 tall),
`station_grand` (0.42 × 0.42, ≤ 0.36, clock tower), `house_a` … `house_f`
(town corner houses ≤ 0.24 × 0.24, ≤ 0.22 tall: cottages and townhouses),
scenery `farmhouse`, `barn`, `silo`, `windmill` (blades a child named
`blades`, turning about the local Y axis), `church`, `townhouse_row`
(0.9 × 0.35), `apartments` (0.45 × 0.35), `warehouse`, `lighthouse`,
`tunnel_portal_road` and `tunnel_portal_rail` (a stone portal on the -Y
face of a mountain, opening matching the route width).

Nature and props (`nature.py`): `oak_a/b/c`, `pine_a/b`, `birch`, `poplar`,
`bush_a/b`, `hedge` (1.0 long), `stone_wall` (1.0 long, 0.06 tall), `fence`
(1.0 long), `rock_a/b/c`, `peak_a/b` (a mountain filling one square, 0.42
tall, snow cap; a straight tunnel may cross it on either axis), `mountain_a/b`
(background, 3 × 3, 1.2–1.6 tall), `rubble` (a rock-fall pile in 0.8 × 0.8,
≤ 0.14 tall), `buffer_stop` (rail end, red), `road_barrier` (red and white,
0.32 wide), `signpost`, `rail_signal`, `lamp`, `hay_bale`, `pier` (wooden
jetty 1.0 × 0.34), `stake` (a survey peg with a red tip), `flowers`,
`reeds`.

## Textures

Generated tiles (OpenAI image generation, one fresh image per variant, two
variants each), processed to seamless 2048 px albedo + normal + ORM WebP in
`public/3d/rota/tex`, listed in `lib/games/rota/textures.json`. Sources and
exact prompts beside this file in `textures.md`.
