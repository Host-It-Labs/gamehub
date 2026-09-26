# Mora overgrown 2D boards (25 September 2026)

After the 3D stage experiment was dropped (all of it removed the same day),
William asked for Mora's two painted boards to be regenerated in the look of
the concept renders and the box cover: places overgrown by nature, animals
untouched. He asked to keep the dimensions of the previous boards, so these
prompts keep the accepted framing text of the current boards word for word
(landscape v5-a Observatory, portrait v7 Observatory, Floodline v5-b both
ways) and only change the style paragraph and how each place looks. Same
image sizes, same place arrangement, same pad counts and shapes.

Fresh built-in generations through Codex (`-m gpt-6-astra`), no reference
images, two variants per board, by `gen.sh`. Outputs in `public/art/`
as `mora-overgrown-<board>-<orientation>-v1-<a|b>.png`.

Prompt = `style.txt` + `places-<board>.txt` + `frame-<board>-<orientation>.txt`.

## observatory landscape

```text
Use case: stylized-concept. Asset type: full-bleed illustrated Gamehub board for Mora. Generate one brand-new board with no image references. Do not open, view or use any existing image file, and do not edit, retouch or inpaint anything: this is a fresh generation.

STYLE. A rich, tactile layered cut-paper diorama with real depth and crisp crafted paper shadows, photographed from a high oblique overhead angle, in the spirit of the Mora box cover: monumental ruins that nature has taken back. Pale weathered stone-paper architecture with arches, balustrades and broken walls; every ledge and cornice blanketed in thick torn-paper moss, cut-leaf ivy climbing the walls, long curtains of hanging vine strands, big cream paper lilies, ferns and broad cut leaves crowding every corner, rusted iron-paper girders. Every object is cut, folded or stacked from thick fibrous cardstock: visible paper grain, white cut edges, folded creases, stacked contour terrain with cast shadows, levels joined by little mossy paper steps. Palette of moss, sage and olive greens, ochre and cream, pale grey stone, with small rust accents. Buildings have presence and character: full-size, complete and overgrown, never small markers. The scene is lush, busy and alive, every place a small stage set. Soft bright daylight from the upper left with long soft shadows. Nothing glossy, plastic, clay or smooth digital 3D.

World: "The Observatory", an abandoned hilltop observatory and its grounds overgrown by nature.

THE SIX PLACES AND THEIR PADS. Every pad is an empty flat cream cardstock piece seen almost face-on, large and readable, clearly separated from its neighbours; there are no look-alike cream stones or discs anywhere else. Square pads are soft-cornered squares; round pads are circles.
Courtyard: a squared, cracked pale flagstone plaza with moss in the joints, before a ruined round stone observatory whose dome is broken open and draped in moss and ivy, a rusted telescope leaning out of its slit, a wooden door; nothing religious. Exactly FOUR SQUARE pads in a 2x2 block.
Roof garden: a round stone terrace on top of a mossy arched ruin, a broken balustrade and planters gone wild. Exactly FOUR SQUARE pads in a 2x2 block.
Root hollow: a giant old hollow tree whose roots have swallowed a stone archway, with a flat wooden-paper floor inside. Exactly TWO SQUARE pads side by side.
Glasshouse trail: a ruined glasshouse of rusted iron ribs and broken panes with ferns bursting out, beside a serpentine flagstone path. Exactly THREE ROUND pads set into the path in order.
Dry channel: a dry stone aqueduct channel on low mossy arches, stacked grey stones along its bed. Exactly THREE ROUND pads spaced along it.
Watchpost: a raised timber-and-rusted-iron deck on posts wrapped in ivy, with a ladder clearly leading up to it and a simple roof that leaves the deck open to view. Exactly ONE ROUND pad on the deck.
Exactly seventeen empty cream cardstock pads in total. Quiet plain ground below each group for text. A small teal paper pond with lilies inside the sanctuary on the left, and a small empty release clearing on the central path. Paths that join every place, stone edging, mossy steps between levels. No text, letters, numbers, icons, animals, people, cards, frame or interface. Edge to edge.

FRAMING AND OUTPUT. LANDSCAPE board, 1536 x 1024. The sanctuary (every building, terrace and pad, outermost pixels) spans the middle 85 percent of the width and about 61 percent of the height, sitting slightly high: thin forest bands each side, a little forest above, and below it about three times as much forest as above. The outer band is continuous expendable overgrown woodland and ruin that will be cropped differently on every screen: dense cut-paper tree crowns, mossy fallen stones, ferns and side paths that lead nowhere; do not let any building, dome, pad or tower touch it. The dome top sits well below the top edge. Layout: root hollow left, roof garden and courtyard with the observatory centre, glasshouse trail below the courtyard, dry channel and watchpost right. Pads about one fourteenth of the image width.
Generate at the newest available image model, highest quality and largest native size; the saved PNG must be exactly 1536 x 1024. No watermark.
```

## observatory portrait

