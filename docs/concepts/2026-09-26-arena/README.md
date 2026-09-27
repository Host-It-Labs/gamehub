# Arena textures and concepts (26 September 2026)

Generated with Codex image generation (`codex exec -m gpt-6-astra`, built-in `$imagegen`), one image per run, two variants each (`-a`, `-b`). Sources live in `assets/arena/textures/`; processed tiles are written to `public/3d/arena/` by `scripts/arena-textures.mjs`.

## Shared texture style paragraph

Use case: a production texture for a real-time 3D strategy game. Style: stylized hand-painted game texture in the tradition of premium painterly fantasy games, painted digitally at high resolution: confident visible brush strokes, rich but controlled natural colour, crisp readable shapes with soft painted shading, small painted highlights and dark accents in the crevices, sharp fine detail everywhere, no photographic noise, no blur, no smudged areas. Technical: one seamless tileable square texture. The left edge continues perfectly into the right edge and the top edge into the bottom edge, so the tile repeats without any visible seam. Even detail density over the whole square: no large single feature, no centre focus, no border, no frame, no vignette, no lighting gradient, no shadow cast across the tile, no perspective. Flat even light from straight above; viewed exactly face-on. No text, no letters, no watermark, no logo, no people, no objects cut off at the edges.

## grass

Subject: a lush, well-kept meadow lawn seen from directly above. Dense short grass painted as overlapping clusters of blade strokes in four greens (deep moss green in the shadows, fresh spring green, a lighter leaf green and sunlit yellow-green tips), a scattering of tiny clover leaves, and very occasional tiny white and pale yellow flowers the size of a few blades. The grass covers the whole tile evenly, no bare soil, no paths, no stones.

## path

Subject: a packed-earth footpath paved with small rounded flat cobblestones, seen from directly above. Fitted cobbles of mixed sizes (each about one tenth of the tile wide) in warm sandy beige, pale ochre and soft warm grey, each with a painted rounded top highlight and a darker lower edge, set in thin gaps of darker brown earth with fine gravel and a few tiny tufts of moss in some gaps. Stones cover the whole tile evenly.

## stone

Subject: a castle masonry wall of rectangular cut stone blocks laid in running bond, seen face-on. About six horizontal courses of blocks from top to bottom and three to four blocks per course, each block slightly different in size, weathered warm grey with cool blue-grey and pale ochre variation, chipped bevelled edges with painted highlights on the top edges and shadow under the bottom edges, thin recessed mortar lines, a few small cracks and tiny moss in some lower joints. The courses run perfectly horizontal and align across the left and right edges.

## roof

Subject: overlapping rounded roof shingles in neat horizontal rows, seen face-on. The shingles are a pale, almost white, neutral light grey (the game tints them with colour later), with strong painted shading: a dark shadow band under each row, a soft highlight along each rounded lower edge, slight variation in each shingle and a few small chips. About eight rows from top to bottom and seven shingles per row, rows offset by half a shingle.

## wood

Subject: weathered wooden planks laid side by side running vertically, seen face-on. Five planks across the tile, each a slightly different warm tone (honey, mid oak brown, a darker walnut), with long painted grain strokes, a few knots, thin dark gaps between planks, and small dark iron nail heads near the top and bottom of each plank. The planks run the full height and continue across the top and bottom edges.

## pebbles

Subject: a shallow clear riverbed of smooth rounded pebbles and stones seen from directly above. Stones of mixed sizes in sandy tan, slate blue-grey, olive and a few rusty red-brown ones, with glossy wet-look highlights, packed closely over fine sand. Even density over the whole tile.

## rock

Subject: a rough natural rock face of large fractured granite planes, seen face-on. Angular facets and cracks painted as clear flat planes of warm grey, cool blue-grey and a little ochre, with a lighter top face on each ledge, dark crack lines, and small spots of pale green and yellow lichen.

## forest

Subject: a woodland floor seen from directly above: deep green moss, patches of dark grass, fallen brown and ochre leaves, small fern fronds and a few thin roots, in deep greens and warm browns, slightly darker and richer than a lawn. Even density over the whole tile.

## foliage

Subject: dense stylized tree foliage seen face-on, filling the whole tile: overlapping clusters of painted leaves, each cluster shaded from a deep blue-green in its shadow to a bright yellow-green on its sunlit top edge, with small leaf-shaped highlight strokes. No branches, no sky, no gaps.

