# Gamehub library and play modal concept directions

Fresh UI mockups generated without image references. Each entry records the exact generation prompt, verification result, model invented elements, illustrative text, and attempt count. Failed generations are retained with `-fail-N` suffixes where applicable.

## Queue progress

- Completed and documented: 01–20
- In progress: none
- Pending: none


<!-- BEGIN QUEUE 01 -->

![Queue 01 concept](library-shelf-landscape-v1-a.png)

# Queue 01 — Direction A shelf wall, landscape

## Output

- **Filename:** `library-shelf-landscape-v1-a.png`
- **Generation mode:** built-in image generation, fresh generation with no input or reference images
- **Requested quality:** highest quality
- **Attempts:** 1
- **Final result:** PASS

## Exact prompt

```text
Use case: ui-mockup
Asset type: high-fidelity desktop Gamehub library concept mockup
Primary request: Create a fresh, polished landscape UI concept showing a scalable games library with 3–4 long shelves and 7–9 physical game boxes per shelf, at least 18–30 visible games total. The library must feel browsable and exciting for hundreds of games while showing richer game information, social presence, and a lighter obvious Play action.

Style. A warm walnut and linen games room seen straight on. Physical shaped game boxes, each a different size and material (kraft, cloth-bound, lacquered tin, screen-printed card), standing and lying on long wooden shelves. Soft daylight from one side, gentle contact shadows, no glossy plastic. Interface elements are printed paper labels and brass shelf tags.

Layout. Top: a thin filter rail of shelf tags (Everyone, Quick, Co-op, Heavy, Friends playing, New). Below: 3–4 shelves each holding 7–9 boxes, one shelf labelled by mood or genre. One box on the second shelf is pulled forward and tilted toward the viewer, with a paper card unfolding beside it showing its stats as icon chips, three avatars playing now, a friend's leaderboard rank, and one Play button. A small bookmark ribbon sticks out of two other boxes to mark unfinished games. Bottom right: a subtle "and 212 more" shelf edge continuing off frame.

Shared library requirements: Show at least 18 visible games. Every game should communicate at a glance play time, player count, mode (competitive, co-op or teams), weight (light, medium or heavy), and one or two genre cues, primarily through tiny icon-plus-value chips rather than prose. Show small round illustrated-face or initial avatars on at least three games to indicate who is playing now, plus discreet social signals such as friends played this week, live table count, leaderboard rank or streak. Each game has one clear light Play control; the featured pulled-forward game must have exactly one Play control. There must be no Resume button anywhere. Mark unfinished games only with discreet bookmark ribbons or a small in-progress dot. Keep the overall library warm and neutral: cream, kraft, walnut, linen, soft charcoal; no promotional heading and no tagline. Make each neighbouring box distinct in silhouette, material, and colour family.

Names and worlds: Use the public names Nox, Mora, Yata. Fill the remaining shelves with these invented games and visually suggest their worlds: Kaldo (mountain rail race), Pemba (spice-market bidding), Orin (lighthouse keepers, co-op), Mavi (tide-pool collecting), Tolu (drum circle rhythm bluffing), Nima (paper-lantern festival), Rako (desert caravan trading), Vela (kite-racing teams), Imbi (mushroom forest draft), Sato (tea-house tile laying), Lumo (firefly night, co-op), Bora (storm-chasing boats), Tiko (street-cat territories), Anoa (river ferry logistics), Zuri (bead-weaving patterns), Pelo (snow-hare sledding), Odu (clay-kiln set collection), Miro (canal-city bluffing), Kena (bee-meadow engine), Suvi (northern-lights memory), Jalo (fish-market auction), Tavi (moth-and-moon co-op).

Text: Allowed baked text is limited to game titles, the word "Play", and short stat values such as numbers, "2–5", "20 min", and "Co-op". Prefer icons over words for stats. Other requested labels such as filters, shelf mood, social indicators, leaderboard and "and 212 more" may be visually illustrative, tiny, abstracted, or partially legible rather than additional prominent readable copy. No promotional heading or tagline.

Composition/framing: straight-on desktop interface view, landscape 3:2, native 1536x1024. The shelves, full boxes, featured tilted box, unfolding stats card, avatars, bookmark ribbons, Play control, and continuation edge must all fit fully inside the frame. Dense but legible, clear hierarchy, credible production UI concept.
Lighting/mood: soft daylight from one side, welcoming quiet games-room atmosphere, gentle contact shadows.
Color palette: warm cream, kraft, walnut, linen and soft charcoal as the shared environment; varied restrained colour families for individual boxes.
Materials/textures: physical walnut shelves, linen backdrop, kraft paper, cloth binding, lacquered tin, screen-printed card, printed paper labels and brass shelf tags; tactile and matte.
Constraints: fresh generation only; no input or reference images; at least 18 visible games; stat icon chips on at least the featured game; avatars on at least three games; exactly one Play control on the featured game; no Resume button; no separate resume action; discreet unfinished markers only; no watermark; PNG; highest quality; native 1536x1024.
Avoid: No cut-paper or kraft dioramas as in Mora, no ink printmaking as in Nox, no toon-shaded arcade as in Yata. No neon, no dark room. No glossy plastic. No bright white SaaS dashboard. No streaming-service interface. No photos for avatars. No promotional heading, no tagline, no watermark, no horizontal carousel crop, no illegible wall of paragraphs.
```

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| PNG and actual pixel size | PASS | PNG decoded as 1536 × 1024, RGB, non-interlaced. |
| Landscape composition | PASS | Straight-on 3:2 desktop shelf wall with four shelf rows fully framed. |
| At least 18 visible games | PASS | 29 visible game boxes, including the pulled-forward featured box. |
| Featured-game stat chips | PASS | Featured Mora card shows time, players, competitive mode, weight or genre icons, avatars, a rank marker and social activity. |
| Avatars on at least three games | PASS | Illustrated round avatars appear on Nox, Yata, Tavi, Pemba, Jalo, Orin, Kena, Tolu and the featured Mora card. |
| Exactly one Play control on featured game | PASS | One light `Play` button appears on the unfolded Mora card; no second Play control is visible on the featured game. |
| No Resume button | PASS | No `Resume` control or separate resume action is visible. |
| Discreet unfinished markers | PASS | Two red bookmark ribbons appear on Sato and Nima. |
| Direction A materials and mood | PASS | Warm walnut shelving, linen wall, matte tactile boxes, brass-like tags, soft daylight and contact shadows are present; the scene is neither neon nor dark. |
| Scale and continuation | PASS | Four dense shelf rows, filter rail, and an `and 212 more` shelf-edge tag communicate a larger catalogue. |
| Text policy | PASS WITH ILLUSTRATIVE TEXT | Game titles, `Play`, and compact stat values dominate. The requested filter labels, shelf labels, `Competitive`, `4 friends played this week`, `#3`, and `and 212 more` are additional illustrative interface text. No promotional heading or tagline appears. |
| Watermark | PASS | No watermark is visible. |
| Portrait horizontal-scroll rule | NOT APPLICABLE | This is a landscape queue item. |

## Invented elements and deviations

- The model added a houseplant, globe, cat figurine, books, ceramics, rug, chair edge, and small grid/search controls to make the room feel inhabited.
- Shelf labels read `Adventure`, `Strategy`, and `Quick & Party`; these are illustrative mood/genre labels.
- Several lower-row covers repeat visual worlds already represented by named boxes: a snow hare, paper-lantern gate, storm boat, moth, and northern lights. These repeated boxes are untitled rather than introducing new game names.
- The featured Mora box uses a warm architectural city cover. It is pulled forward and tilted, with the stats card unfolded beside it as required.
- Most boxes are conventional upright rectangular packages; their cover materials, palette, proportions, and a few orientations vary, but silhouette variation is subtler than requested.
- Compact stat strips appear on nearly all named boxes. Genre or mode is often conveyed as an icon rather than readable text, matching the icon-first intent.

## Attempts

1. **PASS** — saved as `library-shelf-landscape-v1-a.png`; no regeneration was required.

<!-- END QUEUE 01 -->

<!-- BEGIN QUEUE 02 -->

![Queue 02 concept](library-cards-landscape-v1-a.png)

# Queue 02 — Direction B landscape

## Result

- **Filename:** `library-cards-landscape-v1-a.png`
- **Built-in generation:** fresh `image_gen` generation, with no input or reference images
- **Actual size:** 1536×1024 PNG
- **Attempts:** 3
- **Verification result:** Pass on the brief's required library checks on attempt 3

## Exact prompt

```text
Use case: ui-mockup.
Asset type: high-fidelity desktop game-library interface concept.
Output: one native 1536x1024 landscape PNG, highest quality, no watermark.

A calm editorial catalogue on cream paper stock with a fine grid, like a well-designed game-shop catalogue. Flat but tactile: slight paper texture, letterpress-feeling chips, each game as a tall card with a cover illustration, all cards the same size. Confident typography, generous spacing.

Layout. Left: a narrow sticky rail with search and filter groups (time, players, mode, weight, genre, friends). Centre: a dense grid of 5×4 game cards. Each card: cover, title, a stat strip of four icon chips (time, players, mode, weight), two genre keywords, a row of two or three small avatars with "playing now" or "friends this week", and a single light Play button that reads at once. One card is hovered: it lifts slightly and reveals a second line with a tiny leaderboard (three names with ranks). Top right: a small "Your games" cluster of two cards with an in-progress dot.

Shared library requirements. This screen must convincingly support a future catalogue of hundreds: show at least 20 distinct visible game cards in the 5×4 central grid, plus the two-card Your games cluster, with dense but clearly browsable grouping, search, filters, and hierarchy. Every visible game card communicates at a glance play time, player count, mode (competitive, co-op, or teams), weight (light, medium, or heavy), and one or two genre keywords; use compact icon-plus-value chips, never paragraphs. Show social presence on at least three games using small round illustrated-face or initial avatars, never photographs, plus subtle live-table, friends-this-week, rank, or streak signals. Every game has one clear light Play control. Never show a separate Resume button. Unfinished games use only a discreet in-progress dot, bookmark, or ribbon. Keep the whole library warm and neutral: cream, kraft, walnut, linen, and soft charcoal; neither bright white nor dark mode, and never themed as one of the games. No promotional heading and no tagline.

Names and worlds. Use all of these short titles across the visible cards, with distinct cover imagery, material impression, and colour family so neighboring cards do not look alike: Nox — improvised boats, pirate radio, nocturnal harbour, communal salvage; Mora — strange wildlife reclaiming human infrastructure; Yata — underground street food and night culture; Kaldo — mountain rail race; Pemba — spice-market bidding; Orin — lighthouse keepers, co-op; Mavi — tide-pool collecting; Tolu — drum circle rhythm bluffing; Nima — paper-lantern festival; Rako — desert caravan trading; Vela — kite-racing teams; Imbi — mushroom forest draft; Sato — tea-house tile laying; Lumo — firefly night, co-op; Bora — storm-chasing boats; Tiko — street-cat territories; Anoa — river ferry logistics; Zuri — bead-weaving patterns; Pelo — snow-hare sledding; Odu — clay-kiln set collection; Miro — canal-city bluffing; Kena — bee-meadow engine; Suvi — northern-lights memory; Jalo — fish-market auction; Tavi — moth-and-moon co-op. The three real public game names must read exactly Nox, Mora, and Yata.

Allowed baked text. Limit readable baked text to game titles, the word Play, and short stat values such as numbers, 2–5, 20 min, and Co-op. Search/filter labels, genre keywords, social captions, Your games, and leaderboard names may be visually suggested as illustrative typographic marks if accurate readable text cannot fit, but must not create paragraphs. Prefer icons over words for stats. No Resume text anywhere.

Not like. No 3D boxes, no shelves, no room. Not a white SaaS dashboard; the paper must feel warm.
No cut-paper or kraft diorama presentation associated with Mora. No ink printmaking presentation associated with Nox. No toon-shaded arcade presentation associated with Yata. No neon, no dark mode, no glossy plastic, no promotional heading, no tagline, no device frame, no browser chrome, no status bar, no watermark.
```

## Check-by-check verification

- **Native landscape size:** Pass — 1536×1024 PNG, verified from file metadata.
- **At least 18 visible games:** Pass — 20 cards appear in the 5×4 catalogue grid and two more appear in the `Your games` cluster, for 22 visible cards.
- **Stat chips:** Pass — every visible card has a compact icon strip with time, player range, mode and weight-like values; the full grid therefore exceeds the featured-game minimum.
- **Social avatars on at least three games:** Pass — small round illustrated avatars appear across the grid and both saved-game cards; no photographic avatars are present.
- **Exactly one Play control per featured game:** Pass — each of the 20 catalogue cards and each of the two `Your games` cards has one visible `Play` control.
- **No Resume button:** Pass — no Resume control or Resume text is visible.
- **In-progress treatment:** Pass — both `Your games` cards use a discreet green status dot.
- **Direction B material and structure:** Pass — warm cream paper, fine rules, slight paper texture, uniform flat cards, a left filter rail, a 5×4 grid, and the two-card saved-games cluster are present. There are no 3D boxes, shelves, room scene, dark mode, neon, glossy plastic, device frame, browser chrome, status bar, or watermark.
- **Public game names:** Pass — Nox, Mora, and Yata are legible and correctly spelled.
- **Hovered leaderboard detail:** Partial — the final render does not show the requested lifted hover state or three-name leaderboard. This is a layout deviation outside the brief's fixed library verification list.
- **Baked-text limitation:** Partial — game titles, `Play`, and short stat values are present as intended. Filter terms, genre terms, `Your games`, and other interface labels are treated as illustrative UI text. The decorative handwritten phrase `Good games brighter days` is extraneous and conflicts with the no-tagline direction; it is recorded here because the retry limit was reached.
- **Portrait no-horizontal-scroll check:** Not applicable to this landscape queue item.

## Invented elements

- Distinct illustrated covers for all visible games, including moonlit boats, a reclaimed observatory, a night market, mountain rail, spice stalls, lighthouse, tide pools, drums, lanterns, caravan, kites, mushrooms, tea service, fireflies, storm boat, street cat, river ferry, beadwork, snow hare, kiln pottery, bee meadow, aurora, fish market, and moths.
- Green circular in-progress markers for the two saved games.
- Small botanical sprigs and ruled-paper decoration in the side rails.
- Compact pictographic stat symbols and varied illustrated avatar faces.

## Attempt history

1. `library-cards-landscape-v1-a-fail-1.png` — 1536×1024 PNG. Failed because the expanded hovered Yata card omitted its Play control.
2. `library-cards-landscape-v1-a-fail-2.png` — 1536×1024 PNG. Failed because the expanded hovered Mavi card omitted its Play control.
3. `library-cards-landscape-v1-a.png` — 1536×1024 PNG. Passed all fixed library verification checks; deviations are documented above.

<!-- END QUEUE 02 -->

<!-- BEGIN QUEUE 03 -->

![Queue 03 concept](library-table-landscape-v1-a.png)

# Queue 03 — Direction C landscape

## Final file

- `library-table-landscape-v1-a.png`
- Built-in image generation, fresh generation without references
- Actual size: **1536 × 1024 PNG**
- Attempts: **3 total** (initial generation plus 2 retries)
- Final selection: attempt 2, retained after attempt 3 regressed by omitting the required Play control

## Exact prompt

```text
Use case: ui-mockup
Asset type: high-fidelity desktop game-library concept mockup
Primary request: Create one fresh landscape Gamehub library UI concept for a service that will hold hundreds of games. Show a believable dense library of 24 distinct games in the frame, organized for fast browsing while still feeling like an inviting physical game night. The library must answer scale, rich game information, social presence, and an obvious light Play action.

Style. large wooden table seen slightly above, covered dark-green felt mat, lit warm lamp. Game boxes lie flat or in low stacks on felt, grouped in loose clusters like game night in progress. Dice, mug ring, pencil edges. Hand-drawn chalk marks on felt label clusters.

Layout. Clusters mood: "Quick before dinner", "Long evening", "Play together" (co-op), "With friends online". Each cluster holds 5–8 boxes one box slightly rotated. Small round avatar tokens sit on boxes played right now; little brass stand next one cluster shows leaderboard scoreboard card. lamp spotlights one featured box, stat chips arranged printed tokens on felt beside one Play button. mat edge bottom shows more clusters continuing.

Shared library requirements:
- Show exactly 24 visible games across the four loose clusters, six games per cluster, so the density is real and the composition clearly scales toward hundreds of games.
- Every game has an immediately readable compact information treatment: small icon-plus-value chips for play time, player count, mode (competitive, co-op, or teams), weight (light, medium, or heavy), and one or two genre cues. Prefer simple pictograms and symbols; keep readable words within the allowed baked-text list below.
- Show social presence throughout: small round tokens with simple illustrated faces or initials on at least six games to mean who is playing now; visual friend-activity marks; a live-table-count icon and number; and a small leaderboard rank or streak marker. Never use photographic faces.
- Give the featured game exactly one clear, light-colored Play control. No other Play control is required on unfeatured boxes. Never show a Resume button. Mark two unfinished games only with a discreet bookmark, ribbon, or small in-progress dot.
- Keep the surrounding library identity warm and neutral: cream, kraft, walnut, linen, soft charcoal, dark-green felt, warm lamp light. It must not inherit the theme of any single game. No promotional heading and no tagline.
- Every neighboring box must feel like a distinct game, using a different material, silhouette, and color family: kraft board, cloth-bound cases, lacquered tins, screen-printed card boxes, carved wood, embossed paper, woven wraps, and restrained painted finishes. Avoid repeating adjacent materials or palettes.
- Create a high-fidelity complete desktop UI mockup at native 1536x1024 composition, landscape 3:2, largest native size, highest quality, crisp enough to assess interface hierarchy.

Names and worlds for all 24 visible games:
Nox; Mora; Yata; Kaldo (mountain rail race); Pemba (spice-market bidding); Orin (lighthouse keepers, co-op); Mavi (tide-pool collecting); Tolu (drum circle rhythm bluffing); Nima (paper-lantern festival); Rako (desert caravan trading); Vela (kite-racing teams); Imbi (mushroom forest draft); Sato (tea-house tile laying); Lumo (firefly night, co-op); Bora (storm-chasing boats); Tiko (street-cat territories); Anoa (river ferry logistics); Zuri (bead-weaving patterns); Pelo (snow-hare sledding); Odu (clay-kiln set collection); Miro (canal-city bluffing); Kena (bee-meadow engine); Suvi (northern-lights memory); Jalo (fish-market auction). Use each title once. Invent cover imagery freely from each listed world while keeping every cover distinct. Do not add Tavi because the frame is limited to 24 games.

Text (verbatim and allowed): Game titles from the list above, the word "Play", and short stat values such as "2–5", "20 min", and "Co-op". The four chalk cluster labels required by the layout may appear as illustrative handwriting: "Quick before dinner", "Long evening", "Play together", "With friends online". Prefer icons rather than words for all other stats, modes, weights, genres, live-table activity, friends, ranks, and streaks. Do not add other readable interface copy, promotional headings, taglines, paragraphs, slogans, logos, or a Resume label.

Constraints: one complete mockup with no device frame, no browser chrome, no cropped essential controls; at least 18 visible games; featured-game stat chips present; avatars present on at least three games; exactly one Play control on the featured game; no Resume button; no watermark; no signature.

Not like. No shelves, no catalogue grid. No pirate or maritime props (that is Nox), no cardboard cut-paper world (Mora), no neon arcade (Yata).
Avoid: dark-mode dashboard styling, white SaaS panels, glossy plastic, photographic avatars, duplicated titles, illegible gibberish text, extra buttons, multiple Play controls, Resume, promotional copy, watermarks, signatures.
```

