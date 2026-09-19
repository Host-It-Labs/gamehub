# Illustrated worlds: the reusable pipeline

The Observatory is the reference implementation of a full-bleed illustrated
board. Every piece below is game-agnostic except the two JSON files and the
stylesheet; a new world copies those three and reuses the rest.

## Data contract

- `lib/games/<world>-art.json` (one per orientation): source image, optimized
  paths, native size, `crop`, `overview`, `landmarks.protectedBounds`,
  `habitats[]` (zone, pads-only `bounds`, `label`, `slots`, `tokenWidth`,
  `summary` with one `*keyword*`), `release`, `animation` (water polygon,
  foliage polygons with pivots).
- `lib/games/observatory-variants.json`: image-only candidates for review
  (`id`, `orientation`, `label`, four image paths). Empty when nothing is being
  compared.

## Runtime

- `lib/games/mora-world.ts`: `paperWorldFor(tall, variant)`,
  `paperWorldPlayBox`, `paperWorldFrame(surface, stage)` (cover the surface,
  keep the play box in the stage, centred and symmetric otherwise; landscape
  may lean 6% into the reserves, portrait keeps 3% air), `paperWorldTarget`.
- `components/game/scroll-area.tsx`: measures surface and stage, places the
  board at the crop for any `data-paper-world` board.
- `components/game/observatory-scene.tsx`: one canvas across the table; soft
  copy plus feathered margin when the scene cannot cover; crown sway, pond
  shift and pollen; static under reduced motion.
- `components/game/boards.tsx`: habitats as pieces, pads and cards as siblings
  of the piece button, migration by tapping or dragging a placed creature,
  portal landing on placement.
- `components/game/drag-preview.ts`: `dropTargetNear` overlap targeting.
- `components/game/art-variant-switcher.tsx` + `lib/games/art-variant.ts`:
  floating review control, remembered per browser.
- `components/game/observatory.css`: all world-specific styling, in cascade
  order with numbered sections; `mora-refresh.css` keeps shared Mora pieces.

## Tooling

- `scripts/measure-pads.mjs` (`LOOSE=1` for greyer cream): pad detection.
- `scripts/optimize-paper-worlds.mjs`: full scene, board and overview crops for
  the base sources and every registered variant.
- `scripts/measure-observatory-framing.mjs`: coverage per device.
- `scripts/dedupe-css.mjs <file>`: removes declarations overridden later in
  the same selector and media; cascade-safe.
- Tests: `tests/observatory-layout.test.mjs` (geometry, coverage, capacities),
  `tests/artwork.test.mjs` (files, alpha, crops).

## Process

1. `imagegen-brief` skill: fresh generations, text-only style, two variants,
   verify-and-regenerate loop.
2. `iterate-artwork` skill: register candidates as image-only variants and look
   at them in the running game; wire nothing.
3. Integration: measure the chosen image (detector plus crops rendered with an
   overlay), write the JSON, optimize, run the tests, empty the registry.

The safe-area defaults and prompt lessons live in
`.agents/skills/game-world-layout/SKILL.md`.
