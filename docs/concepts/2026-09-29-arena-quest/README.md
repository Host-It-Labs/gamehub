# Arena Quest art: prompts and attempts (29 September 2026)

Art for the brief in [brief.md](brief.md): card portraits for the eight new troops, the loading screen and the three Quest map backgrounds. Every image is a fresh generation from text only, two variants (a, b) per image, one image per run, all launched in parallel with `codex exec -m gpt-6-luna -c model_reasoning_effort="low"` (Codex CLI 0.157.1) and the built-in `$imagegen` tool, using the wrapper in `.claude/skills/artwork/SKILL.md` (call the tool once, print only `output_hint`, copy to the target path). Each saved file is checked afterwards against the single PNG in its own Codex session folder.

## Card portraits v5 for the new troops

Same style as the accepted v5 cards (docs/concepts/2026-09-26-arena-retheme/README.md, "Card portraits v5"). Each card prompt is sent as: the shared paragraph, a space, the subject paragraph, a space, then "Fresh image from this text only; no input or reference images." The shared paragraph is the v5 one, verbatim.

Shared paragraph:

```text
Use case: the square portrait art on a playing card in the hand of a real-time battle game. Style: polished stylised cartoon character art, like the card portraits of a high-quality mobile strategy card game: bold, chunky, exaggerated cartoon proportions (big hands, broad shoulders, slightly large heads, sturdy simple shapes), big readable silhouettes and a very expressive face with a clear, lively expression. Clean hand-painted cartoon rendering with soft cel-like shading in two or three tones per colour, a crisp dark outline feel around the forms, simple smooth colour areas and only the key details, bright highlights on edges, saturated but tasteful colour. Not photoreal, not a glossy 3D render, not a detailed miniature, not a toy, not realistic anatomy, no photographic texture, no film grain, no fine micro detail, no clutter; also not childlike toddler art, not a baby or chibi mascot: confident, characterful and a little heroic or funny. Framing: the character is huge in the frame, centred, and fills it (about 85 to 90 percent of the frame height, head and upper body or the full figure fitted), instantly readable when the card is shown only 90 pixels wide. Keep the top-left corner (about one fifth of the width and height) free of faces and signature items: a cost badge covers it. Background: a simple painterly cartoon backdrop of the character's own era (described below), a few big soft shapes and a smooth colour gradient, lower contrast and slightly darker toward the edges so the character pops. The team colour is a strong cobalt blue. Original design, not any existing game, film, brand or franchise. No text, no letters, no numbers, no writing on anything, no card frame, no border, no icon, no UI, no logo, no watermark, no display base. Square 1024x1024 PNG, highest quality.
```

- **pirate** (`card-pirate-v5-{a,b}.png`):

  ```text
  Subject: ONE swaggering Afro-Caribbean pirate woman from the golden age of sail, the only figure in the picture, framed from the knees up in a bold, cocky stance, a curved cutlass raised in her right hand with the blade angled up toward the viewer's right, away from the top-left corner, and a flintlock pistol tucked in her sash; a black tricorne hat worn over a cobalt-blue bandana, one long braid hanging over her shoulder, a gold hoop earring, a daring, confident grin; a white shirt with rolled sleeves, a striped cobalt-and-cream sash, a long dark waistcoat (a waistcoat, not a coat), dark trousers and the tops of tall black knee boots. Background: a Caribbean harbour with turquoise water, a few palm trees and a big galleon at anchor with furled sails, painted simply.
  ```

- **viking** (`card-viking-v5-{a,b}.png`):

  ```text
  Subject: ONE big, broad Norse viking warrior man, the only figure in the picture, framed from the thighs up, holding a long two-handed bearded axe diagonally across his body in both hands, the axe head toward the upper right, away from the top-left corner, the whole axe head inside the frame; a plain round iron helmet with a nose guard and absolutely no horns, no wings and no crest on it; a huge braided ginger beard, bushy ginger eyebrows and a fierce, roaring battle grin; fur-trimmed shoulders, a cobalt-blue tunic, a wide leather belt and cloth-wrapped legs. Background: a Norwegian fjord with steep green cliffs and calm water, a dragon-prowed longship with a striped sail, painted simply.
  ```

- **gladiator** (`card-gladiator-v5-{a,b}.png`):

  ```text
  Subject: ONE North African Roman gladiator man, the only figure in the picture, framed from the thighs up in a strong guarding stance, a tall curved rectangular cobalt-blue shield with a round bronze boss held on his left arm and a short straight sword held ready in his right hand; an open-faced crested bronze helmet with a tall cobalt-blue plume, his determined, proud face clearly visible under the brim; a broad bare chest with a leather shoulder strap, a leather arm guard on his sword arm, a pleated kilt of leather strips, sandals with bronze greaves. Background: a sunlit Roman arena with a golden sand floor and tiered stone arches under a warm sky, painted simply.
  ```

- **medic** (`card-medic-v5-{a,b}.png`):

  ```text
  Subject: ONE South Asian woman field medic from the 1940s, the only figure in the picture, framed from the thighs up, raising a glowing green tonic flask high in her right hand toward the upper right, away from the top-left corner, with a soft green glow around it; a kind, determined, encouraging smile; a cream cap and a cream armband, each marked with a plain GREEN cross (the cross is green, never red; there is no red cross anywhere in the picture); a khaki shirt, a khaki skirt worn over khaki trousers, a big brown leather satchel on a strap across her body. She carries no weapon. Background: a 1940s canvas field hospital tent in a green summer meadow, a few folding cots under the open tent flap, painted simply.
  ```