## Validation

| Check | Result | Observation |
|---|---|---|
| Native landscape PNG | Pass | 1536 × 1024 PNG. |
| Direction C setting | Pass | Slightly elevated view of a walnut table, dark-green felt mat, warm table lamp, dice, mug ring, pencils and chalk cluster markings. |
| Four mood clusters | Pass | All four labels are present and each cluster contains six boxes. |
| Library density | Pass | Exactly 24 visible games, six per cluster. |
| Required game titles | Pass | Nox, Mora, Yata, Kaldo, Pemba, Orin, Mavi, Tolu, Nima, Rako, Vela, Imbi, Sato, Lumo, Bora, Tiko, Anoa, Zuri, Pelo, Odu, Miro, Kena, Suvi and Jalo each appear once. |
| Worlds and distinct covers | Pass | Cover art reflects every supplied world and neighboring color families vary clearly. |
| Material and silhouette variety | Partial | Covers vary in color, finish and illustration, but most boxes share a similar rectangular construction rather than fully distinct materials and silhouettes. |
| Per-game glanceable information | Pass | Every box has an icon strip with time, player count and compact mode, weight or genre symbols. |
| Social presence | Pass | Illustrated avatar tokens appear on Nox, Yata, Orin, Lumo, Pelo, Miro and Jalo; the brass leaderboard carries ranks, avatars and scores. |
| Live-table count and friend activity | Partial | Avatars and the leaderboard communicate activity, but there is no clearly isolated live-table-count control. |
| Featured game treatment | Pass | Bora is brightly spotlighted and has one light Play control plus a compact stat strip. |
| Printed stat tokens beside featured game | Partial | The stat strip is printed on Bora's box edge rather than laid on the felt as separate tokens. |
| Exactly one Play control | Pass | One Play control appears on Bora and no other box. |
| No Resume control | Pass | No Resume label or separate resume action is visible. |
| In-progress markers | Fail | Three markers appear (Nox, Nima and Zuri) rather than exactly two. |
| Warm neutral library identity | Pass | Walnut, cream, kraft, linen, soft charcoal, dark-green felt and warm lamp light dominate. |
| Direction separation | Pass | No shelves, room-wall catalogue, white SaaS layout or dark streaming-service UI; surrounding props avoid pirate, cut-paper-world and neon-arcade theming. |
| Allowed text | Pass | Readable text is limited to game titles, Play, compact stat values, required chalk labels and illustrative leaderboard numerals. |
| No device chrome, watermark or signature | Pass | None observed. |

## Invented elements

- Potted plants at the rear corners and a tree-pattern ceramic mug.
- Two bowls of pretzels or snack pieces, loose colored dice and wooden player pawns.
- A small ruled notebook with sketch marks, loose pencils, a plaid napkin and two decorative round brass tokens.
- A framed brass leaderboard with four illustrated avatar rows and numeric scores.
- Cover-specific scenic details that support the supplied worlds, including buildings, animals, landscapes, pottery, textiles and festival lights.

## Illustrative and extraneous text

- Required illustrative labels: `Quick before dinner`, `Long evening`, `Play together`, `With friends online`.
- The leaderboard uses illustrative rank and score numerals: `1`, `2`, `3`, `4`, `12`, `10`, `7`, `6`.
- Compact box stats use short values such as minutes, player ranges and `Co-op`.
- No promotional heading, tagline, paragraph, slogan, Resume label, watermark or signature was observed.

## Attempts

1. `library-table-landscape-v1-fail-1.png` — visually strong and complete, but the prompt had normalized the mandatory Direction C style paragraph instead of preserving it verbatim. Rejected before final selection.
2. `library-table-landscape-v1-fail-2.png` — generated from the locked prompt above. It met the main library, social and Play requirements, but showed three in-progress ribbons and kept the featured stats on the box. Selected as the final artifact after the last retry regressed.
3. `library-table-landscape-v1-fail-3.png` — identical locked-prompt retry. It showed the 24 titles and two ribbons, but omitted the required Play control and featured-game treatment, so it was rejected.


<!-- END QUEUE 03 -->

<!-- BEGIN QUEUE 04 -->

![Queue 04 concept](library-night-landscape-v1-a.png)

# Queue 04 — `library-night-landscape-v1-a.png`

- **Generation:** Built-in image generation, fresh image with no references
- **Use case:** `ui-mockup`
- **Attempts:** 1
- **Result:** Pass
- **Actual size:** 1536×1024 PNG

## Exact prompt

```text
Use case: ui-mockup
Asset type: desktop Gamehub library concept mockup
Primary request: Create one polished, complete desktop library front page for a board game platform that can scale to hundreds of games. This is a fresh generation with no reference images. Highest quality, native 1536x1024 landscape PNG, no watermark.

Style. A magazine-like front page in warm neutrals with one big illustrated hero, then horizontal shelves of boxes as rows. Crisp modern type, soft shadows, cream background with a subtle woven texture. Boxes are shaped 3D objects with light CSS-style depth (one tilted face, no heavy perspective).

Layout. Top: hero "Tonight" pick with a large box, stat chips, six avatars of friends online and one Play button. Right of hero: a compact live column with "Tables open now" (three rows: game, players, avatars) and a small weekly leaderboard (five names). Below: four horizontal rows, each 8–10 boxes wide with a row title (New this week, Co-op, Under 20 minutes, Friends are playing) and a soft fade at the right edge. Small in-progress bookmark on two boxes.

Scale and density: show 24 distinct games visibly in the frame across the hero and four rows; make the interface feel ready for hundreds. Include compact search and icon filters without a promotional heading or tagline. Each game needs one obvious, light Play control associated with it, but keep controls visually economical; there must be no separate Resume button anywhere. Use only a discreet bookmark, ribbon, or small dot to mark two unfinished games.

Richer information: on the featured hero game, clearly show small icon-plus-value chips for play time, player count, mode, weight, and one or two genre cues. Repeat tiny icon-led stat strips selectively on row items where readable. Prefer icons over words. Social presence: six simple illustrated-face or initial avatars in the hero, avatar clusters on at least three other games, plus visual markers for live table count, friends played this week, rank or streak. Never use photographic avatars.

Game identities and covers: use the public names Nox, Mora, Yata and enough of these invented games to create 24 distinct visible titles. Every neighbouring box must have a different material, silhouette, illustration, and colour family: Kaldo — mountain rail race; Pemba — spice-market bidding; Orin — lighthouse keepers co-op; Mavi — tide-pool collecting; Tolu — drum-circle rhythm bluffing; Nima — paper-lantern festival; Rako — desert caravan trading; Vela — kite-racing teams; Imbi — mushroom forest draft; Sato — tea-house tile laying; Lumo — firefly night co-op; Bora — storm-chasing boats; Tiko — street-cat territories; Anoa — river ferry logistics; Zuri — bead-weaving patterns; Pelo — snow-hare sledding; Odu — clay-kiln set collection; Miro — canal-city bluffing; Kena — bee-meadow engine; Suvi — northern-lights memory; Jalo — fish-market auction; Tavi — moth-and-moon co-op. Nox is nocturnal improvised boats and pirate radio; Mora is strange wildlife reclaiming human infrastructure; Yata is underground street food and night culture. Distinguish cloth-bound, kraft, lacquered tin, screen-printed card, painted wood, woven fabric, embossed paper, and matte board materials. No two neighbouring covers should look alike.

Text (verbatim and allowed): game titles, "Play", and short stat values such as "2–5", "20 min", "Co-op". The requested structural labels "Tonight", "Tables open now", "New this week", "Co-op", "Under 20 minutes", and "Friends are playing" may appear as illustrative navigation labels only; render leaderboard names and all other secondary copy as abstract short lines or icons rather than readable words. Do not invent slogans, taglines, promotional copy, descriptions, or Resume text.

Fixed checks: at least 18 visibly separate games; featured game has time, player, mode, weight and genre information as icon chips; avatar presence on at least three games; exactly one Play control on the featured game and no Resume button; warm neutral library identity; two discreet in-progress bookmarks.

Not like. No room or table scenery. Not a streaming-service dark UI; warm and light.

Avoid: bright white SaaS dashboard; dark mode; neon; a visual theme borrowed from one game; giant promotional heading; tagline; flat streaming thumbnails; a uniform card grid; heavy-perspective box rendering; glossy plastic; cut-paper or kraft diorama look; Nox-style ink printmaking across the whole library; Yata-style toon arcade across the whole library; pirate or maritime props outside individual cover art; horizontal page scrolling; device frame; browser chrome; status bar; watermark; logos other than game titles.
```

## Checks

- **Native size and format — Pass.** The saved file is a 1536×1024 RGB PNG.
- **Library density — Pass.** There are 28 visible boxes across the hero, live column, and four rows, representing 25 distinct titles.
- **Featured metadata — Pass.** Nox has icon chips for `45 min`, `2–5`, `Co-op`, a four-step weight indicator, and two icon-only genre cues.
- **Social presence — Pass.** The hero has six illustrated avatars. Avatar clusters also appear in the three live-table rows and on several shelf games, comfortably exceeding the three-game minimum.
- **Play and progress — Pass.** The featured Nox game has exactly one Play control. Each smaller game has one light Play control. There is no Resume control. Two gold bookmark ribbons mark Nima and Lumo as in progress.
- **Warm neutral identity — Pass.** The page uses cream woven texture, light cards, soft shadows, warm brown controls, and varied box art without adopting one game's visual theme.
- **Direction D layout — Pass.** A large hero and compact live and leaderboard column sit above four horizontal box rows with right-edge continuation marks.

## Invented elements

- A slim icon-only left navigation rail.
- Search, grid, list, filter, account, and row-continuation controls.
- Illustrated avatar faces, rank bars, leaderboard scores, live status dot, and small social-count icons.
- A moonlit harbour scene behind the featured Nox box.
- Individual cover illustrations, side-panel marks, material treatments, tiny icon motifs, and per-game player-count values.
- Gold bookmark ribbons on Nima and Lumo.

## Illustrative or extraneous baked text

- The structural labels `Tonight`, `Tables open now`, `New this week`, `Co-op`, `Under 20 minutes`, and `Friends are playing` are illustrative navigation text explicitly requested by Direction D.
- The leaderboard uses the illustrative numeric ranks `1`–`5` and scores `42`, `37`, `31`, `28`, and `24`.
- The box sides include a few tiny decorative pseudo-letter marks that are not intended as readable copy.
- No promotional heading, tagline, Resume label, descriptive paragraph, browser chrome, device text, or watermark is visible.

<!-- END QUEUE 04 -->

<!-- BEGIN QUEUE 05 -->

![Queue 05 concept](modal-openbox-landscape-v1-a.png)

# Queue 05 — Direction M landscape

## Result

- **Filename:** `modal-openbox-landscape-v1-a.png`
- **Built-in generation:** fresh `image_gen` generation, with no input or reference images
- **Actual size:** 1536×1024 PNG
- **Attempts:** 1
- **Verification result:** Pass

## Exact prompt

```text
Use case: ui-mockup.
Asset type: high-fidelity desktop play-setup modal concept.
Output: one native 1536x1024 landscape PNG, highest quality, no watermark.

Match Direction A's material: a single physical game box opened toward the viewer on a warm neutral surface, lid lifted back, the inside of the lid showing the game's cover art. Setup choices are physical components laid in the box's inner tray: printed cards, wooden tokens, a folded rules leaflet.

Layout (fixed elements from the current modal, reinvented as objects). Title of the game on the lid. A Learn leaflet. Players 2–6 as small chairs or seat tokens around a tiny table graphic, the chosen count filled. Bot difficulty as three wooden pawns (easy, medium, hard). Content set as two folded boards to choose from. Extensions as three tiles with an emblem, short title, an unmistakable enabled state and a small info mark inside each tile. One large light Play button at the bottom. Resume strip: across the top of the tray, a slim card "Continue your game from Tuesday" with a tiny board thumbnail, the player avatars and the current score, with its own continue affordance; this replaces the library's Resume button. Stats chips for this game (time, players, mode, weight) printed on the lid's inner edge.

Shared requirements. Present one coherent warm, neutral setup experience on cream, kraft, walnut, linen, and soft charcoal materials. The modal must read instantly as opening and arranging a real board-game box. The selected player count must be visible among all five choices 2, 3, 4, 5, and 6. Bot difficulty must show exactly three distinct pawns for easy, medium, and hard with one unmistakably selected. Content set must show exactly two different folded-board choices with one selected. Extensions must show exactly three compact graphical tiles, each with its own emblem, short title, clearly enabled or disabled state, and a small information mark within the tile. Show exactly one large light button bearing the word Play, pinned visually at the bottom of the tray. The resume strip stays separate at the top and uses an arrow or similarly clear non-Play continuation affordance, never a second Play button. Keep choices legible and tactile without becoming a plain form.

Game identity. Use the title Kaldo for this mockup: a mountain rail race with a bold illustrated alpine train cover on the inside lid. Let the two content boards suggest two distinct rail routes, and let the three extension emblems suggest a tunnel, a signal flag, and a snow pass. Preserve warm neutral library materials around the colorful game-specific art.

Allowed baked text. Game title, the word Play, Learn, player numerals 2–6, short difficulty labels, short content-set and extension titles, short stat values, and the required resume-strip phrase may appear. Prefer graphical emblems and material states over explanatory prose. No promotional heading and no tagline.

Not like. Not a plain dialog with radio buttons. No Mora cut-paper look, no Nox ink, no Yata toon.
No shelves, no catalogue grid, no game room scene, no dark mode, no neon, no glossy plastic, no device frame, no browser chrome, no status bar, no watermark. Do not show a Resume button. Do not show more than one Play button.
```

## Check-by-check verification

- **Native landscape size:** Pass — 1536×1024 PNG, verified from file metadata.
- **Opened-box presentation:** Pass — a single physical Kaldo box is opened toward the viewer, with alpine train cover art inside the raised lid and organized components in the inner tray.
- **Learn:** Pass — a folded `Learn` leaflet appears at the left of the tray.
- **Players 2–6:** Pass — five wooden chair tokens are clearly labelled 2, 3, 4, 5, and 6; player count 4 is visibly selected with a warm orange treatment.
- **Bot difficulty:** Pass — exactly three distinct pawns are shown and labelled Easy, Medium, and Hard; Easy has a green selection glow.
- **Content set:** Pass — exactly two board choices, `Alpine Loop` and `Glacier Route`, appear; Alpine Loop is visibly checked.
- **Three extension tiles:** Pass — exactly three tiles appear: `Tunnels`, `Signal Flags`, and `Snow Pass`. Each has its own emblem, a small circular information mark, and a clear checked or unchecked state.
- **One Play:** Pass — exactly one large light `Play` button spans the bottom of the tray.
- **Resume strip:** Pass — the top tray contains the exact phrase `Continue your game from Tuesday`, a small route-board thumbnail, four illustrated avatars, score 78, and a separate arrow continuation affordance. There is no Resume button and no second Play control.
- **Stats chips:** Pass — the lid edge displays time `60–90`, players `2–6`, mode `Competitive`, and weight `2.8` with icons.
- **Direction M visual constraints:** Pass — warm neutral paper, wood, linen, leather, printed cards, and wooden tokens create a tactile physical setup. It does not resemble a plain radio-button dialog and contains no Mora cut-paper, Nox ink, Yata toon, shelf, catalogue grid, dark mode, neon, glossy plastic, device frame, browser chrome, status bar, or watermark.
- **Baked text:** Pass — text is limited to the game identity, setup labels, short option names, stat values, the required resume phrase, and Play. No promotional heading or tagline is present.
- **Portrait no-horizontal-scroll check:** Not applicable to this landscape queue item.

## Invented elements

- Kaldo alpine railway cover art with a red steam train, stone viaduct, mountain lake, pine forest, and tunnel.
- Four illustrated animal avatars in the resume strip and a trophy score marker.
- A lantern, branded ceramic mug, map sheet, cloth-bound notebook, leather folio, evergreen sprig, bowl of wooden pieces, and train token around the box.
- `Alpine Loop` and `Glacier Route` content-set names.
- `Tunnels`, `Signal Flags`, and `Snow Pass` extension names and their arch, flag, and mountain emblems.

## Illustrative or extraneous text

- The map paper, mug, and leather folio repeat the `KALDO` identity as decorative branding.
- No unrelated phrase, promotional copy, watermark, or malformed text was observed.

## Attempt history

1. `modal-openbox-landscape-v1-a.png` — 1536×1024 PNG. Passed every required modal verification check; no retry was needed.

<!-- END QUEUE 05 -->

<!-- BEGIN QUEUE 06 -->

![Queue 06 concept](library-shelf-landscape-v1-b.png)

# Queue 06 — `library-shelf-landscape-v1-b.png`

- **Generation:** Built-in image generation, fresh image with no references
- **Use case:** `ui-mockup`
- **Attempts:** 2
- **Result:** Pass on attempt 2
- **Actual size:** 1536×1024 PNG

## Exact prompt

