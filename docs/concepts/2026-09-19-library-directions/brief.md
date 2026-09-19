# Gamehub library and play-modal concept brief

You are working inside the Gamehub repository (this repo). Generate **UI concept mockups** with the newest ChatGPT image model at the highest quality and the largest native size, use case `ui-mockup`. Work through the numbered queue below with **at most three sub-agents alive at once**: one generation per sub-agent; as soon as one returns, start the next item (rolling queue, never a fourth). Return every generated image.

## Read first, text only

- `docs/DESIGN.md`, especially "Required naming and identity rules" (the library paragraph) and "Artwork".
- `components/game/library.tsx` and the `.box-library` / `.game-box` rules in `app/globals.css` (what exists today: three shaped 3D boxes on a shelf, a genre line, Play and Resume buttons).
- `components/game/solo.tsx` lines 735–815 (the current setup modal: title, Learn, players 2–6, bot difficulty, content set, extension tiles, Play).
- `docs/concepts/2026-09-19-ui-directions/README.md` for the format of a concept README.

**Do not open, view, attach or describe any image file at any point**, including `public/art/box-*.png` and earlier concepts. Style is carried by words only. Fresh generations only: never edit, retouch or "keep everything else" on an existing image. If something is wrong, regenerate the whole image from the same prompt text.

## What this run is for

Today the library shows three games as 3D boxes. Soon it will show **hundreds**. Each concept must answer four things at once:

1. **Scale.** How does a library of hundreds of games stay browsable and exciting: grouping, a featured pick, rows or shelves, filters, search. Show at least 18–30 games in the frame so the density is real.
2. **Richer game info.** Every game shows, at a glance: play time, player count, mode (competitive, co-op or teams), weight (light, medium, heavy), one or two genre keywords (trick taking, draft and place, set collection, bluffing, racing…). Draw these as small icon-plus-value chips, not paragraphs.
3. **Social presence.** Multiplayer and leaderboards are coming. Show small round player avatars on games ("who is playing now"), "3 friends played this week", a live table count, a small leaderboard rank or streak marker. Avatars are simple illustrated faces or initials, never photos.
4. **A lighter, obvious Play.** One clear Play control per game. **No separate Resume button.** Resume is shown inside the play modal (see the modal direction) as a "continue your unfinished game" strip. On the library, an unfinished game gets only a discreet marker (a bookmark, a ribbon, a small "in progress" dot).

The library must stay **warm and neutral**: cream, kraft, walnut, linen, soft charcoal; not white, not dark mode, not themed as one of its games. No promotional heading and no tagline. The three real games keep their public names **Nox, Mora, Yata**; every other game is invented from the list below.

### Invented games to fill the shelves

Use these names (short, easy to say aloud, per DESIGN.md) with the given one-line world so boxes read as distinct games; invent covers freely but keep each box a different material and colour family so no two neighbours look alike:

Kaldo (mountain rail race) · Pemba (spice-market bidding) · Orin (lighthouse keepers, co-op) · Mavi (tide-pool collecting) · Tolu (drum circle rhythm bluffing) · Nima (paper-lantern festival) · Rako (desert caravan trading) · Vela (kite-racing teams) · Imbi (mushroom forest draft) · Sato (tea-house tile laying) · Lumo (firefly night, co-op) · Bora (storm-chasing boats) · Tiko (street-cat territories) · Anoa (river ferry logistics) · Zuri (bead-weaving patterns) · Pelo (snow-hare sledding) · Odu (clay-kiln set collection) · Miro (canal-city bluffing) · Kena (bee-meadow engine) · Suvi (northern-lights memory) · Jalo (fish-market auction) · Tavi (moth-and-moon co-op)

### Allowed baked text

Game titles (real and invented), the word **Play**, and short stat values (numbers, "2–5", "20 min", "Co-op"). Any other text is illustrative and the README must say so. Prefer icons over words for stats.

## Directions

Each queue item copies its style paragraph verbatim and then the layout and negatives. Landscape is 1536×1024 (desktop), portrait is 1024×1536 (phone). Directions must stay far apart from each other; each "not like" clause is binding.

