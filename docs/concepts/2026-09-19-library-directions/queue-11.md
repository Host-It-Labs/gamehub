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