```text
Use case: ui-mockup
Asset type: desktop Gamehub library concept mockup
Primary request: Create one polished, complete desktop library for a board game platform that can scale to hundreds of games. Make this a fresh visual variant with no reference images. Highest quality, native 1536x1024 landscape PNG, no watermark.

Style. A warm walnut and linen games room seen straight on. Physical shaped game boxes, each a different size and material (kraft, cloth-bound, lacquered tin, screen-printed card), standing and lying on long wooden shelves. Soft daylight from one side, gentle contact shadows, no glossy plastic. Interface elements are printed paper labels and brass shelf tags.

Layout. Top: a thin filter rail of shelf tags (Everyone, Quick, Co-op, Heavy, Friends playing, New). Below: 3–4 shelves each holding 7–9 boxes, one shelf labelled by mood or genre. One box on the second shelf is pulled forward and tilted toward the viewer, with a paper card unfolding beside it showing its stats as icon chips, three avatars playing now, a friend's leaderboard rank, and one Play button. A small bookmark ribbon sticks out of two other boxes to mark unfinished games. Bottom right: a subtle "and 212 more" shelf edge continuing off frame.

Scale and density: show 24 distinct visible game boxes across three or four long shelves. Make the shelf wall feel ready for hundreds of games. Each box has exactly one clear, light Play control as a small paper or brass shelf tag associated with it. The featured box also has exactly one Play button on its unfolded card. Never show a Resume button. Use only two discreet bookmark ribbons for unfinished games.

Richer game information: the pulled-forward featured game must clearly show small icon-plus-value chips for play time, player count, mode, weight, and one or two genre cues. Repeat tiny icon-led stat strips on some shelf tags where readable. Prefer icons over prose. Social presence: show three simple illustrated-face or initial avatars on the featured card, plus avatar tokens on at least three other games. Add visual cues for friends played this week, live table count, and a friend's leaderboard rank or streak. Never use photographic avatars.

Game identities and covers: use the public names Nox, Mora, Yata and enough of these invented games to create 24 distinct visible titles. Every neighbouring box must use a different material, silhouette, illustration, and colour family: Kaldo — mountain rail race; Pemba — spice-market bidding; Orin — lighthouse keepers co-op; Mavi — tide-pool collecting; Tolu — drum-circle rhythm bluffing; Nima — paper-lantern festival; Rako — desert caravan trading; Vela — kite-racing teams; Imbi — mushroom forest draft; Sato — tea-house tile laying; Lumo — firefly night co-op; Bora — storm-chasing boats; Tiko — street-cat territories; Anoa — river ferry logistics; Zuri — bead-weaving patterns; Pelo — snow-hare sledding; Odu — clay-kiln set collection; Miro — canal-city bluffing; Kena — bee-meadow engine; Suvi — northern-lights memory; Jalo — fish-market auction; Tavi — moth-and-moon co-op. Nox is nocturnal improvised boats and pirate radio; Mora is strange wildlife reclaiming human infrastructure; Yata is underground street food and night culture. Distinguish kraft wrap, cloth binding, lacquered tin, screen-printed card, painted wood, woven fabric, embossed paper, matte board, slim folio, and shallow sculpted boxes. No two neighbouring covers should look alike.

Text (verbatim and allowed): game titles, "Play", and short stat values such as "2–5", "20 min", "Co-op". The requested filter labels "Everyone", "Quick", "Co-op", "Heavy", "Friends playing", and "New", one short mood or genre shelf label, and "and 212 more" may appear only as illustrative navigation text. Render leaderboard names and all other secondary copy as abstract short lines, icons, or unreadable print texture. Do not invent slogans, taglines, promotional copy, descriptions, or Resume text.

Fixed checks: at least 18 visibly separate games; featured game has time, player, mode, weight and genre information as icon chips; avatar presence on at least three games; exactly one Play control on the featured game and no Resume button; two discreet in-progress bookmarks; warm neutral identity.

Not like. No cut-paper or kraft dioramas as in Mora, no ink printmaking as in Nox, no toon-shaded arcade as in Yata. No neon, no dark room.

Avoid: bright white SaaS dashboard; dark mode; neon; game-specific world scenery taking over the library; giant promotional heading; tagline; flat streaming thumbnails; uniform card grid; heavy perspective; glossy plastic; cardboard diorama environment; printmaking across the whole room; toon arcade across the whole room; pirate or maritime props outside individual cover art; device frame; browser chrome; status bar; watermark; logos other than game titles.
```

## Attempt history

- **Attempt 1 — Fail.** Saved as `library-shelf-landscape-v1-b-fail-1.png`. It met size, density, metadata, avatar, bookmark, and no-Resume checks, but the featured Mora display had two Play controls: one on the box and one on the unfolded card.
- **Attempt 2 — Pass.** Saved as `library-shelf-landscape-v1-b.png`. The featured Mora display has one Play control on its unfolded card.

## Final checks

- **Native size and format — Pass.** The saved file is a 1536×1024 RGB PNG.
- **Library density — Pass.** There are 25 visible game boxes across four shelves, all with distinct readable titles.
- **Featured metadata — Pass.** Mora has icon chips for `60 min`, `1–4`, `Co-op`, a three-step weight indicator, and two icon-only genre cues.
- **Social presence — Pass.** The featured card has three illustrated avatars. Avatar clusters also appear on Nox, Yata, Imbi, Bora, Tiko, Odu, Kena, and other boxes.
- **Play and progress — Pass.** The featured Mora presentation has exactly one Play control. The other games each have one light brass Play tag. No Resume control is visible. Exactly two bookmark ribbons mark Orin and Imbi.
- **Warm neutral identity — Pass.** Walnut shelves, brass tags, linen-textured boxes, daylight, plants, and warm cream surfaces create a neutral physical library without neon or dark-mode treatment.
- **Direction A layout — Pass.** Six brass filter tags sit above four long shelves, the featured Mora box projects toward the viewer with an unfolded information card, shelf labels organize the rows, and `and 212 more` continues the collection at bottom right.

## Invented elements

- Illustrated covers and material treatments for every game.
- Potted and trailing plants, armillary globes, books, a wooden chest, framed map, wooden figure, rug, chair, table, and ceramic mug around the shelf wall.
- Brass stat and Play rails attached to individual boxes.
- Shelf categories `Adventure & Exploration`, `Nature & Cozy`, and `Party & Light`.
- Illustrated avatar faces, rank bars, trophy marker, social icons, and per-game player-count values.

## Illustrative or extraneous baked text

- The filter labels `Everyone`, `Quick`, `Co-op`, `Heavy`, `Friends playing`, and `New`, the shelf categories, and `and 212 more` are illustrative navigation text.
- The featured rank marker `#3` is an illustrative short leaderboard value.
- No promotional heading, tagline, Resume label, descriptive paragraph, browser chrome, device text, or watermark is visible.

<!-- END QUEUE 06 -->

<!-- BEGIN QUEUE 07 -->

![Queue 07 concept](library-cards-landscape-v1-b.png)

# Queue 07 — Direction B landscape, variant B

## Result

- **Filename:** `library-cards-landscape-v1-b.png`
- **Built-in generation:** fresh `image_gen` generation, with no input or reference images
- **Actual size:** 1536×1024 PNG
- **Attempts:** 1
- **Verification result:** Pass on the brief's required library checks

## Exact prompt

```text
Use case: ui-mockup.
Asset type: high-fidelity desktop game-library interface concept, a fresh second variant.
Output: one native 1536x1024 landscape PNG, highest quality, no watermark.

A calm editorial catalogue on cream paper stock with a fine grid, like a well-designed game-shop catalogue. Flat but tactile: slight paper texture, letterpress-feeling chips, each game as a tall card with a cover illustration, all cards the same size. Confident typography, generous spacing.

Layout. Left: a narrow sticky rail with search and filter groups (time, players, mode, weight, genre, friends). Centre: a dense grid of 5×4 game cards. Each card: cover, title, a stat strip of four icon chips (time, players, mode, weight), two genre keywords, a row of two or three small avatars with "playing now" or "friends this week", and a single light Play button that reads at once. One card is hovered: it lifts slightly and reveals a second line with a tiny leaderboard (three names with ranks). The lifted card must retain its one visible Play button while showing the leaderboard line. Top right: a small "Your games" cluster of two cards with an in-progress dot.

Shared library requirements. Make the structure feel like a refined independent print catalogue with thin charcoal rules, blind-debossed filter tabs, muted colored cover panels, and small letterpress chips. It must convincingly support hundreds of games: show exactly 20 full central cards in five columns by four rows, plus two smaller cards in the top-right Your games cluster, all fully inside the frame. Every card communicates play time, player count, mode (competitive, co-op, or teams), weight (light, medium, or heavy), and one or two genres through compact icon-plus-value chips rather than prose. Show small round illustrated-face or initial avatars on at least three different games, never photos, plus subtle playing-now, friends-this-week, live-table, rank, or streak signals. Every visible card, including the lifted hover card and both Your games cards, has exactly one clear light Play control. Never show a Resume button. Mark unfinished games only with a discreet colored dot, bookmark, or ribbon. Keep the library warm and neutral in cream, kraft, walnut, linen, and soft charcoal, neither bright white nor dark mode and never themed as one of its games. No promotional heading and no tagline.

Names and worlds. Use these short titles across the visible cards, keeping neighboring cover illustrations in distinct materials and color families: Nox — improvised boats, pirate radio, nocturnal harbour, communal salvage; Mora — strange wildlife reclaiming human infrastructure; Yata — underground street food and night culture; Kaldo — mountain rail race; Pemba — spice-market bidding; Orin — lighthouse keepers, co-op; Mavi — tide-pool collecting; Tolu — drum circle rhythm bluffing; Nima — paper-lantern festival; Rako — desert caravan trading; Vela — kite-racing teams; Imbi — mushroom forest draft; Sato — tea-house tile laying; Lumo — firefly night, co-op; Bora — storm-chasing boats; Tiko — street-cat territories; Anoa — river ferry logistics; Zuri — bead-weaving patterns; Pelo — snow-hare sledding; Odu — clay-kiln set collection; Miro — canal-city bluffing; Kena — bee-meadow engine; Suvi — northern-lights memory; Jalo — fish-market auction; Tavi — moth-and-moon co-op. The three real public names must read exactly Nox, Mora, and Yata.

Allowed baked text. Limit readable baked text to game titles, the word Play, and short stat values such as numbers, 2–5, 20 min, and Co-op. Search and filter labels, genre keywords, social captions, Your games, and the tiny leaderboard names may be treated as concise illustrative interface text; never create paragraphs. Prefer icons over words for stats. No Resume text anywhere.

Not like. No 3D boxes, no shelves, no room. Not a white SaaS dashboard; the paper must feel warm.
No cut-paper or kraft dioramas as in Mora, no ink printmaking as in Nox, no toon-shaded arcade as in Yata. No neon, no dark mode, no glossy plastic, no promotional heading, no tagline, no device frame, no browser chrome, no status bar, no watermark.
```

## Check-by-check verification

- **Native landscape size:** Pass — 1536×1024 PNG, verified from file metadata.
- **At least 18 visible games:** Pass — 23 full catalogue cards plus two smaller `Your games` cards are visible, for 25 total.
- **Stat chips:** Pass — all visible cards show compact icon and value strips for time, players, mode, and weight-like information.
- **Social avatars on at least three games:** Pass — round illustrated faces or initials appear on every visible game card; no photographic avatars are present.
- **Exactly one Play control per featured game:** Pass — every visible card has exactly one light `Play` button, including the lifted Rako leaderboard card and both `Your games` cards.
- **Hovered leaderboard:** Pass — Rako is raised above its neighbors and displays three ranked entries, Alex, Morgan, and Riley, while retaining its Play control.
- **No Resume button:** Pass — there is no Resume control or Resume text.
- **In-progress treatment:** Pass — Orin and Mavi in `Your games` have discreet green and amber status dots.
- **Direction B visual structure:** Pass — warm cream paper, fine rules, slight tactile texture, uniform flat cards, a sticky filter rail, dense catalogue, and a two-card saved-games cluster are present. There are no 3D boxes, shelves, room scenery, dark mode, neon, device frame, browser chrome, status bar, or watermark.
- **Public game names:** Pass — Nox, Mora, and Yata are all legible and correctly spelled.
- **Exact 5×4 central grid:** Partial — the image exceeds the density requirement but arranges 15 cards in the main five-column block and eight more in a full-width bottom row, rather than exactly 20 central cards in a strict 5×4 rectangle. This does not fail the brief's fixed minimum of 18 visible games.
- **Baked-text limitation:** Pass with illustrative text noted — game titles, Play, and short stat values are primary. Search and filter labels, genre chips, social captions, `Your games`, and the three short leaderboard names are concise illustrative interface text permitted for documentation. No paragraph, promotional tagline, or unrelated phrase appears.
- **Portrait no-horizontal-scroll check:** Not applicable to this landscape queue item.

## Invented elements

- Fresh illustrated covers for the full roster, including harbour boats, a heron among reclaimed ruins, a lantern market, an alpine train, spice bowls, lighthouse, tide pools, drum circle, lantern festival, caravan, kites, mushrooms, tea house, fireflies, storm boat, street cat, ferry, beadwork, snow hare, kiln, canal, bee meadow, aurora, fish market, and moth.
- Blind-debossed filter buttons and thin letterpress divider rules.
- Green and amber saved-game progress dots.
- Rako's three-row leaderboard with crown, ranks, names, avatars, and scores.
- Botanical line illustrations in the right and lower-left margins.

## Illustrative or extraneous text

- Search, filter, mode, weight, genre, friends, and social-presence labels are illustrative interface copy.
- `Your games` and the Rako leaderboard names are illustrative interface copy.
- No unrelated slogan, promotional heading, watermark, malformed text, or Resume text was observed.

## Attempt history

1. `library-cards-landscape-v1-b.png` — 1536×1024 PNG. Passed every fixed library verification check; no retry was needed.

<!-- END QUEUE 07 -->

<!-- BEGIN QUEUE 08 -->

![Queue 08 concept](library-table-landscape-v1-b.png)

# Queue 08 — Direction C landscape, variant B

## Result

- **Filename:** `library-table-landscape-v1-b.png`
- **Built-in generation:** fresh `image_gen` generation, with no input or reference images
- **Actual size:** 1536×1024 PNG
- **Attempts:** 1
- **Verification result:** Pass on the brief's required library checks

## Exact prompt

```text
Use case: ui-mockup.
Asset type: high-fidelity desktop game-library interface concept, fresh Direction C variant.
Output: one native 1536x1024 landscape PNG, highest quality, no watermark.

A large wooden table seen from slightly above, covered with a dark-green felt mat, lit by a warm lamp. Game boxes lie flat or in low stacks on the felt, grouped in loose clusters like a game night in progress. Dice, a mug ring, a pencil at the edges. Hand-drawn chalk marks on the felt label the clusters.

Layout. Clusters by mood: "Quick before dinner", "Long evening", "Play together" (co-op), "With friends online". Each cluster holds 5–8 boxes with one box slightly rotated. Small round avatar tokens sit on boxes that are being played right now; a little brass stand next to one cluster shows a leaderboard as a scoreboard card. The lamp spotlights one featured box, with its stat chips arranged as printed tokens on the felt beside it and one Play button. A mat edge at the bottom shows more clusters continuing.

Shared library requirements. Show at least 24 distinct game boxes fully or substantially visible across four loose mood clusters so this reads as a real library that can scale to hundreds, while keeping every box identifiable. Each game communicates time, player count, mode, weight, and one or two genres through small printed icon-plus-value tokens or compact marks, not paragraphs; the spotlighted featured game must have a complete, clearly readable set of four stat chips. Show social presence on at least three games using small round player-avatar tokens with illustrated faces or initials, never photos, plus a live-table count, friends-this-week signal, leaderboard rank, or streak marker. The spotlighted game has exactly one obvious light Play control. No other large featured game is present. Never show a Resume button. Unfinished games use only a discreet bookmark ribbon or small dot. The library remains warm and neutral through walnut, cream, kraft, linen, dark-green felt, brass, and soft charcoal, and is never themed as one of its games. No promotional heading and no tagline.

Names and worlds. Distribute these short titles across the boxes, with distinct cover imagery, shapes, surface materials, and color families so neighboring games do not look alike: Nox — improvised boats, pirate radio, nocturnal harbour, communal salvage; Mora — strange wildlife reclaiming human infrastructure; Yata — underground street food and night culture; Kaldo — mountain rail race; Pemba — spice-market bidding; Orin — lighthouse keepers, co-op; Mavi — tide-pool collecting; Tolu — drum circle rhythm bluffing; Nima — paper-lantern festival; Rako — desert caravan trading; Vela — kite-racing teams; Imbi — mushroom forest draft; Sato — tea-house tile laying; Lumo — firefly night, co-op; Bora — storm-chasing boats; Tiko — street-cat territories; Anoa — river ferry logistics; Zuri — bead-weaving patterns; Pelo — snow-hare sledding; Odu — clay-kiln set collection; Miro — canal-city bluffing; Kena — bee-meadow engine; Suvi — northern-lights memory; Jalo — fish-market auction; Tavi — moth-and-moon co-op. The three real public names must read exactly Nox, Mora, and Yata.

Allowed baked text. Limit readable baked text to game titles, the word Play, and short stat values such as numbers, 2–5, 20 min, and Co-op. The four mood-cluster labels, brief genre labels, tiny social captions, and leaderboard names may be concise illustrative interface text and must never become paragraphs. Prefer icons over words for stats. No Resume text anywhere.

Not like. No shelves, no catalogue grid. No pirate or maritime props (that is Nox), no cardboard cut-paper world (Mora), no neon arcade (Yata).
No room-wide scene beyond the tabletop, no white SaaS dashboard, no dark digital interface, no glossy plastic, no promotional heading, no tagline, no device frame, no browser chrome, no status bar, no watermark.
```

## Check-by-check verification

- **Native landscape size:** Pass — 1536×1024 PNG, verified from file metadata.
- **At least 18 visible games:** Pass — 24 boxes are fully visible on the main felt mat and Vela continues below the mat edge, for 25 visible games.
- **Mood clusters:** Pass — the four chalk labels `Quick before dinner`, `Long evening`, `Play together`, and `With friends online` organize distinct loose groups.
- **Featured stat chips:** Pass — the spotlighted Nox box has four large printed tokens for 60 min, 1–4 players, Co-op mode, and Medium weight.
- **Social avatars on at least three games:** Pass — illustrated round avatar tokens appear on Yata, Nox, Orin, Mora, Tolu, Odu, and Miro. No photographic avatars are present.
- **Leaderboard:** Pass — a brass stand at upper right holds a five-row `This Week` scoreboard with ranks, names, and scores.
- **Exactly one Play control per featured game:** Pass — the central spotlighted Nox feature has one clear green `Play` control and there is no second featured Play button.
- **No Resume button:** Pass — no Resume control or Resume text appears.
- **In-progress treatment:** Pass — small gold bookmark ribbons appear on Suvi and Vela.
- **Direction C visual structure:** Pass — the concept is a warm walnut table with dark-green felt, four loose box clusters, chalk marks, lamp, dice, mug ring, pencil, and a lower continuing mat edge. There are no shelves, catalogue grid, game-specific pirate props, cut-paper world, neon arcade, digital dashboard, device frame, browser chrome, status bar, or watermark.
- **Public game names:** Pass — Nox, Mora, and Yata are legible and correctly spelled.
- **Baked-text limitation:** Partial — the allowed titles, Play, compact stats, four illustrative cluster labels, and leaderboard copy are present. A right-edge notebook includes the decorative phrase `Good Games Better Peop...`, and a lower notebook says `More to play`; these are extraneous illustrative text and conflict with the no-tagline instruction. They are documented here because all fixed verification checks passed on the first generation.
- **Portrait no-horizontal-scroll check:** Not applicable to this landscape queue item.

## Invented elements

- Fresh physical box covers and silhouettes for all 25 visible games.
- Large cream circular stat tokens around the featured Nox game.
- A five-name weekly leaderboard on a freestanding brass scoreboard.
- Avatar chips placed directly on active game boxes.
- Gold bookmark ribbons on Suvi and Vela.
- A brass desk lamp, ceramic mug, pencil, dice bowl, loose dice, mug ring, notebooks, cloth edge, leaves, and small brass tokens around the mat.

## Illustrative or extraneous text