```text
Use case: stylized-concept. Asset type: full-bleed illustrated Gamehub board for Mora. Generate one brand-new board with no image references. Do not open, view or use any existing image file, and do not edit, retouch or inpaint anything: this is a fresh generation.

STYLE. A rich, tactile layered cut-paper diorama with real depth and crisp crafted paper shadows, photographed from a high oblique overhead angle, in the spirit of the Mora box cover: monumental ruins that nature has taken back. Pale weathered stone-paper architecture with arches, balustrades and broken walls; every ledge and cornice blanketed in thick torn-paper moss, cut-leaf ivy climbing the walls, long curtains of hanging vine strands, big cream paper lilies, ferns and broad cut leaves crowding every corner, rusted iron-paper girders. Every object is cut, folded or stacked from thick fibrous cardstock: visible paper grain, white cut edges, folded creases, stacked contour terrain with cast shadows, levels joined by little mossy paper steps. Palette of moss, sage and olive greens, ochre and cream, pale grey stone, with small rust accents. Buildings have presence and character: full-size, complete and overgrown, never small markers. The scene is lush, busy and alive, every place a small stage set. Soft bright daylight from the upper left with long soft shadows. Nothing glossy, plastic, clay or smooth digital 3D.

World: "The Observatory", an abandoned hilltop observatory and its grounds overgrown by nature.

THE SIX PLACES AND THEIR PADS. Every pad is an empty flat cream cardstock piece seen almost face-on, large and readable, clearly separated from its neighbours; there are no look-alike cream stones or discs anywhere else. Square pads are soft-cornered squares; round pads are circles.
Courtyard: a squared, cracked pale flagstone plaza with moss in the joints, before a ruined round stone observatory whose dome is broken open and draped in moss and ivy, a rusted telescope leaning out of its slit, a wooden door; nothing religious. Exactly FOUR SQUARE pads in a 2x2 block.
Roof garden: a round stone terrace on top of a mossy arched ruin, a broken balustrade and planters gone wild. Exactly FOUR SQUARE pads in a 2x2 block.
Root hollow: a giant old hollow tree whose roots have swallowed a stone archway, with a flat wooden-paper floor inside. Exactly TWO SQUARE pads side by side.
Glasshouse trail: a ruined glasshouse of rusted iron ribs and broken panes with ferns bursting out, beside a serpentine flagstone path. Exactly THREE ROUND pads set into the path in order.
Dry channel: a dry stone aqueduct channel on low mossy arches, stacked grey stones along its bed. Exactly THREE ROUND pads spaced along it.
Watchpost: a raised timber-and-rusted-iron deck on posts wrapped in ivy, with a ladder clearly leading up to it and a simple roof that leaves the deck open to view. Exactly ONE ROUND pad on the deck.
Exactly seventeen empty cream cardstock pads in total. Quiet plain ground below each group for text. A small teal paper pond with lilies inside the sanctuary on the left, and a small empty release clearing on the central path. Paths that join every place, stone edging, mossy steps between levels. No text, letters, numbers, icons, animals, people, cards, frame or interface. Edge to edge.

FRAMING AND OUTPUT. PORTRAIT board, 1024 x 1536. This is a dedicated tall composition, not a crop of a wide picture. The sanctuary (every building, terrace and pad, outermost pixels) spans the middle 61 percent of the picture's width and about 57 percent of its height. Forest bands about a fifth of the width on each side, a little forest above the sanctuary (about a sixth of the height), and below it nearly twice as much forest as above (about a quarter of the height). The outer band is continuous expendable overgrown woodland and ruin that will be cropped differently on every screen; do not let any building, dome, pad or tower touch it. Layout in three staggered pairs: roof garden (left) and courtyard with the observatory (right) on top; root hollow (left) and watchpost (right) in the middle; glasshouse trail (left) and dry channel (right) at the bottom. Pond on the left beside the root hollow, release clearing on the central path between the middle and bottom pairs. Pads about one eighth of the sanctuary's width.
Generate at the newest available image model, highest quality and largest native size; the saved PNG must be exactly 1024 x 1536. No watermark.
```

## floodline landscape

