# Queue 18 — `library-night-portrait-v1-b.png`

- **Generation:** Built-in image generation, fresh images with no references
- **Use case:** `ui-mockup`
- **Attempts:** 3
- **Result:** Fail after maximum retries
- **Actual size:** 1024×1536 PNG

## Exact prompt

```text
Use case: ui-mockup
Asset type: phone Gamehub library concept mockup
Primary request: Create one polished, complete portrait phone library front page for a board game platform that can scale to hundreds of games. This is a fresh visual variant with no reference images. Feature Yata as the hero pick so this portrait B variant has a distinct editorial emphasis. Highest quality, native 1024x1536 portrait PNG, no watermark.

Style. A magazine-like front page in warm neutrals with one big illustrated hero, then horizontal shelves of boxes as rows. Crisp modern type, soft shadows, cream background with a subtle woven texture. Boxes are shaped 3D objects with light CSS-style depth (one tilted face, no heavy perspective).

Layout. Top: hero "Tonight" pick with a large box, stat chips, six avatars of friends online and one Play button. Right of hero: a compact live column with "Tables open now" (three rows: game, players, avatars) and a small weekly leaderboard (five names). Below: four horizontal rows, each 8–10 boxes wide with a row title (New this week, Co-op, Under 20 minutes, Friends are playing) and a soft fade at the right edge. Small in-progress bookmark on two boxes.

Portrait adaptation: propose a phone layout with no horizontal scrolling of essentials. At the very top place one fully visible row of compact icon filter chips. Reflow the hero to full width. Stack the compact "Tables open now" module and small weekly leaderboard directly below or beside it without clipping. Transform the four desktop horizontal shelves into four vertical sections. Within those sections, arrange exactly 18 distinct game boxes as a dense two-column grid. Every box edge, stat icon, avatar group, and Play control must fit inside the 1024px canvas. Do not draw horizontal carousels, clipped boxes, sideways continuation arrows, horizontal scrollbars, or offscreen essentials.

Scale and density: show exactly 18 distinct visible games in the two-column library sections, in addition to the full-width hero if repeated. Make the interface feel ready for hundreds. Each non-featured game has exactly one obvious, light Play control. The featured Yata hero presentation has exactly one Play control total. There must be no Resume button anywhere. Use exactly two discreet bookmarks or ribbons to mark unfinished games.

Richer information: on the featured Yata hero, clearly show small icon-plus-value chips for play time, player count, mode, weight, and one or two genre cues. Repeat tiny icon-led stats selectively on library boxes where readable. Prefer icons over words. Social presence: show six simple illustrated-face or initial avatars in the hero and avatar clusters on at least three other games, plus visual markers for live table count, friends played this week, rank, or streak. Never use photographic avatars.

Game identities and covers: use 18 distinct titles selected from the public names Nox, Mora, Yata and these invented games. Ensure Nox, Mora, and Yata are present. Kaldo — mountain rail race; Pemba — spice-market bidding; Orin — lighthouse keepers co-op; Mavi — tide-pool collecting; Tolu — drum-circle rhythm bluffing; Nima — paper-lantern festival; Rako — desert caravan trading; Vela — kite-racing teams; Imbi — mushroom forest draft; Sato — tea-house tile laying; Lumo — firefly night co-op; Bora — storm-chasing boats; Tiko — street-cat territories; Anoa — river ferry logistics; Zuri — bead-weaving patterns; Pelo — snow-hare sledding; Odu — clay-kiln set collection; Miro — canal-city bluffing; Kena — bee-meadow engine; Suvi — northern-lights memory; Jalo — fish-market auction; Tavi — moth-and-moon co-op. Nox is nocturnal improvised boats and pirate radio; Mora is strange wildlife reclaiming human infrastructure; Yata is underground street food and night culture. Give every neighbouring box a distinct material, silhouette, cover illustration, palette, and typography.

Text (verbatim and allowed): game titles, "Play", and short stat values such as "2–5", "20 min", "Co-op". The requested structural labels "Tonight", "Tables open now", "Weekly leaderboard", "New this week", "Co-op", "Under 20 minutes", and "Friends are playing", plus short filter labels, may appear as illustrative navigation text only. Render leaderboard names and all other secondary copy as abstract short lines or icons rather than readable words. Do not invent slogans, taglines, promotional copy, descriptions, or Resume text.

Fixed checks: at least 18 visibly separate games; featured game has time, player, mode, weight, and genre information as icon chips; avatar presence on at least three games; exactly one Play control on the featured game and no Resume button; exactly two in-progress bookmarks; warm neutral library identity; no horizontal scrolling of essentials; fully contained two-column portrait sections.

Not like. No room or table scenery. Not a streaming-service dark UI; warm and light.

Avoid: bright white SaaS dashboard; dark mode; neon; a visual theme borrowed from one game; giant promotional heading; tagline; flat streaming thumbnails; uniform cards without box depth; heavy perspective; glossy plastic; cut-paper or kraft diorama look across the interface; Nox-style ink printmaking across the whole library; Yata-style toon arcade across the whole library; pirate or maritime props outside individual cover art; horizontal carousels; clipped boxes; horizontal scrolling; device frame; browser chrome; phone status bar; watermark; unrelated logos.
```

## Attempt history

- **Attempt 1 — Fail.** Saved as `library-night-portrait-v1-b-fail-1.png`. The library used five boxes per row instead of the required two-column portrait layout.
- **Attempt 2 — Fail.** Saved as `library-night-portrait-v1-b-fail-2.png`. The library used four boxes per row instead of the required two-column portrait layout.
- **Attempt 3 — Fail.** Saved at the requested final path `library-night-portrait-v1-b.png` after reaching the two-retry limit. It again uses four boxes per row and contains only 17 distinct titles including the hero and live-column titles, below the 18-title minimum.

## Final checks

- **Native size and format — Pass.** The saved file is a 1024×1536 RGBA PNG.
- **Library density — Fail.** There are 16 shelf boxes plus the Yata hero and repeated live-table titles, representing 17 distinct titles in total.
- **Featured metadata — Pass.** Yata has icon chips for `45 min`, `2–5`, `Competitive`, `2.8` weight, `Strategy`, and `Party`.
- **Social presence — Pass.** The hero has six illustrated avatars. Avatar clusters also appear in all three live-table entries and on Nox, Orin, Mavi, Yata, Anoa, and Kena.
- **Play and progress — Pass.** The Yata hero has exactly one Play control. Each shelf box has one Play control. No Resume control appears. Exactly two gold ribbons mark Pelo and Tavi.
- **Warm neutral identity — Pass.** Cream woven surfaces, warm shadows, muted wood tones, and softly modelled boxes create a light editorial presentation.
- **No horizontal clipping — Pass.** All visible boxes, controls, and metadata stay within the canvas and no horizontal scrollbar or carousel continuation appears.
- **Two-column portrait layout — Fail.** Each section is four boxes wide rather than two boxes wide.

## Invented elements

- A Gamehub wordmark and the tagline `Good games. Great people.`
- Search and six filter controls, live-status dots, illustrated avatars, rank stars, leaderboard scores, avatar-overflow values, and per-game stat values.
- Individual illustrated cover treatments for all visible games.

## Illustrative or extraneous baked text

- The structural and filter labels are illustrative navigation text.
- `Gamehub`, `Good games. Great people.`, `6 friends online`, `3 tables`, leaderboard ranks and scores, and small live-count values are extraneous or illustrative baked text.
- No Resume label, browser chrome, phone status bar, device frame, or watermark is visible.
