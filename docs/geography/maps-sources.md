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