```text
Use case: stylized-concept. Asset type: full-bleed illustrated Gamehub board for Mora. Generate one brand-new board with no image references. Do not open, view or use any existing image file, and do not edit, retouch or inpaint anything: this is a fresh generation.

STYLE. A rich, tactile layered cut-paper diorama with real depth and crisp crafted paper shadows, photographed from a high oblique overhead angle, in the spirit of the Mora box cover: monumental ruins that nature has taken back. Pale weathered stone-paper architecture with arches, balustrades and broken walls; every ledge and cornice blanketed in thick torn-paper moss, cut-leaf ivy climbing the walls, long curtains of hanging vine strands, big cream paper lilies, ferns and broad cut leaves crowding every corner, rusted iron-paper girders. Every object is cut, folded or stacked from thick fibrous cardstock: visible paper grain, white cut edges, folded creases, stacked contour terrain with cast shadows, levels joined by little mossy paper steps. Palette of moss, sage and olive greens, ochre and cream, pale grey stone, with small rust accents. Buildings have presence and character: full-size, complete and overgrown, never small markers. The scene is lush, busy and alive, every place a small stage set. Soft bright daylight from the upper left with long soft shadows. Nothing glossy, plastic, clay or smooth digital 3D.

World: "Floodline Station", an abandoned coastal railway station that the sea has flooded and nature has taken back: clear layered turquoise and jade paper water in several shades, pale sand, grey stacked-paper rocks, kraft boardwalks, old rails and sleepers running into the water, palms, sea grass and shells among the moss and ivy.

THE SIX PLACES AND THEIR PADS. Every pad is an empty flat cream cardstock piece seen almost face-on, large and readable, clearly separated from its neighbours; there are no look-alike cream stones or discs anywhere else. Square pads are soft-cornered squares; round pads are circles.
1. Rock pools: a shelf of grey paper rocks and fallen mossy stone arches holding small turquoise pools. Exactly FIVE SQUARE pads, set on the rock between the pools, in a row of three above a row of two.
2. Nesting beach: a pale sandy beach with dune grass curving below the overgrown old station building, whose broken iron-and-glass canopy is hung with vines. Exactly FIVE SQUARE pads on the sand, a row of three above a row of two.
3. Mangrove roots: mangrove trees grown right through a rusted, half-sunk railway carriage, their arching paper roots making three flat wooden-paper floors. Exactly THREE SQUARE pads in a row, one between each pair of roots.
4. Pier: an old railway viaduct of mossy stone arches stepping out into the water, rails still on its deck. Exactly FOUR ROUND pads spaced evenly along the deck in one clear line from the shore end to the far end.
5. Sea cave: the wide flooded mouth of a railway tunnel under a mossy cliff, a flat pale rock floor inside the mouth. Exactly FOUR ROUND pads on that floor in a gentle arc, all fully visible and not hidden by the arch.
6. Lighthouse: a moss-covered stone signal lighthouse with its lantern room, on a small rocky headland with a railed stone-paper terrace at its foot. Exactly TWO ROUND pads side by side on that terrace, beside the tower, never covered by it.
Exactly twenty-three empty cream pads in total: 5 + 5 + 3 + 4 + 4 + 2. Quiet plain ground or plain water directly below each group for a text label. A small empty sandbar clearing with nothing on it in the middle of the station, reachable by planks, for releasing creatures. Boardwalks, steps and stepping stones join every place. No text, letters, numbers, icons, animals, people, cards, frame or interface. The picture runs edge to edge with no border or table.

FRAMING AND OUTPUT. LANDSCAPE board, 1536 x 1024. The whole station (every building, terrace, pier and pad, outermost pixels including the lighthouse top and the station canopy) is small in the frame but everything inside it is large and clear: it spans only the middle 85 percent of the width and about 60 percent of the height, sitting slightly high. The outer band is continuous expendable coastal scenery that will be cropped differently on every screen: open rippled paper sea with rocks, sea stacks, floating kelp, palms and dune grass. Above the lighthouse lantern there is open sea and sky-coloured water about one tenth of the image height; the lighthouse top sits well below the top edge, never near it. On the left and right the scenery band is about as wide as the lighthouse terrace. Below the lowest pads there is about three times as much scenery as above the lighthouse: a wide foreground of shallow water, sand and rocks. Do not let any building, pad, pier end, canopy or lantern touch the outer band.
Layout: lighthouse on its headland upper left, sea cave lower left below it; old station building with the nesting beach at the top centre; rock pools at the bottom centre; pier stepping out to the upper right; mangrove roots at the lower right. The release sandbar sits in the middle between them. Pads about one fourteenth of the image width.
Generate at the newest available image model, highest quality and largest native size; the saved PNG must be exactly 1536 x 1024. No watermark.
```

## floodline portrait

```text
Use case: stylized-concept. Asset type: full-bleed illustrated Gamehub board for Mora. Generate one brand-new board with no image references. Do not open, view or use any existing image file, and do not edit, retouch or inpaint anything: this is a fresh generation.

STYLE. A rich, tactile layered cut-paper diorama with real depth and crisp crafted paper shadows, photographed from a high oblique overhead angle, in the spirit of the Mora box cover: monumental ruins that nature has taken back. Pale weathered stone-paper architecture with arches, balustrades and broken walls; every ledge and cornice blanketed in thick torn-paper moss, cut-leaf ivy climbing the walls, long curtains of hanging vine strands, big cream paper lilies, ferns and broad cut leaves crowding every corner, rusted iron-paper girders. Every object is cut, folded or stacked from thick fibrous cardstock: visible paper grain, white cut edges, folded creases, stacked contour terrain with cast shadows, levels joined by little mossy paper steps. Palette of moss, sage and olive greens, ochre and cream, pale grey stone, with small rust accents. Buildings have presence and character: full-size, complete and overgrown, never small markers. The scene is lush, busy and alive, every place a small stage set. Soft bright daylight from the upper left with long soft shadows. Nothing glossy, plastic, clay or smooth digital 3D.

World: "Floodline Station", an abandoned coastal railway station that the sea has flooded and nature has taken back: clear layered turquoise and jade paper water in several shades, pale sand, grey stacked-paper rocks, kraft boardwalks, old rails and sleepers running into the water, palms, sea grass and shells among the moss and ivy.

THE SIX PLACES AND THEIR PADS. Every pad is an empty flat cream cardstock piece seen almost face-on, large and readable, clearly separated from its neighbours; there are no look-alike cream stones or discs anywhere else. Square pads are soft-cornered squares; round pads are circles.
1. Rock pools: a shelf of grey paper rocks and fallen mossy stone arches holding small turquoise pools. Exactly FIVE SQUARE pads, set on the rock between the pools, in a row of three above a row of two.
2. Nesting beach: a pale sandy beach with dune grass curving below the overgrown old station building, whose broken iron-and-glass canopy is hung with vines. Exactly FIVE SQUARE pads on the sand, a row of three above a row of two.
3. Mangrove roots: mangrove trees grown right through a rusted, half-sunk railway carriage, their arching paper roots making three flat wooden-paper floors. Exactly THREE SQUARE pads in a row, one between each pair of roots.
4. Pier: an old railway viaduct of mossy stone arches stepping out into the water, rails still on its deck. Exactly FOUR ROUND pads spaced evenly along the deck in one clear line from the shore end to the far end.
5. Sea cave: the wide flooded mouth of a railway tunnel under a mossy cliff, a flat pale rock floor inside the mouth. Exactly FOUR ROUND pads on that floor in a gentle arc, all fully visible and not hidden by the arch.
6. Lighthouse: a moss-covered stone signal lighthouse with its lantern room, on a small rocky headland with a railed stone-paper terrace at its foot. Exactly TWO ROUND pads side by side on that terrace, beside the tower, never covered by it.
Exactly twenty-three empty cream pads in total: 5 + 5 + 3 + 4 + 4 + 2. Quiet plain ground or plain water directly below each group for a text label. A small empty sandbar clearing with nothing on it in the middle of the station, reachable by planks, for releasing creatures. Boardwalks, steps and stepping stones join every place. No text, letters, numbers, icons, animals, people, cards, frame or interface. The picture runs edge to edge with no border or table.

FRAMING AND OUTPUT. PORTRAIT board, 1024 x 1536. This is a dedicated tall composition, not a crop of a wide picture. The whole station (every building, terrace, pier and pad, outermost pixels including the lighthouse top and the station canopy) is small in the frame but everything inside it is large and clear: it spans the middle 62 percent of the width and about 58 percent of the height. The outer band is continuous expendable coastal scenery that will be cropped differently on every screen: open rippled paper sea with rocks, sea stacks, floating kelp, palms and dune grass. Above the lighthouse lantern there is open sea about one sixth of the image height; the lighthouse top sits at about one sixth of the height, never near the top edge. On the left and right the scenery band is about one fifth of the width each. Below the lowest pads there is nearly twice as much scenery as above the lighthouse: a wide foreground of shallow water, sand and rocks. Do not let any building, pad, pier end, canopy or lantern touch the outer band.
Layout in three staggered pairs: lighthouse on its headland (left) and the pier stepping out into the water (right) on top; nesting beach below the old station building (left) and mangrove roots (right) in the middle; rock pools (left) and sea cave (right) at the bottom. The release sandbar sits in the centre between the middle and bottom pairs. The viaduct pier runs mostly vertically so its four pads are in one clear line. Pads about one ninth of the image width.
Generate at the newest available image model, highest quality and largest native size; the saved PNG must be exactly 1024 x 1536. No watermark.
```

