# Artwork for the feedback build

Generated with the built-in OpenAI image tool. The tool did not expose a model/version selector, so the specific model version is unverified. Originals remain in the generation output directory; these copies are used by the application.

- `public/art/nami-cover.png`: portrait Nami cover (formerly Undertow).
- `public/art/mora-cover.png`: portrait Mora cover (formerly Wildgrove).
- `public/art/yatai-cover.png`: portrait Yatai cover (formerly Midnight Market).
- `public/art/mora-board.png`: six-region landscape board.
- `public/art/miniatures-v4.png`: transparent six-column, two-row miniature atlas. Row one: Mossling, Cloudwing, Emberfox, Pebbleback, Moonhare, Dewfin. Row two: bun, fizz, cake, dumpling, tea, skewer.

Display names changed; stored game identifiers remain compatible. Covers are displayed in full, without cropping. Atlas transparency was checked in the generated RGBA file.

## Generation prompts

### Nami cover

Use case: illustration-story. Create one original premium board game cover illustration, portrait 2:3 composition. Game is NAMI, a game of hazardous currents and trick taking. Hand painted gouache and fine ink, rich editorial folk-fantasy illustration, adventurous and mysterious, balanced family audience without cute cartoon faces or photorealism. A tiny sailing vessel navigates enormous indigo and muted jade waves around weathered brass navigation markers beneath a cream crescent moon, intricate flowing wave patterns, distant ochre cliffs. Confident graphic shapes, tactile paper grain, sophisticated limited palette, expressive detail. The scene should read as an actual illustrated board game box cover with an ornamental illustrated border. No text, no letters, no logos. Fill the portrait canvas; complete composition designed to be shown without cropping. Original imagery, no reproduction of an existing game.

### Mora cover

Use case: illustration-story. Original premium board game cover for MORA, portrait 2:3. Painted gouache and fine ink, richly patterned editorial folk fantasy on textured paper, sophisticated moss green, ochre, ivory and midnight blue. Adventurous family board game tone, neither childish nor grim adult fantasy. A magical woodland valley seen through twisting ancient trees, a proud rust-red fox, a small moss-covered horned creature and a white long-eared hare exploring ruined stone paths, pale cranes in the sky, distant golden ridge and crescent moon. Beautiful interlocking silhouette composition with ornamental botanical border, luminous details, no photorealism, no plastic cartoon rendering, no text, no logos. Designed as a complete portrait board game cover without cropping. Entirely original imagery.

### Yatai cover

Use case: illustration-story. Original premium board game cover for YATAI, portrait 2:3. Richly illustrated gouache and fine ink on tactile paper, adventurous editorial folk-fantasy, balanced family audience, never childish cartoon or photorealistic. A lantern-lit evening feast in a winding market street beneath an indigo sky. Foreground beautiful ceramic dishes of steamed moon buns, berry drinks, layered cloud cakes, dumplings, green tea and star-shaped skewers on carved wooden tables, architectural silhouettes and hanging amber lanterns receding into a magical town. Muted vermilion, warm ochre, indigo, ivory, atmospheric warm glow, fine ornamental food-and-leaf border. Strong readable cover composition. No words or letters or logos. Show full portrait composition without cropping. Original art.

### Mora board

Use case: stylized-concept. Asset: one landscape 3:2 illustrated tabletop game board background for MORA. Top-down with subtle dimensional painted scenery, gouache and fine ink on linen paper, sophisticated adventurous woodland folk-fantasy in moss green, ochre, stone grey and midnight blue. Six spacious organic clearings separated by curving paths, streams, fallen logs and trees. Layout must be exactly three columns and two rows but WITHOUT straight grid lines or rectangular cells: upper left a wooded hollow; upper middle a golden ridge; upper right a moonlit blue glade; lower left a ruined lookout; lower middle a sunlit flower garden; lower right an expansive meadow. Quiet central space within each region for physical creature miniatures placed by the app. Natural illustrated landscape with terrain connecting across regions, detailed along edges, no pieces, no animals, no text, no signs, no icons, no UI, no baked drop shadows, no photorealism. A gently worn carved wooden perimeter completes the physical game board. Full-bleed, attractive, not cartoonish.

### Miniature atlas

Use case: stylized-concept. Create ONE game miniature sprite atlas with genuinely TRANSPARENT background, landscape 3:1 aspect ratio, EXACTLY SIX EQUAL COLUMNS and TWO EQUAL ROWS, each cell square. Exactly one isolated object centered inside each cell, 15 percent transparent padding, no object crosses cell boundaries. NO labels, NO grid lines, NO rectangular backgrounds, NO checkerboard drawn in image. Top row left to right: (1) moss-green horned woodland creature, (2) ivory blue-winged bird, (3) rust-red fox, (4) grey stone-backed tortoise, (5) ivory long-eared hare, (6) teal fish with curled tail. Bottom row left to right: (1) round steamed bun, (2) glass of dark berry fizz, (3) layered cream cake slice, (4) golden dumpling, (5) small green tea cup, (6) wooden skewer with three star-shaped morsels. All twelve objects should look like premium hand-painted carved wooden board game miniatures, 3/4 view with visible thickness and sculpted edges, sophisticated gouache textures, warm ochre and muted jewel colors, readable silhouettes. No cute faces, no photorealism, no ground plane, no stands, no shadows extending outside each object. True alpha transparency outside each silhouette. A production asset sheet, not a scene.

## Rules reference

[Gigamic's Papayoo rulebook](https://www.gigamic.com/index.php?controller=attachment&id_attachment=77), passing table: 3–4 players pass five cards; five players pass four; six players pass three. Nami's two-player extension uses five. An old exchange already started with three cards finishes at three; newly dealt rounds use the updated count.

## Feedback checks

- Hover across a large Nami hand; drag a card over the table and release on a legal target.
- Tap an inactive card on touch: it may select a prepared choice but must not open details. Hold, or tap its mobile i button, to inspect.
- Prepare passes as a later multiplayer seat; select cards, habitats and wards while waiting. Confirm when the turn arrives. New packets clear old preparations.
- Roll in Nami and Mora, including remote/bot rolls and reduced-motion mode.
- Close card details, rules and reference panels; verify no other content flashes.
- Review full covers, Mora signposts and creature silhouettes, Yatai card scoring and accumulated food stacks on desktop and mobile.

Local checks are not browser/device acceptance. User feedback is pending; no commit, push or publication was performed.
