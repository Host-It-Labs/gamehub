# Alto: attached space hardware, 3 October 2026

Build each base upgrade as a simple, rounded piece of space-station hardware,
with cream enamel, dark steel, blue glass and a small gold or blue accent.
Every object has one bolted mounting flange and starts at that flange; no
individual terrain, domestic house roofs, kitchen appliances or surrounding
dioramas. Keep the silhouettes readable at shop and inventory sizes.

The written brief and procedural sources are fresh. No earlier raster image
is supplied as a generation reference or edited. `alto-modules.ts` is the
exact geometric source; `alto-gear.ts` builds the replacement Cooler.

| Existing id | Display name | New silhouette                                              |
| ----------- | ------------ | ----------------------------------------------------------- |
| shrine      | Telescope    | Short optical tube on a sensor mount                        |
| beacon      | Beacon       | Compact amber signal mast                                   |
| post        | Fabricator   | Small workstation with robot arms                           |
| belltower   | Dish         | Open parabolic reflector on a swivel                        |
| gardens     | Garden       | Greenhouse capsule with a clear dome                        |
| bridge      | Statue       | Small rocket memorial                                       |
| market      | Workshop     | Rounded work console                                        |
| lighthouse  | Signal Tower | Stacked illuminated signal rings                            |
| palace      | Habitat      | Low windowed living dome                                    |
| guildhall   | Refinery     | Pipes and compact processing drums                          |
| observatory | Observatory  | Sensor dome                                                 |
| archive     | Hangar       | Rounded capsule with a shutter                              |
| fountain    | Water Tank   | Cylindrical reservoir                                       |
| treasury    | Vault        | Sealed cylindrical storage                                  |
| skytower    | Archive      | Glass specimen cabinets                                     |
| bazaar      | Cargo Hub    | Four small cargo canisters                                  |
| windmill    | Cooler       | Horizontal coolant canister with fins, strapped to the ship |

The fixed asteroid chassis contains all sixteen base sockets. The player's
Ship and Base bays have equal bounds; only a ship part can change the ship's
fit. Opponent ships continue to use the chassis landing pad.

Transparent source renders are in `public/art/alto/stills-v3/`; they are
rendered directly from the current models using `/alto/lab?stills=modules`.
`scripts/alto-module-art.mjs` trims alpha, adds 5% padding, and writes only
these seventeen 256-pixel WebP thumbnails. Earlier sources remain intact.

The development table fixture `/alto/lab?table` can show year, built ids,
player count, long names and Orders without reading or writing a game save.
