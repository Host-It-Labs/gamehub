# Round 2 — structure, inhabited surroundings and scene light

The twelve supplied runtime images were inspected before modeling. They show
a readable patio surrounded by largely empty, uniformly coloured ground.
The car's cream roof and grey worktop band overwhelm its useful small details;
festoon bulbs are too small and too dim, and the truck is visibly detached.
This is a large visual change. Keep the game rectangle, furniture, counter
clearance and existing camera ownership intact.

The car retains its long chrome/cherry carriage silhouette, but gets an
arched roof shell, a narrow raised monitor with glazed clerestory, transverse
seams, chrome rain gutters, cowl vents and rooftop mechanical detail. The
monitor and cream shoulders form separate masses rather than a single pill.
The DINER marquee is a dark framed sign with thick orange-pink neon tubes,
visible standoffs and alternating warm perimeter bulbs. Its visible tubes,
window lamps and bulbs use HDR values suitable for the new bloom threshold.
The same construction and hierarchy carries into the closed map car.

The patio gains a cherry enamel counter front with recessed panels and
chrome seams, a warm detailed galley behind the reserved machine volumes,
and properly sagging festoon cables with ceramic sockets and pear-shaped
lamps. Strings stay on the two sides and outside the front boundary; no cable
crosses the playing deck. The truck sits nose out on the car's centreline;
its coupler meets the car hitch exactly while both tyre sets meet y=-0.24.
Headlights and a restrained ground pool make the parked rig feel connected.

Place scenery forms continuous districts across the camera's actual outer
frame: approximately x=-15..26, z=-34..21. Near clutter is low, walking extras
are outside the playfield, the established hero silhouettes stay behind the
car and do not force a wider camera. Each district has its own authored
ground surface, curbs or edges, illuminated interiors and props, cheap
ground light pools, and time-driven motion. Night values sit below the deck;
small powered accents carry the surroundings. Reduced motion freezes all
decorative motion and chasing, and brownouts dim electrical emissive clones.

Quality review remains geometry/composition in CPU source renders. They do
not establish actual night material exposure, bloom, reflections or mobile
GPU performance. Claude will capture the revised scene in the real WebGL
renderer for round 3. Blender is excluded.