- **miner** (`card-miner-v5-{a,b}.png`):

  ```text
  Subject: ONE cheerful, stocky Latino miner man from the early 1900s, the only figure in the picture, framed from the thighs up, a pickaxe resting on his right shoulder with its head behind him to the right, away from the top-left corner; a hard hat with a glowing brass headlamp, a big bushy black moustache, a broad cheerful grin and dusty cheeks; a dusty cobalt-blue shirt with rolled sleeves, denim dungarees with suspenders, heavy work boots. Background: a timber-framed mine entrance in a rocky hillside with rails running into the dark tunnel, a small ore cart and warm hanging lanterns, painted simply.
  ```

- **balloon** (`card-balloon-v5-{a,b}.png`):

  ```text
  Subject: ONE hot-air balloon, the only aircraft in the picture, large in the frame and slightly right of centre so the top-left corner shows open sky; the round envelope has bold vertical stripes of cobalt blue and cream under rope netting, and below it hangs a wicker basket with sandbags tied round its rim and a small rack of round black bombs on its side; the basket and its passenger are big, taking about the lower third of the frame. In the basket ONE white-haired elderly aviatrix woman with round brass goggles and a long scarf fluttering in the wind, a mischievous, gleeful grin, leaning over the rim with a round black bomb in her hands, about to drop it. Background: open blue sky with big soft cartoon clouds above a patchwork countryside of green and golden fields and hedgerows far below.
  ```

- **inventor** (`card-inventor-v5-{a,b}.png`):

  ```text
  Subject: ONE young Black woman inventor in a 1950s retro-futurist style, the only figure in the picture, framed from the thighs up, pointing a copper zapper wand toward the upper right, away from the top-left corner, with a crackle of blue-white lightning arcing from its tip; big brass goggles pushed up on her forehead, two round hair puffs, an excited, clever grin; a white lab coat, cobalt-blue gloves, and a backpack Tesla coil rising above her right shoulder with a glowing ball on top. Background: a crackling inventor's workshop with tall Tesla coils throwing little arcs, workbenches and copper pipes in a dim blue light, painted simply.
  ```

- **gunner** (`card-gunner-v5-{a,b}.png`):

  ```text
  Subject: ONE Napoleonic-era artilleryman with big bushy grey sideburns, the only figure in the picture, framed as a full figure together with his gun, leaning into pushing a small bronze field cannon on two wooden spoked wheels toward the viewer's right, the man and the cannon both large and fully inside the frame; a gruff, determined grin; a tall black shako with a cobalt-blue plume, a short dark navy jacket (short, not a long coat) with cobalt-blue cuffs and gold epaulettes, white trousers and black gaiters. Background: the grassy earthen rampart of a star fort with angled stone bastion walls and drifting white powder smoke under a pale sky, painted simply.
  ```

## Loading screen v1

Full prompts, exactly as sent (both variants of an orientation use the same prompt).

### loading-wide-v1 (`assets/arena/concepts/loading-wide-v1-{a,b}.png`)

```text
Use case: illustration-story; the full-screen loading illustration of a real-time tower-battle game called Arena. Style: polished stylised cartoon art, like the key art of a high-quality mobile strategy card game: bold, chunky, exaggerated cartoon proportions (big hands, broad shoulders, slightly large heads, sturdy simple shapes), big readable silhouettes and very expressive faces with clear, lively expressions. Clean hand-painted cartoon rendering with soft cel-like shading in two or three tones per colour, a crisp dark outline feel around the forms, simple smooth colour areas and only the key details, bright highlights on edges, saturated but tasteful warm colour, warm late-afternoon sunlight from the upper left. Not photoreal, not a glossy 3D render, not a detailed miniature, not a toy, not realistic anatomy, no photographic texture, no film grain, no fine micro detail, no clutter; also not childlike toddler art, not baby or chibi mascots: confident, characterful and a little heroic or funny. Original design, not any existing game, film, brand or franchise. Scene: a bright, warm cartoon valley battlefield seen from a gentle high angle: rolling green grass, a sparkling blue river running across the valley with a chunky stone arch bridge in the middle, a squat blue castle tower with a cobalt-blue roof and banner on the left side and a matching squat red castle tower with a red roof and banner on the right side, clumps of round cartoon trees at the edges, a warm sky with big soft clouds. A dynamic crowd of cartoon characters from different eras charges at each other toward the bridge. Blue team, charging from the left: a samurai in chunky navy-blue lacquered armour with a big golden horned crest, raising a katana; a bearded wizard in a cobalt-blue robe and a tall pointed cobalt hat, raising a staff crowned by a glowing orange crystal; exactly two 1960s retro space cadets in off-white suits with cobalt-blue panels and clear glass bubble helmets, firing chunky chrome ray guns; an Afro-Caribbean pirate woman in a black tricorne hat and cobalt bandana leaping forward with a cutlass; and above them a hot-air balloon with cobalt-and-cream stripes, a white-haired goggled aviatrix in its wicker basket. Red team, charging from the right: a big cartoon tyrannosaurus rex with a red hide roaring with its jaw open; an 1880s cowboy in a wide-brimmed brown hat and a long sand-coloured duster over a red shirt, aiming a lever-action rifle; a few small tin wind-up robots in red enamel with chrome wind-up keys on their backs; a big broad viking with a plain round iron helmet with a nose guard (no horns), a braided ginger beard and a long two-handed axe; a North African Roman gladiator with a crested bronze helmet, a red plume and a tall red shield; and a red First World War biplane swooping low overhead. Every character is distinct, readable and full of energy, with lively cartoon faces. Title: the exact sole text "Arena" (capital A, lowercase r e n a), rendered yourself as big chunky custom cartoon lettering in warm gold with a thick dark outline and a soft warm glow around it, integrated into the composition, unmistakably readable. No other text, letters, numbers or glyphs anywhere; banners, shields and flags are blank or carry a simple non-letter shape. The title sits in the upper middle of the picture, over the sky and the far hills, its letters about one fifth of the picture height tall. Composition: the title between about 6% and 30% down from the top edge; the towers, bridge and charging crowd in the middle band, from about 25% to 76% down; the bottom 22% of the picture is calm: only soft grass and a quiet river bank, simple and low in contrast, with no faces, no characters, no title and no important detail there, because a progress bar will sit over it. Format: one wide landscape image at the largest native landscape size the image tool offers (1536x1024 or larger), PNG, highest quality. No border, no frame, no vignette, no gray padding, no UI, no buttons, no progress bar, no health bars, no counters, no icons, no logo other than the title, no watermark, no game screenshot. Artwork fills all four edges. Fresh composition from this text only; no input or reference images.
```

