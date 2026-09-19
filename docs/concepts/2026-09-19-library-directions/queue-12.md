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
