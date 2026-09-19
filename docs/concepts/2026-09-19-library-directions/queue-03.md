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