### Direction A — Shelf wall

**Style.** A warm walnut and linen games room seen straight on. Physical shaped game boxes, each a different size and material (kraft, cloth-bound, lacquered tin, screen-printed card), standing and lying on long wooden shelves. Soft daylight from one side, gentle contact shadows, no glossy plastic. Interface elements are printed paper labels and brass shelf tags.

**Layout.** Top: a thin filter rail of shelf tags (Everyone, Quick, Co-op, Heavy, Friends playing, New). Below: 3–4 shelves each holding 7–9 boxes, one shelf labelled by mood or genre. One box on the second shelf is **pulled forward and tilted toward the viewer**, with a paper card unfolding beside it showing its stats as icon chips, three avatars playing now, a friend's leaderboard rank, and one Play button. A small bookmark ribbon sticks out of two other boxes to mark unfinished games. Bottom right: a subtle "and 212 more" shelf edge continuing off frame.

**Not like.** No cut-paper or kraft dioramas as in Mora, no ink printmaking as in Nox, no toon-shaded arcade as in Yata. No neon, no dark room.

### Direction B — Catalogue cards

**Style.** A calm editorial catalogue on cream paper stock with a fine grid, like a well-designed game-shop catalogue. Flat but tactile: slight paper texture, letterpress-feeling chips, each game as a tall card with a cover illustration, all cards the same size. Confident typography, generous spacing.

**Layout.** Left: a narrow sticky rail with search and filter groups (time, players, mode, weight, genre, friends). Centre: a dense grid of 5×4 game cards. Each card: cover, title, a stat strip of four icon chips (time, players, mode, weight), two genre keywords, a row of two or three small avatars with "playing now" or "friends this week", and a single light Play button that reads at once. One card is hovered: it lifts slightly and reveals a second line with a tiny leaderboard (three names with ranks). Top right: a small "Your games" cluster of two cards with an in-progress dot.

**Not like.** No 3D boxes, no shelves, no room. Not a white SaaS dashboard; the paper must feel warm.

### Direction C — Game table

**Style.** A large wooden table seen from slightly above, covered with a dark-green felt mat, lit by a warm lamp. Game boxes lie flat or in low stacks on the felt, grouped in loose clusters like a game night in progress. Dice, a mug ring, a pencil at the edges. Hand-drawn chalk marks on the felt label the clusters.

**Layout.** Clusters by mood: "Quick before dinner", "Long evening", "Play together" (co-op), "With friends online". Each cluster holds 5–8 boxes with one box slightly rotated. Small round avatar tokens sit on boxes that are being played right now; a little brass stand next to one cluster shows a leaderboard as a scoreboard card. The lamp spotlights one featured box, with its stat chips arranged as printed tokens on the felt beside it and one Play button. A mat edge at the bottom shows more clusters continuing.

**Not like.** No shelves, no catalogue grid. No pirate or maritime props (that is Nox), no cardboard cut-paper world (Mora), no neon arcade (Yata).

### Direction D — Game night front page

**Style.** A magazine-like front page in warm neutrals with one big illustrated hero, then horizontal shelves of boxes as rows. Crisp modern type, soft shadows, cream background with a subtle woven texture. Boxes are shaped 3D objects with light CSS-style depth (one tilted face, no heavy perspective).

**Layout.** Top: hero "Tonight" pick with a large box, stat chips, six avatars of friends online and one Play button. Right of hero: a compact live column with "Tables open now" (three rows: game, players, avatars) and a small weekly leaderboard (five names). Below: four horizontal rows, each 8–10 boxes wide with a row title (New this week, Co-op, Under 20 minutes, Friends are playing) and a soft fade at the right edge. Small in-progress bookmark on two boxes.

**Not like.** No room or table scenery. Not a streaming-service dark UI; warm and light.

### Direction M — Play modal, "opening the box"

