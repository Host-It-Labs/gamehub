# Round 2 surroundings source brief

The inspected real WebGL views show empty single-colour ground in every place,
especially the 25–30 m above the diner and 8 m below the front rail on phones.
Keep the existing hero landmarks and play rectangle. Compose each place as an
actual night district, with a foreground approach, inhabited middle distance,
and a farther skyline. Desktop side margins must contain useful scenery too.

- Truck stop: cracked asphalt apron, parking lines, raised pump islands, oil
  stains and reflected neon puddles. A lit service shop and lined-up semis
  connect the pumps to a highway with traffic and sodium pools. Richness comes
  from the engineered panels, lamps, tyre racks and kerbs, not random props.
- Drive-in: ordered gravel parking rows with speaker posts, occupied cars,
  a concession/projection kiosk, silver screen and cool reflected film light.
  Rows continue behind the hero screen and flank the patio.
- Fairground: worn grass surrounds connected timber midway paths. Candy stalls,
  striped awnings, bunting, ticket booth and small coaster give the rides an
  inhabited setting. Families stroll along the paths; the deck stays quieter.
- Harbour: a continuous shaped timber quay wraps the deck, with bollards,
  coils, nets, stacked crates and moored boats. Rippling teal water carries
  moon-glitter. A rocky headland, harbour sheds and sailors anchor the light.
- Old Town: irregular cobbles with raised kerbs and pavements, varied brick
  gables/chimneys, warm detailed window interiors, gas lamps and pools, benches
  and a tiered fountain. The square has inhabitants and an approach street.
- Moon Mile: rippled violet sand and layered rocks, cactus/scrub islands,
  an observatory outpost under the dish, illuminated rocket motel and long
  desert highway. Lamps and windows make little oases; moonlight shapes hills.

Compact map vignettes retain one hero silhouette and add a few meaningful
secondary scene pieces. No per-stop floor tile and no second diner.

All surfaces use deep night values with differentiated roughness. Powered
bulbs/windows/neon use linear glow values 2–4; soft additive ground pools
replace new lights. New moving scenery is instanced and deterministic, with
all time-driven updates frozen under reduced motion. Shared materials are
borrowed; every owned material, texture, geometry and instance buffer is freed.

Geometry is authored in TypeScript. No Blender or AI raster editing. The root
agent independently reviews final matched-size source renders and runtime
lighting remains Claude's verification, since the sandbox cannot reach it.
