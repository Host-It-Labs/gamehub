# Rota passenger models: brief and review (8–9 October 2026)

## Brief

Passengers get in and out of cars and trains at Rota's stations, so the
stations and trains had to change (William: "you can rework the models so
they work with this").

- `dmu_car` (`assets/rota/blender/vehicles.py`): one driving car of a 1950s
  first-generation diesel multiple unit, 0.34 long, two run back to back.
  Cab at +Y, gangway at −Y; slam doors on both sides at ±0.10 from the
  middle, separate leaves `door_l0`, `door_l1`, `door_r0`, `door_r1` hinged on
  the edge nearer their end (outward: r0 +, r1 −, l0 −, l1 + about the
  leaf's up axis), dark vestibules behind, floor at 0.066.
- `station_hall` / `station_grand` (`works.py`): passenger booking halls on a
  platform-level bank (top 0.056) over ±0.20 / ±0.25, an open doorway in
  every wall, canopies all round; they replace `goods_shed` / `goods_grand`.
- `station_platforms(_grand)` and `station_steps(_grand)`: dressing placed per
  side by `world.ts` — side platforms along each track (0.082–0.19 from the
  rail centre, bank height, lamps, benches, nameboard, buffer stop) and a
  seven-step flight from the road (0.012) up to the bank across the street
  and both pavements.

The models were built by a Claude subagent on 8 October; it was stopped by
a usage limit after exporting the GLBs and before writing renders or notes.
It had also written kerb-side car doors into `vehicles.py`: `car_sedan` has
`door_rf` and `door_rr`, the two-door `car_retro` only `door_rf`, each cut
from its body panel, hinged on its front edge (positive rotation opens),
with a dark cabin and seats behind. They shipped with the 9 October
rebuild, which also gave the railcar's wheelsets ten sides instead of nine
(an odd polygon is off-centre, and quantization then moved the wheel
pivots by half a millimetre; `tests/rota-assets.test.mjs` caught it).

## Review (9 October, Claude, in the real renderer)

Inspected in headless Chrome on `/rota/lab?map=meadow&rounds=5&ext=towns`
with a close review camera (screens in the session scratchpad, not kept):

- Default 1440×900 and 390×844 board views: halls, platforms and steps read
  as small stations at play scale; the board stays legible. Pass.
- `station_grand`: two storeys, clock cupola, glazed canopies, steps to both
  streets, platforms with lamps and railings. Pass.
- `station_hall`: hipped slate roof with a clock gable, glazed canopy all
  round, platforms with lamps, bench and railings. Pass.
- `station_steps`: seven treads across the street end with cheek walls,
  lamps and handrails; cars stop short and passengers climb them. Pass.
- `dmu_car`: livery recolours per player, cab with lit lamps and
  windscreen, framed windows, cream lining, grey roof; stands with its cab
  at the buffers and both doors of the leading car on the platform. Doors
  verified open (±0.85 rad) while passengers pass; hard to see from the
  game's high camera. Pass.
- Car doors (9 October rebuild): a sedan at the station kerb opens its
  front door, the passenger ducks out onto the road and steps up to the
  pavement, the door shuts and the car turns round. Passengers use each
  model's measured door positions. Pass.
- Station halls light their windows at dusk like the other buildings
  (`station_` added to the building list in `Materials.dress`).
- Defect found and fixed: a Mills site's footings showed through the
  shortened station street (they were drawn under any piece); footings now
  show only while the site is empty.

Remaining: no turntable/close-up renders of the masters were produced (the
build was interrupted); a Blender review set would be the next step if the
railcar or halls are refined further.