### loading-tall-v1 (`assets/arena/concepts/loading-tall-v1-{a,b}.png`)

```text
Use case: illustration-story; the full-screen loading illustration, for a phone held upright, of a real-time tower-battle game called Arena. Style: polished stylised cartoon art, like the key art of a high-quality mobile strategy card game: bold, chunky, exaggerated cartoon proportions (big hands, broad shoulders, slightly large heads, sturdy simple shapes), big readable silhouettes and very expressive faces with clear, lively expressions. Clean hand-painted cartoon rendering with soft cel-like shading in two or three tones per colour, a crisp dark outline feel around the forms, simple smooth colour areas and only the key details, bright highlights on edges, saturated but tasteful warm colour, warm late-afternoon sunlight from the upper left. Not photoreal, not a glossy 3D render, not a detailed miniature, not a toy, not realistic anatomy, no photographic texture, no film grain, no fine micro detail, no clutter; also not childlike toddler art, not baby or chibi mascots: confident, characterful and a little heroic or funny. Original design, not any existing game, film, brand or franchise. Scene: a bright, warm cartoon valley battlefield seen from a gentle high angle: rolling green grass, a sparkling blue river winding through the valley with a chunky stone arch bridge in the centre of the picture, a squat blue castle tower with a cobalt-blue roof and banner near the left edge and a matching squat red castle tower with a red roof and banner near the right edge, clumps of round cartoon trees, a warm sky with big soft clouds at the top. A dynamic crowd of cartoon characters from different eras charges at each other toward the bridge, packed into the middle of the tall picture. Blue team, charging from the left: a samurai in chunky navy-blue lacquered armour with a big golden horned crest, raising a katana; a bearded wizard in a cobalt-blue robe and a tall pointed cobalt hat, raising a staff crowned by a glowing orange crystal; exactly two 1960s retro space cadets in off-white suits with cobalt-blue panels and clear glass bubble helmets, firing chunky chrome ray guns; an Afro-Caribbean pirate woman in a black tricorne hat and cobalt bandana leaping forward with a cutlass; and above them a hot-air balloon with cobalt-and-cream stripes, a white-haired goggled aviatrix in its wicker basket. Red team, charging from the right: a big cartoon tyrannosaurus rex with a red hide roaring with its jaw open; an 1880s cowboy in a wide-brimmed brown hat and a long sand-coloured duster over a red shirt, aiming a lever-action rifle; a few small tin wind-up robots in red enamel with chrome wind-up keys on their backs; a big broad viking with a plain round iron helmet with a nose guard (no horns), a braided ginger beard and a long two-handed axe; a North African Roman gladiator with a crested bronze helmet, a red plume and a tall red shield; and a red First World War biplane swooping low overhead. Every character is distinct, readable and full of energy, with lively cartoon faces. Title: the exact sole text "Arena" (capital A, lowercase r e n a), rendered yourself as big chunky custom cartoon lettering in warm gold with a thick dark outline and a soft warm glow around it, integrated into the composition, unmistakably readable. No other text, letters, numbers or glyphs anywhere; banners, shields and flags are blank or carry a simple non-letter shape. The title sits in the upper middle of the picture, over the sky, spanning most of the width, its letters about one eighth of the picture height tall. Composition: the title between about 6% and 24% down from the top edge; the towers, bridge and charging crowd in the middle band, from about 22% to 76% down; the bottom 22% of the picture is calm: only soft grass and a quiet river bank, simple and low in contrast, with no faces, no characters, no title and no important detail there, because a progress bar will sit over it. Format: one tall portrait image at the largest native portrait size the image tool offers (1024x1536 or larger), PNG, highest quality. No border, no frame, no vignette, no gray padding, no UI, no buttons, no progress bar, no health bars, no counters, no icons, no logo other than the title, no watermark, no game screenshot. Artwork fills all four edges. Fresh composition from this text only; no input or reference images.
```

## Quest map backgrounds v1

Full prompts, exactly as sent (both variants use the same prompt). Region 1 Greenwood, 2 Sunstone, 3 Frostpeak.

### quest-map-1-wide-v1 (`assets/arena/concepts/quest-map-1-wide-v1-{a,b}.png`)

