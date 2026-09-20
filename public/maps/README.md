# World geometry

`world.json` contains country polygon coordinates from Natural Earth's public-domain
1:110m Admin 0 Countries dataset. Coordinates are rounded to three decimals; properties
are omitted. It is for a geography game, not navigation or legal boundary determinations.

Source downloaded 2026-09-20:
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson

License: https://www.naturalearthdata.com/about/terms-of-use/

The capital-location catalog in `lib/games/party/places.json` comes from World
Bank country metadata; each record contains its original API source. These are
approximate city coordinates, not exact landmark locations.

`public/art/atlas-cover.svg` is an original code-native cover composed from the same public-domain polygons, native typography, route strokes and circles.
