# Queue 14 — Direction M portrait, variant A

## Result

- **Filename:** `modal-openbox-portrait-v1-a.png`
- **Built-in generation:** fresh `image_gen` generation, with no input or reference images
- **Actual size:** 1024×1536 PNG
- **Attempts:** 1
- **Verification result:** Pass

## Exact prompt

```text
Use case: ui-mockup.
Asset type: high-fidelity portrait phone play-setup modal concept.
Output: one native 1024x1536 portrait PNG, highest quality, no watermark.

Match Direction A's material: a single physical game box opened toward the viewer on a warm neutral surface, lid lifted back, the inside of the lid showing the game's cover art. Setup choices are physical components laid in the box's inner tray: printed cards, wooden tokens, a folded rules leaflet.

Layout (fixed elements from the current modal, reinvented as objects). Title of the game on the lid. A Learn leaflet. Players 2–6 as small chairs or seat tokens around a tiny table graphic, the chosen count filled. Bot difficulty as three wooden pawns (easy, medium, hard). Content set as two folded boards to choose from. Extensions as three tiles with an emblem, short title, an unmistakable enabled state and a small info mark inside each tile. One large light Play button at the bottom. Resume strip: across the top of the tray, a slim card "Continue your game from Tuesday" with a tiny board thumbnail, the player avatars and the current score, with its own continue affordance; this replaces the library's Resume button. Stats chips for this game (time, players, mode, weight) printed on the lid's inner edge.

Portrait phone proposal. Present the opened game box as a full-screen vertical setup sheet with no device frame and no horizontal scrolling of any essential. Pin the resume strip across the very top of the inner tray, fully visible within the phone width. Pin exactly one large light Play button across the bottom of the tray, fully visible within the phone width. Between them, stack compact physical sections vertically: Learn and stats first; all five player choices 2, 3, 4, 5, 6 in one contained row; all three bot pawns in one contained row; two content-set boards side by side; and three extension tiles in one contained row. Nothing essential may be clipped or require sideways movement. The lifted lid and title remain visible above the tray without consuming so much height that setup components fall below the frame.

Shared modal requirements. Show all player choices 2–6 with one chosen count clearly filled. Show exactly three different wooden bot pawns for easy, medium, and hard, with one selected. Show exactly two distinct folded content boards, with one selected. Show exactly three compact graphical extension tiles, each with its own emblem, short title, unmistakable enabled or disabled state, and small information mark inside the tile. Show exactly one button bearing the word Play. The top resume strip must include its phrase, one tiny board thumbnail, illustrated player avatars, a current score, and a separate arrow continuation affordance; never label it Resume and never give it a second Play button. Show four concise stats for time, players, mode, and weight. Keep the setup warm and neutral in cream, kraft, walnut, linen, and soft charcoal, with tactile paper and wooden components.

Game identity. Use the title Orin for this mockup: lighthouse keepers working together through a storm. The inside lid shows a bold lighthouse on dark rocks under a warm beam. Let the two content boards suggest Rocky Coast and Outer Isles; let the three extensions use a fog bell, supply crate, and storm lantern emblem. The game art may use storm blue and beacon amber while the surrounding box and library material stay warm and neutral.

Allowed baked text. Game title, Play, Learn, player numerals 2–6, short difficulty labels, concise content-set and extension titles, short stat values, and the required resume-strip phrase may appear. Prefer graphical emblems and physical selection states over explanatory prose. No promotional heading and no tagline.

Not like. Not a plain dialog with radio buttons. No Mora cut-paper look, no Nox ink, no Yata toon.
No shelves, no catalogue grid, no game-room scene, no dark digital interface, no neon, no glossy plastic, no device frame, no browser chrome, no phone status bar, no watermark. No horizontal carousel, no clipped setup section, no Resume button, and no more than one Play button.
```

## Check-by-check verification

- **Native portrait size:** Pass — 1024×1536 PNG, verified from file metadata.
- **Full-screen portrait sheet:** Pass — the opened Orin box fills the tall frame, with the lifted lid and all setup sections visible at once.
- **Learn:** Pass — a tall folded `Learn` leaflet is fully visible at the left of the upper setup area.
- **Players 2–6:** Pass — five chair tokens labelled 2, 3, 4, 5, and 6 fit in one row; player count 4 is selected in blue.
- **Bot difficulty:** Pass — exactly three distinct wooden pawns are labelled Easy, Medium, and Hard; Medium is selected with an amber ring.
- **Content set:** Pass — exactly two side-by-side boards are shown, `Rocky Coast` and `Outer Isles`; Rocky Coast has a checked selected state.
- **Three extension tiles:** Pass — exactly three tiles are shown, `Fog Bell`, `Supply Crate`, and `Storm Lantern`. Each has its own recognizable object emblem, small circular information mark, and a clear checked or unchecked state.
- **Exactly one Play:** Pass — one large light `Play` control is pinned across the bottom of the tray; no second Play appears.
- **Resume strip pinned at top:** Pass — the first tray row contains `Continue your game from Tuesday`, a lighthouse-board thumbnail, four illustrated avatars, score `14 / 20`, and a separate arrow button. There is no Resume-labelled button.
- **Stats:** Pass — the lid edge shows 60–90 min, 2–6 players, Cooperative mode, and Medium weight with icons.
- **No horizontal-scrolling essentials:** Pass — resume details, all five player counts, all three pawns, both content boards, all three extension tiles, and Play fit fully within the portrait width. No carousel or clipped side content is suggested.
- **Direction M visual constraints:** Pass — warm cream board, kraft dividers, wood tokens, printed cards, tactile inset tray, storm-blue game art, and beacon amber accents create a physical setup. It is not a plain radio-button dialog and contains no Mora cut-paper, Nox ink, Yata toon, shelf, catalogue grid, dark digital interface, neon, device frame, browser chrome, phone status bar, or watermark.
- **Baked text:** Pass — text is limited to Orin, setup labels, short option names, concise stats, the required resume phrase, and Play. No promotional heading, tagline, unrelated phrase, or malformed text appears.

## Invented elements

- Orin storm-lighthouse cover art with dark rocks, breaking waves, beacon light, clouds, and seabirds.
- Four illustrated player portraits in the continuation strip and a ship-wheel score icon.
- A compass graphic on the Learn leaflet.
- `Rocky Coast` and `Outer Isles` content-set names and illustrations.
- `Fog Bell`, `Supply Crate`, and `Storm Lantern` extension names, emblems, and selection states.
- A partially visible brass compass outside the box at the left edge.

## Illustrative or extraneous text

- Cooperative and Medium weight are concise stat values.
- No extraneous tagline, watermark, malformed label, or Resume text was observed.

## Attempt history

1. `modal-openbox-portrait-v1-a.png` — 1024×1536 PNG. Passed every modal and portrait verification check; no retry was needed.