```text
Use case: the background of a roguelite quest map screen in a cartoon strategy game. Style: a painted cartoon fantasy map landscape in a warm, polished stylised cartoon style, like the world map of a high-quality mobile strategy game: bold, chunky, simple shapes, clean hand-painted rendering with soft cel-like shading in two or three tones per colour, a crisp dark outline feel around the forms, simple smooth colour areas and only the key details, bright highlights on edges, saturated but tasteful warm colour, bright but never washed out or pale, with good depth. Seen from high above at a slight angle, like a tilted bird's-eye view over a small painted world, soft warm sunlight from the upper left with gentle shadows. Not photoreal, not a 3D render, not a satellite photo, not a parchment map, not flat vector art, not an isometric tile grid, no photographic texture, no film grain, no fine micro detail, no clutter. Original design, not any existing game, film, brand or franchise. Region: Greenwood, a gentle green starting land: rolling bright meadows, small round woods of chunky cartoon trees, a winding blue river and a little wooden windmill with white sails, a few hedgerows and wildflower patches. Composition: the woods, the windmill and the denser features sit around the edges and corners; the river winds along the lower-left and left edge rather than through the centre. The middle of the picture, roughly the central 60% of the width and 60% of the height, is calm, open ground of the region with only gentle, low-contrast variation (soft grass, sand or snow), no landmarks and no strong shapes, because a path of round map markers will be drawn over it later. Format: one wide landscape image at the largest native landscape size the image tool offers (1536x1024 or larger), PNG, highest quality. Nothing may be drawn that looks like a route: no roads, no paths, no trails, no dotted lines, no bridges across the middle, no markers, no pins, no flags, no nodes, no circles, no numbers, no text, no letters, no labels, no compass rose, no legend, no scale bar, no frame, no border, no parchment edge, no torn edges, no vignette, no people, no characters, no animals, no UI, no watermark. Artwork fills all four edges. Fresh composition from this text only; no input or reference images.
```

### quest-map-1-tall-v1 (`assets/arena/concepts/quest-map-1-tall-v1-{a,b}.png`)

```text
Use case: the background of a roguelite quest map screen in a cartoon strategy game. Style: a painted cartoon fantasy map landscape in a warm, polished stylised cartoon style, like the world map of a high-quality mobile strategy game: bold, chunky, simple shapes, clean hand-painted rendering with soft cel-like shading in two or three tones per colour, a crisp dark outline feel around the forms, simple smooth colour areas and only the key details, bright highlights on edges, saturated but tasteful warm colour, bright but never washed out or pale, with good depth. Seen from high above at a slight angle, like a tilted bird's-eye view over a small painted world, soft warm sunlight from the upper left with gentle shadows. Not photoreal, not a 3D render, not a satellite photo, not a parchment map, not flat vector art, not an isometric tile grid, no photographic texture, no film grain, no fine micro detail, no clutter. Original design, not any existing game, film, brand or franchise. Region: Greenwood, a gentle green starting land: rolling bright meadows, small round woods of chunky cartoon trees, a winding blue river and a little wooden windmill with white sails, a few hedgerows and wildflower patches. Composition: the woods, the windmill and the denser features sit around the edges and corners; the river winds along the left edge rather than through the centre. The middle of the picture, roughly the central 60% of the width and 65% of the height, is calm, open ground of the region with only gentle, low-contrast variation (soft grass, sand or snow), no landmarks and no strong shapes, because a path of round map markers will be drawn over it later from the bottom to the top. Format: one tall portrait image at the largest native portrait size the image tool offers (1024x1536 or larger), PNG, highest quality. Nothing may be drawn that looks like a route: no roads, no paths, no trails, no dotted lines, no bridges across the middle, no markers, no pins, no flags, no nodes, no circles, no numbers, no text, no letters, no labels, no compass rose, no legend, no scale bar, no frame, no border, no parchment edge, no torn edges, no vignette, no people, no characters, no animals, no UI, no watermark. Artwork fills all four edges. Fresh composition from this text only; no input or reference images.
```

### quest-map-2-wide-v1 (`assets/arena/concepts/quest-map-2-wide-v1-{a,b}.png`)

```text
Use case: the background of a roguelite quest map screen in a cartoon strategy game. Style: a painted cartoon fantasy map landscape in a warm, polished stylised cartoon style, like the world map of a high-quality mobile strategy game: bold, chunky, simple shapes, clean hand-painted rendering with soft cel-like shading in two or three tones per colour, a crisp dark outline feel around the forms, simple smooth colour areas and only the key details, bright highlights on edges, saturated but tasteful warm colour, bright but never washed out or pale, with good depth. Seen from high above at a slight angle, like a tilted bird's-eye view over a small painted world, soft warm sunlight from the upper left with gentle shadows. Not photoreal, not a 3D render, not a satellite photo, not a parchment map, not flat vector art, not an isometric tile grid, no photographic texture, no film grain, no fine micro detail, no clutter. Original design, not any existing game, film, brand or franchise. Region: Sunstone, a warm desert canyon land: flat-topped orange and red mesas with layered stripes, a dry, cracked sandy riverbed, chunky green cacti, sun-bleached ancient stone ruins with broken columns and arches, warm golden sand. Composition: the mesas, ruins and cactus groves sit around the edges and corners; the dry riverbed runs along the lower edge rather than through the centre. The middle of the picture, roughly the central 60% of the width and 60% of the height, is calm, open ground of the region with only gentle, low-contrast variation (soft grass, sand or snow), no landmarks and no strong shapes, because a path of round map markers will be drawn over it later. Format: one wide landscape image at the largest native landscape size the image tool offers (1536x1024 or larger), PNG, highest quality. Nothing may be drawn that looks like a route: no roads, no paths, no trails, no dotted lines, no bridges across the middle, no markers, no pins, no flags, no nodes, no circles, no numbers, no text, no letters, no labels, no compass rose, no legend, no scale bar, no frame, no border, no parchment edge, no torn edges, no vignette, no people, no characters, no animals, no UI, no watermark. Artwork fills all four edges. Fresh composition from this text only; no input or reference images.
```

### quest-map-2-tall-v1 (`assets/arena/concepts/quest-map-2-tall-v1-{a,b}.png`)

