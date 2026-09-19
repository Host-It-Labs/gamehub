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

