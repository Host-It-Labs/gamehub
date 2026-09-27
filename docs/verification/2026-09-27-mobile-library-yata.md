# Mobile library and Yata — 27 September 2026

## Changed behavior

- Phone library: 40px multiplayer icon before Menu; two larger covers and a peek of the next.
- One Play entry per setup. Single-save games show Continue/New game inside it, explicitly stating that a new game replaces the save. Newcomer learning choices are inside this flow. Device-local completed-game counts stop recommending Learn after two completed board games; practice does not count. Arena counts completed battles; Folio uses completed saved runs. Lucky and Folio retain their existing multiple-run storage model.
- Yata reserves two phone ticket rows throughout drafting. Scoring text increases from 8px to 10px, the art fills more of its band, and dish names use bold slanted text. No generated title images or new external font dependency.
- Others reuses the season route, based only on revealed cards in the current round. Matches become ticks; unmatched and upcoming dishes are faded. Phones use the same horizontal presentation as their main board.
- Compact player badges fit six seats; portrait-tablet badges stay between navigation controls.

## Browser evidence

Checked with the Codex browser on the running development server. A separate 127.0.0.1 origin held the test match; the existing localhost save was preserved and its practice mode was used for the all-extension view.

At 390 × 844, the rectangles were identical with six, four, three and two cards, and after round rollover:

| Element | x | y | width | height |
| --- | ---: | ---: | ---: | ---: |
| Board stage | 0 | 92 | 390 | 389.922 |
| Controls | 8 | 491.922 | 286 | 48 |
| Hand tray | 8 | 549.922 | 374 | 284.078 |
| Board artwork | 16.414 | 97.258 | 357.156 | 292.320 |

- 390 × 664 and 320 × 568: no page overflow; all six badges fit. At the narrowest size the existing camera chooses the tall counter instead of round phone plates.
- 768 × 1024: all six contracted badges share the top baseline, clear of navigation. Board and hand remain in the viewport.
- 1536 × 730: desktop counter, dish names, hand and season route visually checked; no page overflow.
- Six-player Others: tick/miss/upcoming states, horizontal phone route, five opponent boards, internal scrolling and Close checked.
- Single-save flow: Play opened Continue/New game; Continue restored the same two-card hand. The existing localhost save was never replaced.
- Folio: one Play button opens the run/practice choices; missing-name validation returns focus to the name field without creating a run.
- All Yata extensions: full six-card practice hand, orders, season route and Undo fit at 390 × 844.

Physical touch, device fullscreen/orientation behavior, custom long online names and a live multiplayer session were not tested. Landscape resizing of a desktop-pointer browser does not establish phone rotation behavior. No artwork or camera-source geometry changed.

## Automated checks

- Final production build and typecheck pass. Lint of every changed TS/TSX file and the new test passes.
- The earlier full suite passed all 610 tests. The final suite, with the new familiarity test, passed 609 of 611 while building concurrently; two Folio generation timing assertions failed. Rerunning both affected files without the build passed all 53 tests. No scoring, state or functional assertion failed.
- Full-repository lint has two existing restrict-template-expressions errors in tests/arena.test.mjs (lines 939 and 1047).
- Initial HTTP tests/build were blocked by sandbox listen EPERM and were rerun with local port access.
