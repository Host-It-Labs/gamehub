# Lucky — ticket factory machines, floor and belt (25 September 2026)

Fresh text-only generations with Codex `$imagegen` (`gpt-6-astra`), two
variants per image, all launched in parallel by `run.sh`. The exact prompt of
every image is in `prompts.mjs` (the size line is prepended by `run.sh`);
Codex logs are kept as `log-*.txt`. Source PNGs live in the art archive
(`../gamehub-art-archive/public/art/lucky/factory/`), not in git. Delivery
files are written by `scripts/optimize-lucky-factory-art.mjs` into
`public/art/lucky/factory/`.

Brief: the factory "looks too basic"; the machines and belts need to be
pretty to look at. Style vocabulary follows the ticket books (vintage
fairground lottery print: cream, cherry red, gold, enamel, brass).

## Images

- `machines` — landscape 1536×1024 sprite sheet, 5×2 grid of ten top-down
  machines (printer, bot, cashier, splitter, lamp, ink, stamper, gilder,
  charm, bundler), outputs facing right, transparent background.
- `floor` — square 1024×1024 seamless teal enamel floor texture.
- `belt` — square 1024×1024 transparent straight belt segment, left to right.

## Log

| Attempt       | File                                      | Result                                                                                                                                                                                                                                                                        |
| ------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| floor a #1    | floor-v1-a-fail-1.png (1254×1254, opaque) | FAIL: 8×8 checker tiles, but the outer edge has no brass seam, so a 2×2 tiling shows a thin dark line instead of brass at every repeat. Regenerated.                                                                                                                          |
| floor b #1    | floor-v1-b.png (1254×1254, opaque)        | PASS: 8×8 checker, brass seam continues across both joins in a native-resolution 2×2 check; even lighting, no vignette.                                                                                                                                                       |
| machines a #1 | machines-v1-a.png (1536×1024, alpha)      | PASS: ten machines in a 5×2 grid, clean alpha (68% clear, <1% partial), gutters between all pieces, no text. Mostly plan view, but several bodies show little front feet (a slight three-quarter hint). Outputs right on all ten; splitter has bold red arrows up/right/down. |
| machines b #1 | machines-v1-b.png (1536×1024, alpha)      | PASS: ten machines in a 5×2 grid, clean alpha (67% clear, <1% partial), gutters, no text. Flatter plan view, more even square footprints; tickets or tabs poke out on the right of nine machines. Charm is left/right symmetric (brass knobs on both sides).                  |
| belt a #1     | belt-v1-a.png (1254×1254, alpha)          | PASS: straight belt, rails and ridges continue across a 3× strip; each join shows a paired rivet (reads as a rail joint). Band 46% of height (rows 331–912), below the ~60% asked.                                                                                            |
| belt b #1     | belt-v1-b.png (1254×1254, alpha)          | PASS: same structure with finer ridges; a faint lighter column shows at each join. Band 44% of height (rows 348–900).                                                                                                                                                         |
| floor a #2    | floor-v1-a.png (1254×1254, opaque)        | PASS: 8×8 checker, brass seam continues across both joins at native resolution; slightly dimmer seams and more pale speckle than B. (First relaunch hung on stdin; `run.sh` now closes stdin.)                                                                                |

All images came back at the model's native sizes: the machine sheet at the
requested 1536×1024, the floor and belt squares at 1254×1254 instead of
1024×1024 (square as asked; the script resizes them).

## Chosen

| Image    | Chosen | Why                                                                                                                                                                                                                                                                                                                        |
| -------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| machines | B      | Flatter true plan view (A shows little front feet on most bodies), more even square footprints, and a ticket or tab on the right edge of nine machines, so the output side reads at a glance. The splitter's four-arm cross reads as a junction; the bot is working on its ticket. Only the charm is left/right symmetric. |
| floor    | B      | Both final variants tile; B has crisper polished brass seams and a cleaner enamel surface with fewer pale speckles, while staying low contrast under the machines. A (retry) is a fine alternative (`LUCKY_FLOOR=floor-v1-a.png`).                                                                                         |
| belt     | A      | Cleaner join (B shows a faint lighter column at each repeat), slightly taller band (46% vs 44%), and chunkier ridges that read better at 256 px and smaller.                                                                                                                                                               |

## Delivery

`node scripts/optimize-lucky-factory-art.mjs` (override the picks with
`LUCKY_MACHINES`, `LUCKY_FLOOR`, `LUCKY_BELT`) writes into
`public/art/lucky/factory/`:

- `printer`, `bot`, `cashier`, `splitter`, `lamp`, `ink`, `stamper`,
  `gilder`, `charm`, `bundler` `.webp`, 192×192. The sheet is cut at its
  emptiest rows and columns (no cut crosses a machine), each machine is
  trimmed to its alpha box and centred on that box in one common square
  (322 source px for all ten), so the bodies keep one scale. The generated
  rows sit nearer the middle than the geometric cell centres, which is why
  sprites are centred on their own box rather than on the cell.
- `floor.webp`, 512×512, the whole seamless square (8×8 tiles, so one floor
  tile is 64 px at that size).
- `belt.webp`, 256×256, the whole transparent square; the belt band (rails
  included) covers rows 68–185, 0.266–0.727 of the height.