```text
Use case: the background of a roguelite quest map screen in a cartoon strategy game. Style: a painted cartoon fantasy map landscape in a warm, polished stylised cartoon style, like the world map of a high-quality mobile strategy game: bold, chunky, simple shapes, clean hand-painted rendering with soft cel-like shading in two or three tones per colour, a crisp dark outline feel around the forms, simple smooth colour areas and only the key details, bright highlights on edges, saturated but tasteful warm colour, bright but never washed out or pale, with good depth. Seen from high above at a slight angle, like a tilted bird's-eye view over a small painted world, soft warm sunlight from the upper left with gentle shadows. Not photoreal, not a 3D render, not a satellite photo, not a parchment map, not flat vector art, not an isometric tile grid, no photographic texture, no film grain, no fine micro detail, no clutter. Original design, not any existing game, film, brand or franchise. Region: Sunstone, a warm desert canyon land: flat-topped orange and red mesas with layered stripes, a dry, cracked sandy riverbed, chunky green cacti, sun-bleached ancient stone ruins with broken columns and arches, warm golden sand. Composition: the mesas, ruins and cactus groves sit around the edges and corners; the dry riverbed runs along the right edge rather than through the centre. The middle of the picture, roughly the central 60% of the width and 65% of the height, is calm, open ground of the region with only gentle, low-contrast variation (soft grass, sand or snow), no landmarks and no strong shapes, because a path of round map markers will be drawn over it later from the bottom to the top. Format: one tall portrait image at the largest native portrait size the image tool offers (1024x1536 or larger), PNG, highest quality. Nothing may be drawn that looks like a route: no roads, no paths, no trails, no dotted lines, no bridges across the middle, no markers, no pins, no flags, no nodes, no circles, no numbers, no text, no letters, no labels, no compass rose, no legend, no scale bar, no frame, no border, no parchment edge, no torn edges, no vignette, no people, no characters, no animals, no UI, no watermark. Artwork fills all four edges. Fresh composition from this text only; no input or reference images.
```

### quest-map-3-wide-v1 (`assets/arena/concepts/quest-map-3-wide-v1-{a,b}.png`)

```text
Use case: the background of a roguelite quest map screen in a cartoon strategy game. Style: a painted cartoon fantasy map landscape in a warm, polished stylised cartoon style, like the world map of a high-quality mobile strategy game: bold, chunky, simple shapes, clean hand-painted rendering with soft cel-like shading in two or three tones per colour, a crisp dark outline feel around the forms, simple smooth colour areas and only the key details, bright highlights on edges, saturated but tasteful warm colour, bright but never washed out or pale, with good depth. Seen from high above at a slight angle, like a tilted bird's-eye view over a small painted world, soft warm sunlight from the upper left with gentle shadows. Not photoreal, not a 3D render, not a satellite photo, not a parchment map, not flat vector art, not an isometric tile grid, no photographic texture, no film grain, no fine micro detail, no clutter. Original design, not any existing game, film, brand or franchise. Region: Frostpeak, a cold final land: snowy mountains with icy blue shadows, dark green snow-dusted pine forests, a smooth frozen lake, and on the highest peak a distant dark fortress of black stone with sharp towers and a faint ominous purple glow, the home of the final boss. Composition: the mountains and pine forests sit around the edges and corners; the frozen lake lies near the lower-left corner; the highest peak with the dark fortress rises at the upper right, small and distant. The middle of the picture, roughly the central 60% of the width and 60% of the height, is calm, open ground of the region with only gentle, low-contrast variation (soft grass, sand or snow), no landmarks and no strong shapes, because a path of round map markers will be drawn over it later. Format: one wide landscape image at the largest native landscape size the image tool offers (1536x1024 or larger), PNG, highest quality. Nothing may be drawn that looks like a route: no roads, no paths, no trails, no dotted lines, no bridges across the middle, no markers, no pins, no flags, no nodes, no circles, no numbers, no text, no letters, no labels, no compass rose, no legend, no scale bar, no frame, no border, no parchment edge, no torn edges, no vignette, no people, no characters, no animals, no UI, no watermark. Artwork fills all four edges. Fresh composition from this text only; no input or reference images.
```

### quest-map-3-tall-v1 (`assets/arena/concepts/quest-map-3-tall-v1-{a,b}.png`)

```text
Use case: the background of a roguelite quest map screen in a cartoon strategy game. Style: a painted cartoon fantasy map landscape in a warm, polished stylised cartoon style, like the world map of a high-quality mobile strategy game: bold, chunky, simple shapes, clean hand-painted rendering with soft cel-like shading in two or three tones per colour, a crisp dark outline feel around the forms, simple smooth colour areas and only the key details, bright highlights on edges, saturated but tasteful warm colour, bright but never washed out or pale, with good depth. Seen from high above at a slight angle, like a tilted bird's-eye view over a small painted world, soft warm sunlight from the upper left with gentle shadows. Not photoreal, not a 3D render, not a satellite photo, not a parchment map, not flat vector art, not an isometric tile grid, no photographic texture, no film grain, no fine micro detail, no clutter. Original design, not any existing game, film, brand or franchise. Region: Frostpeak, a cold final land: snowy mountains with icy blue shadows, dark green snow-dusted pine forests, a smooth frozen lake, and on the highest peak a distant dark fortress of black stone with sharp towers and a faint ominous purple glow, the home of the final boss. Composition: the mountains and pine forests sit along the sides and the bottom; the frozen lake lies near the lower-right corner; the highest peak with the dark fortress rises at the top centre, small and distant. The middle of the picture, roughly the central 60% of the width and 65% of the height, is calm, open ground of the region with only gentle, low-contrast variation (soft grass, sand or snow), no landmarks and no strong shapes, because a path of round map markers will be drawn over it later from the bottom to the top. Format: one tall portrait image at the largest native portrait size the image tool offers (1024x1536 or larger), PNG, highest quality. Nothing may be drawn that looks like a route: no roads, no paths, no trails, no dotted lines, no bridges across the middle, no markers, no pins, no flags, no nodes, no circles, no numbers, no text, no letters, no labels, no compass rose, no legend, no scale bar, no frame, no border, no parchment edge, no torn edges, no vignette, no people, no characters, no animals, no UI, no watermark. Artwork fills all four edges. Fresh composition from this text only; no input or reference images.
```

