# Map sources

These notes cover `public/maps`. The retired `world.json` (now in the art
archive outside the repo) contained country polygon coordinates from Natural Earth's public-domain
1:110m Admin 0 Countries dataset. Coordinates are rounded to three decimals; properties
are omitted. It is for a geography game, not navigation or legal boundary determinations.

Source downloaded 2026-09-20:
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson

License: https://www.naturalearthdata.com/about/terms-of-use/

The location catalog in `lib/games/party/geo-places.json` contains curated medium
and hard town/city destinations, approximate centre coordinates, and three clues.
Real location photographs are stored locally in `public/geography`; each catalog
record includes the original Wikimedia Commons file, author and licence.
Full acquisition metadata is in `docs/geography/photo-provenance.json`.


## Atlas satellite globe

`earth-satellite.jpg` is the NASA Blue Marble Earth composite distributed by
Three.js as `examples/textures/planets/earth_atmos_2048.jpg`:
https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg
Downloaded 2026-09-21. NASA imagery: https://visibleearth.nasa.gov/collection/1484/blue-marble
NASA media usage: https://www.nasa.gov/nasa-brand-center/images-and-media/
The 2048×1024 texture is bundled locally, with no country boundary, label or
political overlay. It is a global satellite composite, not live or street-level
imagery. Atlas no longer renders the Natural Earth country geometry.

On 2026-09-26 the texture's sea was regraded so it matches the Esri close-up
tiles the globe switches to when zoomed in (navy about rgb(24, 37, 62) moved
to teal about rgb(8, 58, 75)). Only blue-dominant dark pixels changed: each
moved by (−16, +21, +13), faded out by how blue and how dark it was. Land,
ice and the source's 2048×1024 size are unchanged.


## Mobile detail and poles (27 September 2026)

Atlas uses the same Esri tile source and zoom range on phones and desktops.
Tile selection has a 1080-pixel height floor and rounds up to the next detail
level; the canvas supports device pixel ratios up to three. Its CSS size stays
independent of its drawing buffer to avoid resize feedback.

Mercator tiles now stop at their native ±85.0511° latitude. Fixed polar meshes
use the bundled global texture with equirectangular UVs, replacing edge tiles
stretched to the poles. This avoids changing polar wedges as tile zoom changes;
polar detail is still limited by the bundled image. Esri documents the projection
limit in [Mercator](https://desktop.arcgis.com/en/arcmap/latest/map/projections/mercator.htm).
