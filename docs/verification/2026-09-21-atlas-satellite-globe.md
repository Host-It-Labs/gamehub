# Atlas satellite globe

Replaced the current flat SVG country map in `components/game/geo-pin-map.tsx`
with a Three.js sphere using a locally bundled NASA Blue Marble composite.
No country polygons, borders, graticules or geographic labels are rendered.
Pins use the same latitude/longitude coordinates as the rules engine, with
raycasting for selection and depth-tested markers on the visible hemisphere.

One-finger dragging rotates; two-finger gestures rotate and zoom. Mouse wheel
and trackpad scrolling zoom. Drag and multi-touch sequences do not place pins.
Keyboard arrows rotate, plus/minus zoom, Enter places the center crosshair and
Home resets. World is the only visible camera button. Rendering is on demand,
with no auto-spin or inertial animation. ResizeObserver updates the viewport;
WebGL/image failures show a retry action rather than substituting a political map.
The imagery is a 2048×1024 global composite, not live or street-level satellite
tiles. Provenance is in `public/maps/README.md`.

Validation: typecheck, repository lint, production build and all nine geography
tests passed. Full suite: 188/189 pass. The failure is the existing shelf/table
source-markup assertion in `tests/standalone-games.test.mjs:145`, concerning
`game-box.tsx`, which this change does not modify. Build and HTTP tests required
local-port permission beyond the initial sandbox run.

No browser, GPU, touch or responsive visual acceptance was performed. Browser
and computer-use tools require the user's explicit request in this repository.

## Confirmed two-round format

The user confirmed medium round one and hard round two. Each round runs Places,
Photos and Three facts, with one shared destination and one private pin per
player per category. Each category has its own discussion and reveal. Starting
teams alternate across all six categories, so each team starts each category
exactly once. Captains rotate each category. All players must acknowledge a
reveal before progression; the game ends only after round two's Three facts.
Scoring stays +1 closest and +1 within 100 km per destination, six destinations
in total. Rules marker 8 rejects incompatible old Atlas saves. Decision keys
include the category to prevent stale submissions across stages in one round.
The existing content-history selection is preserved.

Two-round validation: 29 focused geography, game, online and content-history
tests pass; typecheck, repository lint and production build pass. Full suite:
198/199 pass, with the same unrelated shelf/table source-markup assertion failing.
The added fairness test covers both team sizes and 12 seeds, all six categories,
rotating captains, fresh private guesses, category decision keys and final
acknowledgement gating. Browser and touch checks remain unperformed.


## Private preparation correction

All players now prepare three pins independently at the start of each round,
using Places/Photos/Three facts tabs in any order. One lock freezes all three;
no discussion or answer is exposed until every player locks. Category changes
retain the frozen guesses and proceed directly to discussion (or reveal in
individual mode). Only the next round deals fresh private guesses. Each category
reveals only its own answer and opponents' pins, preserving future categories.
The shared decision key changes by category; choices for another category are
rejected. Rules marker 8 rejects the previous per-category preparation format.

Correction validation: all 30 focused tests, typecheck, lint and production
build pass. Full suite: 200/201 pass; the same unrelated shelf/table markup
assertion remains. Tests cover out-of-order concurrent preparation, incomplete
lock rejection, teammate privacy, the all-player barrier, frozen pins across
categories, category-specific reveals, balanced starters and the next-round
reset. Browser/touch behavior has not been checked.