## Attempt log

One line per run: file, result.

Batch 1: all 32 runs launched at once. Eight runs lost the network
(image tool "connection failed" / "workspace routing discovery timed out")
and made no image; those are reruns of the same prompt, not failures of an
image, and have no `-fail-N` file.

- `card-pirate-v5-a`: attempt 1 fail (RGBA with a transparent ragged vignette round the edges), kept as `card-pirate-v5-a-fail-1.png`.
- `card-pirate-v5-b`: attempt 1 fail (transparent vignette round the edges), kept as `card-pirate-v5-b-fail-1.png`.
- `card-viking-v5-a`: attempt 1 pass (helmet with nose guard, no horns; ginger braided beard; longship). The session made two images (the tool was called twice); the last is saved.
- `card-viking-v5-b`: attempt 1 pass.
- `card-gladiator-v5-a`: attempt 1 no image (network), rerun.
- `card-gladiator-v5-b`: attempt 1 pass (cobalt plume and shield, bronze boss, strip kilt, greaves; face visible).
- `card-medic-v5-a`: attempt 1 no image (network), rerun.
- `card-medic-v5-b`: attempt 1 fail (transparent vignette round the edges; crosses were green), kept as `card-medic-v5-b-fail-1.png`.
- `card-miner-v5-a`: attempt 1 pass (Codex copied another session's file; replaced with the run's own image).
- `card-miner-v5-b`: attempt 1 pass (same copy fix).
- `card-balloon-v5-a`: attempt 1 pass (cobalt-and-cream envelope, sandbags, bomb rack, goggled aviatrix with scarf holding a bomb).
- `card-balloon-v5-b`: attempt 1 pass.
- `card-inventor-v5-a`: attempt 1 fail (transparent vignette round the edges), kept as `card-inventor-v5-a-fail-1.png`.
- `card-inventor-v5-b`: attempt 1 no image (network), rerun.
- `card-gunner-v5-a`: attempt 1 pass (shako with cobalt plume, sideburns, cobalt cuffs, epaulettes, white trousers, gaiters, bronze cannon on spoked wheels; Codex did not copy, saved from its session).
- `card-gunner-v5-b`: attempt 1 no image (network), rerun.
- `loading-wide-v1-a`: attempt 1 pass ("Arena" correct; every named character present; bottom band grass and river with only the feet of a robot and the gladiator entering it; Codex did not copy, saved from its session). 1536x1024.
- `loading-wide-v1-b`: attempt 1 pass ("Arena" correct; bottom band grass, flowers and river only). 1536x1024.
- `loading-tall-v1-a`: attempt 1 pass ("Arena" correct; bottom 22% grass, rocks and river only). 1024x1536.
- `loading-tall-v1-b`: attempt 1 fail (a bar under the crown over the "e" makes the title read "Arēna"), kept as `loading-tall-v1-b-fail-1.png`.
- `quest-map-1-wide-v1-a`: attempt 1 no image (network), rerun.
- `quest-map-1-wide-v1-b`: attempt 1 pass (river down the left, windmill top right, open meadow in the middle; a short farm track by the windmill at the edge).
- `quest-map-1-tall-v1-a`: attempt 1 pass (river down the left, windmill top right, open meadow).
- `quest-map-1-tall-v1-b`: attempt 1 no image (network), rerun.
- `quest-map-2-wide-v1-a`: attempt 1 no image (network), rerun.
- `quest-map-2-wide-v1-b`: attempt 1 pass (mesas and ruins round the edges, dry riverbed along the bottom right, open sand in the middle).
- `quest-map-2-tall-v1-a`: attempt 1 pass (riverbed along the right edge, ruins and mesas at the sides).
- `quest-map-2-tall-v1-b`: attempt 1 pass.
- `quest-map-3-wide-v1-a`: attempt 1 no image (network), rerun.
- `quest-map-3-wide-v1-b`: attempt 1 pass (frozen lake lower left, dark fortress with purple glow on the peak at the upper right, open snowfield).
- `quest-map-3-tall-v1-a`: attempt 1 pass (fortress top centre, lake lower right; Codex copied another session's file, replaced with its own).
- `quest-map-3-tall-v1-b`: attempt 1 pass (same copy fix).

Every passing image is full-bleed and opaque, with no border and no text other than the loading title.

Reruns and retries (same prompt text):

- `quest-map-1-tall-v1-b`: rerun after the network loss, pass (river down the left, windmill top right, open meadow).
- `card-gladiator-v5-a`: rerun after the network loss, fail (transparent ragged patches in the left corners), kept as `card-gladiator-v5-a-fail-1.png`.
- `card-inventor-v5-b`: rerun after the network loss, fail (transparent vignette round the edges), kept as `card-inventor-v5-b-fail-1.png`.
- `quest-map-2-wide-v1-a`: rerun after the network loss, pass (mesas and ruins round the edges, dry riverbed along the lower left, open sand in the middle).
- `quest-map-1-wide-v1-a`: rerun after the network loss, pass (river down the left with a waterfall, windmill top right, open meadow).
- `card-medic-v5-b`: retry 1, fail (transparent patches again), kept as `card-medic-v5-b-fail-2.png`.
- `card-pirate-v5-b`: retry 1, fail (transparent vignette again), kept as `card-pirate-v5-b-fail-2.png`.
- `loading-tall-v1-b`: retry 1, pass ("Arena" correct; bottom 22% grass, rocks and river only; every named character present). 1024x1536.
- `card-gunner-v5-b`: rerun after the network loss, pass (all details per the brief; the cannon muzzle touches the right edge). The session made two images; Codex copied neither, the last is saved.
- `card-inventor-v5-a`: retry 1, fail (transparent vignette again), kept as `card-inventor-v5-a-fail-2.png`.
- `card-pirate-v5-a`: retry 1, fail (transparent vignette again), kept as `card-pirate-v5-a-fail-2.png`.
- `card-medic-v5-a`: rerun after the network loss, fail (it looks right, green crosses and all, but the whole PNG is semi-transparent: 99% of pixels below full opacity, mean alpha 238), kept as `card-medic-v5-a-fail-1.png`.
- `card-medic-v5-b`: retry 2, fail (transparent vignette), kept as `card-medic-v5-b-fail-3.png`.
- `card-gladiator-v5-a`: retry 1 made no image (network), rerun.
- `card-pirate-v5-b`: retry 2, fail (transparent vignette), kept as `card-pirate-v5-b-fail-3.png`.
- `quest-map-3-wide-v1-a`: rerun after the network loss, pass (lake lower left, dark fortress with purple glow at the upper right, open snowfield; Codex copied another session's file, replaced with its own).
- `card-inventor-v5-b`: retry 1, fail (transparent vignette), kept as `card-inventor-v5-b-fail-2.png`.
- `card-inventor-v5-a`: retry 2, fail (semi-transparent PNG, mean alpha 239, with transparent patches), kept as `card-inventor-v5-a-fail-3.png`.
- `card-medic-v5-b`: retry 3 (last in the budget), fail (transparent patches), kept as `card-medic-v5-b-fail-4.png`. No passing medic b.
- `card-pirate-v5-b`: retry 3 (last in the budget), fail (transparent vignette), kept as `card-pirate-v5-b-fail-4.png`. No passing pirate b.
- `card-inventor-v5-a`: retry 3 (last in the budget), fail (the whole PNG semi-transparent, mean alpha 242), kept as `card-inventor-v5-a-fail-4.png`. No passing inventor a.
- `card-gladiator-v5-a`: retry 2, fail (transparent vignette), kept as `card-gladiator-v5-a-fail-2.png`.
- `card-inventor-v5-b`: retry 2, fail (transparent vignette; the session made two images and both are semi-transparent), kept as `card-inventor-v5-b-fail-3.png`.
- `card-pirate-v5-a`: retry 2. Luna called the image tool four times in this one run (against the wrapper) and copied a semi-transparent one, now `card-pirate-v5-a-fail-3.png`; two others are semi-transparent too; one of the four is opaque and passes (tricorne over cobalt bandana, braid, hoop earring, white shirt, striped sash with flintlock, waistcoat, knee boots, cutlass, harbour and galleon), saved as `card-pirate-v5-a.png` from `~/.codex/generated_images/01a0ef11-b6c7-75f3-9d44-315e8aa63092/exec-df387b35-1058-4f22-a9c3-b7467495c69b.png`.
- `card-gladiator-v5-a`: retry 3, pass (open-faced crested bronze helmet with cobalt plume, cobalt shield with bronze boss, short sword, arm guard, strip kilt, greaves).
- `card-medic-v5-a`: retry 1, fail (transparent vignette), kept as `card-medic-v5-a-fail-2.png`.
- `card-inventor-v5-b`: retry 3 (last in the budget), fail (transparent vignette), kept as `card-inventor-v5-b-fail-4.png`. No passing inventor b, so no passing Inventor card at all.
- `card-medic-v5-a`: retry 2, fail (transparent vignette), kept as `card-medic-v5-a-fail-3.png`.
- `card-medic-v5-a`: retry 3 (last in the budget), fail (transparent vignette), kept as `card-medic-v5-a-fail-4.png`. No passing Medic card.

### Why the cards failed

Every card failure is the same one: the PNG comes back RGBA with a ragged
transparent vignette round the edges (or, in three cases, the whole image a
few percent see-through), as `card-meteor-v5-b` did on 27 September. It hit
the women's cards almost every time (Pirate 5 of 6 images, Medic 8 of 8,
Inventor 8 of 8) and the men's rarely (Gladiator 2 of 4, none for Viking,
Miner, Balloon, Gunner). None of the loading or map images had it. Staying
with the same prompt text as asked, the Medic and the Inventor used their whole
budget without a pass. A next attempt would change the text: drop "slightly
darker toward the edges" from the shared paragraph and add "fully opaque,
the painted backdrop covers every pixel up to all four edges, no
transparency, no vignette".

