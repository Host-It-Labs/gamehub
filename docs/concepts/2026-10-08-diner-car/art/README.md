# Diner art — icons and place postcards (8–9 October 2026)

William: "the icons for burgers or shakes or players waiting … feel a bit ugly".
The hand-drawn SVG icons are replaced by illustrated sticker art. Three sheets,
two variants each (`-a`, `-b`), generated fresh from these written prompts with
no reference images (artwork skill). The chosen sheet is sliced into single
transparent images under `public/art/diner/icons/` and `public/art/diner/places/`.

Background is flat mid-grey so the die-cut stickers can be keyed out by
flood-filling from the edges.


## Sheet A (food and order states)

```
Style: glossy 1950s American diner enamel-badge stickers, the look of a premium modern mobile game's UI icons. Chunky, rounded, appetising forms with soft painted shading, a crisp white specular highlight and gentle ambient occlusion, warm saturated colours (cherry red, cream, mint green, mustard yellow, polished chrome, golden brown). Every object has a confident dark warm-brown outline and sits on its own die-cut sticker with a thick cream-white border that follows the object's silhouette. The same soft light comes from the top left on every icon. Each icon reads instantly at 32 pixels. No text, no letters, no numbers anywhere. Layout: a square image holding an even 4 by 4 grid of 16 separate stickers, one per cell, each centred in its cell and filling about 70 percent of the cell, with clear empty space between neighbours. The background is one perfectly flat, untextured neutral mid-grey (#7f7f7f) with no shadows, no gradient, no frame and nothing else on it. Stickers never touch each other or the image edge. Contents, in reading order left to right, top row first: 1 a juicy cheeseburger seen at a slight three-quarter angle, sesame bun, lettuce, melted cheese; 2 a tall strawberry milkshake in a fluted glass with whipped cream, a cherry and a red-and-white straw; 3 golden french fries in a red paper carton; 4 a slice of cherry pie with a lattice crust on a small white plate; 5 a burnt black burger patty smoking on a white plate; 6 a stack of three dirty white plates with crumbs and a fork; 7 a glass coffee pot with a black handle, full of coffee, a wisp of steam; 8 a shiny brass service bell; 9 a red diner menu card with a cream cover band; 10 a crossed fork and knife; 11 a single gold coin with a star embossed on it; 12 a glossy red heart; 13 a mint-green enamel token with a cream star in its centre; 14 a red jerry can of fuel; 15 a chrome wrench; 16 a small stack of three gold coins on a table napkin.
```

## Sheet B (actions and equipment)

```
Style: glossy 1950s American diner enamel-badge stickers, the look of a premium modern mobile game's UI icons. Chunky, rounded, appetising forms with soft painted shading, a crisp white specular highlight and gentle ambient occlusion, warm saturated colours (cherry red, cream, mint green, mustard yellow, polished chrome, golden brown). Every object has a confident dark warm-brown outline and sits on its own die-cut sticker with a thick cream-white border that follows the object's silhouette. The same soft light comes from the top left on every icon. Each icon reads instantly at 32 pixels. No text, no letters, no numbers anywhere. Layout: a square image holding an even 4 by 4 grid of 16 separate stickers, one per cell, each centred in its cell and filling about 70 percent of the cell, with clear empty space between neighbours. The background is one perfectly flat, untextured neutral mid-grey (#7f7f7f) with no shadows, no gradient, no frame and nothing else on it. Stickers never touch each other or the image edge. Contents, in reading order left to right, top row first: 1 a yellow mop in a red bucket with soap suds; 2 a chrome sink with soap bubbles; 3 a red pedal trash bin with a chrome lid; 4 two pink musical notes in front of a tiny glowing jukebox; 5 a pink roller skate with yellow wheels; 6 a round chrome serving tray carrying two covered plates; 7 a spare tyre with a whitewall; 8 two cream dice with red pips; 9 a folded road map with a red route line; 10 a small glowing pink neon tube shaped like a coffee cup on a dark backing board; 11 a wooden supply crate with rope handles; 12 a yellow lightning bolt; 13 a chrome stopwatch; 14 a single wide open eye with a mint iris; 15 a gold star with a glossy shine; 16 an open white-gloved hand, palm forward.
```

## Sheet P (place postcards)

```
Style: twelve-colour gouache travel postcards from the 1950s, the warm painterly look of vintage American roadside illustration, at night: deep indigo and violet skies, warm glowing windows and bulbs, cool moonlight rims, simple strong shapes, soft painted texture, no harsh black. Each postcard is a square card with rounded corners and a thick cream border. No text, no letters, no numbers, no signs with writing anywhere. Layout: a landscape image holding an even grid of 8 separate square postcards, 4 across and 2 down, each centred in its cell with clear empty space between them, on one perfectly flat untextured neutral mid-grey (#7f7f7f) background with no shadows and nothing else; postcards never touch each other or the image edge. Contents, left to right, top row first: 1 a desert truck stop with glowing petrol pumps under a canopy, a parked semi-trailer and a tall pole sign shape; 2 a drive-in cinema: a huge glowing blue screen above rows of parked rounded cars; 3 a night fairground with a lit Ferris wheel, a striped carousel tent and strings of bulbs; 4 a harbour: a red-and-white striped lighthouse throwing a beam over dark teal water, small boats at a wooden pier; 5 an old town square with brick shopfronts with lit windows, a clock tower and iron street lamps on cobbles; 6 the Moon Mile: violet desert mesas under a huge pale moon, a radio telescope dish and a retro rocket-shaped motel marker; 7 a roadside garage with a mint service bay door open, a car on a lift, warm light inside; 8 a small cream roadside motel with a cherry neon frame, a glowing pool and a palm.
```

## Results (9 October 2026)

All six generations made one image each; every saved sheet matches the PNG
in its own Codex session folder (sha256 checked). `sheet-a-a` was not copied
by its run and was recovered from its session folder.

| Sheet | Chosen | Why |
| --- | --- | --- |
| A, food and order states | `sheet-a-b.png` | bolder shake and bell, all 16 in order |
| B, actions and equipment | `sheet-b-a.png` | all 16 in order, clearer jukebox and tray |
| P, place postcards | `sheet-p-b.png` | larger frames, each landmark reads at 50 px |

Cut with `node scripts/diner/slice-stickers.mjs <sheet> <outDir> <size> <names>`
into `public/art/diner/icons/*.webp` (160 px) and
`public/art/diner/places/*.webp` (360 px). Keying checked on a dark contact
sheet: no grey fringe.
