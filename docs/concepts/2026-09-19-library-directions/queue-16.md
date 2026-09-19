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