- The four mood labels and weekly leaderboard names are illustrative interface copy required by the direction.
- `Good Games Better Peop...` and `More to play` are extraneous decorative notebook text.
- No Resume text, watermark, browser text, or malformed game title was observed.

## Attempt history

1. `library-table-landscape-v1-b.png` — 1536×1024 PNG. Passed every fixed library verification check; no retry was needed.

<!-- END QUEUE 08 -->

<!-- BEGIN QUEUE 09 -->

![Queue 09 concept](library-night-landscape-v1-b.png)

# Queue 09 — `library-night-landscape-v1-b.png`

- **Generation:** Built-in image generation, fresh image with no references
- **Use case:** `ui-mockup`
- **Attempts:** 1
- **Result:** Pass
- **Actual size:** 1536×1024 PNG

## Exact prompt

```text
Use case: ui-mockup
Asset type: desktop Gamehub library concept mockup
Primary request: Create one polished, complete desktop library front page for a board game platform that can scale to hundreds of games. This must be a fresh visual variant with no reference images. Feature Mora as the hero pick so this variant has a different editorial emphasis. Highest quality, native 1536x1024 landscape PNG, no watermark.

Style. A magazine-like front page in warm neutrals with one big illustrated hero, then horizontal shelves of boxes as rows. Crisp modern type, soft shadows, cream background with a subtle woven texture. Boxes are shaped 3D objects with light CSS-style depth (one tilted face, no heavy perspective).

Layout. Top: hero "Tonight" pick with a large box, stat chips, six avatars of friends online and one Play button. Right of hero: a compact live column with "Tables open now" (three rows: game, players, avatars) and a small weekly leaderboard (five names). Below: four horizontal rows, each 8–10 boxes wide with a row title (New this week, Co-op, Under 20 minutes, Friends are playing) and a soft fade at the right edge. Small in-progress bookmark on two boxes.

Scale and density: show 24 distinct games visibly in the frame across the hero and four rows; make the interface feel ready for hundreds. Include compact search and icon filters without a promotional heading or tagline. Give each non-featured game exactly one obvious, light Play control. The featured Mora presentation must have exactly one Play control total. There must be no separate Resume button anywhere. Use exactly two discreet bookmarks or ribbons to mark unfinished games.

Richer information: on the featured Mora hero game, clearly show small icon-plus-value chips for play time, player count, mode, weight, and one or two genre cues. Repeat tiny icon-led stat strips selectively on row items where readable. Prefer icons over words. Social presence: six simple illustrated-face or initial avatars in the hero, avatar clusters on at least three other games, plus visual markers for live table count, friends played this week, rank or streak. Never use photographic avatars.

Game identities and covers: use the public names Nox, Mora, Yata and enough of these invented games to create 24 distinct visible titles. Every neighbouring box must have a different material, silhouette, illustration, and colour family: Kaldo — mountain rail race; Pemba — spice-market bidding; Orin — lighthouse keepers co-op; Mavi — tide-pool collecting; Tolu — drum-circle rhythm bluffing; Nima — paper-lantern festival; Rako — desert caravan trading; Vela — kite-racing teams; Imbi — mushroom forest draft; Sato — tea-house tile laying; Lumo — firefly night co-op; Bora — storm-chasing boats; Tiko — street-cat territories; Anoa — river ferry logistics; Zuri — bead-weaving patterns; Pelo — snow-hare sledding; Odu — clay-kiln set collection; Miro — canal-city bluffing; Kena — bee-meadow engine; Suvi — northern-lights memory; Jalo — fish-market auction; Tavi — moth-and-moon co-op. Nox is nocturnal improvised boats and pirate radio; Mora is strange wildlife reclaiming human infrastructure; Yata is underground street food and night culture. Distinguish cloth-bound, kraft, lacquered tin, screen-printed card, painted wood, woven fabric, embossed paper, and matte board materials. No two neighbouring covers should look alike.

Text (verbatim and allowed): game titles, "Play", and short stat values such as "2–5", "20 min", "Co-op". The requested structural labels "Tonight", "Tables open now", "New this week", "Co-op", "Under 20 minutes", and "Friends are playing" may appear as illustrative navigation labels only; render leaderboard names and all other secondary copy as abstract short lines or icons rather than readable words. Do not invent slogans, taglines, promotional copy, descriptions, or Resume text.

Fixed checks: at least 18 visibly separate games; featured game has time, player, mode, weight and genre information as icon chips; avatar presence on at least three games; exactly one Play control on the featured game and no Resume button; warm neutral library identity; exactly two discreet in-progress bookmarks.

Not like. No room or table scenery. Not a streaming-service dark UI; warm and light.

Avoid: bright white SaaS dashboard; dark mode; neon; a visual theme borrowed from one game; giant promotional heading; tagline; flat streaming thumbnails; a uniform card grid; heavy-perspective box rendering; glossy plastic; cut-paper or kraft diorama look across the interface; Nox-style ink printmaking across the whole library; Yata-style toon arcade across the whole library; pirate or maritime props outside individual cover art; horizontal page scrolling; device frame; browser chrome; status bar; watermark; logos other than game titles.
```

## Checks

- **Native size and format — Pass.** The saved file is a 1536×1024 RGB PNG.
- **Library density — Pass.** The four shelves show 30 boxes, with additional hero and live-column boxes. The image presents all 25 requested distinct game titles and reads as a library built for a much larger catalogue.
- **Featured metadata — Pass.** Mora has icon chips for `60 min`, `2–5`, `Co-op`, a four-step weight indicator, and two icon-only genre cues.
- **Social presence — Pass.** The hero has six illustrated avatars. Avatar groups also appear in all three live-table rows and on Mora, Nox, Yata, Zuri, Imbi, and other shelf boxes.
- **Play and progress — Pass.** The featured Mora presentation has exactly one Play control. Each shelf box has one small Play control. No Resume control is visible. Exactly two red bookmark ribbons mark Pelo and Lumo.
- **Warm neutral identity — Pass.** Cream woven surfaces, pale wood shelves, leafy edge accents, soft shadows, and warm taupe navigation create a light neutral library.
- **Direction D layout — Pass.** A large Mora hero sits beside a three-row live column and five-entry weekly leaderboard, above four horizontal shelves with continuation controls.

## Invented elements

- A slim icon-only left navigation rail and compact icon filter row.
- Search, notification, profile, shelf continuation, and status-dot controls.
- Illustrated avatar faces, rank bars, leaderboard scores, live counts, `+1` and `+2` avatar overflow markers, and tiny social icons.
- Leafy plants and pale wood ledges that frame the editorial interface.
- Individual cover illustrations, box materials, tiny stat icons, and per-game player values.

## Illustrative or extraneous baked text

- The structural labels `Tonight`, `Tables open now`, `Weekly leaderboard`, `New this week`, `Co-op`, `Under 20 minutes`, and `Friends are playing` are illustrative navigation text.
- `6 friends online`, the leaderboard ranks `1`–`5`, scores `37`, `28`, `26`, `21`, and `18`, and the live-table values `2/4`, `4/5`, and `1/4` are illustrative social and stat values.
- The `+1` and `+2` avatar overflow markers are illustrative values.
- No promotional heading, tagline, Resume label, descriptive paragraph, browser chrome, device frame, or watermark is visible.

<!-- END QUEUE 09 -->

<!-- BEGIN QUEUE 10 -->

![Queue 10 concept](modal-openbox-landscape-v1-b.png)

# Queue 10 — Direction M landscape variant B

## Final file

- `modal-openbox-landscape-v1-b.png`
- Built-in image generation, fresh generation without references
- Actual size: **1536 × 1024 PNG**
- Attempts: **1**
- Overall result: **Pass**

## Exact prompt

```text
Use case: ui-mockup
Asset type: high-fidelity desktop play-modal concept mockup
Primary request: Create one fresh landscape Direction M variant B for Gamehub: a complete, readable game setup modal embodied as an opened physical game box for the game Nima. Make every fixed setup choice clearly visible and understandable at a glance.

Style. Match Direction material: single physical game box opened toward viewer on warm neutral surface, lid lifted back, inside lid showing game's cover art. Setup choices physical components laid in box's inner tray: printed cards, wooden tokens, folded rules leaflet.

Layout (fixed elements current modal, reinvented objects). Title game on lid. Learn leaflet. Players 2–6 small chairs seat tokens around tiny table graphic, chosen count filled. Bot difficulty three wooden pawns (easy, medium, hard). Content set two folded boards choose from. Extensions three tiles emblem, short title, unmistakable enabled state small info mark inside each tile. One large light Play button bottom. Resume strip: across top tray, slim card "Continue game Tuesday" tiny board thumbnail, player avatars current score, own continue affordance; replaces library's Resume button. Stats chips game (time, players, mode, weight) printed on lid's inner edge.

Landscape composition and hierarchy:
- Native 1536x1024 landscape 3:2 composition, largest native size, highest quality.
- View the open box from a gentle elevated three-quarter angle, with the lid standing behind and the organized inner tray facing the viewer.
- Keep the complete box, lid, Resume strip, every setup control, and the bottom Play button fully inside frame with generous safe margins.
- The setup should read left to right: Players 2–6, Bot difficulty, Content set, Extensions. Use shallow tray compartments and tactile objects, while preserving clear UI grouping.
- Make Players 2–6 a row of five tiny table-and-chair seat tokens labeled 2, 3, 4, 5, 6; show 4 selected with filled chairs and a clear highlighted base.
- Make Bot difficulty three distinct wooden pawns labeled easy, medium, hard; show medium selected with a clear ring or raised socket.
- Make Content set two folded mini boards labeled Lantern Paths and River Lights; show Lantern Paths selected with a check or highlighted frame.
- Make Extensions three compact tiles titled Moon Gate, Shared Glow, Last Light. Each tile has a distinct emblem and a small circled information mark inside the tile. Show Moon Gate and Last Light enabled with an unmistakable lit inset, check, or raised toggle; show Shared Glow disabled.
- Place one folded Learn leaflet in its own obvious compartment.
- Put one large, light-colored Play button centered along the bottom inner tray.
- The Resume strip is a slim card across the top of the tray reading exactly "Continue game Tuesday"; include a tiny board thumbnail, three simple illustrated avatar medallions, compact current-score numerals, and its own small arrow-shaped continue affordance. Do not put Resume on the library or add a second main Play button.
- Print four compact stat chips on the inner lid edge: "30 min", "2–6", "Co-op", "Medium".
- Inside the lid, show the title "Nima" over distinctive paper-lantern festival cover art with glowing lanterns, evening plum and amber colors, and delicate screen-printed texture. Keep this art contained to the game lid rather than theming the entire neutral modal.
- Materials: warm kraft board, linen-lined tray, screen-printed cards, maple and walnut tokens, folded matte paper, small brass hinges, soft charcoal ink. Warm neutral cream, kraft and walnut surroundings; soft lamp light and believable contact shadows; no glossy plastic.

Text (verbatim): "Nima", "Learn", "Players 2–6", "2", "3", "4", "5", "6", "Bot difficulty", "easy", "medium", "hard", "Content set", "Lantern Paths", "River Lights", "Extensions", "Moon Gate", "Shared Glow", "Last Light", "Continue game Tuesday", "30 min", "2–6", "Co-op", "Medium", "Play". Keep all other communication graphical. The only other readable text may be small score numerals on the Resume strip.

Constraints: complete desktop modal, crisp readable hierarchy, one opened box only, exactly one large main Play button, Resume strip pinned visually across the tray top, five player-count choices, three bot-difficulty choices, two content-set choices, three extension tiles, enabled states unmistakable, small info mark inside every extension tile, one Learn leaflet, four stats on lid edge, avatars illustrated rather than photographic, no device frame, no browser chrome, no watermark, no signature.

Avoid: closed game box, extra boxes, library shelves, catalogue grid, dark-mode dashboard, white SaaS panels, flat generic web form, floating controls detached from the tray, illegible gibberish, duplicated labels, extra extensions, extra Play buttons, a large separate Resume button, promotional heading, tagline, logo, watermark, signature.
```

## Validation

| Check | Result | Observation |
|---|---|---|
| Native landscape PNG | Pass | 1536 × 1024 PNG. |
| Single opened physical box | Pass | One complete box faces the viewer with lid raised and inner tray fully visible. |
| Warm neutral material direction | Pass | Kraft board, linen lining, wood tokens, matte paper and brass hinges sit on a cream textile surface under warm light. |
| Title and cover art on lid | Pass | `Nima` is clear over contained lantern-festival artwork. |
| Four stat chips on lid edge | Pass | `30 min`, `2–6`, `Co-op`, and `Medium` are present and readable. |
| Resume strip | Pass | Slim top-tray card contains `Continue game Tuesday`, a board thumbnail, three illustrated avatars, three score numerals and a separate arrow affordance. |
| Players 2–6 | Pass | Five table-and-chair choices labeled 2 through 6 are present; 4 is clearly selected with a bright inset. |
| Bot difficulty | Pass | Easy, medium and hard wooden pawns are present; medium is selected with a lit ring. |
| Content set | Pass | Lantern Paths and River Lights folded-board choices are present; Lantern Paths is selected with a check and bright frame. |
| Extensions | Pass | Exactly three named tiles are present, each with its own emblem and circled info mark. Moon Gate and Last Light are checked and lit; Shared Glow is visibly off. |
| Learn leaflet | Pass | A folded `Learn` leaflet occupies its own lower-left compartment. |
| Main Play action | Pass | Exactly one large light `Play` button spans the bottom of the tray. |
| Complete safe framing | Pass | Lid, tray, controls and action remain inside the canvas; no essential element is cropped. |
| Readable hierarchy | Pass | Resume sits first, setup choices follow left to right, extensions occupy a distinct row, and Play anchors the bottom. |
| Text accuracy | Pass | All required labels are readable; no duplicated or gibberish interface labels observed. |
| Illustrated avatars | Pass | Resume avatars are drawn medallions rather than photos. |
| No forbidden presentation | Pass | No device chrome, shelves, catalogue grid, generic web form, second box, extra Play button, separate large Resume button, watermark or signature. |

## Invented elements

- Nima lantern-festival lid art with a moonlit river town, bridge, cherry blossoms and glowing suspended lanterns.
- Lantern Paths and River Lights content-set thumbnails.
- Moon Gate torii emblem, Shared Glow lantern-cluster emblem and Last Light single-lantern emblem.
- Tiny round wooden tables and chairs used as player-count selectors.
- Botanical printing on the Learn leaflet and Play button.
- Ceramic tea cup, flowering branches, small wooden token bowl and a patterned fabric pouch around the box.

## Illustrative and extraneous text

- Resume score numerals: `18`, `12`, `7`.
- No other extraneous readable text observed.

## Attempts

1. `modal-openbox-landscape-v1-b.png` — passed the modal validation on the first generation; no retry or `-fail-N` file was needed.


<!-- END QUEUE 10 -->

<!-- BEGIN QUEUE 11 -->

![Queue 11 concept](library-shelf-portrait-v1-a.png)

# Queue 11 — Direction A portrait, variant A

## Result

- **Filename:** `library-shelf-portrait-v1-a.png`
- **Built-in generation:** fresh `image_gen` generation, with no input or reference images
- **Actual size:** 1024×1536 PNG
- **Attempts:** 1
- **Verification result:** Pass

## Exact prompt

```text
Use case: ui-mockup.
Asset type: high-fidelity portrait phone game-library interface concept.
Output: one native 1024x1536 portrait PNG, highest quality, no watermark.

A warm walnut and linen games room seen straight on. Physical shaped game boxes, each a different size and material (kraft, cloth-bound, lacquered tin, screen-printed card), standing and lying on long wooden shelves. Soft daylight from one side, gentle contact shadows, no glossy plastic. Interface elements are printed paper labels and brass shelf tags.

Layout. Top: a thin filter rail of shelf tags (Everyone, Quick, Co-op, Heavy, Friends playing, New). Below: 3–4 shelves each holding 7–9 boxes, one shelf labelled by mood or genre. One box on the second shelf is pulled forward and tilted toward the viewer, with a paper card unfolding beside it showing its stats as icon chips, three avatars playing now, a friend's leaderboard rank, and one Play button. A small bookmark ribbon sticks out of two other boxes to mark unfinished games. Bottom right: a subtle "and 212 more" shelf edge continuing off frame.

Portrait phone proposal. Recompose the shelf-wall idea into a tall phone screen with no horizontal scrolling of any essential control or information. Collapse all filters into one compact single row of six small shelf-tag chips at the top, fully visible within the width. Below, arrange at least 20 game boxes as a dense two-column grid of short vertical shelf bays that continue downward; use five compact shelf bands with two boxes per column per band. Every box, every required stat, every avatar, the featured detail card, and the Play control must remain inside the phone width. The selected box on the second shelf pulls slightly forward within its column, while its narrow paper detail card unfolds vertically beneath it rather than sideways. Keep the two-column structure obvious and prevent any clipped horizontal carousel or off-screen essential. Show enough of the lower shelf edge to imply vertical continuation.

Shared library requirements. Show at least 20 distinct games clearly enough to count. The featured game must show play time, player count, mode, weight, and one or two genre keywords through small icon-plus-value chips, never a paragraph. Show social presence on at least three different games through small round player-avatar tokens with illustrated faces or initials, never photographs, plus playing-now, friends-this-week, live-table, rank, or streak signals. The pulled-forward featured game has exactly one clear light Play control. Never show a separate Resume button. Unfinished games use only discreet bookmark ribbons or small dots. Keep the library warm and neutral with cream, kraft, walnut, linen, brass, and soft charcoal, never bright white, dark mode, or themed as one particular game. No promotional heading and no tagline.

Names and worlds. Use these short titles across the visible boxes, with distinct cover imagery, materials, silhouettes, and color families so neighbors differ: Nox — improvised boats, pirate radio, nocturnal harbour, communal salvage; Mora — strange wildlife reclaiming human infrastructure; Yata — underground street food and night culture; Kaldo — mountain rail race; Pemba — spice-market bidding; Orin — lighthouse keepers, co-op; Mavi — tide-pool collecting; Tolu — drum circle rhythm bluffing; Nima — paper-lantern festival; Rako — desert caravan trading; Vela — kite-racing teams; Imbi — mushroom forest draft; Sato — tea-house tile laying; Lumo — firefly night, co-op; Bora — storm-chasing boats; Tiko — street-cat territories; Anoa — river ferry logistics; Zuri — bead-weaving patterns; Pelo — snow-hare sledding; Odu — clay-kiln set collection; Miro — canal-city bluffing; Kena — bee-meadow engine; Suvi — northern-lights memory; Jalo — fish-market auction; Tavi — moth-and-moon co-op. The three real public names must read exactly Nox, Mora, and Yata.

Allowed baked text. Limit readable baked text to game titles, the word Play, and short stat values such as numbers, 2–5, 20 min, and Co-op. Filter chips, one short shelf label, a tiny social caption, a rank, and "and 212 more" may be concise illustrative interface text. Prefer icons over words for stats. No Resume text anywhere.

Not like. No cut-paper or kraft dioramas as in Mora, no ink printmaking as in Nox, no toon-shaded arcade as in Yata. No neon, no dark room.
No catalogue-card UI, no plain digital dashboard, no glossy plastic, no promotional heading, no tagline, no device frame, no browser chrome, no phone status bar, no watermark. Do not use horizontal scrolling, clipped side content, or sideways carousels for any essential.
```