### Picks

| Image | Pick | Why |
| --- | --- | --- |
| card-pirate | a | the only passing Pirate (b failed four times) |
| card-viking | b | the face and braided beard larger, the whole axe head inside the frame |
| card-gladiator | a | the face larger and the shield boss clearer; b is close |
| card-medic | none | no passing image (eight semi-transparent) |
| card-miner | b | the face larger and the whole pickaxe inside the frame |
| card-balloon | b | the bomb with its fuse and the bomb rack read at once |
| card-inventor | none | no passing image (eight semi-transparent) |
| card-gunner | a | the man and the whole cannon inside the frame; b crops the muzzle |
| loading-wide | b | the bottom band only grass, flowers and river; a has feet entering it |
| loading-tall | b | bigger, livelier characters round a centred bridge; calm bottom band |
| quest-map-1-wide | a | the largest open meadow and no track by the windmill |
| quest-map-1-tall | b | richer colour and depth with an equally open middle |
| quest-map-2-wide | b | an open centre framed by cliffs, more depth in the canyon |
| quest-map-2-tall | b | the cleanest open middle, ruins kept to the edges |
| quest-map-3-wide | a | the fortress clearer on its peak, the snowfield more open |
| quest-map-3-tall | a | the fortress centred at the top and the middle cleanest |