## Attempts

| Image | Result |
| --- | --- |
| observatory landscape a / b | 1536×1024; 17 pads each (4/4/2/3/3/1) by eye, release clearing present. Sanctuary runs wider and higher than v5-a: the tree reaches the left edge and the dome sits close to the top |
| observatory portrait a / b | 1024×1536; 17 pads each, three staggered pairs as briefed; dome top close to the top edge (a closer than b) |
| floodline landscape a / b | 1536×1024; 23 pads each (5/5/3/4/4/2); layout as v5-b; lighthouse top near the top edge like v5-b |
| floodline portrait a / b | 1024×1536; 23 pads each; three staggered pairs; pier end near the top edge |

`compare-<board>-<orientation>.jpg`: current accepted board, then a, then b.
Measurement of pad centres, labels and landmark bounds happens after the
user picks, per chosen image.

## Round 2 (v2), after feedback

William: v1 lost the 2D paper texture and looked too realistic; the greenery
merged the places together; and Floodline had forest plants that make no
sense in the sea. v2 prompts (`v2/`) restore the accepted paper style
paragraph, add a readability paragraph (each place its own terrace with its
own dominant material, open paths between, nothing overhanging a pad), and
give Floodline only sea life (seaweed, kelp, algae, barnacles, coral, sea
grass, dune grass; mangroves only at Mangrove roots; no palms, ivy, ferns or
forest). Framing text unchanged.

### v2 observatory landscape