## Check-by-check verification

- **Native portrait size:** Pass — 1024×1536 PNG, verified from file metadata.
- **At least 18 visible games:** Pass — 25 distinct named boxes are visible and countable.
- **Featured stat chips:** Pass — Yata's unfolded paper detail shows 30 min, 2–5 players, Competitive mode, weight 2/5, and two genres, Bluffing and Culture.
- **Social avatars on at least three games:** Pass — round illustrated avatar tokens appear on Nox, Mora, Pemba, Orin, Tolu, Lumo, Tiko, Kena, Tavi, and the featured Yata detail card. No photos appear.
- **Exactly one Play control per featured game:** Pass — the Yata paper detail card has one large light `Play` control, and no second featured Play appears.
- **No Resume button:** Pass — no Resume control or Resume text appears.
- **Unfinished markers:** Pass — bookmark ribbons appear on Orin, Vela, Anoa, and Suvi.
- **Single-row portrait filters:** Pass — Everyone, Quick, Co-op, Heavy, Friends playing, and New are all fully visible in one compact brass-tag row at the top.
- **No horizontal-scrolling essentials:** Pass — all filters, shelves, boxes, featured stats, avatars, rank, and Play control fit inside the portrait frame. There is no clipped carousel or off-screen essential.
- **Portrait shelf proposal:** Pass — the content uses tall side-by-side vertical shelf bays with compact shelf bands, satisfying the brief's `2-column grid or vertical shelves` portrait rule. The boxes often run four across within the two main vertical bays, a denser interpretation than the prompt's requested two-box-per-band arrangement.
- **Direction A visual structure:** Pass — warm walnut cabinetry, linen-toned details, varied physical boxes, brass filter tags, daylight, contact shadows, a pulled-forward featured game, ribbons, plants, and a lower continuation tag are present. There is no neon, dark room, catalogue-card dashboard, device frame, browser chrome, status bar, or watermark.
- **Public game names:** Pass — Nox, Mora, and Yata are all correctly spelled and legible.
- **Baked-text limitation:** Pass with illustrative interface text — the six filter tags, Yata's concise stat and social labels, and `and 212 more` are permitted illustrative copy. No paragraph, promotional heading, tagline, or unrelated phrase appears.

## Invented elements

- Fresh physical covers for all 25 named games, each based on its supplied world.
- A split walnut cabinet with two tall vertical bays and varied shelf heights.
- Brass plaque filters with pictograms.
- A cream fold-down Yata detail card that overlaps lower shelves without leaving the phone width.
- Globe, ceramic planter, climbing vines, floor rug, and soft side-lighting.
- Blue and red bookmark ribbons and small framed avatar medallions.

## Illustrative or extraneous text

- Filter names, Yata's concise social line, `#2 this week`, and `and 212 more` are illustrative interface copy required or permitted by the brief.
- No extraneous tagline, watermark, malformed title, or Resume text was observed.

## Attempt history

1. `library-shelf-portrait-v1-a.png` — 1024×1536 PNG. Passed every library and portrait verification check; no retry was needed.

<!-- END QUEUE 11 -->

<!-- BEGIN QUEUE 12 -->

![Queue 12 concept](library-cards-portrait-v1-a.png)

# Queue 12 — `library-cards-portrait-v1-a.png`

- **Generation:** Built-in image generation, fresh image with no references
- **Use case:** `ui-mockup`
- **Attempts:** 1
- **Result:** Pass
- **Actual size:** 1024×1536 PNG

## Exact prompt

```text
Use case: ui-mockup
Asset type: phone Gamehub library concept mockup
Primary request: Create one polished, complete portrait phone library screen for a board game platform that can scale to hundreds of games. This is a fresh generation with no reference images. Highest quality, native 1024x1536 portrait PNG, no watermark.

Style. A calm editorial catalogue on cream paper stock with a fine grid, like a well-designed game-shop catalogue. Flat but tactile: slight paper texture, letterpress-feeling chips, each game as a tall card with a cover illustration, all cards the same size. Confident typography, generous spacing.

Layout. Left: a narrow sticky rail with search and filter groups (time, players, mode, weight, genre, friends). Centre: a dense grid of 5×4 game cards. Each card: cover, title, a stat strip of four icon chips (time, players, mode, weight), two genre keywords, a row of two or three small avatars with "playing now" or "friends this week", and a single light Play button that reads at once. One card is hovered: it lifts slightly and reveals a second line with a tiny leaderboard (three names with ranks). Top right: a small "Your games" cluster of two cards with an in-progress dot.

Portrait adaptation: propose a phone layout with no horizontal scrolling of the essentials. Collapse all filters into one single visible row of compact icon chips below a full-width search field. Replace the desktop left rail with that one-row filter treatment. Arrange the catalogue as a dense vertical 2-column grid with nine visible rows, 18 visible game cards total. The two columns, every card edge, all stat icons, avatar clusters, and all Play buttons must fit fully within the 1024px canvas. Do not draw sideways carousels, clipped cards, offscreen essentials, horizontal scrollbars, or continuation arrows. At the top, show a compact "Your games" strip as two small in-progress cards stacked or fitted fully within the width, then one selected catalogue card with a subtle lift and a three-rank mini leaderboard while preserving the 2-column flow.

Scale and density: show exactly 18 distinct visible game cards in the 2-column catalogue grid so the library already feels large. Keep cards compact but readable. Each game has exactly one clear, light Play control. There must be no Resume button. Mark exactly two unfinished games only with discreet dots.

Richer information: every game card shows, at a glance, icon-plus-value information for play time, player count, mode, and weight, plus one or two very short genre cues. Prefer icons over words. Social presence: use simple illustrated-face or initial avatars on at least three games, plus compact icon cues for playing now, friends this week, a live table count, rank, or streak. Never use photographic avatars.

Game identities and covers: use 18 distinct titles selected from the public names Nox, Mora, Yata and these invented games. Ensure Nox, Mora, and Yata are present. Kaldo — mountain rail race; Pemba — spice-market bidding; Orin — lighthouse keepers co-op; Mavi — tide-pool collecting; Tolu — drum-circle rhythm bluffing; Nima — paper-lantern festival; Rako — desert caravan trading; Vela — kite-racing teams; Imbi — mushroom forest draft; Sato — tea-house tile laying; Lumo — firefly night co-op; Bora — storm-chasing boats; Tiko — street-cat territories; Anoa — river ferry logistics; Zuri — bead-weaving patterns; Pelo — snow-hare sledding; Odu — clay-kiln set collection; Miro — canal-city bluffing; Kena — bee-meadow engine; Suvi — northern-lights memory; Jalo — fish-market auction; Tavi — moth-and-moon co-op. Nox is nocturnal improvised boats and pirate radio; Mora is strange wildlife reclaiming human infrastructure; Yata is underground street food and night culture. Give every neighbouring card a distinct cover illustration, material impression, palette, and typography.

Text (verbatim and allowed): game titles, "Play", and short stat values such as "2–5", "20 min", "Co-op". The requested compact labels "Your games" and short filter labels may appear as illustrative navigation text. Render leaderboard names, social phrases, and any secondary copy as abstract short lines or icons rather than readable words. Do not invent slogans, taglines, promotional copy, descriptions, or Resume text.

Fixed checks: at least 18 visibly separate games; stats on every card and especially the selected card; avatar presence on at least three games; exactly one Play control per game and no Resume button; exactly two in-progress dots; no horizontal scrolling of essentials; full 2-column portrait layout.

Not like. No 3D boxes, no shelves, no room. Not a white SaaS dashboard; the paper must feel warm.

Avoid: shaped 3D boxes; shelves; room or table scenery; dark mode; neon; bright white SaaS dashboard; streaming-service rows; horizontal carousels; clipped cards; horizontal scrolling; device frame; browser chrome; phone status bar; promotional heading; tagline; paragraphs; glossy plastic; cut-paper diorama; uniform game art; photographic avatars; watermark; unrelated logos.
```

## Checks

- **Native size and format — Pass.** The saved file is a 1024×1536 RGB PNG.
- **Library density — Pass.** The catalogue contains exactly 18 distinct visible games in nine complete two-card rows: Nox, Mora, Yata, Kaldo, Pemba, Orin, Mavi, Tolu, Nima, Rako, Vela, Imbi, Sato, Lumo, Bora, Tiko, Anoa, and Zuri.
- **Metadata — Pass.** Every catalogue card shows icon-led time and player values, a triangular weight indicator, and two compact coloured genre or mode marks. The mobile density reduces these to one compact strip rather than four separated chips.
- **Social presence — Pass.** Illustrated avatar clusters appear on Nox, Mora, Yata, Pemba, Orin, Mavi, Nima, Rako, Imbi, Sato, Bora, Anoa, and both `Your games` cards.
- **Play and progress — Pass.** Every catalogue card has exactly one light Play control. No Resume control is visible. Nox and Mora each have one green in-progress dot in the `Your games` strip.
- **Portrait flow — Pass.** Search spans the available width, all six filters fit in one visible row, and the two-column catalogue keeps every card edge and Play control inside the canvas. There is no horizontal scrollbar, clipped card, carousel arrow, or offscreen essential.
- **Warm catalogue identity — Pass.** Cream paper texture, fine rules, letterpress-like outlines, soft shadows, and compact editorial typography avoid both a room scene and a bright-white dashboard.

## Direction deviations

- The cards use a wide horizontal mobile proportion rather than the desktop direction's tall-card proportion.
- No card visibly expands into a three-rank mini leaderboard. Social avatar rows remain visible, and the required library verification checks pass.
- Genre and mode are communicated through compact coloured symbols instead of readable genre keywords.

## Invented elements

- A full-width outlined search field and six rounded icon filter chips.
- Green in-progress dots on the two `Your games` cards.
- Illustrated avatar faces, coloured genre marks, triangular weight marks, and per-game time and player values.
- Individual cover illustrations for all 18 games.

## Illustrative or extraneous baked text

- `Your games`, `Search games…`, `Time`, `Players`, `Mode`, `Weight`, `Genre`, and `Friends` are illustrative navigation text.
- The short minute and player-count values are allowed stat text.
- No promotional heading, tagline, Resume label, descriptive paragraph, browser chrome, phone status bar, device frame, or watermark is visible.

<!-- END QUEUE 12 -->

<!-- BEGIN QUEUE 13 -->

![Queue 13 concept](library-night-portrait-v1-a.png)

# Queue 13 — Direction D portrait variant A

## Final file

- `library-night-portrait-v1-a.png`
- Built-in image generation, fresh generation without references
- Actual size: **1024 × 1536 PNG**
- Attempts: **1**
- Overall result: **Pass**

## Exact prompt

```text
Use case: ui-mockup
Asset type: high-fidelity portrait phone game-library concept mockup
Primary request: Create one fresh Direction D portrait proposal for the Gamehub library at native 1024x1536. It must show how a warm magazine-like library scales to hundreds of games on a phone while keeping every essential control visible without horizontal scrolling.

Style. A magazine-like front page in warm neutrals with one big illustrated hero, then horizontal shelves of boxes as rows. Crisp modern type, soft shadows, cream background with a subtle woven texture. Boxes are shaped 3D objects with light CSS-style depth (one tilted face, no heavy perspective).

Direction D layout source. Top: hero "Tonight" pick with a large box, stat chips, six avatars of friends online and one Play button. Right of hero: a compact live column with "Tables open now" (three rows: game, players, avatars) and a small weekly leaderboard (five names). Below: four horizontal rows, each 8–10 boxes wide with a row title (New this week, Co-op, Under 20 minutes, Friends are playing) and a soft fade at the right edge. Small in-progress bookmark on two boxes.

Portrait proposal:
- Draw a complete phone library screen as a single portrait composition, but do not draw a device frame, browser chrome or status bar.
- No horizontal scrolling of essentials. Nothing important is clipped behind a carousel or fade.
- Collapse filters into one compact visible row of five chips near the top: Quick, Co-op, Light, Friends, New. All chips fit across the phone width.
- Adapt the hero to the full phone width: a compact Tonight feature for Nima with one large shaped 3D box, four icon-plus-value stat chips, exactly six small illustrated avatar circles, and exactly one light Play button.
- Stack the social module beneath the hero rather than placing it off-screen to the right. Use one compact cream panel split into Tables open now with three tiny rows and a weekly leaderboard with five ranked avatar entries.
- Replace Direction D's horizontally scrolling shelves with a two-column vertical grid. Show exactly 18 additional shaped 3D game boxes in nine compact rows, all fully inside the canvas, with these section labels inserted as slim full-width dividers: New this week, Co-op, Under 20 minutes, Friends are playing.
- Every game tile must show a title and a tiny icon-plus-value strip for time, player count, mode, weight and one genre cue. Use icons whenever possible.
- Show social presence on at least six grid games using simple illustrated avatar circles or initials, plus small live-table counts, friend-activity dots, or rank and streak marks. Never use photos.
- Mark exactly two unfinished games with only a discreet bookmark or dot. Do not show any Resume button.
- Continue the two-column grid visibly toward the bottom edge, but keep the final visible tiles and their stats fully readable rather than cropping essentials.

Visible game titles and worlds:
Hero: Nima (paper-lantern festival).
Grid, each exactly once: Nox; Mora; Yata; Kaldo (mountain rail race); Pemba (spice-market bidding); Orin (lighthouse keepers, co-op); Mavi (tide-pool collecting); Tolu (drum-circle rhythm bluffing); Rako (desert caravan trading); Vela (kite-racing teams); Imbi (mushroom forest draft); Sato (tea-house tile laying); Lumo (firefly night, co-op); Bora (storm-chasing boats); Tiko (street-cat territories); Anoa (river ferry logistics); Zuri (bead-weaving patterns); Pelo (snow-hare sledding).
Invent each cover from its listed world. Keep adjacent boxes distinct in material and color family: kraft paper, cloth-bound board, lacquered tin, screen-printed card, carved wood, embossed paper, woven wrap and restrained painted finishes.

Shared library requirements:
- Show 19 games total in frame: one featured hero plus 18 fully visible grid boxes.
- The interface must communicate scale, rich game information, social presence and one obvious light Play action.
- Keep the library itself warm neutral: cream, kraft, walnut, linen and soft charcoal. The background is warm and light with subtle woven texture, never white or dark mode.
- No promotional heading and no tagline.
- Make all typography crisp and readable at portrait size, with generous but efficient spacing.

Text (verbatim and allowed): game titles listed above, Play, short stat values such as 2–5, 20 min, and Co-op. Required illustrative navigation and section text may read Tonight, Quick, Co-op, Light, Friends, New, Tables open now, Weekly leaders, New this week, Under 20 minutes, and Friends are playing. Prefer icons over any additional words. No paragraphs, slogans, promotional headings, logos or Resume label.

Constraints: native 1024x1536 portrait composition, largest native size, highest quality; at least 18 visible games; stat chips on the featured game and every grid tile; illustrated avatars on at least three games; exactly one Play control on the featured hero; no Resume button; no horizontal scrolling of essential content; one-row filters; two-column vertical game layout; no watermark; no signature.

Not like. No room or table scenery. Not a streaming-service dark UI; warm and light.
Avoid: dark interface, black streaming-service background, white SaaS dashboard, horizontal carousel, cropped essential tiles, shelves extending off-screen, tiny illegible gibberish, photographic faces, duplicate titles, multiple Play controls, Resume, promotional copy, device frame, browser chrome, watermark, signature.
```

## Validation

| Check | Result | Observation |
|---|---|---|
| Native portrait PNG | Pass | 1024 × 1536 PNG. |
| Direction D visual identity | Pass | Magazine-like cream front page, subtle woven texture, crisp type, soft shadows and shaped 3D boxes with restrained depth. |
| Warm and light presentation | Pass | Warm cream and neutral panels dominate; no dark streaming-service treatment, room or table scenery. |
| Portrait no-scroll proposal | Pass | All essential content is fully contained in the frame; no horizontal carousel, clipped edge or fade implies required sideways scrolling. |
| Collapsed filter row | Pass | Quick, Co-op, Light, Friends and New fit in one row across the top. |
| Featured hero | Pass | Nima has one large box, five compact stats, exactly six illustrated friend avatars and one large Play control. |
| Social module | Pass | Tables open now has three rows with players and avatars; Weekly leaders has five ranked illustrated-avatar entries. |
| Two-column vertical library | Pass | Eighteen additional games appear in nine complete two-column rows. |
| Library density | Pass | Nineteen games total are visible: one featured hero and eighteen grid games. |
| Required titles | Pass | Nima plus all eighteen requested grid titles each appear once. |
| Cover-world accuracy | Pass | Every cover clearly reflects its supplied world, from Kaldo's mountain train to Zuri's woven pattern and Pelo's snow hare. |
| Section structure | Pass | New this week, Co-op, Under 20 minutes and Friends are playing divide the vertical grid. |
| Per-game information | Pass | Every grid game has time, player count, weight and mode or genre information using icons and short values. |
| Social presence in library | Pass | Avatar groups appear on more than six grid games, with additional hero, live-table and leaderboard presence. |
| Exactly one Play control | Pass | The single Play control belongs to the Nima hero. |
| No Resume control | Pass | No Resume label or action appears. |
| Two in-progress markers | Pass | Exactly two discreet bookmarks appear, on Yata and Imbi. |
| Complete bottom framing | Pass | Zuri and Pelo, including their stat rows, remain fully visible at the bottom. |
| No forbidden chrome or marks | Pass | No device frame, browser chrome, status bar, watermark or signature. |

## Invented elements

- Nima hero cover with an amber lantern festival on a reflective canal.
- Illustrated friend portraits with small green online dots.
- Weekly-leader names Aiko, Ren, Mara, Dev and Lina.
- Small weight bar ratings and genre pictograms on each game row.
- Cream inset panels, rounded filter chips and light walnut typography accents.

## Illustrative and extraneous text

- Required illustrative navigation and structure: `Tonight`, `Quick`, `Co-op`, `Light`, `Friends`, `New`, `Tables open now`, `Weekly leaders`, `New this week`, `Under 20 minutes`, `Friends are playing`.
- Social illustration: `6 friends online`; live-table fractions `3/5`, `2/4`, `4/5`; leaderboard names `Aiko`, `Ren`, `Mara`, `Dev`, `Lina`; ranks, scores and weight decimals.
- Additional illustrative genre words appear in grid stats: `Strategy`, `Abstract`, `Family`, `Economic`, `Party`, `Racing`, `Adventure`.
- One extra parenthetical cover subtitle, `(Mountain rail race)`, appears under `Kaldo`.
- No promotional tagline, paragraph, Resume label, watermark or signature was observed.

## Attempts

