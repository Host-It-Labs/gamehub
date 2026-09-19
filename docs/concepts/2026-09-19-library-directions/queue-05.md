# Queue 05 — Direction M landscape

## Result

- **Filename:** `modal-openbox-landscape-v1-a.png`
- **Built-in generation:** fresh `image_gen` generation, with no input or reference images
- **Actual size:** 1536×1024 PNG
- **Attempts:** 1
- **Verification result:** Pass

## Exact prompt

```text
Use case: ui-mockup.
Asset type: high-fidelity desktop play-setup modal concept.
Output: one native 1536x1024 landscape PNG, highest quality, no watermark.

Match Direction A's material: a single physical game box opened toward the viewer on a warm neutral surface, lid lifted back, the inside of the lid showing the game's cover art. Setup choices are physical components laid in the box's inner tray: printed cards, wooden tokens, a folded rules leaflet.

Layout (fixed elements from the current modal, reinvented as objects). Title of the game on the lid. A Learn leaflet. Players 2–6 as small chairs or seat tokens around a tiny table graphic, the chosen count filled. Bot difficulty as three wooden pawns (easy, medium, hard). Content set as two folded boards to choose from. Extensions as three tiles with an emblem, short title, an unmistakable enabled state and a small info mark inside each tile. One large light Play button at the bottom. Resume strip: across the top of the tray, a slim card "Continue your game from Tuesday" with a tiny board thumbnail, the player avatars and the current score, with its own continue affordance; this replaces the library's Resume button. Stats chips for this game (time, players, mode, weight) printed on the lid's inner edge.

Shared requirements. Present one coherent warm, neutral setup experience on cream, kraft, walnut, linen, and soft charcoal materials. The modal must read instantly as opening and arranging a real board-game box. The selected player count must be visible among all five choices 2, 3, 4, 5, and 6. Bot difficulty must show exactly three distinct pawns for easy, medium, and hard with one unmistakably selected. Content set must show exactly two different folded-board choices with one selected. Extensions must show exactly three compact graphical tiles, each with its own emblem, short title, clearly enabled or disabled state, and a small information mark within the tile. Show exactly one large light button bearing the word Play, pinned visually at the bottom of the tray. The resume strip stays separate at the top and uses an arrow or similarly clear non-Play continuation affordance, never a second Play button. Keep choices legible and tactile without becoming a plain form.

Game identity. Use the title Kaldo for this mockup: a mountain rail race with a bold illustrated alpine train cover on the inside lid. Let the two content boards suggest two distinct rail routes, and let the three extension emblems suggest a tunnel, a signal flag, and a snow pass. Preserve warm neutral library materials around the colorful game-specific art.

Allowed baked text. Game title, the word Play, Learn, player numerals 2–6, short difficulty labels, short content-set and extension titles, short stat values, and the required resume-strip phrase may appear. Prefer graphical emblems and material states over explanatory prose. No promotional heading and no tagline.

Not like. Not a plain dialog with radio buttons. No Mora cut-paper look, no Nox ink, no Yata toon.
No shelves, no catalogue grid, no game room scene, no dark mode, no neon, no glossy plastic, no device frame, no browser chrome, no status bar, no watermark. Do not show a Resume button. Do not show more than one Play button.
```

## Check-by-check verification

- **Native landscape size:** Pass — 1536×1024 PNG, verified from file metadata.
- **Opened-box presentation:** Pass — a single physical Kaldo box is opened toward the viewer, with alpine train cover art inside the raised lid and organized components in the inner tray.
- **Learn:** Pass — a folded `Learn` leaflet appears at the left of the tray.
- **Players 2–6:** Pass — five wooden chair tokens are clearly labelled 2, 3, 4, 5, and 6; player count 4 is visibly selected with a warm orange treatment.
- **Bot difficulty:** Pass — exactly three distinct pawns are shown and labelled Easy, Medium, and Hard; Easy has a green selection glow.
- **Content set:** Pass — exactly two board choices, `Alpine Loop` and `Glacier Route`, appear; Alpine Loop is visibly checked.
- **Three extension tiles:** Pass — exactly three tiles appear: `Tunnels`, `Signal Flags`, and `Snow Pass`. Each has its own emblem, a small circular information mark, and a clear checked or unchecked state.
- **One Play:** Pass — exactly one large light `Play` button spans the bottom of the tray.
- **Resume strip:** Pass — the top tray contains the exact phrase `Continue your game from Tuesday`, a small route-board thumbnail, four illustrated avatars, score 78, and a separate arrow continuation affordance. There is no Resume button and no second Play control.
- **Stats chips:** Pass — the lid edge displays time `60–90`, players `2–6`, mode `Competitive`, and weight `2.8` with icons.
- **Direction M visual constraints:** Pass — warm neutral paper, wood, linen, leather, printed cards, and wooden tokens create a tactile physical setup. It does not resemble a plain radio-button dialog and contains no Mora cut-paper, Nox ink, Yata toon, shelf, catalogue grid, dark mode, neon, glossy plastic, device frame, browser chrome, status bar, or watermark.
- **Baked text:** Pass — text is limited to the game identity, setup labels, short option names, stat values, the required resume phrase, and Play. No promotional heading or tagline is present.
- **Portrait no-horizontal-scroll check:** Not applicable to this landscape queue item.

## Invented elements

- Kaldo alpine railway cover art with a red steam train, stone viaduct, mountain lake, pine forest, and tunnel.
- Four illustrated animal avatars in the resume strip and a trophy score marker.
- A lantern, branded ceramic mug, map sheet, cloth-bound notebook, leather folio, evergreen sprig, bowl of wooden pieces, and train token around the box.
- `Alpine Loop` and `Glacier Route` content-set names.
- `Tunnels`, `Signal Flags`, and `Snow Pass` extension names and their arch, flag, and mountain emblems.

## Illustrative or extraneous text

- The map paper, mug, and leather folio repeat the `KALDO` identity as decorative branding.
- No unrelated phrase, promotional copy, watermark, or malformed text was observed.

## Attempt history

1. `modal-openbox-landscape-v1-a.png` — 1536×1024 PNG. Passed every required modal verification check; no retry was needed.
