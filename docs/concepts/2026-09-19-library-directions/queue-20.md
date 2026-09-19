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