## bark

Subject: stylized tree bark seen face-on: vertical ridges and furrows of warm grey-brown and umber, with painted highlights on the ridge tops, dark furrows, and a few small patches of green moss. The ridges run vertically and continue across the top and bottom edges.

## cloth

Subject: a heavy woven linen canvas fabric seen face-on, off-white and very light warm grey (the game tints it later), with a clearly visible fine basket weave of threads, subtle slub threads and very slight painted variation. No folds, no creases, no pattern, no stains.

## metal

Subject: a hammered steel armour plate surface seen face-on: cool silver-grey with soft blue tints, many small shallow hammer dents each with a painted highlight and a shadow, fine scratches, a few tiny darker spots. Even over the whole tile, no rivets, no edges.

## leather

Subject: worn brown leather hide seen face-on: warm saddle brown with darker creases, fine pores, small scuffs and lighter worn areas painted with soft strokes. No stitching, no edges, no pattern.

## dirt

Subject: a sandy dirt riverbank seen from directly above: fine sandy soil in warm ochre and tan with small pebbles, dry cracks, a few tiny tufts of grass and small twigs, evenly spread.

## box-arena-square

```text
Use case: illustration-story. Create one original square full-bleed board-game library cover illustration. World: Arena, a real-time battle between two rival hill forts facing each other across a clear mountain stream in a sunlit highland meadow; each side has a big king tower and two smaller stone towers, two wooden bridges cross the stream, and small troops fight over the bridges. Style: stylized 3D fantasy miniature, like the key art of a premium strategy game: chunky, charming troops with big heads and bold readable silhouettes, hand-painted textures with visible brushwork on every surface (lush meadow grass, warm cut stone, honey-coloured wood planks, woven cloth, hammered steel), warm late-morning sunlight from the upper left with soft long shadows and a gentle glow, saturated but controlled palette of meadow greens, warm sandstone, slate grey and honey wood; the near side is the blue team (cobalt blue cloth and roofs with brass trim), the far side is the red team (crimson cloth and roofs with bronze trim). Original designs, not any existing game, franchise or logo. Not flat vector art, not cel-shaded outlines, not cut paper, not ink printmaking, not photoreal. Composition: a dramatic slightly high three-quarter view along the stream: a sturdy blue-roofed stone tower with a cobalt banner in the near foreground on one side, a crimson-roofed tower across the water, a wooden bridge in the middle where a steel-helmeted blue knight with a round shield clashes with a big grey-green red-team ogre swinging a club, a small winged orange drake breathing a puff of fire above them, a hooded blue archer loosing an arrow from the near bank, sparkles of spray on the stream. Big simple shapes that read at thumbnail size. Title: the exact sole text "Arena" (capital A, lowercase r e n a), rendered yourself as big bold chiselled stone display lettering with warm gold bevelled edges, placed across the upper third of the picture over the sky and distant hills, unmistakably readable when the cover is shown 140 pixels wide. No tiny print, no subtitle, no other text, glyphs or letters anywhere; every banner and shield is blank or carries a simple non-letter emblem. Format: one square image, 1024x1024 PNG, largest native square size, highest quality, no watermark. No border, no mat, no frame, no vignette, no gray padding, no box mockup, no perspective packaging, no UI, no game screenshot, no buttons, no counters, no health bars. Artwork fills all four edges. Fresh composition from this text only; no input or reference images.
```

## box-arena-wide

