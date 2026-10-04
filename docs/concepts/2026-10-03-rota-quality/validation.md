# Rota material quality and traffic

3 October 2026. The ground, streets, roofs, buildings and surrounding town
now use filtered procedural detail over the existing mill town colours.
The camera, model proportions, board rules and hit boxes are unchanged.

Quality starts high on every device. Sustained frame costs adjust density,
shadows, multisampling and fine grain through three levels. Recovery waits
for sustained headroom. The rendering targets share no redundant depth or
MSAA attachments; dense displays avoid additional multisampling. A lost
GPU context restores with low-cost buffers before recovering quality.

Traffic joins must preserve direction. Small vehicles turn using bounded
steering arcs inside the kerbs; larger vehicles avoid unsuitable branches.
Junctions and curved or raised connecting roads reserve a clear way through.
Trains reverse along their trail without rotating their bodies or shifting
their wagons; short sidings receive consists that fit.

## Code verification

- Full suite: 907 tests, initially 871 passing and 36 blocked by sandbox
  `listen EPERM` failures. Reran the eight affected HTTP/SSE suites with
  localhost listener access: all 81 tests passed, resolving all 36 failures.
- Production build and TypeScript check passed. The build's temporary
  prerender listener also required localhost access.
- Rota lint passed. Quality policy has 20 tests, including density budgets,
  slow clients, recovery, MSAA costs and repeated GPU pressure.
- Traffic/routes: 20 tests passed. Long simulations cover 16 bot-built
  sheets across all four maps, base/all extensions and seeds 3/11: 150 seconds
  per sheet for overlaps, visibility, tangent continuity and train axle
  continuity; 120 seconds per sheet for stuck queues.
- Asset check passed: 591 production assets, 129.59 MiB, all present and the
  Docker allowlist verified.
- Repository-wide lint still reports four errors in concurrent Arena and
  party work. Neither unrelated source nor the existing asset allowlist was
  changed for this task.

## Browser verification

Used the muted Chrome preview at localhost:3017. Examined live Meadow and
Harbour rendering and shader logs; no shader errors or warnings appeared.

| CSS viewport | Density tested | Check |
| --- | --- | --- |
| 1280 × 720 | 1 | Desktop scene, board, dock and six badges |
| 1920 × 969 | 1 | Large desktop framing |
| 1133 × 744 | 1 and 1.25 | Tablet/zoom-sized viewport and fractional density |
| 320 × 568 | 1 | Small phone, six long names and three-digit scores |
| 390 × 844 | 3 | Portrait phone, emulated touch, quality and GPU recovery |
| 430 × 932 | 1 | Tall portrait phone |
| 844 × 390 | 3, mobile | Phone rotation guard |

The board stayed inside its stage, the dock remained visible, and the page
did not scroll. Six contracted badges now fit the 320px viewport without
sideways scrolling. All three quality levels returned the exact same board
bounds. Native browser zoom was not changed; the equivalent CSS viewport
and fractional display density were tested.

Touch emulation selected a die, placed it in an enabled grid cell, and Undo
restored it. Others produced five loaded 520px sheet snapshots and restored
the live board when closed. A fresh reduced-motion world did not animate
traffic; the simulation tests also verify that existing vehicles stay parked.
Live Harbour observations tracked physical model identities across 120
frames: 21 of 23 bodies moved, with no large position jump. Tracking the
first car of a train alone is insufficient because leading order changes
on reversal; the actual model identities were checked.

Simulated GPU loss on the DPR-3 phone restored at low quality: the drawing
buffer changed from 1170 × 2532 to 487 × 1055, with 1024 shadows and no MSAA.
The board bounds remained identical. Normal startup was restored afterward.

Physical phone performance and touch have not been tested. Browser screenshot
capture timed out, so the previews are direct canvas renders of the scene,
without the DOM controls. The phone and desktop pictures use high quality.
Temporary media, touch and viewport overrides were removed after testing.

## Previews

- `desktop.png`: Meadow at 1280 × 720.
- `phone.png`: Meadow at 390 × 844, drawn at DPR 3.
- `harbour.png`: Harbour with rivers and mills.

The muted Meadow lab tab remains open for review.