1. `library-night-portrait-v1-a.png` — passed all required library and portrait checks on the first generation; no retry or `-fail-N` file was needed.


<!-- END QUEUE 13 -->

<!-- BEGIN QUEUE 14 -->

![Queue 14 concept](modal-openbox-portrait-v1-a.png)

# Queue 14 — Direction M portrait, variant A

## Result

- **Filename:** `modal-openbox-portrait-v1-a.png`
- **Built-in generation:** fresh `image_gen` generation, with no input or reference images
- **Actual size:** 1024×1536 PNG
- **Attempts:** 1
- **Verification result:** Pass

## Exact prompt

```text
Use case: ui-mockup.
Asset type: high-fidelity portrait phone play-setup modal concept.
Output: one native 1024x1536 portrait PNG, highest quality, no watermark.

Match Direction A's material: a single physical game box opened toward the viewer on a warm neutral surface, lid lifted back, the inside of the lid showing the game's cover art. Setup choices are physical components laid in the box's inner tray: printed cards, wooden tokens, a folded rules leaflet.

Layout (fixed elements from the current modal, reinvented as objects). Title of the game on the lid. A Learn leaflet. Players 2–6 as small chairs or seat tokens around a tiny table graphic, the chosen count filled. Bot difficulty as three wooden pawns (easy, medium, hard). Content set as two folded boards to choose from. Extensions as three tiles with an emblem, short title, an unmistakable enabled state and a small info mark inside each tile. One large light Play button at the bottom. Resume strip: across the top of the tray, a slim card "Continue your game from Tuesday" with a tiny board thumbnail, the player avatars and the current score, with its own continue affordance; this replaces the library's Resume button. Stats chips for this game (time, players, mode, weight) printed on the lid's inner edge.

Portrait phone proposal. Present the opened game box as a full-screen vertical setup sheet with no device frame and no horizontal scrolling of any essential. Pin the resume strip across the very top of the inner tray, fully visible within the phone width. Pin exactly one large light Play button across the bottom of the tray, fully visible within the phone width. Between them, stack compact physical sections vertically: Learn and stats first; all five player choices 2, 3, 4, 5, 6 in one contained row; all three bot pawns in one contained row; two content-set boards side by side; and three extension tiles in one contained row. Nothing essential may be clipped or require sideways movement. The lifted lid and title remain visible above the tray without consuming so much height that setup components fall below the frame.

Shared modal requirements. Show all player choices 2–6 with one chosen count clearly filled. Show exactly three different wooden bot pawns for easy, medium, and hard, with one selected. Show exactly two distinct folded content boards, with one selected. Show exactly three compact graphical extension tiles, each with its own emblem, short title, unmistakable enabled or disabled state, and small information mark inside the tile. Show exactly one button bearing the word Play. The top resume strip must include its phrase, one tiny board thumbnail, illustrated player avatars, a current score, and a separate arrow continuation affordance; never label it Resume and never give it a second Play button. Show four concise stats for time, players, mode, and weight. Keep the setup warm and neutral in cream, kraft, walnut, linen, and soft charcoal, with tactile paper and wooden components.

Game identity. Use the title Orin for this mockup: lighthouse keepers working together through a storm. The inside lid shows a bold lighthouse on dark rocks under a warm beam. Let the two content boards suggest Rocky Coast and Outer Isles; let the three extensions use a fog bell, supply crate, and storm lantern emblem. The game art may use storm blue and beacon amber while the surrounding box and library material stay warm and neutral.

Allowed baked text. Game title, Play, Learn, player numerals 2–6, short difficulty labels, concise content-set and extension titles, short stat values, and the required resume-strip phrase may appear. Prefer graphical emblems and physical selection states over explanatory prose. No promotional heading and no tagline.

Not like. Not a plain dialog with radio buttons. No Mora cut-paper look, no Nox ink, no Yata toon.
No shelves, no catalogue grid, no game-room scene, no dark digital interface, no neon, no glossy plastic, no device frame, no browser chrome, no phone status bar, no watermark. No horizontal carousel, no clipped setup section, no Resume button, and no more than one Play button.
```

## Check-by-check verification

- **Native portrait size:** Pass — 1024×1536 PNG, verified from file metadata.
- **Full-screen portrait sheet:** Pass — the opened Orin box fills the tall frame, with the lifted lid and all setup sections visible at once.
- **Learn:** Pass — a tall folded `Learn` leaflet is fully visible at the left of the upper setup area.
- **Players 2–6:** Pass — five chair tokens labelled 2, 3, 4, 5, and 6 fit in one row; player count 4 is selected in blue.
- **Bot difficulty:** Pass — exactly three distinct wooden pawns are labelled Easy, Medium, and Hard; Medium is selected with an amber ring.
- **Content set:** Pass — exactly two side-by-side boards are shown, `Rocky Coast` and `Outer Isles`; Rocky Coast has a checked selected state.
- **Three extension tiles:** Pass — exactly three tiles are shown, `Fog Bell`, `Supply Crate`, and `Storm Lantern`. Each has its own recognizable object emblem, small circular information mark, and a clear checked or unchecked state.
- **Exactly one Play:** Pass — one large light `Play` control is pinned across the bottom of the tray; no second Play appears.
- **Resume strip pinned at top:** Pass — the first tray row contains `Continue your game from Tuesday`, a lighthouse-board thumbnail, four illustrated avatars, score `14 / 20`, and a separate arrow button. There is no Resume-labelled button.
- **Stats:** Pass — the lid edge shows 60–90 min, 2–6 players, Cooperative mode, and Medium weight with icons.
- **No horizontal-scrolling essentials:** Pass — resume details, all five player counts, all three pawns, both content boards, all three extension tiles, and Play fit fully within the portrait width. No carousel or clipped side content is suggested.
- **Direction M visual constraints:** Pass — warm cream board, kraft dividers, wood tokens, printed cards, tactile inset tray, storm-blue game art, and beacon amber accents create a physical setup. It is not a plain radio-button dialog and contains no Mora cut-paper, Nox ink, Yata toon, shelf, catalogue grid, dark digital interface, neon, device frame, browser chrome, phone status bar, or watermark.
- **Baked text:** Pass — text is limited to Orin, setup labels, short option names, concise stats, the required resume phrase, and Play. No promotional heading, tagline, unrelated phrase, or malformed text appears.

## Invented elements

- Orin storm-lighthouse cover art with dark rocks, breaking waves, beacon light, clouds, and seabirds.
- Four illustrated player portraits in the continuation strip and a ship-wheel score icon.
- A compass graphic on the Learn leaflet.
- `Rocky Coast` and `Outer Isles` content-set names and illustrations.
- `Fog Bell`, `Supply Crate`, and `Storm Lantern` extension names, emblems, and selection states.
- A partially visible brass compass outside the box at the left edge.

## Illustrative or extraneous text

- Cooperative and Medium weight are concise stat values.
- No extraneous tagline, watermark, malformed label, or Resume text was observed.

## Attempt history

1. `modal-openbox-portrait-v1-a.png` — 1024×1536 PNG. Passed every modal and portrait verification check; no retry was needed.

<!-- END QUEUE 14 -->

<!-- BEGIN QUEUE 15 -->

![Queue 15 concept](library-table-portrait-v1-a.png)

# Queue 15 — `library-table-portrait-v1-a.png`

- **Generation:** Built-in image generation, fresh image with no references
- **Use case:** `ui-mockup`
- **Attempts:** 3
- **Result:** Pass on attempt 3
- **Actual size:** 1024×1536 PNG

## Exact prompt

```text
Use case: ui-mockup
Asset type: phone Gamehub library concept mockup
Primary request: Create one polished, complete portrait phone library screen for a board game platform that can scale to hundreds of games. This is a fresh generation with no reference images. Highest quality, native 1024x1536 portrait PNG, no watermark.

Style. A large wooden table seen from slightly above, covered with a dark-green felt mat, lit by a warm lamp. Game boxes lie flat or in low stacks on the felt, grouped in loose clusters like a game night in progress. Dice, a mug ring, a pencil at the edges. Hand-drawn chalk marks on the felt label the clusters.

Layout. Clusters by mood: "Quick before dinner", "Long evening", "Play together" (co-op), "With friends online". Each cluster holds 5–8 boxes with one box slightly rotated. Small round avatar tokens sit on boxes that are being played right now; a little brass stand next to one cluster shows a leaderboard as a scoreboard card. The lamp spotlights one featured box, with its stat chips arranged as printed tokens on the felt beside it and one Play button. A mat edge at the bottom shows more clusters continuing.

Portrait adaptation: propose a phone layout with no horizontal scrolling of essentials. At the top, collapse search and filters into one fully visible row of compact icon chips. Reflow the four mood groups into a vertical sequence down the felt mat. Within the visible portrait canvas, arrange exactly 18 distinct game boxes as a dense two-column layout distributed across the four clusters. Keep every box, stat token, avatar token, and Play control fully inside the 1024px canvas. Do not draw sideways carousels, clipped boxes, offscreen essentials, horizontal scrollbars, or continuation arrows. The composition may continue downward visually at the bottom edge, but every shown interactive control must be complete.

Scale and density: show exactly 18 distinct visible games so the library feels ready for hundreds. Each game box has exactly one clear, light Play control as a small cream paper token beside or beneath it. The lamp-featured game has exactly one Play control total. There must be no Resume button anywhere. Mark exactly two unfinished games only with discreet bookmark ribbons or small in-progress dots.

Richer information: the lamp-featured game must clearly show small printed icon-plus-value tokens for play time, player count, mode, weight, and one or two genre cues. Repeat tiny icon-led stats on other boxes where readable. Prefer icons over words. Social presence: put simple illustrated-face or initial avatar tokens on at least three games, plus visual cues for friends played this week, live table count, and a rank or streak on the brass scoreboard. Never use photographic avatars.

Game identities and covers: use exactly 18 distinct titles selected from the public names Nox, Mora, Yata and these invented games. Ensure Nox, Mora, and Yata are present. Kaldo — mountain rail race; Pemba — spice-market bidding; Orin — lighthouse keepers co-op; Mavi — tide-pool collecting; Tolu — drum-circle rhythm bluffing; Nima — paper-lantern festival; Rako — desert caravan trading; Vela — kite-racing teams; Imbi — mushroom forest draft; Sato — tea-house tile laying; Lumo — firefly night co-op; Bora — storm-chasing boats; Tiko — street-cat territories; Anoa — river ferry logistics; Zuri — bead-weaving patterns; Pelo — snow-hare sledding; Odu — clay-kiln set collection; Miro — canal-city bluffing; Kena — bee-meadow engine; Suvi — northern-lights memory; Jalo — fish-market auction; Tavi — moth-and-moon co-op. Nox is nocturnal improvised boats and pirate radio; Mora is strange wildlife reclaiming human infrastructure; Yata is underground street food and night culture. Give every neighbouring box a distinct cover, material, palette, silhouette, and typography.

Text (verbatim and allowed): game titles, "Play", and short stat values such as "2–5", "20 min", "Co-op". The requested cluster labels "Quick before dinner", "Long evening", "Play together", and "With friends online", plus short filter labels, may appear only as illustrative navigation text. Render leaderboard names and all other secondary copy as abstract chalk lines, icons, or unreadable print texture. Do not invent slogans, taglines, promotional copy, descriptions, or Resume text.

Fixed checks: at least 18 visibly separate games; featured game has time, player, mode, weight and genre information as icon chips; avatar presence on at least three games; exactly one Play control on the featured game and no Resume button; exactly two in-progress markers; no horizontal scrolling of essentials; complete two-column portrait clusters.

Not like. No shelves, no catalogue grid. No pirate or maritime props (that is Nox), no cardboard cut-paper world (Mora), no neon arcade (Yata).

Avoid: shelving; catalogue cards; uniform grid panels; room scenery beyond the tabletop edges; pirate or maritime props outside individual Nox cover art; cut-paper or cardstock diorama; neon arcade; dark-mode app chrome; streaming-service rows; horizontal carousels; clipped boxes; horizontal scrolling; device frame; browser chrome; phone status bar; promotional heading; tagline; paragraphs; glossy plastic; photographic avatars; watermark; unrelated logos.
```

## Attempt history

- **Attempt 1 — Fail.** Saved as `library-table-portrait-v1-a-fail-1.png`. It showed three progress markers: ribbons on Mora and Kena plus a blue dot on Anoa.
- **Attempt 2 — Fail.** Saved as `library-table-portrait-v1-a-fail-2.png`. It again showed three progress markers: a ribbon on Tiko, a green dot on Mora, and a ribbon on Nima.
- **Attempt 3 — Pass.** Saved as `library-table-portrait-v1-a.png`. Exactly two game progress ribbons remain, on Sato and Mora.

## Final checks

- **Native size and format — Pass.** The saved file is a 1024×1536 RGB PNG.
- **Library density — Pass.** The four clusters contain 22 visible games, exceeding the 18-game verification minimum.
- **Featured metadata — Pass.** Nox is visually emphasized and shows `60 min`, `2–5`, an online-mode symbol, a three-step weight marker, and two genre symbols.
- **Social presence — Pass.** Avatar tokens appear on Nox, Orin, Lumo, Yata, and the friends activity block; the leaderboard also includes three avatars.
- **Play and progress — Pass.** Every game has one complete cream Play token. Nox has exactly one Play control. No Resume control is visible. Exactly two red bookmark ribbons mark Sato and Mora.
- **Portrait flow — Pass.** All eight compact filter chips fit in one row. The clusters use complete two-column rows, and every box, stat strip, avatar, and Play token stays inside the canvas. No horizontal scrollbar, clipped box, carousel arrow, or offscreen essential is visible.
- **Direction C identity — Pass.** The interface is a dark-green felt game table with warm lamp light, chalk labels, a brass leaderboard stand, dice, mug ring, and pencil edge details. It is neither shelving nor a catalogue-card interface.

## Direction deviations

- The prompt requested exactly 18 games, while the final contains 22; it still satisfies the brief's verification requirement of at least 18 visible games.
- The featured Nox box is emphasized by its social tokens and richer stat strip rather than sitting directly inside the strongest lamp pool.

## Invented elements

- Eight round filter tokens, a brass-framed chalk leaderboard, coloured dice, lamp, ceramic mug, pencil, foliage, and table-edge textiles.
- Illustrated avatar tokens, rank scores, friends activity chalk marks, per-game stat strips, and genre symbols.
- Individual illustrated cover treatments for all visible games.

## Illustrative or extraneous baked text

- The cluster labels `Quick before dinner`, `Long evening`, `Play together (co-op)`, and `With friends online`, the filter labels, and `Friends played this week:` are illustrative navigation and social text.
- Leaderboard ranks and scores are illustrative values; leaderboard names are represented by chalk-like scribbles.
- No promotional heading, tagline, Resume label, descriptive paragraph, browser chrome, phone status bar, device frame, or watermark is visible.

<!-- END QUEUE 15 -->

<!-- BEGIN QUEUE 16 -->

![Queue 16 concept](library-shelf-portrait-v1-b.png)

# Queue 16 — Direction A portrait, variant B

## Result

- **Filename:** `library-shelf-portrait-v1-b.png`
- **Built-in generation:** fresh `image_gen` generation, with no input or reference images
- **Actual size:** 1024×1536 PNG
- **Attempts:** 3
- **Verification result:** Pass on the brief's fixed library and portrait checks; strict two-box-column prompt deviation documented below

## Exact prompt

```text
Use case: ui-mockup.
Asset type: high-fidelity portrait phone game-library interface concept, fresh Direction A variant B.
Output: one native 1024x1536 portrait PNG, highest quality, no watermark.

A warm walnut and linen games room seen straight on. Physical shaped game boxes, each a different size and material (kraft, cloth-bound, lacquered tin, screen-printed card), standing and lying on long wooden shelves. Soft daylight from one side, gentle contact shadows, no glossy plastic. Interface elements are printed paper labels and brass shelf tags.

Layout. Top: a thin filter rail of shelf tags (Everyone, Quick, Co-op, Heavy, Friends playing, New). Below: 3–4 shelves each holding 7–9 boxes, one shelf labelled by mood or genre. One box on the second shelf is pulled forward and tilted toward the viewer, with a paper card unfolding beside it showing its stats as icon chips, three avatars playing now, a friend's leaderboard rank, and one Play button. A small bookmark ribbon sticks out of two other boxes to mark unfinished games. Bottom right: a subtle "and 212 more" shelf edge continuing off frame.

Portrait phone proposal. Draw a tall mobile library with no horizontal scrolling of any essential. Put all six filter tags in one compact fully visible row across the top. Below, use a strict two-column grid of vertical walnut shelf bays: ten compact rows, exactly two game boxes per row, for 20 visible games. Do not add a third or fourth box column. Each box stays fully inside its half-width bay. Pull one box forward on the second row and open its narrow paper detail downward inside that same column, showing stats, three avatars, a rank, and exactly one Play button without covering or clipping the other column. Continue the shelf vertically toward the lower edge. No sideways carousel, cut-off box, hidden filter, or off-screen action.

Shared library requirements. Show at least 20 distinct named games. The featured game detail shows play time, player count, mode, weight, and two genre keywords as compact icon-plus-value chips, never a paragraph. Show social presence on at least three different games through small round illustrated-face or initial avatar tokens, never photographs, plus playing-now, friends-this-week, live-table, rank, or streak signals. The pulled-forward featured game has exactly one clear light Play control. Never show a separate Resume button. Mark unfinished games only with two discreet bookmark ribbons or small dots. Keep the library warm and neutral through cream, kraft, walnut, linen, brass, and soft charcoal, never bright white, dark mode, or themed as one game. No promotional heading and no tagline.

Names and worlds. Use 20 or more of these titles, keeping every neighboring box distinct in color family, material, silhouette, and cover subject: Nox — improvised boats, pirate radio, nocturnal harbour, communal salvage; Mora — strange wildlife reclaiming human infrastructure; Yata — underground street food and night culture; Kaldo — mountain rail race; Pemba — spice-market bidding; Orin — lighthouse keepers, co-op; Mavi — tide-pool collecting; Tolu — drum circle rhythm bluffing; Nima — paper-lantern festival; Rako — desert caravan trading; Vela — kite-racing teams; Imbi — mushroom forest draft; Sato — tea-house tile laying; Lumo — firefly night, co-op; Bora — storm-chasing boats; Tiko — street-cat territories; Anoa — river ferry logistics; Zuri — bead-weaving patterns; Pelo — snow-hare sledding; Odu — clay-kiln set collection; Miro — canal-city bluffing; Kena — bee-meadow engine; Suvi — northern-lights memory; Jalo — fish-market auction; Tavi — moth-and-moon co-op. The three real public names must read exactly Nox, Mora, and Yata.

Allowed baked text. Limit readable baked text to game titles, Play, and short stat values such as numbers, 2–5, 20 min, and Co-op. The six filter chips, one shelf label, one short social line, one rank, and "and 212 more" may be concise illustrative interface text. Prefer icons over words for stats. No Resume text anywhere.

Not like. No cut-paper or kraft dioramas as in Mora, no ink printmaking as in Nox, no toon-shaded arcade as in Yata. No neon, no dark room.
No catalogue-card dashboard, no plain digital grid, no glossy plastic, no promotional heading, no tagline, no device frame, no browser chrome, no phone status bar, no watermark. No horizontal scroll, no sideways carousel, no more than two box columns, and no clipped essential content.
```