```text
Use case: illustration-story. Create one original wide full-bleed board-game cover banner illustration. World: Arena, a real-time battle between two rival hill forts facing each other across a clear mountain stream in a sunlit highland meadow; each side has a big king tower and two smaller stone towers, two wooden bridges cross the stream, and small troops fight over the bridges. Style: stylized 3D fantasy miniature, like the key art of a premium strategy game: chunky, charming troops with big heads and bold readable silhouettes, hand-painted textures with visible brushwork on every surface (lush meadow grass, warm cut stone, honey-coloured wood planks, woven cloth, hammered steel), warm late-morning sunlight from the upper left with soft long shadows and a gentle glow, saturated but controlled palette of meadow greens, warm sandstone, slate grey and honey wood; the near side is the blue team (cobalt blue cloth and roofs with brass trim), the far side is the red team (crimson cloth and roofs with bronze trim). Original designs, not any existing game, franchise or logo. Not flat vector art, not cel-shaded outlines, not cut paper, not ink printmaking, not photoreal. Panoramic composition seen from the side at a slightly high angle: the stream runs horizontally across the whole width with a wooden bridge on each side of the title; the blue team's stone tower with a cobalt roof and banner stands at the far left, the red team's crimson-roofed tower at the far right; on the left bridge a blue knight with a round shield braces against a big grey-green ogre, on the right bridge blue archers trade arrows with red imps, a small orange winged drake glides low over the water beside the title. The top quarter is plain soft blue sky with a few painted clouds and distant hills; the bottom quarter is plain meadow grass and the stream's pebbly near bank. Format: one wide landscape image, 1536x1024 PNG, largest native landscape size, highest quality, no watermark. CROP RULE, check it before drawing: this picture will be cut down to a 3:1 strip that keeps only the middle half of its height, from 25% to 75% down from the top edge; the top quarter and the bottom quarter are thrown away. Compose for that strip. The title and every meaningful subject must lie completely inside the central horizontal band from 30% to 70% of the image height, and horizontally between 6% and 94% of the width. The top quarter and the bottom quarter of the picture are expendable continuation only: plain background that simply carries on (sky, ground, water) with nothing important in them: no title letters, no heads, no key objects, no tops of towers. If a tall thing would poke into the top quarter, make it lower and wider instead. Think of a long cinematic panorama banner: the world spreads horizontally across the whole width, with subjects arranged to the left and to the right of the title along one horizontal line, never a square composition padded out with empty sides. The title sits in the middle third of the width, and its capital letters are about one quarter of the whole picture height tall (about half the height of the kept strip), so the title occupies roughly 37% to 63% down from the top. Exact sole text: "Arena" (capital A, lowercase r e n a). Render it yourself as enormous bold chiselled stone display lettering with warm gold bevelled edges integrated into the scene, unmistakably readable when the whole strip is shown only 390 pixels wide. No tiny print, no subtitle, no other text, glyphs or letters anywhere; every banner and shield is blank. No border, no mat, no frame, no vignette, no gray padding, no box mockup, no perspective packaging, no UI, no game screenshot, no buttons, no counters, no health bars. Artwork fills all four edges. Fresh composition from this text only; no input or reference images.
```

## troops-lineup

```text
Use case: character design reference sheet for 3D modelling. World: Arena, a real-time battle between two rival hill forts facing each other across a clear mountain stream in a sunlit highland meadow; each side has a big king tower and two smaller stone towers, two wooden bridges cross the stream, and small troops fight over the bridges. Style: stylized 3D fantasy miniature, like the key art of a premium strategy game: chunky, charming troops with big heads and bold readable silhouettes, hand-painted textures with visible brushwork on every surface (lush meadow grass, warm cut stone, honey-coloured wood planks, woven cloth, hammered steel), warm late-morning sunlight from the upper left with soft long shadows and a gentle glow, saturated but controlled palette of meadow greens, warm sandstone, slate grey and honey wood; the near side is the blue team (cobalt blue cloth and roofs with brass trim), the far side is the red team (crimson cloth and roofs with bronze trim). Original designs, not any existing game, franchise or logo. Not flat vector art, not cel-shaded outlines, not cut paper, not ink printmaking, not photoreal. Show eight original troop characters standing side by side in one row on a plain flat warm light-grey background, full body, three-quarter front view, even soft studio light, all at a consistent scale, each clearly separated with space between them, all on the blue team (cobalt blue cloth accents). Chibi proportions: the head is about one third of the body height for the humanoids. From left to right: 1 Knight: sturdy, full rounded steel helmet with a T-shaped visor slit and a short blue plume, round wooden shield with a steel rim and boss, short broadsword, chainmail shirt under a blue tabard, leather boots. 2 Archer: young, a blue hooded short cloak, short curved bow, quiver of arrows on the back, leather bracers, soft boots, a friendly face. 3 Ogre: huge, twice the Knight's height and very broad, grey-green skin, small tusks, bald head with a topknot, leather shoulder strap, blue cloth loincloth, bare feet, carrying a big wooden club. 4 Imp: tiny, half the Knight's height, a mischievous goblin-like creature with long pointed ears, olive-green skin, big eyes, a blue rag tunic and a small curved dagger. 5 Duelist: lean fighter in dark blued steel plate armour with a closed helmet and a single glowing slit, a long two-handed greatsword held ready. 6 Ranger: wide-brimmed leather hat with a feather, a long coat, a blue scarf, a wooden crossbow, a bolt pouch. 7 Drake: a small winged dragon hovering, orange-red scales, cream belly plates, bat-like wings, stubby horns, big friendly eyes. 8 Mage: a robed wizard with a tall blue pointed hat, a long white beard, blue robe with gold trim, holding a gnarled staff topped with a glowing fire orb. Clean readable shapes, simple large forms suited to a small real-time strategy game miniature, hand-painted texture detail on cloth, steel, leather and skin. No text, no labels, no numbers, no weapons crossing other characters. Format: one wide landscape image, 1536x1024 PNG, highest quality, no watermark. Fresh composition from this text only; no input or reference images.
```