```text
Use case: stylized-concept. Asset type: full-bleed illustrated Gamehub board for Mora, world "The Observatory". Generate one brand-new board with no image references. Do not open, view or use any existing image file, and do not edit, retouch or inpaint anything: this is a fresh generation.

STYLE. A lovingly handmade layered cut-paper diorama with real depth, photographed from a high oblique overhead angle. Every object is cut, folded or stacked from thick fibrous cardstock and kraft paper: visible paper grain, white cut edges, folded creases, stacked contour terrain with a soft cast shadow under every paper layer, terraces on different levels joined by little paper steps. Shapes are simplified and graphic like real paper craft: trees are stacked scalloped paper discs and fans, moss is torn paper layers, ivy is small cut-paper leaf strips, stones are flat paper cut-outs with scored lines. This is an old hilltop observatory that nature has taken back, like a paper model of overgrown ruins: pale cream and warm grey stone-paper walls, arches and balustrades, torn-paper moss on the ledges, cut-paper ivy and a few hanging paper vines, cream paper lilies, rusted kraft-paper iron. Palette of moss, sage, olive and ochre with autumn accents of yellow and rust, cream and pale grey stone. Soft daylight from the upper left with long soft shadows. It must read clearly as a real paper model: matte, flat colour fields, crisp paper edges. Nothing photorealistic, nothing painterly, nothing glossy, plastic, clay or smooth digital 3D.

READABILITY. Each of the six places is its own clearly separated stage set on its own raised paper terrace or platform, with a different dominant material and colour so it reads at a glance: pale flagstone, round stone terrace, dark kraft wood, rust-brown iron and pale glass, grey stone bed, timber. Wide open paths of pale sand-coloured paper and open plain lawn separate the places; greenery frames the places and fills the outer forest, but never floods across the paths or between places, and nothing overhangs a pad.



THE SIX PLACES AND THEIR PADS. Every pad is an empty flat cream cardstock piece seen almost face-on, large and readable, clearly separated from its neighbours; there are no look-alike cream stones or discs anywhere else. Square pads are soft-cornered squares; round pads are circles.
Courtyard: a squared, cracked pale flagstone plaza with moss in the joints, before a ruined round stone observatory whose dome is broken open and draped in paper moss and ivy, a rusted telescope leaning out of its slit, a wooden door; nothing religious. Exactly FOUR SQUARE pads in a 2x2 block.
Roof garden: a round stone terrace on top of a mossy arched ruin, a broken balustrade and planters gone wild. Exactly FOUR SQUARE pads in a 2x2 block.
Root hollow: a giant old hollow tree whose roots have swallowed a stone archway, with a flat wooden-paper floor inside. Exactly TWO SQUARE pads side by side.
Glasshouse trail: a ruined glasshouse of rusted iron ribs and broken panes with ferns bursting out, beside a serpentine flagstone path. Exactly THREE ROUND pads set into the path in order.
Dry channel: a dry stone aqueduct channel on low mossy arches, stacked grey stones along its bed. Exactly THREE ROUND pads spaced along it.
Watchpost: a raised timber-and-rusted-iron deck on posts wrapped in ivy, with a ladder clearly leading up to it and a simple roof that leaves the deck open to view. Exactly ONE ROUND pad on the deck.
Exactly seventeen empty cream cardstock pads in total. Quiet plain ground below each group for text. A small teal paper pond with lilies inside the sanctuary on the left, and a small empty release clearing on the central path. Paths that join every place, stone edging, mossy steps between levels. No text, letters, numbers, icons, animals, people, cards, frame or interface. Edge to edge.

FRAMING AND OUTPUT. LANDSCAPE board, 1536 x 1024. The sanctuary (every building, terrace and pad, outermost pixels) spans the middle 85 percent of the width and about 61 percent of the height, sitting slightly high: thin forest bands each side, a little forest above, and below it about three times as much forest as above. The outer band is continuous expendable cut-paper woodland with a few fallen paper stones that will be cropped differently on every screen: dense cut-paper tree crowns, mossy fallen stones, ferns and side paths that lead nowhere; do not let any building, dome, pad or tower touch it. The dome top sits well below the top edge. Layout: root hollow left, roof garden and courtyard with the observatory centre, glasshouse trail below the courtyard, dry channel and watchpost right. Pads about one fourteenth of the image width.
Generate at the newest available image model, highest quality and largest native size; the saved PNG must be exactly 1536 x 1024. No watermark.
```

### v2 observatory portrait

```text
Use case: stylized-concept. Asset type: full-bleed illustrated Gamehub board for Mora, world "The Observatory". Generate one brand-new board with no image references. Do not open, view or use any existing image file, and do not edit, retouch or inpaint anything: this is a fresh generation.

STYLE. A lovingly handmade layered cut-paper diorama with real depth, photographed from a high oblique overhead angle. Every object is cut, folded or stacked from thick fibrous cardstock and kraft paper: visible paper grain, white cut edges, folded creases, stacked contour terrain with a soft cast shadow under every paper layer, terraces on different levels joined by little paper steps. Shapes are simplified and graphic like real paper craft: trees are stacked scalloped paper discs and fans, moss is torn paper layers, ivy is small cut-paper leaf strips, stones are flat paper cut-outs with scored lines. This is an old hilltop observatory that nature has taken back, like a paper model of overgrown ruins: pale cream and warm grey stone-paper walls, arches and balustrades, torn-paper moss on the ledges, cut-paper ivy and a few hanging paper vines, cream paper lilies, rusted kraft-paper iron. Palette of moss, sage, olive and ochre with autumn accents of yellow and rust, cream and pale grey stone. Soft daylight from the upper left with long soft shadows. It must read clearly as a real paper model: matte, flat colour fields, crisp paper edges. Nothing photorealistic, nothing painterly, nothing glossy, plastic, clay or smooth digital 3D.

READABILITY. Each of the six places is its own clearly separated stage set on its own raised paper terrace or platform, with a different dominant material and colour so it reads at a glance: pale flagstone, round stone terrace, dark kraft wood, rust-brown iron and pale glass, grey stone bed, timber. Wide open paths of pale sand-coloured paper and open plain lawn separate the places; greenery frames the places and fills the outer forest, but never floods across the paths or between places, and nothing overhangs a pad.



THE SIX PLACES AND THEIR PADS. Every pad is an empty flat cream cardstock piece seen almost face-on, large and readable, clearly separated from its neighbours; there are no look-alike cream stones or discs anywhere else. Square pads are soft-cornered squares; round pads are circles.
Courtyard: a squared, cracked pale flagstone plaza with moss in the joints, before a ruined round stone observatory whose dome is broken open and draped in paper moss and ivy, a rusted telescope leaning out of its slit, a wooden door; nothing religious. Exactly FOUR SQUARE pads in a 2x2 block.
Roof garden: a round stone terrace on top of a mossy arched ruin, a broken balustrade and planters gone wild. Exactly FOUR SQUARE pads in a 2x2 block.
Root hollow: a giant old hollow tree whose roots have swallowed a stone archway, with a flat wooden-paper floor inside. Exactly TWO SQUARE pads side by side.
Glasshouse trail: a ruined glasshouse of rusted iron ribs and broken panes with ferns bursting out, beside a serpentine flagstone path. Exactly THREE ROUND pads set into the path in order.
Dry channel: a dry stone aqueduct channel on low mossy arches, stacked grey stones along its bed. Exactly THREE ROUND pads spaced along it.
Watchpost: a raised timber-and-rusted-iron deck on posts wrapped in ivy, with a ladder clearly leading up to it and a simple roof that leaves the deck open to view. Exactly ONE ROUND pad on the deck.
Exactly seventeen empty cream cardstock pads in total. Quiet plain ground below each group for text. A small teal paper pond with lilies inside the sanctuary on the left, and a small empty release clearing on the central path. Paths that join every place, stone edging, mossy steps between levels. No text, letters, numbers, icons, animals, people, cards, frame or interface. Edge to edge.

FRAMING AND OUTPUT. PORTRAIT board, 1024 x 1536. This is a dedicated tall composition, not a crop of a wide picture. The sanctuary (every building, terrace and pad, outermost pixels) spans the middle 61 percent of the picture's width and about 57 percent of its height. Forest bands about a fifth of the width on each side, a little forest above the sanctuary (about a sixth of the height), and below it nearly twice as much forest as above (about a quarter of the height). The outer band is continuous expendable cut-paper woodland with a few fallen paper stones that will be cropped differently on every screen; do not let any building, dome, pad or tower touch it. Layout in three staggered pairs: roof garden (left) and courtyard with the observatory (right) on top; root hollow (left) and watchpost (right) in the middle; glasshouse trail (left) and dry channel (right) at the bottom. Pond on the left beside the root hollow, release clearing on the central path between the middle and bottom pairs. Pads about one eighth of the sanctuary's width.
Generate at the newest available image model, highest quality and largest native size; the saved PNG must be exactly 1024 x 1536. No watermark.
```