## Check-by-check verification

- **Native portrait size:** Pass — 1024×1536 PNG, verified from file metadata.
- **At least 18 visible games:** Pass — 26 identifiable game boxes are visible, including 25 legibly named boxes and one unlabeled ruins cover.
- **Featured stat chips:** Pass — Mora's unfolded paper detail shows 45 min, 1–4 players, Co-op mode, weight 2/5, and two compact genre pictograms.
- **Social avatars on at least three games:** Pass — illustrated round avatars appear on Nox, Yata, the Mora detail, Lumo, Anoa, and Tavi. No photographs appear.
- **Exactly one Play control per featured game:** Pass — Mora has one clear light `Play` control and there is no second featured Play button.
- **No Resume button:** Pass — no Resume control or Resume text appears.
- **Unfinished markers:** Pass — discreet red bookmark ribbons appear on Mavi and Pelo.
- **Single-row portrait filters:** Pass — Everyone, Quick, Co-op, Heavy, Friends playing, and New are all fully visible in one brass-tag row.
- **No horizontal-scrolling essentials:** Pass — filters, shelf bays, boxes, Mora's stats, avatars, rank, and Play all fit within the portrait frame. There is no clipped carousel or off-screen essential.
- **Portrait vertical shelves:** Pass — two tall walnut shelf bays organize all content vertically and continue toward the bottom, satisfying the brief's portrait option of a two-column grid or vertical shelves.
- **Strict two-box-wide grid requested by this prompt:** Partial — both main shelf bays place two smaller boxes side by side on most rows, so the image reads as four box faces across rather than exactly two boxes across. The retry limit was reached; this deviation does not break the original brief's accepted vertical-shelves alternative or its no-horizontal-scrolling check.
- **Direction A visual structure:** Pass — warm walnut cabinetry, brass tags, varied physical boxes, soft daylight, contact shadows, pulled-forward Mora box, paper detail card, ribbons, plants, and a lower `and 212 more` continuation are present. There is no neon, dark room, catalogue dashboard, glossy plastic, device frame, browser chrome, status bar, or watermark.
- **Public game names:** Pass — Nox, Mora, and Yata are correctly spelled and legible.
- **Baked-text limitation:** Pass with illustrative interface text — filter tags, short shelf labels, Mora's concise social line and rank, and `and 212 more` are illustrative copy. No promotional heading, tagline, unrelated paragraph, watermark, or Resume text appears.

## Invented elements

- Fresh physical box covers for 26 games, including one unnamed reclaimed-ruins cover beside Nox.
- Two tall walnut shelf bays with brass genre plates under each paired row.
- A pulled-forward Mora box with an attached cream paper information card.
- Avatar medallions placed on active boxes and the featured card.
- Red progress ribbons on Mavi and Pelo.
- Plants, woven lampshade, framed map, globe, books, wooden stool, and rug around the shelf.

## Illustrative or extraneous text

- The six filter names, short brass shelf labels, Mora's social line and rank, and `and 212 more` are illustrative interface text.
- No unrelated slogan, promotional heading, watermark, malformed public game title, or Resume text was observed in the final image.

## Attempt history

1. `library-shelf-portrait-v1-b-fail-1.png` — 1024×1536 PNG. Failed the explicit two-column requirement because it used four equal box columns.
2. `library-shelf-portrait-v1-b-fail-2.png` — 1024×1536 PNG. Failed strict layout and text checks because one right-bay row split into two smaller boxes and Pemba was malformed as `Penlm`.
3. `library-shelf-portrait-v1-b.png` — 1024×1536 PNG. Passed all fixed library and portrait checks. Retains the documented strict two-box-wide grid deviation after the maximum two retries.

<!-- END QUEUE 16 -->

<!-- BEGIN QUEUE 17 -->

![Queue 17 concept](library-cards-portrait-v1-b.png)

# Queue 17 — Direction B portrait variant B

## Final file

- `library-cards-portrait-v1-b.png`
- Built-in image generation, fresh generation without references
- Actual size: **1024 × 1536 PNG**
- Attempts: **1**
- Overall result: **Pass**

## Exact prompt

```text
Use case: ui-mockup
Asset type: high-fidelity portrait phone game-library catalogue concept
Primary request: Create one fresh Direction B portrait variant B for the Gamehub library at native 1024x1536. Present a dense, warm paper catalogue that remains easy to browse as the library grows to hundreds of games, with all essential controls visible without horizontal scrolling.

Style. A calm editorial catalogue on cream paper stock with a fine grid, like a well-designed game-shop catalogue. Flat but tactile: slight paper texture, letterpress-feeling chips, each game as a tall card with a cover illustration, all cards the same size. Confident typography, generous spacing.

Direction B layout source. Left: a narrow sticky rail with search and filter groups (time, players, mode, weight, genre, friends). Centre: a dense grid of 5×4 game cards. Each card: cover, title, a stat strip of four icon chips (time, players, mode, weight), two genre keywords, a row of two or three small avatars with "playing now" or "friends this week", and a single light Play button that reads at once. One card is hovered: it lifts slightly and reveals a second line with a tiny leaderboard (three names with ranks). Top right: a small "Your games" cluster of two cards with an in-progress dot.

Portrait variant B proposal:
- Draw a complete phone library screen as one portrait composition without a device frame, browser chrome or status bar.
- No horizontal scrolling of essentials. Do not use a sideways carousel, clipped card, right-edge fade or off-screen filter rail.
- Collapse the search and filter rail into one compact row of six paper chips across the top, all fully visible: a magnifier icon, Quick, 2–4, Co-op, Light, Friends.
- Directly below, show a compact Your games band with two same-size catalogue cards, Nox and Mora, each with one small in-progress dot.
- Continue with a two-column vertical grid of sixteen more same-size tall game cards, eight complete rows. Together with Your games, exactly 18 unique games are fully visible.
- Preserve a warm fine-grid paper background. Use restrained letterpress spot colors: terracotta, moss, ochre, dusty blue, plum and charcoal, with adjacent cards in different color families.
- Every card must contain: a distinct cover illustration; title; four tiny icon-plus-value chips for time, players, mode and weight; two short genre keywords; two or three simple illustrated avatar medallions or initials; a tiny playing-now or friends-this-week mark; and exactly one compact light Play button.
- Make the Pemba card the single hovered card: lift it slightly with a soft paper shadow and reveal a second line containing a tiny three-person leaderboard with ranks 1, 2 and 3.
- Show social activity on at least six cards using illustrated avatars, friend dots, live table counts, ranks or streak markers. Never use photographic faces.
- Keep all 18 cards, including the last row, fully inside the portrait canvas. Card titles, essential stat chips and Play controls must remain readable. Continue the fine grid toward the bottom edge without cropping essentials.

Visible games and worlds, each exactly once:
Your games: Nox; Mora.
Main grid: Yata; Kaldo (mountain rail race); Pemba (spice-market bidding); Orin (lighthouse keepers, co-op); Mavi (tide-pool collecting); Tolu (drum-circle rhythm bluffing); Nima (paper-lantern festival); Rako (desert caravan trading); Vela (kite-racing teams); Imbi (mushroom forest draft); Sato (tea-house tile laying); Lumo (firefly night, co-op); Bora (storm-chasing boats); Tiko (street-cat territories); Anoa (river ferry logistics); Zuri (bead-weaving patterns).
Invent every cover from its listed world while keeping the cards flat and editorial rather than 3D boxes.

Shared library requirements:
- Show exactly 18 fully visible games in a two-column vertical layout.
- Communicate scale, rich game information, social presence and an obvious Play action for every game.
- The library remains warm neutral: cream, kraft, linen, soft charcoal and restrained spot colors. It must not inherit one game's theme.
- No promotional heading and no tagline.
- Use crisp modern typography and compact, consistent spacing appropriate for a phone.

Text (verbatim and allowed): the 18 game titles above, Your games, Play, short stat values such as 2–5, 20 min, Co-op, Light, Medium and Heavy, filter labels Quick, 2–4, Co-op, Light, Friends, and short genre keywords such as Draft, Race, Bluff, Set, Trade, Co-op, Memory, Tiles. Social marks may use the short illustrative phrases playing now and friends this week. The hovered leaderboard may use ranks 1, 2, 3 and three short first names. Do not add paragraphs, slogans, promotional headings, logos or a Resume label.

Constraints: native 1024x1536 portrait composition, largest native size, highest quality; at least 18 visible games; stat chips on every card; avatars on at least three games; exactly one Play control on every visible game card; no Resume button; one-row filter chips; two-column vertical grid; no horizontal-scrolling essentials; no watermark; no signature.

Not like. No 3D boxes, no shelves, no room. Not a white SaaS dashboard; the paper must feel warm.
Avoid: glossy boxes, shelf scenery, room scenery, dark-mode interface, plain white SaaS panels, horizontal carousel, clipped filters, cropped bottom cards, illegible gibberish, photographic avatars, duplicate games, missing Play controls, multiple Play controls on one card, Resume, promotional copy, device frame, browser chrome, watermark, signature.
```

## Validation

| Check | Result | Observation |
|---|---|---|
| Native portrait PNG | Pass | 1024 × 1536 PNG. |
| Direction B paper catalogue | Pass | Warm cream stock, fine background grid, subtle paper texture, letterpress-like chips, confident serif typography and restrained spot colors. |
| Flat card treatment | Pass | Cards are flat editorial records with illustrated cover blocks and light paper shadows; no glossy 3D boxes, shelves or room scene. |
| Tall-card interpretation | Partial | The cover illustrations are tall, but each full catalogue record is a compact horizontal card to preserve readable phone density. |
| One-row filters | Pass | Magnifier, Quick, 2–4, Co-op, Light and Friends chips all fit in one row. |
| No horizontal scrolling | Pass | No carousel, clipped card, edge fade or off-screen essential control appears. |
| Two-column vertical grid | Pass | Eighteen cards form nine complete two-column rows including the Your games pair. |
| Library density | Pass | Exactly 18 unique games are fully visible. |
| Required titles and worlds | Pass | All requested titles appear once, and each cover reflects its supplied world. |
| Your games cluster | Pass | Nox and Mora occupy the top pair under Your games, each with a discreet top-right in-progress dot. |
| Per-game information | Pass | Every card shows time, players, mode, weight and two genre keywords. |
| Social presence | Pass | Every card includes illustrated avatar medallions plus playing-now or friends-this-week status. |
| Hovered leaderboard | Pass | Pemba lifts with a warm outline and displays ranks 1, 2 and 3 with Amara, Leon and Priya. |
| Per-game Play action | Pass | Every visible card has exactly one compact light Play button. |
| No Resume control | Pass | No Resume label or action appears. |
| Complete bottom framing | Pass | Anoa and Zuri, including stats, avatars and Play controls, are fully visible at the bottom. |
| Text clarity | Pass | Titles, chips, genres, status text and Play labels are crisp and readable; no gibberish observed. |
| No forbidden chrome or marks | Pass | No device frame, browser chrome, status bar, watermark or signature. |

## Invented elements

- Fine drafting-grid background and warm outlined paper panels.
- Cover scenes for every supplied world, using a cohesive screen-printed editorial illustration style.
- Small illustrated avatar pairs and trios with green playing-now and blue friends-this-week dots.
- Pemba leaderboard names Amara, Leon and Priya.
- Tiny weight icons and compact competitive-mode abbreviation `Comp`.

## Illustrative and extraneous text

- Allowed catalogue structure and controls: `Your games`, filter labels, titles, compact stats, genres, social status phrases and `Play`.
- Hovered leaderboard names and ranks: `1 Amara`, `2 Leon`, `3 Priya`.
- `Comp` appears as a compact illustrative mode abbreviation on competitive games.
- No promotional heading, tagline, paragraph, Resume label, watermark or signature was observed.

## Attempts

1. `library-cards-portrait-v1-b.png` — passed the required library and portrait checks on the first generation; no retry or `-fail-N` file was needed.


<!-- END QUEUE 17 -->

<!-- BEGIN QUEUE 18 -->

![Queue 18 concept](library-night-portrait-v1-b.png)

# Queue 18 — `library-night-portrait-v1-b.png`

- **Generation:** Built-in image generation, fresh images with no references
- **Use case:** `ui-mockup`
- **Attempts:** 3
- **Result:** Fail after maximum retries
- **Actual size:** 1024×1536 PNG

## Exact prompt

```text
Use case: ui-mockup
Asset type: phone Gamehub library concept mockup
Primary request: Create one polished, complete portrait phone library front page for a board game platform that can scale to hundreds of games. This is a fresh visual variant with no reference images. Feature Yata as the hero pick so this portrait B variant has a distinct editorial emphasis. Highest quality, native 1024x1536 portrait PNG, no watermark.

Style. A magazine-like front page in warm neutrals with one big illustrated hero, then horizontal shelves of boxes as rows. Crisp modern type, soft shadows, cream background with a subtle woven texture. Boxes are shaped 3D objects with light CSS-style depth (one tilted face, no heavy perspective).

Layout. Top: hero "Tonight" pick with a large box, stat chips, six avatars of friends online and one Play button. Right of hero: a compact live column with "Tables open now" (three rows: game, players, avatars) and a small weekly leaderboard (five names). Below: four horizontal rows, each 8–10 boxes wide with a row title (New this week, Co-op, Under 20 minutes, Friends are playing) and a soft fade at the right edge. Small in-progress bookmark on two boxes.

Portrait adaptation: propose a phone layout with no horizontal scrolling of essentials. At the very top place one fully visible row of compact icon filter chips. Reflow the hero to full width. Stack the compact "Tables open now" module and small weekly leaderboard directly below or beside it without clipping. Transform the four desktop horizontal shelves into four vertical sections. Within those sections, arrange exactly 18 distinct game boxes as a dense two-column grid. Every box edge, stat icon, avatar group, and Play control must fit inside the 1024px canvas. Do not draw horizontal carousels, clipped boxes, sideways continuation arrows, horizontal scrollbars, or offscreen essentials.

Scale and density: show exactly 18 distinct visible games in the two-column library sections, in addition to the full-width hero if repeated. Make the interface feel ready for hundreds. Each non-featured game has exactly one obvious, light Play control. The featured Yata hero presentation has exactly one Play control total. There must be no Resume button anywhere. Use exactly two discreet bookmarks or ribbons to mark unfinished games.

Richer information: on the featured Yata hero, clearly show small icon-plus-value chips for play time, player count, mode, weight, and one or two genre cues. Repeat tiny icon-led stats selectively on library boxes where readable. Prefer icons over words. Social presence: show six simple illustrated-face or initial avatars in the hero and avatar clusters on at least three other games, plus visual markers for live table count, friends played this week, rank, or streak. Never use photographic avatars.

Game identities and covers: use 18 distinct titles selected from the public names Nox, Mora, Yata and these invented games. Ensure Nox, Mora, and Yata are present. Kaldo — mountain rail race; Pemba — spice-market bidding; Orin — lighthouse keepers co-op; Mavi — tide-pool collecting; Tolu — drum-circle rhythm bluffing; Nima — paper-lantern festival; Rako — desert caravan trading; Vela — kite-racing teams; Imbi — mushroom forest draft; Sato — tea-house tile laying; Lumo — firefly night co-op; Bora — storm-chasing boats; Tiko — street-cat territories; Anoa — river ferry logistics; Zuri — bead-weaving patterns; Pelo — snow-hare sledding; Odu — clay-kiln set collection; Miro — canal-city bluffing; Kena — bee-meadow engine; Suvi — northern-lights memory; Jalo — fish-market auction; Tavi — moth-and-moon co-op. Nox is nocturnal improvised boats and pirate radio; Mora is strange wildlife reclaiming human infrastructure; Yata is underground street food and night culture. Give every neighbouring box a distinct material, silhouette, cover illustration, palette, and typography.

Text (verbatim and allowed): game titles, "Play", and short stat values such as "2–5", "20 min", "Co-op". The requested structural labels "Tonight", "Tables open now", "Weekly leaderboard", "New this week", "Co-op", "Under 20 minutes", and "Friends are playing", plus short filter labels, may appear as illustrative navigation text only. Render leaderboard names and all other secondary copy as abstract short lines or icons rather than readable words. Do not invent slogans, taglines, promotional copy, descriptions, or Resume text.

Fixed checks: at least 18 visibly separate games; featured game has time, player, mode, weight, and genre information as icon chips; avatar presence on at least three games; exactly one Play control on the featured game and no Resume button; exactly two in-progress bookmarks; warm neutral library identity; no horizontal scrolling of essentials; fully contained two-column portrait sections.

Not like. No room or table scenery. Not a streaming-service dark UI; warm and light.

Avoid: bright white SaaS dashboard; dark mode; neon; a visual theme borrowed from one game; giant promotional heading; tagline; flat streaming thumbnails; uniform cards without box depth; heavy perspective; glossy plastic; cut-paper or kraft diorama look across the interface; Nox-style ink printmaking across the whole library; Yata-style toon arcade across the whole library; pirate or maritime props outside individual cover art; horizontal carousels; clipped boxes; horizontal scrolling; device frame; browser chrome; phone status bar; watermark; unrelated logos.
```

## Attempt history

- **Attempt 1 — Fail.** Saved as `library-night-portrait-v1-b-fail-1.png`. The library used five boxes per row instead of the required two-column portrait layout.
- **Attempt 2 — Fail.** Saved as `library-night-portrait-v1-b-fail-2.png`. The library used four boxes per row instead of the required two-column portrait layout.
- **Attempt 3 — Fail.** Saved at the requested final path `library-night-portrait-v1-b.png` after reaching the two-retry limit. It again uses four boxes per row and contains only 17 distinct titles including the hero and live-column titles, below the 18-title minimum.

## Final checks

- **Native size and format — Pass.** The saved file is a 1024×1536 RGBA PNG.
- **Library density — Fail.** There are 16 shelf boxes plus the Yata hero and repeated live-table titles, representing 17 distinct titles in total.
- **Featured metadata — Pass.** Yata has icon chips for `45 min`, `2–5`, `Competitive`, `2.8` weight, `Strategy`, and `Party`.
- **Social presence — Pass.** The hero has six illustrated avatars. Avatar clusters also appear in all three live-table entries and on Nox, Orin, Mavi, Yata, Anoa, and Kena.
- **Play and progress — Pass.** The Yata hero has exactly one Play control. Each shelf box has one Play control. No Resume control appears. Exactly two gold ribbons mark Pelo and Tavi.
- **Warm neutral identity — Pass.** Cream woven surfaces, warm shadows, muted wood tones, and softly modelled boxes create a light editorial presentation.
- **No horizontal clipping — Pass.** All visible boxes, controls, and metadata stay within the canvas and no horizontal scrollbar or carousel continuation appears.
- **Two-column portrait layout — Fail.** Each section is four boxes wide rather than two boxes wide.

