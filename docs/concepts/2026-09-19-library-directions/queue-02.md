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