Integrated: `pirate v5-a`, `viking v5-b`, `gladiator v5-a`, `miner v5-b`,
`balloon v5-b`, `gunner v5-a` in `CARD_ART` (`scripts/arena-assets.mjs`),
then `node scripts/arena-assets.mjs --only=cards`; textures and models in
`lib/games/arena/assets.json` unchanged.

## Medic and Inventor cards v6: revised paragraph (29 September 2026)

After eight semi-transparent images each with the v5 text, the shared paragraph was changed for these two cards only: "slightly darker toward the edges" dropped and "fully opaque, the painted backdrop covers every pixel up to all four edges, no transparency, no vignette" added. The subjects are unchanged. Files are labelled v6 (`card-{medic,inventor}-v6-{a,b}.png`) to keep them apart from the v5 failures. Each prompt is sent as the revised paragraph, a space, the subject paragraph (as in the v5 list above), a space, then "Fresh image from this text only; no input or reference images."

Revised shared paragraph:

```text
Use case: the square portrait art on a playing card in the hand of a real-time battle game. Style: polished stylised cartoon character art, like the card portraits of a high-quality mobile strategy card game: bold, chunky, exaggerated cartoon proportions (big hands, broad shoulders, slightly large heads, sturdy simple shapes), big readable silhouettes and a very expressive face with a clear, lively expression. Clean hand-painted cartoon rendering with soft cel-like shading in two or three tones per colour, a crisp dark outline feel around the forms, simple smooth colour areas and only the key details, bright highlights on edges, saturated but tasteful colour. Not photoreal, not a glossy 3D render, not a detailed miniature, not a toy, not realistic anatomy, no photographic texture, no film grain, no fine micro detail, no clutter; also not childlike toddler art, not a baby or chibi mascot: confident, characterful and a little heroic or funny. Framing: the character is huge in the frame, centred, and fills it (about 85 to 90 percent of the frame height, head and upper body or the full figure fitted), instantly readable when the card is shown only 90 pixels wide. Keep the top-left corner (about one fifth of the width and height) free of faces and signature items: a cost badge covers it. Background: a simple painterly cartoon backdrop of the character's own era (described below), a few big soft shapes and a smooth colour gradient, lower contrast toward the edges so the character pops; fully opaque, the painted backdrop covers every pixel up to all four edges, no transparency, no vignette. The team colour is a strong cobalt blue. Original design, not any existing game, film, brand or franchise. No text, no letters, no numbers, no writing on anything, no card frame, no border, no icon, no UI, no logo, no watermark, no display base. Square 1024x1024 PNG, highest quality.
```

- **medic** (`card-medic-v6-{a,b}.png`):

  ```text
  Subject: ONE South Asian woman field medic from the 1940s, the only figure in the picture, framed from the thighs up, raising a glowing green tonic flask high in her right hand toward the upper right, away from the top-left corner, with a soft green glow around it; a kind, determined, encouraging smile; a cream cap and a cream armband, each marked with a plain GREEN cross (the cross is green, never red; there is no red cross anywhere in the picture); a khaki shirt, a khaki skirt worn over khaki trousers, a big brown leather satchel on a strap across her body. She carries no weapon. Background: a 1940s canvas field hospital tent in a green summer meadow, a few folding cots under the open tent flap, painted simply.
  ```

- **inventor** (`card-inventor-v6-{a,b}.png`):

  ```text
  Subject: ONE young Black woman inventor in a 1950s retro-futurist style, the only figure in the picture, framed from the thighs up, pointing a copper zapper wand toward the upper right, away from the top-left corner, with a crackle of blue-white lightning arcing from its tip; big brass goggles pushed up on her forehead, two round hair puffs, an excited, clever grin; a white lab coat, cobalt-blue gloves, and a backpack Tesla coil rising above her right shoulder with a glowing ball on top. Background: a crackling inventor's workshop with tall Tesla coils throwing little arcs, workbenches and copper pipes in a dim blue light, painted simply.
  ```

Attempt log (v6):

- `card-inventor-v6-b`: attempt 1, pass (opaque; goggles on the forehead, two hair puffs, lab coat, cobalt gloves, backpack Tesla coil with glowing ball, copper zapper with lightning; she also wears a cobalt jumpsuit).
- `card-inventor-v6-a`: attempt 1, pass (opaque; all details per the brief, big lightning arc; cobalt overalls under the coat; the paper on the bench carries only scribbles, no text).
- `card-medic-v6-b`: attempt 1, pass (opaque; green crosses on the cap and on the armband of the raised arm, khaki shirt and skirt over trousers, satchel, glowing green flask, tent with cots in a meadow).
- `card-medic-v6-a`: attempt 1, pass (opaque; same details, armband on the other arm).

With the revised paragraph all four came back opaque on the first attempt.

Picks (v6): Medic **b** (both green crosses large and at the front, on the cap and the raised arm); Inventor **a** (the larger, livelier face and the bigger lightning arc). Both added to `CARD_ART`.
