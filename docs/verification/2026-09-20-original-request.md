# Original request reconciliation

Source: the user's attached “Okay. So first of all, let's rework the kind of main page…” transcript, plus the Yata/audio follow-up and subsequent placement corrections.

## Library and setup

- The first shelf contains the six implemented game IDs. Lower shelves contain concept games; no new second row of category tags was added (the user withdrew that idea).
- Six new original covers and six illustrated spines replace board screenshots. Sources, exact prompts and derivatives are recorded in `public/art/library-boxes-v4/`. The updated Roka, Talo and Soma identities use their dedicated v5 fronts and spines from `public/art/library-boxes-v5/`.
- Boxes use smaller shelf dimensions, varied height/depth ratios and front/spine/top/bottom faces. The bottom face closes the previous gap; inset seams and transparent outlines soften rasterized edges.
- Setup retains its illustrated header and tag strip. Its lower insert uses a plain warm surface with contained seats, difficulty pawns, content/deck choices and extension tiles.
- Nox exposes Normal above Fast mode. Play and Continue share the bottom row with equal column widths.

## Nox

- Source metadata disables the gold sparkle overlays; atmospheric lighting remains.
- A single chalk-colored circular arrow sits on the table plane and shows passing direction during the exchange and clockwise play during tricks. The central NOX title and four perimeter arrows are removed.
- Two- and three-player layouts center the local player's near-edge seat. Seat badges and played cards are larger.
- Both decks pass 4 cards at two players, 3 at three players, and 2 at four or more. A saved exchange retains its previously agreed count.
- New two-player normal matches use ranks 1, 3, 5, 8, 10 (25 cards); fast matches use 1, 4, 5 (15 cards). The penalty rank remains present. Existing full-deck saves retain their deck.
- Shared die faces slightly overlap with a small rounded edge, avoiding open corners without the previous sharp joins.
- Longer hull/surf recordings, timber creaks and low filtered distant chatter supply the ship ambience. Cue and ambience gains are raised; quiet layers remain below the cues.

## Mora and undo

- Observatory Glasshouse: 2 points per creature, plus 4 for a full pair and a different guest; maximum 10. Courtyard still rewards its largest matching group. Goal and placement symbols follow the new rule.
- New matches receive one Roam use. Existing saves with unspent older allowances remain readable.
- A themed Undo button has a permanent dock position and stays visible while disabled. It clears local preparation, including migration, or withdraws a still-hidden simultaneous commitment. It cannot rewind a revealed pick or trick.
- The server validates the requesting seat and pending state. Undo neither exposes another player's selection nor consumes cards or extension permits.

## Floodline

- Landscape A is the accepted source. Its measured slot centers, habitat bounds, labels and release raft replace B's old coordinates. Runtime candidate overrides cannot silently switch the source while retaining different geometry.
- Selection outlines use Floodline-specific rounded rectangles for square pads, capsules for cave/pier and an angled landscape pier outline, replacing inherited Observatory ellipses.
- Both orientations contain exactly two cave pads. The generated edit changes only the removed-pad patches; all other source pixels and crop dimensions remain unchanged. Verification is recorded in `public/art/floodline-two-pad-edit/verification.json`.
- Mangrove roots: matching pair 9, different pair 0, single 1. Sea cave: different pair 7, matching pair 2, single 1. Lighthouse: 5 only when its species lives nowhere else (released creatures excluded).
- Habitat descriptions, maximum scores, goals, symbols and placement capacities use these rules. Older three-creature cave saves keep their existing pieces visible as overflow, but cannot add more.
- Floodline uses surf and coastal birds rather than the Observatory forest soundscape.

## Yata and shared controls

- Counter B is fixed. Artwork A/B switches and redundant passing/Table controls are absent from playing scenes; Others is under Menu.
- Clipboard content follows the selected plate's source transform and the paper's angle. Three current order tickets plus a compact prior-round receipt fit the left paper; stall and forecast controls fit the right paper.
- All 12 dishes use the new illustrated cutouts. Landscape cards are larger, with a fixed tray footprint and count-dependent overlap.
- Yata includes quiet cooking beneath its street ambience. All soundscapes use longer randomized sections, longer gaps and recent-event avoidance.

## Verification boundaries

Desktop browser inspection was performed for the library, equal-width setup actions, Nox center arrow/seat position, and Yata clipboard alignment. Floodline targets were inspected and a placement was exercised. Browser work stopped immediately when the user requested it; final rule, two-pad art and Undo changes were verified through source, image inspection, geometry and automated tests. No phone or tablet browser testing was performed.

Balance samples are in the adjacent Observatory and Floodline JSON reports: 40 deterministic medium-bot matches per board, 160 player boards each. They are tuning evidence, not a claim of competitive balance or human acceptance. Audio was not listening-tested in this task.

Final validation: full automated suite passed (195 tests); TypeScript, lint, production build and `git diff --check` passed. No further browser use after the user withdrew permission.
