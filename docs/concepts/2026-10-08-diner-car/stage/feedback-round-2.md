# Stage — round 2 feedback (Claude, 9 October 2026, after runtime review)

Runtime screenshots (real WebGL renderer, the lab, Claude's new night lighting
from `components/game/diner/lighting.ts`, bloom threshold 0.9):
`review/runtime-{place}-{1280x720|390x844}.png`. Your CPU renders could not
show this; please read these images first.

What works: the patio composition, booth placement, counter heights, the
car's long silhouette and the truck. Keep the gameplay rectangle as it is.

What does not work yet (William's complaint was "not stylised, not alive"):

1. **The places are nearly empty.** Every view is a flat single-colour plane
   with two to four big props. Phones show 25–30 m of ground above the car and
   ~8 m below the front rail; wide screens show ~12 m each side. All of it
   must be rich, dense and lit. You used 17–32 draw calls and ~100k triangles
   of 140 / 450k: spend it (instancing for repeats).
2. **Ground is never one flat colour.** Truck stop: asphalt with oil stains,
   painted bays, kerbs, puddles catching neon, a diner-side forecourt, the
   highway with moving traffic. Drive-in: gravel rows, speaker posts, many
   parked cars with silhouettes inside, the projection booth, the screen
   glowing. Fairground: trampled grass, midway boards, stalls with awnings,
   bunting, a coaster or swing ride, a ticket booth, crowds. Harbour: plank
   pier wrapping the patio, bollards, nets, crates, boats tied up, the water
   with moonlight glitter and gentle swell, the lighthouse headland. Old Town:
   cobbles plus pavements and kerbs, lit shop windows with interiors, awnings,
   a fountain, benches, lamp pools. Moon Mile: rippled sand, rocks, scrub,
   cacti, the dish on a hill, the rocket motel sign lit, a long highway.
3. **Night light comes from the scene.** The view now provides dark ambient,
   moonlight, haze (fog from ~40 m) and one warm spot on the deck. Your
   emissive surfaces must carry the night: bulbs, neon tubes, windows, screens
   at emissive intensity 2–4 so they bloom; soft additive light-pool decals on
   the ground under lamps and signs (cheaper than lights). The fog colours per
   place are in `lighting.ts` (`MOODS`); pick ground and wall values that read
   at night under them, not daytime pastels.
4. **Life.** Small stylised people (walking loops, couples in parked cars,
   kids at stalls, sailors on the pier, a cook at the truck), moving vehicles,
   turning rides, flags, steam from vents, a dog, birds on wires. Cheap,
   instanced, time-driven; frozen under reduced motion.
5. **The car.** From the game camera the roof is a large plain cream pill
   that dominates the screen. Give it structure: a monitor roof with a
   clerestory strip, vents and ribs, chrome edge trim, rooftop equipment; make
   the DINER sign a real neon sign (tubes on a framed board with chasing
   bulbs), bigger and glowing. The band between the window row and the
   counter reads as flat grey: show the galley wall (menu boards, pie case,
   shelves, warm interior light) and give the counter's camera-facing front
   enamel and chrome panels.
6. **String lights**: currently thin poles with invisible dots. Make festoon
   strings with sagging catenaries and glowing bulbs along the patio's sides
   and front edge (never across the deck), on proper poles.
7. **The truck** looks dropped beside the patio on phones; park it hitched at
   the car's end, nose out, lights on, consistent between places.
8. Keep everything outside the playfield calm enough that guests, plates and
   bubbles on the deck still read first; contrast comes from the deck being the
   brightest, warmest area.

Process: you cannot reach the browser from your sandbox, so keep using your
CPU renders for geometry and composition; Claude will take runtime shots when
you finish and send a round 3. Do not run Blender (machine memory limits).
Same file ownership as before (diner-car.ts, places.ts, stage.ts, this folder).
Update notes.md with what changed.