### v2 floodline landscape

```text
Use case: stylized-concept. Asset type: full-bleed illustrated Gamehub board for Mora, world "Floodline Station". Generate one brand-new board with no image references. Do not open, view or use any existing image file, and do not edit, retouch or inpaint anything: this is a fresh generation.

STYLE. A lovingly handmade layered cut-paper diorama with real depth, photographed from a high oblique overhead angle. Every object is cut, folded or stacked from thick fibrous cardstock and kraft paper: visible paper grain, white cut edges, folded creases, stacked layers with a soft cast shadow under each, levels joined by little paper steps and ramps. Shapes are simplified and graphic like real paper craft. This is an old coastal railway station that the sea has flooded and sea life has taken back: layered rippled turquoise, jade and teal paper water in several shades, pale sand-coloured paper beaches and sandbars, grey stacked-paper rocks, cream and pale grey stone-paper ruins, kraft-card boardwalks, rusted old rails running into the water. The sea has overgrown the ruins the way the sea does, not like a forest: cut-paper seaweed and kelp draped over walls and rails, green and ochre algae on the stones, barnacle and mussel clusters, small coral-pink and cream coral and sea anemones, sea grass meadows in the shallows, dune grass and sea pinks on the sand, shells and driftwood. No forest, no woodland trees, no palm trees, no ivy, no ferns, no garden flowers: the only trees are the mangroves of the mangrove place. Palette of turquoise, jade, sea green, sand, cream and warm grey with small accents of coral and rust. Soft daylight from the upper left with long soft shadows. It must read clearly as a real paper model: matte, flat colour fields, crisp paper edges. Nothing photorealistic, nothing painterly, nothing glossy, plastic, clay or smooth digital 3D.

READABILITY. Each of the six places is its own clearly separated island or structure with a different dominant material and colour so it reads at a glance: grey rock with turquoise pools, pale sand, dark mangrove roots with rust carriage, cream stone viaduct with rails, dark cave mouth, cream stone lighthouse. Open water and plain sandbars separate the places; seaweed and algae stay on the structures' edges and never cover a pad.



THE SIX PLACES AND THEIR PADS. Every pad is an empty flat cream cardstock piece seen almost face-on, large and readable, clearly separated from its neighbours; there are no look-alike cream stones or discs anywhere else. Square pads are soft-cornered squares; round pads are circles.
1. Rock pools: a shelf of grey paper rocks and fallen stone arches crusted with algae and barnacles holding small turquoise pools. Exactly FIVE SQUARE pads, set on the rock between the pools, in a row of three above a row of two.
2. Nesting beach: a pale sandy beach with dune grass curving below the old stone station building, whose broken iron-and-glass canopy is hung with seaweed. Exactly FIVE SQUARE pads on the sand, a row of three above a row of two.
3. Mangrove roots: mangrove trees grown right through a rusted, half-sunk railway carriage, their arching paper roots making three flat wooden-paper floors. Exactly THREE SQUARE pads in a row, one between each pair of roots.
4. Pier: an old railway viaduct of stone arches draped in kelp stepping out into the water, rails still on its deck. Exactly FOUR ROUND pads spaced evenly along the deck in one clear line from the shore end to the far end.
5. Sea cave: the wide flooded mouth of a railway tunnel under a rock cliff crusted with algae, a flat pale rock floor inside the mouth. Exactly FOUR ROUND pads on that floor in a gentle arc, all fully visible and not hidden by the arch.
6. Lighthouse: a cream stone signal lighthouse streaked with algae with its lantern room, on a small rocky headland with a railed stone-paper terrace at its foot. Exactly TWO ROUND pads side by side on that terrace, beside the tower, never covered by it.
Exactly twenty-three empty cream pads in total: 5 + 5 + 3 + 4 + 4 + 2. Quiet plain ground or plain water directly below each group for a text label. A small empty sandbar clearing with nothing on it in the middle of the station, reachable by planks, for releasing creatures. Boardwalks, steps and stepping stones join every place. No text, letters, numbers, icons, animals, people, cards, frame or interface. The picture runs edge to edge with no border or table.

FRAMING AND OUTPUT. LANDSCAPE board, 1536 x 1024. The whole station (every building, terrace, pier and pad, outermost pixels including the lighthouse top and the station canopy) is small in the frame but everything inside it is large and clear: it spans only the middle 85 percent of the width and about 60 percent of the height, sitting slightly high. The outer band is continuous expendable coastal scenery that will be cropped differently on every screen: open rippled paper sea with rocks, sea stacks, floating kelp, sea grass and small sandbars. Above the lighthouse lantern there is open sea and sky-coloured water about one tenth of the image height; the lighthouse top sits well below the top edge, never near it. On the left and right the scenery band is about as wide as the lighthouse terrace. Below the lowest pads there is about three times as much scenery as above the lighthouse: a wide foreground of shallow water, sand and rocks. Do not let any building, pad, pier end, canopy or lantern touch the outer band.
Layout: lighthouse on its headland upper left, sea cave lower left below it; old station building with the nesting beach at the top centre; rock pools at the bottom centre; pier stepping out to the upper right; mangrove roots at the lower right. The release sandbar sits in the middle between them. Pads about one fourteenth of the image width.
Generate at the newest available image model, highest quality and largest native size; the saved PNG must be exactly 1536 x 1024. No watermark.
```

