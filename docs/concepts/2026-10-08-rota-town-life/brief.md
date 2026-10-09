# Rota: the town at closing time

8 October 2026. Source brief for procedural geometry and shader work. Read
alongside the 3 October mill-town brief and DESIGN.md's Rota sections.

The cleared site remains the game's whole board. The town outside it is alive:
people go home along sandstone pavements, a parent pushes a sprung hooded pram,
a child takes shorter steps, a dog trots beside its owner. Workers wear fitted
wool overcoats, trousers and flat caps; other residents wear calf-length coats,
skirts and tied headscarves. Adults stand 0.068–0.074 units tall (about 1.75 m),
with ordinary head and shoulder proportions. Shaped cloth profiles, narrow
connected limbs and low forward-facing shoes carry their silhouettes. No large
heads, capsule toys, saturated clothing or enlarged people. Their feet plant,
knees bend through the swing, arms counter the stride and shoulders transfer
weight; a pram-pusher's hands meet its handle. A stopped resident settles their
feet, turns slowly and pauses before going into an actual terrace door.

Routes follow the inner pavement of the RING back lane and nearby residential
side streets. Use the real generated rows and terrain to avoid houses, water,
tunnel mounds and the site. Break paths into explicit pavement/crossing spans.
Residents wait at the kerb, then cross only if the sensed traffic leaves enough
time. Zebra markings are cream-painted stripes at road intersections, with
black-and-white poles and amber Belisha globes. Railway crossings have timber
walkway planks, white/red gates, cast-iron posts and paired hooded red lamps.
Use the exit rails that the existing simulation actually serves; never modify
the simulation. Close before the leading axle arrives, hold for every wagon
and release only after the rear clears. Reduced motion freezes locomotion,
cloth, smoke and flashing, while safety states and requested dusk still update.

Existing window apertures are the source of light, not rectangles pasted over
walls. Preserve mullions and reveals; each opening gets its own stable seed and
slow household lighting schedule, with warm amber interiors, a few fanlights
and curtains. Procedural terrace fronts gain painted doors, sandstone surrounds,
sills, sash bars and gathered curtains. Gas lanterns turn on at different dusk
thresholds. Their warm lenses and small pools are instanced; avoid hundreds of
point lights. A few washing lines live between back-to-back terraces, and small
birds skim the town beyond the hoarding. Chimney smoke and water glints retain
the existing ink and restrained toon palette.

The existing desktop camera (49 degrees) and phone camera (up to 76 degrees),
DOM projection and targets remain fixed. At real play scale people are small:
headwear, coat silhouette and motion should identify them without increasing
scale. Architecture and routes remain the centrepiece.

Afternoon progresses through honey-coloured late light to early blue hour over
about two seconds. Lower and warm the sun, shift the sky/haze to a smoky warm
blue, retain ample cool hemispheric fill and a route/ground lighting floor.
Keep chalk grid edges, every street/track, red loose ends, ghost and target
highlights unambiguous at dusk 1. Emissive halos are a short, thresholded filter
inside the existing ink pass, not a broad blur that washes out the board; low
quality uses local emissives only. Three hard light tones and crisp ink remain.

Implementation targets: a few dozen instanced residents, fewer at lower quality;
merged crossing fittings, instanced moving gate arms and signal lenses; GPU
window schedules; bounded reused CPU arrays/matrices. No new GLB, raster art,
UI copy, camera/layout edits or changes to traffic/assets owned by other tasks.

Review is intentionally deferred to Claude's headless Chrome: desktop and
phone at dusk 0, 0.5 and 1, plus complete walking/waiting/turning/gate cycles.
No local listener or dev server. Geometry/logic tests and TypeScript establish
implementation validity, not artistic acceptance or measured phone GPU cost.
