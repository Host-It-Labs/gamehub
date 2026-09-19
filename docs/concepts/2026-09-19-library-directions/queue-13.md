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