**Style.** Match Direction A's material: a single physical game box opened toward the viewer on a warm neutral surface, lid lifted back, the inside of the lid showing the game's cover art. Setup choices are physical components laid in the box's inner tray: printed cards, wooden tokens, a folded rules leaflet.

**Layout (fixed elements from the current modal, reinvented as objects).** Title of the game on the lid. A Learn leaflet. **Players 2–6** as small chairs or seat tokens around a tiny table graphic, the chosen count filled. **Bot difficulty** as three wooden pawns (easy, medium, hard). **Content set** as two folded boards to choose from. **Extensions** as three tiles with an emblem, short title, an unmistakable enabled state and a small info mark inside each tile. One large light **Play** button at the bottom. **Resume strip:** across the top of the tray, a slim card "Continue your game from Tuesday" with a tiny board thumbnail, the player avatars and the current score, with its own continue affordance; this replaces the library's Resume button. Stats chips for this game (time, players, mode, weight) printed on the lid's inner edge.

**Not like.** Not a plain dialog with radio buttons. No Mora cut-paper look, no Nox ink, no Yata toon.

### Portrait rule

Every portrait prompt must **propose a phone layout with no horizontal scrolling of the essentials**: filters collapse into a single row of chips, boxes shrink into a 2-column grid or vertical shelves, the play modal becomes a full-screen sheet with the resume strip pinned at top and Play pinned at bottom. Draw the proposal.

## Queue (priority order)

Copy the direction's style paragraph verbatim into each prompt. Output path under `docs/concepts/2026-09-19-library-directions/`.

1. `library-shelf-landscape-v1-a.png` — Direction A, landscape
2. `library-cards-landscape-v1-a.png` — Direction B, landscape
3. `library-table-landscape-v1-a.png` — Direction C, landscape
4. `library-night-landscape-v1-a.png` — Direction D, landscape
5. `modal-openbox-landscape-v1-a.png` — Direction M, landscape
6. `library-shelf-landscape-v1-b.png` — Direction A, landscape
7. `library-cards-landscape-v1-b.png` — Direction B, landscape
8. `library-table-landscape-v1-b.png` — Direction C, landscape
9. `library-night-landscape-v1-b.png` — Direction D, landscape
10. `modal-openbox-landscape-v1-b.png` — Direction M, landscape
11. `library-shelf-portrait-v1-a.png` — Direction A, portrait
12. `library-cards-portrait-v1-a.png` — Direction B, portrait
13. `library-night-portrait-v1-a.png` — Direction D, portrait
14. `modal-openbox-portrait-v1-a.png` — Direction M, portrait
15. `library-table-portrait-v1-a.png` — Direction C, portrait
16. `library-shelf-portrait-v1-b.png` — Direction A, portrait
17. `library-cards-portrait-v1-b.png` — Direction B, portrait
18. `library-night-portrait-v1-b.png` — Direction D, portrait
19. `modal-openbox-portrait-v1-b.png` — Direction M, portrait
20. `library-table-portrait-v1-b.png` — Direction C, portrait

## Output

Native size (1536×1024 landscape, 1024×1536 portrait), PNG, no watermark, never overwrite an existing file.

## Verification loop

For each image the sub-agent checks, without opening any other image:

- actual pixel size matches the orientation;
- baked text is limited to game titles, Play and short stat values; anything else is noted as illustrative;
- the fixed elements are present: for library directions, at least 18 visible games, stat chips on at least the featured game, avatars on at least three games, exactly one Play control per featured game and no Resume button; for the modal, players 2–6, bot difficulty, content set, three extension tiles, one Play, and the resume strip;
- portrait images show no horizontal-scrolling essentials.

If a check fails, do **not** edit the image: regenerate from scratch from the same prompt text, save as `-fail-N`, and try again, at most 2 extra generations per queue item. Stop at the first pass.

Write `docs/concepts/2026-09-19-library-directions/README.md` incrementally: for every image, its filename, the exact prompt, pass/fail per check, which elements the model invented, and the number of attempts. Report progress after every three completions. End with a table: queue number, path, size, pass/fail, attempts.