### v2 floodline portrait

```text
Use case: stylized-concept. Asset type: full-bleed illustrated Gamehub board for Mora, world "Floodline Station". Generate one brand-new board with no image references. Do not open, view or use any existing image file, and do not edit, retouch or inpaint anything: this is a fresh generation.

STYLE. A lovingly handmade layered cut-paper diorama with real depth, photographed from a high oblique overhead angle. Every object is cut, folded or stacked from thick fibrous cardstock and kraft paper: visible paper grain, white cut edges, folded creases, stacked layers with a soft cast shadow under each, levels joined by little paper steps and ramps. Shapes are simplified and graphic like real paper craft. This is an old coastal railway station that the sea has flooded and sea life has taken back: layered rippled turquoise, jade and teal paper water in several shades, pale sand-coloured paper beaches and sandbars, grey stacked-paper rocks, cream and pale grey stone-paper ruins, kraft-card boardwalks, rusted old rails running into the water. The sea has overgrown the ruins the way the sea does, not like a forest: cut-paper seaweed and kelp draped over walls and rails, green and ochre algae on the stones, barnacle and mussel clusters, small coral-pink and cream coral and sea anemones, sea grass meadows in the shallows, dune grass and sea pinks on the sand, shells and driftwood. No forest, no woodland trees, no palm trees, no ivy, no ferns, no garden flowers: the only trees are the mangroves of the mangrove place. Palette of turquoise, jade, sea green, sand, cream and warm grey with small accents of coral and rust. Soft daylight from the upper left with long soft shadows. It must read clearly as a real paper model: matte, flat colour fields, crisp paper edges. Nothing photorealistic, nothing painterly, nothing glossy, plastic, clay or smooth digital 3D.

READABILITY. Each of the six places is its own clearly separated island or structure with a different dominant material and colour so it reads at a glance: grey rock with turquoise pools, pale sand, dark mangrove roots with rust carriage, cream stone viaduct with rails, dark cave mouth, cream stone lighthouse. Open water and plain sandbars separate the places; seaweed and algae stay on the structures' edges and never cover a pad.



THE SIX PLACES AND THEIR PADS. Every pad is an empty flat cream cardstock piece seen almost face-on, large and readable, clearly separated from its neighbours; there are no look-alike cream stones or discs anywhere else. Square pads are soft-cornered squares; round pads are circles.
1. Rock pools: a shelf of grey paper rocks and fallen stone arches crusted with algae and barnacles holding small turquoise pools. Exactly FIVE SQUARE pads, set on the rock between the pools, in a row of three above a row of two.
2. Nesting beach: a pale sandy beach with dune grass curving below the old stone station building, whose broken iron-and-glass canopy is hung with seaweed. Exactly FIVE SQUARE pads on the sand, a row of three above a row of two.
3. Mangrove roots: mangrove trees grown right through a rusted, half-sunk railway carriage, their arching paper roots making three flat wooden-paper floors. Exactly THREE SQUARE pads in a row, one between each pair of roots.
4. Pier: an old railway viaduct of stone arches draped in kelp stepping out into the water, rails still on its deck. Exactly FOUR ROUND pads spaced evenly along the deck in one clear line from the shore end to the far end.
5. Sea cave: the wide flooded mouth of a railway tunnel under a rock cliff crusted with algae, a flat pale rock floor inside the mouth. Exactly FOUR ROUND pads on that floor in a gentle arc, all fully visible and not hidden by the arch.
6. Lighthouse: a cream stone signal lighthouse streaked with algae with its lantern room, on a small rocky headland with a railed stone-paper terrace at its foot. Exactly TWO ROUND pads side by side on that terrace, beside the tower, never covered by it.
Exactly twenty-three empty cream pads in total: 5 + 5 + 3 + 4 + 4 + 2. Quiet plain ground or plain water directly below each group for a text label. A small empty sandbar clearing with nothing on it in the middle of the station, reachable by planks, for releasing creatures. Boardwalks, steps and stepping stones join every place. No text, letters, numbers, icons, animals, people, cards, frame or interface. The picture runs edge to edge with no border or table.

FRAMING AND OUTPUT. PORTRAIT board, 1024 x 1536. This is a dedicated tall composition, not a crop of a wide picture. The whole station (every building, terrace, pier and pad, outermost pixels including the lighthouse top and the station canopy) is small in the frame but everything inside it is large and clear: it spans the middle 62 percent of the width and about 58 percent of the height. The outer band is continuous expendable coastal scenery that will be cropped differently on every screen: open rippled paper sea with rocks, sea stacks, floating kelp, sea grass and small sandbars. Above the lighthouse lantern there is open sea about one sixth of the image height; the lighthouse top sits at about one sixth of the height, never near the top edge. On the left and right the scenery band is about one fifth of the width each. Below the lowest pads there is nearly twice as much scenery as above the lighthouse: a wide foreground of shallow water, sand and rocks. Do not let any building, pad, pier end, canopy or lantern touch the outer band.
Layout in three staggered pairs: lighthouse on its headland (left) and the pier stepping out into the water (right) on top; nesting beach below the old station building (left) and mangrove roots (right) in the middle; rock pools (left) and sea cave (right) at the bottom. The release sandbar sits in the centre between the middle and bottom pairs. The viaduct pier runs mostly vertically so its four pads are in one clear line. Pads about one ninth of the image width.
Generate at the newest available image model, highest quality and largest native size; the saved PNG must be exactly 1024 x 1536. No watermark.
```