## Card portraits

Shared paragraph:

```text
Use case: the portrait art on a playing card in the hand of a real-time fantasy strategy game. Style: stylized 3D fantasy miniature like premium strategy-game key art: a chunky, charming character with a big head and a bold readable silhouette, hand-painted textures with visible brushwork on cloth, steel, leather and skin, warm late-morning sunlight from the upper left with a bright rim light on the right edge, saturated but controlled colour. The character belongs to the blue team: cobalt blue cloth accents with brass trim. Composition: one square picture; the character, seen in three-quarter view turned slightly to the right, fills most of the frame from the waist or chest up (the whole creature for small creatures), large and centred, with its weapon clearly visible; behind it a softly blurred sunny meadow, stone wall and sky in warm greens and blues, darker at the corners so the character pops. Original design, not from any existing game or franchise. No text, no letters, no numbers, no card frame, no border, no gem, no icon, no UI, no watermark. Format: square 1024x1024 PNG, highest quality.
```

- **knight**: The Knight: sturdy, a full rounded steel helmet with a T-shaped visor slit and a short blue plume, a round wooden shield with a steel rim and boss, a short broadsword raised, chainmail under a blue tabard with brass trim.

- **archers**: The Archer: a young friendly archer with a blue hooded short cloak, drawing a short curved bow with an arrow nocked, a quiver of arrows on the back, leather bracers.

- **ogre**: The Ogre: a huge, broad, good-natured but fierce ogre with grey-green skin, small tusks, a bald head with a black topknot, a leather shoulder strap, a blue cloth loincloth edge, resting a big spiked wooden club on the shoulder.

- **imps**: The Imps: three tiny mischievous goblin-like imps with long pointed ears, olive-green skin, big eyes and grins, blue rag tunics, each with a small curved dagger, bunched together, the front one biggest.

- **duelist**: The Duelist: a lean fighter in dark blued steel plate armour with brass edges, a closed helmet with a single glowing orange eye slit, a blue scarf, holding a long two-handed greatsword ready across the body.

- **ranger**: The Ranger: a bearded ranger with a wide-brimmed leather hat with a blue feather, a long brown coat, a blue scarf, aiming a wooden crossbow with a loaded bolt.

- **drake**: The Drake: a small young winged dragon with orange-red scales, cream belly plates, bat-like wings spread, stubby horns and big friendly eyes, breathing a small puff of flame.

- **mage**: The Mage: an old robed wizard with a tall blue pointed hat with a brass band, a long white beard, a blue robe with gold trim, holding a gnarled staff topped with a glowing fire orb and conjuring a flame in the other hand.

## Picks (26 September 2026)

- **Textures** (sources in `assets/arena/textures/`, choices in
  `scripts/arena-textures.mjs`): grass b, path a, stone b, roof b, wood a,
  pebbles b, rock b, forest b, foliage b, bark a, cloth a, metal b,
  leather b, dirt b. All generated at 1254 px, near-seamless; the script
  blends any leftover seam per axis and derives normal and AO/roughness maps.
- **Library covers**: square `box-arena-square-v1-b` (simpler shapes that read
  at thumbnail size), wide `box-arena-wide-v1-a` (title framed by a banner,
  subjects inside the kept 3:1 band). Title spelling checked on both.
- **Card portraits**: variant a for all eight cards (`assets/arena/cards/`).
- **Troop line-up** (`assets/arena/concepts/troops-lineup-v1-{a,b}.png`) is a
  modelling reference only; it is not shipped. The troops themselves are
  Blender code in `assets/arena/blender/troop_*.py`.
