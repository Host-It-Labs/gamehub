# Rota map and mill rework — verification

17 October 2026. Large task: authored 3D assets, map geometry and duration,
scenery, saved-game compatibility and browser verification.

## Result

| New-game map | Board | Rounds | Character |
| --- | --- | --- | --- |
| Meadow | 7 × 7 | 7 | Open green districts beyond the terrace ring |
| Harbour | 9 × 9 | 10 | Stepped dock basin, four wharves and stone quays |
| Ridge | 10 × 10 | 14 | Two broken rock bands, sixteen exits and hill shoulders |

Capital is absent from new-game setup. Existing saves resolve their original
map definitions and durations; their next new match uses the current options.
The engine writes `mapVersion: 2` for new games. Match help uses the actual
saved match duration. The canvas rebuilds when the resolved map changes.

Large/small mills, chimney, mill site and both outcrops have new source
geometry. Final Works archive: `works-51f1f67e.glb`, 1,704,436 bytes.
The other seventeen Works roots retain their original geometry, materials
and transforms. Detailed editable Blender sources and independent visual
reviews are recorded in `mills.md` and `ridges.md`.

## Automated checks

- Rota engine, maps, compatibility, online and scene tests passed in scoped
  runs. The final asset/growth/town-life run passed all eleven tests.
- Traffic suite: 20/20 passed (189 seconds).
- Landscape geometry: 2/2 passed, including coast alignment, wharf
  openings, three-draw-call quay budget, off-board scenery and both quality
  tiers' terrace rings.
- Final project lint, TypeScript check and production build passed.
- Production asset validation passed during the production build; the
  Docker allowlist references the final Works hash.
- Full repository run at the concurrent-work snapshot: 1,351/1,356 passed.
  Three failures were assertions in concurrently edited Alto tests. Two
  timing-sensitive failures passed isolated serial reruns: Rota online
  5/5 and Folio equation 21/21. No tolerances were changed.

## Browser evidence

Chrome against the local development server, using the actual Three.js
renderer. Root inspected the generated source renders and integrated views.

- Meadow, Harbour and Ridge mid-match, with six seats and relevant
  extensions; all three new map choices and durations checked in setup.
- Phone 390 × 844, short phone 390 × 664, tablet 1133 × 744 and desktop
  1536 × 864; board and essential controls fit without page scrolling.
- Live phone/tablet resizing uncovered a parent-ref timing bug in the
  frame observer. The observer now attaches after the whole React commit
  and tracks the visual viewport as well. Repeated resizing kept canvas,
  camera and DOM hit targets aligned.
- Mouse placement and Undo on Ridge; emulated touch placement and Undo on
  Meadow. Landscape phone showed the existing portrait instruction.
- Reduced-motion emulation confirmed both the media query and runtime
  `opts.still` were true with the final scene ready.
- Final Ridge browser console contained no warnings or errors.
- Six long names revealed badge overflow at 601 px. The existing compact
  badge grid now also applies through tablet widths. Rechecked at 601 and
  390 px: badge scroll width equals client width, all six remain visible,
  and the page has no scrolling. The temporary lab fixture and viewport
  overrides were discarded after verification.

Screenshots are under `work/rota-rework/`: `meadow-tablet.png`,
`meadow-short-phone.png`, `harbour-phone.png`, `harbour-desktop-final.png`,
`ridge-phone-final.png` and `ridge-desktop-final.png`.

These are browser and emulated-touch checks, not physical-device testing.
An end-to-end online match and fractional browser zoom were not replayed
in the UI; online behavior and saved-map transitions have automated coverage.
The unrelated concurrent leaderboard implementation was preserved; its
map grouping is outside this change.

## Library footage

The repository recorder refreshed Rota's wide and portrait footage after
the final geometry and build review, one take at a time. Both used the
existing 8× capture slowdown and play back at exactly 1× game speed.

| Clip | Size | Unique frames per second | Longest hold |
| --- | --- | --- | --- |
| Wide | 1920 × 1080 | 59.9 / 60 | 2 frames |
| Portrait | 1080 × 1920 | 59.7 / 60 | 2 frames |

Root inspected sampled frames from both outputs. The 720p/360p cuts and
poster frames were refreshed too; all five library-reel tests passed.
Strict production assets passed after recording (578 assets, 292.63 MiB).
Capture results are in `work/rota-rework/reels.log`.