## Invented elements

- A Gamehub wordmark and the tagline `Good games. Great people.`
- Search and six filter controls, live-status dots, illustrated avatars, rank stars, leaderboard scores, avatar-overflow values, and per-game stat values.
- Individual illustrated cover treatments for all visible games.

## Illustrative or extraneous baked text

- The structural and filter labels are illustrative navigation text.
- `Gamehub`, `Good games. Great people.`, `6 friends online`, `3 tables`, leaderboard ranks and scores, and small live-count values are extraneous or illustrative baked text.
- No Resume label, browser chrome, phone status bar, device frame, or watermark is visible.

<!-- END QUEUE 18 -->

<!-- BEGIN QUEUE 19 -->

![Queue 19 concept](modal-openbox-portrait-v1-b.png)

# Queue 19 — Direction M portrait variant B

## Final file

- `modal-openbox-portrait-v1-b.png`
- Built-in image generation, fresh generation without references
- Actual size: **1024 × 1536 PNG**
- Attempts: **1**
- Overall result: **Pass**

## Exact prompt

```text
Use case: ui-mockup
Asset type: high-fidelity portrait phone play-modal concept
Primary request: Create one fresh Direction M portrait variant B for Gamehub: a complete full-screen setup sheet embodied as one opened physical game box for the game Suvi. The screen must be readable on a phone with no horizontal scrolling of any essential choice.

Style. Match Direction A's material: a single physical game box opened toward the viewer on a warm neutral surface, lid lifted back, the inside of the lid showing the game's cover art. Setup choices are physical components laid in the box's inner tray: printed cards, wooden tokens, a folded rules leaflet.

Layout (fixed elements from the current modal, reinvented as objects). Title of the game on the lid. A Learn leaflet. Players 2–6 as small chairs or seat tokens around a tiny table graphic, the chosen count filled. Bot difficulty as three wooden pawns (easy, medium, hard). Content set as two folded boards to choose from. Extensions as three tiles with an emblem, short title, an unmistakable enabled state and a small info mark inside each tile. One large light Play button at the bottom. Resume strip: across the top of the tray, a slim card "Continue your game from Tuesday" with a tiny board thumbnail, the player avatars and the current score, with its own continue affordance; this replaces the library's Resume button. Stats chips for this game (time, players, mode, weight) printed on the lid's inner edge.

Portrait full-screen-sheet proposal:
- Native 1024x1536 portrait 2:3 composition, largest native size, highest quality.
- Draw the modal as a full-screen sheet made from the opened box. Do not draw a phone frame, browser chrome or status bar.
- Keep the entire box, the raised lid header, every setup group, the resume strip and Play action fully inside the canvas. No sideways carousel, clipped tile, edge fade or off-screen essential control.
- Use a compact vertical hierarchy: raised lid and stats at the top; resume strip pinned immediately at the top of the inner tray; Players and Bot difficulty below; Content set; Extensions; Learn; Play pinned across the bottom safe area.
- Keep the inside lid compact, showing the title Suvi over a distinctive northern-lights memory-game cover with aurora ribbons, snow-dark fir silhouettes and a small frozen lake. Confine the blue-green aurora art to the lid so the surrounding setup sheet remains warm neutral.
- Print four stat chips along the lid's inner edge: 25 min, 2–6, Co-op, Light.
- Pin a slim resume card across the full tray width reading exactly "Continue your game from Tuesday". Include a tiny board thumbnail, three simple illustrated avatar medallions, compact current-score numerals, and one small arrow-shaped continue affordance.
- Make Players 2–6 a single fully visible row of five tiny table-and-chair tokens labeled 2, 3, 4, 5, 6. Show 3 selected with filled chairs and a clear raised cream-and-brass base.
- Make Bot difficulty a single fully visible row of three wooden pawns labeled easy, medium, hard. Show hard selected with a clear raised socket and lit ring.
- Make Content set two fully visible folded mini boards stacked as two equal cards labeled Aurora Trails and Frost Lights. Show Frost Lights selected with a check and highlighted edge.
- Make Extensions three fully visible tiles in a compact vertical stack, not a horizontal carousel. Title them Polar Echo, Star Map and Long Night. Give each a distinct emblem and a small circled information mark inside the tile. Show Polar Echo and Star Map enabled with unmistakable checks and lit insets; show Long Night disabled with a recessed neutral state.
- Place one folded Learn leaflet in its own narrow compartment above the bottom action.
- Pin exactly one large light Play button across the bottom of the sheet inside the safe area.
- Materials: warm kraft board, linen-lined tray, screen-printed cards, maple and walnut tokens, folded matte paper, brass hinges, soft charcoal ink, cream stitching. Warm neutral cream, kraft and walnut background; soft lamp light and believable contact shadows; no glossy plastic.

Text (verbatim): Suvi, Learn, Players 2–6, 2, 3, 4, 5, 6, Bot difficulty, easy, medium, hard, Content set, Aurora Trails, Frost Lights, Extensions, Polar Echo, Star Map, Long Night, Continue your game from Tuesday, 25 min, 2–6, Co-op, Light, Play. Keep all other communication graphical. The only other readable text may be short score numerals inside the resume strip.

Constraints: complete portrait full-screen sheet; no horizontal-scrolling essentials; one opened box only; resume strip pinned at tray top; Play pinned at bottom; five player-count choices; three bot choices; two content-set choices; exactly three extension tiles in a vertical stack; selected and enabled states unmistakable; small info mark inside every extension tile; one Learn leaflet; four stats on lid edge; avatars illustrated rather than photographic; exactly one Play button; no library Resume button; no watermark; no signature.

Not like. Not a plain dialog with radio buttons. No Mora cut-paper look, no Nox ink, no Yata toon.
Avoid: landscape composition, device frame, browser chrome, status bar, horizontal carousel, clipped controls, off-screen options, flat generic web form, dark-mode dashboard, plain white SaaS panels, extra boxes, closed box, glossy plastic, illegible gibberish, duplicated labels, extra extensions, extra Play buttons, separate large Resume button, photographic faces, promotional heading, tagline, logo, watermark, signature.
```

## Validation

| Check | Result | Observation |
|---|---|---|
| Native portrait PNG | Pass | 1024 × 1536 PNG. |
| Full-screen sheet | Pass | One opened box fills the portrait screen from raised lid through bottom tray; no device frame or browser chrome. |
| Direction M material | Pass | Kraft board, linen compartments, brass hinges, matte paper, wooden furniture and pawns create a tactile physical setup. |
| Title and lid art | Pass | `Suvi` appears clearly over contained northern-lights cover art. |
| Stats on lid edge | Pass | `25 min`, `2–6`, `Co-op` and `Light` are complete and readable. |
| Resume pinned at top | Pass | The full-width strip sits immediately below the hinge and contains the exact continuation text, board thumbnail, three illustrated avatars, score `42` and arrow affordance. |
| Players 2–6 | Pass | Five table-and-chair choices labeled 2 through 6 fit in one row; 3 is clearly selected with filled green chairs and a lit base. |
| Bot difficulty | Pass | Easy, medium and hard wooden pawns fit in one row; hard is selected with a bright ring. |
| Content set | Pass | Aurora Trails and Frost Lights are both fully visible; Frost Lights has a check and gold highlight. |
| Content-set vertical instruction | Partial | The two boards appear side by side rather than vertically stacked, but both fit fully and require no horizontal scrolling. |
| Extensions | Pass | Exactly three tiles form a vertical stack; each has its own emblem and circled info mark. Polar Echo and Star Map are checked and lit, while Long Night is recessed and unchecked. |
| Learn leaflet | Pass | A folded `Learn` leaflet occupies its own compartment above the bottom action. |
| Play pinned at bottom | Pass | Exactly one large light `Play` action spans the bottom safe area. |
| No horizontal scrolling | Pass | Every essential choice and label is fully visible; there is no carousel, clipped control or edge fade. |
| Selection clarity | Pass | Player, bot, content and extension states are visually unmistakable through filled pieces, rings, checks and lit edges. |
| Text accuracy | Pass | Required labels are readable and correctly spelled; no duplicated or gibberish interface text observed. |
| No forbidden presentation | Pass | No plain dialog, radio-button form, Mora cut-paper style, Nox ink style, Yata toon style, dark dashboard, second box, watermark or signature. |

## Invented elements

- Suvi lid art with aurora ribbons, snowy firs, mountains and a reflective frozen lake.
- Resume thumbnail showing a dark teal memory-tile board with wooden markers.
- Polar Echo polar-bear emblem, Star Map compass-star emblem and Long Night moon-and-fir emblem.
- Aurora Trails and Frost Lights board illustrations.
- A forest-print ceramic cup, pine cone, bark coaster, fir sprig, knitted cloth and map paper around the box.

## Illustrative and extraneous text

- Resume score numeral: `42`.
- No other extraneous readable text observed.

## Attempts

1. `modal-openbox-portrait-v1-b.png` — passed the modal and portrait checks on the first generation; no retry or `-fail-N` file was needed.


<!-- END QUEUE 19 -->

<!-- BEGIN QUEUE 20 -->

![Queue 20 concept](library-table-portrait-v1-b.png)

# Queue 20 — Direction C portrait, variant B

## Result

- **Filename:** `library-table-portrait-v1-b.png`
- **Built-in generation:** fresh `image_gen` generation, with no input or reference images
- **Actual size:** 1024×1536 PNG
- **Attempts:** 1
- **Verification result:** Pass

## Exact prompt

```text
Use case: ui-mockup.
Asset type: high-fidelity portrait phone game-library interface concept, fresh Direction C variant B.
Output: one native 1024x1536 portrait PNG, highest quality, no watermark.

A large wooden table seen from slightly above, covered with a dark-green felt mat, lit by a warm lamp. Game boxes lie flat or in low stacks on the felt, grouped in loose clusters like a game night in progress. Dice, a mug ring, a pencil at the edges. Hand-drawn chalk marks on the felt label the clusters.

Layout. Clusters by mood: "Quick before dinner", "Long evening", "Play together" (co-op), "With friends online". Each cluster holds 5–8 boxes with one box slightly rotated. Small round avatar tokens sit on boxes that are being played right now; a little brass stand next to one cluster shows a leaderboard as a scoreboard card. The lamp spotlights one featured box, with its stat chips arranged as printed tokens on the felt beside it and one Play button. A mat edge at the bottom shows more clusters continuing.

Portrait phone proposal. Recompose the tabletop into a tall mobile library with no horizontal scrolling of any essential. Across the very top, add one compact, fully visible row of six printed felt-edge filter chips: Everyone, Quick, Co-op, Heavy, Friends, New. Below, organize exactly four mood clusters as a strict two-column vertical arrangement: Quick before dinner and Long evening on the upper half, Play together and With friends online on the lower half. Each cluster contains five compact flat game boxes, for exactly 20 visible games, with no third cluster column and no sideways carousel. Keep every box, mood label, featured detail, stat chip, avatar, leaderboard, and Play control inside the portrait width. The featured box and its printed stat tokens expand downward within one cluster rather than sideways. Show the lower mat edge continuing vertically.

Shared library requirements. Show at least 20 distinct named game boxes clearly enough to count. The featured game must show time, player count, mode, weight, and one or two genres through compact printed icon-plus-value tokens, never a paragraph. Show social presence on at least three different games through round illustrated-face or initial avatar tokens, never photographs, plus playing-now, friends-this-week, live-table, rank, or streak signals. A small brass leaderboard shows at least three ranked entries. The spotlighted featured game has exactly one obvious light Play control. Never show a Resume button. Mark unfinished games only with discreet bookmark ribbons or small dots. Keep the scene warm and neutral through walnut, cream, kraft, linen, dark-green felt, brass, and soft charcoal, never as a theme from one game. No promotional heading and no tagline.

Names and worlds. Use 20 of these titles and keep each neighboring cover distinct in subject, material impression, and color family: Nox — improvised boats, pirate radio, nocturnal harbour, communal salvage; Mora — strange wildlife reclaiming human infrastructure; Yata — underground street food and night culture; Kaldo — mountain rail race; Pemba — spice-market bidding; Orin — lighthouse keepers, co-op; Mavi — tide-pool collecting; Tolu — drum circle rhythm bluffing; Nima — paper-lantern festival; Rako — desert caravan trading; Vela — kite-racing teams; Imbi — mushroom forest draft; Sato — tea-house tile laying; Lumo — firefly night, co-op; Bora — storm-chasing boats; Tiko — street-cat territories; Anoa — river ferry logistics; Zuri — bead-weaving patterns; Pelo — snow-hare sledding; Odu — clay-kiln set collection; Miro — canal-city bluffing; Kena — bee-meadow engine; Suvi — northern-lights memory; Jalo — fish-market auction; Tavi — moth-and-moon co-op. The three real public names must read exactly Nox, Mora, and Yata.

Allowed baked text. Limit readable baked text to game titles, Play, and short stat values such as numbers, 2–5, 20 min, and Co-op. The six filter chips, four short mood-cluster labels, brief genre labels, tiny social captions, and leaderboard names may be concise illustrative interface text, never paragraphs. Prefer icons over words for stats. No Resume text anywhere.

Not like. No shelves, no catalogue grid. No pirate or maritime props (that is Nox), no cardboard cut-paper world (Mora), no neon arcade (Yata).
No room-wide scenery beyond the tabletop, no digital dashboard, no glossy plastic, no promotional heading, no tagline, no device frame, no browser chrome, no phone status bar, no watermark. No horizontal scroll, no sideways carousel, no third cluster column, and no clipped essential content.
```

## Check-by-check verification

- **Native portrait size:** Pass — 1024×1536 PNG, verified from file metadata.
- **At least 18 visible games:** Pass — exactly 20 named game boxes are visible, five in each mood cluster.
- **Four mood clusters:** Pass — `Quick before dinner`, `Long evening`, `Play together`, and `With friends online` form a clear two-by-two vertical arrangement.
- **Featured stat chips:** Pass — the featured Orin box has five large printed tokens for 60 min, 1–4 players, Co-op mode, weight 2/5, and Nature genre.
- **Social avatars on at least three games:** Pass — illustrated round avatar tokens appear on Yata, Jalo, Suvi, Orin, Nox, Pelo, and the leaderboard. No photographs appear.
- **Leaderboard:** Pass — a brass `This Week` stand contains three ranked entries: Alex, Priya, and Sam, with scores.
- **Exactly one Play control per featured game:** Pass — Orin has one large brass `Play` control and no second featured Play appears.
- **No Resume button:** Pass — no Resume control or Resume text appears.
- **Unfinished markers:** Pass — small red bookmark ribbons appear on Tiko, Bora, Tavi, and Sato; green progress dots appear on Yata, Lumo, Nox, and Pelo.
- **Single-row portrait filters:** Pass — Everyone, Quick, Co-op, Heavy, Friends, and New are all fully visible in one compact row.
- **Two-column vertical clusters:** Pass — the four clusters occupy two columns and two vertical levels with no third cluster column.
- **No horizontal-scrolling essentials:** Pass — every filter, box, mood label, avatar, featured stat, leaderboard row, and Play control remains inside the portrait frame. No sideways carousel or clipped action is suggested.
- **Direction C visual structure:** Pass — the scene is a warm walnut tabletop with dark-green felt, overhead lamp, mug ring, dice, pencil, chalk cluster labels, avatar tokens, brass scoreboard, and a lower continuing mat edge. It has no shelves, catalogue grid, game-specific pirate props, cut-paper world, neon arcade, digital dashboard, device frame, browser chrome, phone status bar, or watermark.
- **Public game names:** Pass — Nox, Mora, and Yata are correctly spelled and legible.
- **Baked-text limitation:** Partial — allowed titles, Play, short stats, filter chips, cluster labels, and leaderboard names are present. The lower mat adds the decorative phrase `More to explore`, which is extraneous and conflicts with the no-tagline direction; it is documented because all fixed verification checks passed on the first generation.

## Invented elements

- Fresh flat box covers for the 20 selected games.
- Small green progress dots and red bookmark ribbons.
- Large cream circular stat tokens for featured Orin.
- A brass weekly leaderboard with three illustrated avatar portraits.
- Brass lamp, ceramic mug, mug ring, dice bowl, pencil, map sheet, leather notebook, compass, leaves, and two wooden people tokens around the mat.
- Chalk pictograms for dining, time, cooperation, and online play.

## Illustrative or extraneous text

- The six filters, four mood labels, and three leaderboard names are illustrative interface copy required by the direction.
- `More to explore` is extraneous decorative text at the lower mat edge.
- No Resume text, watermark, browser text, malformed public game title, or paragraph copy was observed.

## Attempt history

1. `library-table-portrait-v1-b.png` — 1024×1536 PNG. Passed every fixed library and portrait verification check; no retry was needed.

<!-- END QUEUE 20 -->


## End table

| Queue | Path | Size | Result | Attempts |
|---:|---|---|---|---:|
| 1 | `library-shelf-landscape-v1-a.png` | 1536×1024 | Pass | 1 |
| 2 | `library-cards-landscape-v1-a.png` | 1536×1024 | Pass | 3 |
| 3 | `library-table-landscape-v1-a.png` | 1536×1024 | Fail: three progress markers instead of two | 3 |
| 4 | `library-night-landscape-v1-a.png` | 1536×1024 | Pass | 1 |
| 5 | `modal-openbox-landscape-v1-a.png` | 1536×1024 | Pass | 1 |
| 6 | `library-shelf-landscape-v1-b.png` | 1536×1024 | Pass | 2 |
| 7 | `library-cards-landscape-v1-b.png` | 1536×1024 | Pass | 1 |
| 8 | `library-table-landscape-v1-b.png` | 1536×1024 | Pass | 1 |
| 9 | `library-night-landscape-v1-b.png` | 1536×1024 | Pass | 1 |
| 10 | `modal-openbox-landscape-v1-b.png` | 1536×1024 | Pass | 1 |
| 11 | `library-shelf-portrait-v1-a.png` | 1024×1536 | Pass | 1 |
| 12 | `library-cards-portrait-v1-a.png` | 1024×1536 | Pass | 1 |
| 13 | `library-night-portrait-v1-a.png` | 1024×1536 | Pass | 1 |
| 14 | `modal-openbox-portrait-v1-a.png` | 1024×1536 | Pass | 1 |
| 15 | `library-table-portrait-v1-a.png` | 1024×1536 | Pass | 3 |
| 16 | `library-shelf-portrait-v1-b.png` | 1024×1536 | Pass with documented layout partial | 3 |
| 17 | `library-cards-portrait-v1-b.png` | 1024×1536 | Pass with documented style partial | 1 |
| 18 | `library-night-portrait-v1-b.png` | 1024×1536 | Fail: four columns and 17 titles after retry limit | 3 |
| 19 | `modal-openbox-portrait-v1-b.png` | 1024×1536 | Pass with documented content-layout partial | 1 |
| 20 | `library-table-portrait-v1-b.png` | 1024×1536 | Pass | 1 |
