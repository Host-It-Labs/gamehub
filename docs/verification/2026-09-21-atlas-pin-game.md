# Atlas replacement — 21 September 2026

The old capital-ordering game, its separate capital catalog and its reveal-only
Three.js globe are removed. Atlas / `miro` now uses rules version 6: three rounds
(named town and country, real photo, three facts), two destinations per round
(medium then hard), private frozen guesses and alternating team selection.

The map supports pointer placement, drag pan, zoom buttons and keyboard
crosshair/placement. Photo enlargement uses the shared accessible dialog.
Twenty-second discussions are enforced by the online server and local solo
controller. At timeout, existing selections are retained and only missing
selections fall back to the captain's frozen guesses. Practice is untimed.
Old sorting saves are deliberately incompatible. Other party-game rules remain
unchanged. No commit, push or deployment was performed.

## Checks passed

- `npm run typecheck`.
- `npm run lint` (no warnings).
- `npm test`: **185 passed**, including HTTP/SSE tests, hidden player and
  spectator views, full online matches, solo bot completion, and old-save
  rejection. Loopback listeners required elevated sandbox execution.
- `npm run build`: production bundle and static prerender completed. The
  prerender listener required elevated sandbox execution. Existing large-chunk
  guidance remains a build warning.
- `git diff --check`.
- Geography tests explicitly cover both private pins, no post-lock edits,
  same-team captain selection, wrong-team and wrong-turn rejection, no early
  reveal, alternation, medium/hard ordering, six distinct destinations,
  scoring/distance ties, deadline boundaries and late-move fallback, practice
  timing, malformed moves, saved state, and local photo availability/provenance.
- All 23 JPEGs visually inspected in a contact sheet. Photos span six world
  regions; credits and acquisition metadata are retained. Files are local,
  so play does not require Wikimedia availability.

## Not verified

No browser or computer-use tools were used. Live visual layout, browser zoom,
mobile touch, keyboard focus behavior, actual photo-dialog interaction and
human-play pacing/difficulty remain unverified. Engine/HTTP checks do not
substitute for that acceptance. No production or Docker release was requested.
