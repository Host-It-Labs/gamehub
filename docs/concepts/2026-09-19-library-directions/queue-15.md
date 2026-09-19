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
