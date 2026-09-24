# Mundo — cover and Sizes illustrations

Mundo (provisional name, internal id `miro`) turns Atlas into a two-game set
about the world: **Atlas** (pin the place on the globe) and **Sizes** (guess
how many of one thing match another: animals and objects, then countries).
It follows Tribu's structure: an opening vote between the two games, a vote
after every round to play again, switch or finish, and totals that carry
across both.

Text-only fresh generations with the built-in image tool. No reference images,
and no previous cover inspected. Two variants per image from the same prompt,
`-a` and `-b`.

## Style paragraph (shared)

Sunlit mid-century explorer travel-poster illustration, painted in opaque
gouache with soft airbrushed gradients and a fine paper grain; warm saffron,
ochre and sand, deep ultramarine and sea teal, tomato-red accents, cream
highlights; rounded confident shapes, gentle long shadows from a low
afternoon sun on the left, optimistic and adventurous, crisp but painterly.
Not neon, not night-time, not cut paper or kraft, not ink printmaking or
risograph, not a radio tuner.

## Cover prompt (`public/art/box-mundo-v1-{a,b}.png`)

Use case: illustration-story. Create a fresh full-bleed square 2D illustrated board-game cover, largest native square size, PNG. Text verbatim: "Mundo", no other text, letters or numbers anywhere. A lively party game about the world: players pin mystery places on a globe and guess how many of one thing fit into another, like how many cats weigh as much as a hippo or how many Switzerlands fit inside Brazil. Style: sunlit mid-century explorer travel-poster illustration, painted in opaque gouache with soft airbrushed gradients and a fine paper grain; warm saffron, ochre and sand, deep ultramarine and sea teal, tomato-red accents, cream highlights; rounded confident shapes, gentle long shadows from a low afternoon sun on the left, optimistic and adventurous, crisp but painterly. Composition: a big glowing globe rising like a sun behind the title, with one bright red map pin planted in it; in the foreground a cheerful sense of scale: a tall giraffe standing beside a small Eiffel-like iron tower, a tiny house cat sitting on one pan of an old brass balance scale opposite a hippo whose pan sits lower, and a couple of simple country silhouettes floating like paper kites; a dotted flight path arcing across the sky. Make the title "Mundo" a huge chunky rounded custom display typeface in warm cream with a tomato-red inline and a soft shadow, integrated across the upper centre in front of the globe, readable at 160px. All title letters completely within the central 84% of the canvas (8% margins minimum). Artwork fills every edge. Not neon, not night-time, not cut paper or kraft, not ink printmaking or risograph, not a radio tuner. No UI, no game screenshot, no counters, no border, no external mat or gray padding, no physical box mockup, no additional lettering. Original composition from this description alone.

## Sizes sheets (`public/art/sizes-{animals,things}-v1-{a,b}.png`)

Animals prompt: Use case: sprite-sheet. Create a fresh square PNG, largest native square size: a sheet of sixteen separate game illustrations in an exact 4 by 4 grid of equal square cells, each subject centred in its own cell with generous empty margin, nothing crossing cell edges, plain flat warm cream background (#f6ecd9) everywhere with no grid lines, frames, shadows between cells, labels, text or numbers. Style: sunlit mid-century explorer travel-poster illustration, painted in opaque gouache with soft airbrushed gradients and a fine paper grain; warm saffron, ochre and sand, deep ultramarine and sea teal, tomato-red accents, cream highlights; rounded confident shapes, one soft light from the upper left, friendly and characterful, crisp readable silhouettes that still read at 64 pixels. Every subject is a full-body side or three-quarter view, standing on nothing, with a small soft contact shadow only. Row 1, left to right: a house mouse, a hen chicken, a house cat sitting, a golden retriever. Row 2: an ostrich, a giant panda sitting, a silverback gorilla, a grizzly bear on all fours. Row 3: a polar bear on all fours, a horse, a black-and-white dairy cow, a giraffe. Row 4: a hippopotamus, an African elephant, a Tyrannosaurus rex, a blue whale. Each subject fills about 70% of its cell regardless of real size. Not neon, not cut paper, not ink printmaking or risograph. No text anywhere.

Things prompt: identical framing and style paragraph, with the subjects: Row 1, left to right: an adult person standing in casual clothes, a ripe yellow banana, a plain bank card with no text, a plain red soda can with no text. Row 2: a glossy bowling ball, a whole watermelon, a wooden front door in its frame, a black grand piano. Row 3: a small family hatchback car, a red double-decker bus with no text, a jumbo jet airliner in side view with no livery text, the ocean liner Titanic with four funnels. Row 4: the Statue of Liberty, the Eiffel Tower, the Great Pyramid of Giza, the Burj Khalifa skyscraper. Each subject fills about 70% of its cell regardless of real size; tall subjects stand upright and fill the cell height. No text, logos or numbers anywhere.

## Attempts

Logged below as images land.

| Image | Path | Result |
| --- | --- | --- |
| Cover A | `public/art/box-mundo-v1-a.png` (1254²) | Pass: title spelled right, readable at thumbnail size, full bleed. Brazil and Switzerland silhouettes nod to Sizes. **Chosen.** |
| Cover B | `public/art/box-mundo-v1-b.png` (1254²) | Pass on title and edges; softer gouache, but it paints two Eiffel towers. Kept for comparison. |
| Animals A | `public/art/sizes-animals-v1-a.png` (1254²) | Pass: all sixteen subjects in order, one per cell, no text. **Chosen.** |
| Animals B | `public/art/sizes-animals-v1-b.png` (1254²) | Pass; equally usable. Kept for comparison. |
| Things A | `public/art/sizes-things-v1-a.png` (1254²) | Pass on subjects, but the Titanic sits on painted water and the Burj Khalifa on a city base, which don't cut out cleanly. |
| Things B | `public/art/sizes-things-v1-b.png` (1254²) | Pass: sixteen clean, free-standing subjects, no legible text. **Chosen.** |

Delivery: `node scripts/optimize-sizes-sheets.mjs` floods the paper from the
border (so white fur survives), assigns each blob to the cell holding its
centre (tall towers poke over the quarter lines), and writes transparent,
evenly centred 1024² sheets to `public/art/optimized/sizes-{animals,things}-v1.webp`.
The chosen cover is copied to `public/art/box-mundo-blind-v1.png`.

## Retired (23 September 2026)

Mundo became Sabi with a new look; this cover and the gouache Sizes sheets are no longer served. Their files, and `scripts/optimize-sizes-sheets.mjs`, moved to `~/Documents/code/gamehub-art-archive/`. See [the Sabi notes](../2026-09-23-sabi/README.md).
