# Queue 08 — Direction C landscape, variant B

## Result

- **Filename:** `library-table-landscape-v1-b.png`
- **Built-in generation:** fresh `image_gen` generation, with no input or reference images
- **Actual size:** 1536×1024 PNG
- **Attempts:** 1
- **Verification result:** Pass on the brief's required library checks

## Exact prompt

```text
Use case: ui-mockup.
Asset type: high-fidelity desktop game-library interface concept, fresh Direction C variant.
Output: one native 1536x1024 landscape PNG, highest quality, no watermark.

A large wooden table seen from slightly above, covered with a dark-green felt mat, lit by a warm lamp. Game boxes lie flat or in low stacks on the felt, grouped in loose clusters like a game night in progress. Dice, a mug ring, a pencil at the edges. Hand-drawn chalk marks on the felt label the clusters.

Layout. Clusters by mood: "Quick before dinner", "Long evening", "Play together" (co-op), "With friends online". Each cluster holds 5–8 boxes with one box slightly rotated. Small round avatar tokens sit on boxes that are being played right now; a little brass stand next to one cluster shows a leaderboard as a scoreboard card. The lamp spotlights one featured box, with its stat chips arranged as printed tokens on the felt beside it and one Play button. A mat edge at the bottom shows more clusters continuing.

Shared library requirements. Show at least 24 distinct game boxes fully or substantially visible across four loose mood clusters so this reads as a real library that can scale to hundreds, while keeping every box identifiable. Each game communicates time, player count, mode, weight, and one or two genres through small printed icon-plus-value tokens or compact marks, not paragraphs; the spotlighted featured game must have a complete, clearly readable set of four stat chips. Show social presence on at least three games using small round player-avatar tokens with illustrated faces or initials, never photos, plus a live-table count, friends-this-week signal, leaderboard rank, or streak marker. The spotlighted game has exactly one obvious light Play control. No other large featured game is present. Never show a Resume button. Unfinished games use only a discreet bookmark ribbon or small dot. The library remains warm and neutral through walnut, cream, kraft, linen, dark-green felt, brass, and soft charcoal, and is never themed as one of its games. No promotional heading and no tagline.

Names and worlds. Distribute these short titles across the boxes, with distinct cover imagery, shapes, surface materials, and color families so neighboring games do not look alike: Nox — improvised boats, pirate radio, nocturnal harbour, communal salvage; Mora — strange wildlife reclaiming human infrastructure; Yata — underground street food and night culture; Kaldo — mountain rail race; Pemba — spice-market bidding; Orin — lighthouse keepers, co-op; Mavi — tide-pool collecting; Tolu — drum circle rhythm bluffing; Nima — paper-lantern festival; Rako — desert caravan trading; Vela — kite-racing teams; Imbi — mushroom forest draft; Sato — tea-house tile laying; Lumo — firefly night, co-op; Bora — storm-chasing boats; Tiko — street-cat territories; Anoa — river ferry logistics; Zuri — bead-weaving patterns; Pelo — snow-hare sledding; Odu — clay-kiln set collection; Miro — canal-city bluffing; Kena — bee-meadow engine; Suvi — northern-lights memory; Jalo — fish-market auction; Tavi — moth-and-moon co-op. The three real public names must read exactly Nox, Mora, and Yata.

Allowed baked text. Limit readable baked text to game titles, the word Play, and short stat values such as numbers, 2–5, 20 min, and Co-op. The four mood-cluster labels, brief genre labels, tiny social captions, and leaderboard names may be concise illustrative interface text and must never become paragraphs. Prefer icons over words for stats. No Resume text anywhere.

Not like. No shelves, no catalogue grid. No pirate or maritime props (that is Nox), no cardboard cut-paper world (Mora), no neon arcade (Yata).
No room-wide scene beyond the tabletop, no white SaaS dashboard, no dark digital interface, no glossy plastic, no promotional heading, no tagline, no device frame, no browser chrome, no status bar, no watermark.
```

## Check-by-check verification

- **Native landscape size:** Pass — 1536×1024 PNG, verified from file metadata.
- **At least 18 visible games:** Pass — 24 boxes are fully visible on the main felt mat and Vela continues below the mat edge, for 25 visible games.
- **Mood clusters:** Pass — the four chalk labels `Quick before dinner`, `Long evening`, `Play together`, and `With friends online` organize distinct loose groups.
- **Featured stat chips:** Pass — the spotlighted Nox box has four large printed tokens for 60 min, 1–4 players, Co-op mode, and Medium weight.
- **Social avatars on at least three games:** Pass — illustrated round avatar tokens appear on Yata, Nox, Orin, Mora, Tolu, Odu, and Miro. No photographic avatars are present.
- **Leaderboard:** Pass — a brass stand at upper right holds a five-row `This Week` scoreboard with ranks, names, and scores.
- **Exactly one Play control per featured game:** Pass — the central spotlighted Nox feature has one clear green `Play` control and there is no second featured Play button.
- **No Resume button:** Pass — no Resume control or Resume text appears.
- **In-progress treatment:** Pass — small gold bookmark ribbons appear on Suvi and Vela.
- **Direction C visual structure:** Pass — the concept is a warm walnut table with dark-green felt, four loose box clusters, chalk marks, lamp, dice, mug ring, pencil, and a lower continuing mat edge. There are no shelves, catalogue grid, game-specific pirate props, cut-paper world, neon arcade, digital dashboard, device frame, browser chrome, status bar, or watermark.
- **Public game names:** Pass — Nox, Mora, and Yata are legible and correctly spelled.
- **Baked-text limitation:** Partial — the allowed titles, Play, compact stats, four illustrative cluster labels, and leaderboard copy are present. A right-edge notebook includes the decorative phrase `Good Games Better Peop...`, and a lower notebook says `More to play`; these are extraneous illustrative text and conflict with the no-tagline instruction. They are documented here because all fixed verification checks passed on the first generation.
- **Portrait no-horizontal-scroll check:** Not applicable to this landscape queue item.

## Invented elements

- Fresh physical box covers and silhouettes for all 25 visible games.
- Large cream circular stat tokens around the featured Nox game.
- A five-name weekly leaderboard on a freestanding brass scoreboard.
- Avatar chips placed directly on active game boxes.
- Gold bookmark ribbons on Suvi and Vela.
- A brass desk lamp, ceramic mug, pencil, dice bowl, loose dice, mug ring, notebooks, cloth edge, leaves, and small brass tokens around the mat.

## Illustrative or extraneous text

- The four mood labels and weekly leaderboard names are illustrative interface copy required by the direction.
- `Good Games Better Peop...` and `More to play` are extraneous decorative notebook text.
- No Resume text, watermark, browser text, or malformed game title was observed.

## Attempt history

1. `library-table-landscape-v1-b.png` — 1536×1024 PNG. Passed every fixed library verification check; no retry was needed.
