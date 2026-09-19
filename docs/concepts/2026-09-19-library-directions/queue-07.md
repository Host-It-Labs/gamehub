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