### v2 results and choice

All eight v2 images: native size, correct pad counts (17 / 23), paper look
restored, places clearly separated, Floodline without forest plants.
Accepted and integrated (25 September 2026, William asked to implement
without a further review):

| Board | Accepted | Why |
| --- | --- | --- |
| Observatory landscape | `mora-overgrown-observatory-landscape-v2-b.png` | more room above the dome than a |
| Observatory portrait | `mora-overgrown-observatory-portrait-v2-b.png` | flatter paper colour, dome clear of the top |
| Floodline landscape | `mora-overgrown-floodline-landscape-v2-a.png` | most paper-like layered water, largest pads |
| Floodline portrait | `mora-overgrown-floodline-portrait-v2-b.png` | cleanest separation of the six places |

Geometry: pad centres from `LOOSE=1 node scripts/measure-pads.mjs` (4, 15, 19
and 15 found), the rest placed by eye; every pad, label, Release and landmark
box checked on a full-resolution overlay before writing
`lib/games/{observatory,observatory-portrait,floodline,floodline-portrait}-art.json`.
Habitat bounds use 0.85 token widths each side and 0.72 above, so the play box
leaves room for full scenery cover on 1440×900 desktops. v1 images stay in
`public/art/` for reference and are not shipped.

## Round 3 (v3): no borders on desktop or phones

William: side borders on his 16:9 desktop (zooming out 20% hid them), the
Floodline station building wasted the top, and the bottom places sat under
the hand. Measured cause: the v2 play boxes were 678 (Observatory) and 656
(Floodline) of 1024 px tall; at a 1920×969 window's cover scale only 624 fit,
at 1536×730 only 555. New gate: `scripts/check-board-cover.mjs` (also run by
`tests/observatory-layout.test.mjs`), documented in the game-world-layout
skill ("Desktop side borders").

- Landscape prompts (`v3/frame-*-landscape.txt`) ask for a wide shallow band,
  gameplay between 22% and 70% of the height, two rows; Floodline drops the
  station building (the beach is backed by a low platform edge and rails) and
  gets a short lighthouse. Three variants each; accepted `observatory-landscape-v3-b`
  (play box 534 tall) and `floodline-landscape-v3-b` (537).
- Portrait prompts (`v3/frame-*-portrait.txt`, Floodline also
  `frame-floodline-portrait-narrow.txt`) keep the six places in a central
  column. Accepted `observatory-portrait-v3-c` and `floodline-portrait-v3-f`,
  each made taller with `scripts/extend-paper-world.mjs` (its own scenery,
  mirrored, above and below): `-v3-c-tall` 1024×1720 (+120 top, +64 bottom)
  and `-v3-f-tall` 1024×1780 (+188, +56). Taller sources lower the phone's
  cover scale, which widens the visible column; pads stay about 25 px.
- Every pad, plate, Release and landmark was placed on a full-resolution
  overlay. Checker: all desktop windows and all full-height phones cover.
  Short phone windows (Safari with both bars, iPhone SE) are reported only;
  no accepted board has covered them.
- Browser (isolated worktree, headless Chrome): scene fills 1920×969,
  1536×730, 390×844 and 430×932 on both boards, no page scroll. At 1536×730
  the lower edge of Floodline's second Rock pools row touches the hand tray.

Unused candidates of all three rounds moved to `../gamehub-art-archive/public/art/`.
