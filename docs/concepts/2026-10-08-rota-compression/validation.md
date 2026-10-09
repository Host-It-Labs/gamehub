# Rota GLB compression — 8 October 2026

The four downloads total **5,197,004 bytes**, down from **15,666,036 bytes**
(**3.014× smaller**, 66.8% fewer bytes), without HTTP compression. The untouched
Blender builds remain the source. All restricted runtime files were left to their
existing editors.

| File | Previously shipped bytes | New bytes | Reduction | New hash |
| --- | ---: | ---: | ---: | --- |
| vehicles | 5,563,420 | 1,814,960 | 3.07× | `7cf8ef26` |
| nature | 4,858,272 | 1,668,148 | 2.91× | `1de73f03` |
| town | 2,301,960 | 740,284 | 3.11× | `c01b9eeb` |
| works | 2,942,384 | 973,612 | 3.02× | `64f4a613` |

## Settings and preservation

- Exact dev dependencies: `@gltf-transform/{core,extensions,functions}` 4.5.0
  and `meshoptimizer` 1.1.1. The existing npm registry cache lacked their
  manifests. Lock metadata was seeded from the already installed packages,
  then finalized with `npm install --save-dev --save-exact --offline
  --package-lock-only --ignore-scripts --no-audit --no-fund`. No existing lock
  entry changed version or metadata; fourteen dependency entries were added.
- Dedup keeps unique resource names. Prune keeps attributes, leaf nodes,
  indices and extras. No decimation, simplification, welding or instancing.
- Positions use 16-bit signed normalized integers with a separate quantization
  volume for each mesh. This protects small vehicles from large scenery bounds.
- Normals use the high Meshopt mode's 8-bit octahedral filter. Maximum measured
  direction error is 1.1561 degrees. Normal seams and every triangle remain.
- UVs retain float accessors and repeats outside [0,1]. Fourteen mantissa bits
  are retained; no UV clamping or texture transform. Largest UV component error
  is 0.0001220703125. At the actual procedural material scales, the maximum
  surface-coordinate shift is 1.8096 mm, below a pixel at the board camera.
- AO colours use normalized RGBA8. Maximum source colour error is 0.001953155
  (half an 8-bit step). The runtime softens AO contrast. Its integer write-back
  also rounds to the accessor's precision, so the runtime read-back is not
  claimed to be bit-for-bit equal to the original 16-bit colours.
- `EXT_meshopt_compression` uses FILTER, the high mode, with size-oriented
  vertex/index reordering. Compatible streams are packed across accessor parents
  with the pinned writer's public `WriterContext` grouping set, producing four
  compressed buffer views per file. Accessors, meshes, nodes and materials remain
  separate. This saves JSON/codec overhead without merging gameplay objects.
- The compression extension is required. The standard fallback buffer definition
  describes decoded storage only; it has no URI or shipped uncompressed payload.
- Re-running the asset build produced identical hashes and manifest bytes.
  The measured repeat took 1.317 s while other work was running.

## Numeric comparison

`node scripts/rota-model-check.mjs --out=docs/concepts/2026-10-08-rota-compression/metrics.json`
compares corresponding vertices after lossless reordering, never a nearest-point
approximation. It checks triangle winding, all attributes, every hierarchy edge,
node/mesh/material names and extras, and wheel spin pivots. All 85 model roots and
234 nodes are preserved. It records bounds for every root and error for every
mesh in [metrics.json](metrics.json).

| File | Vertices before = after | Maximum position error, model units | At 25 m/unit |
| --- | ---: | ---: | ---: |
| vehicles | 119,271 | 0.000007099125 | 0.177478 mm |
| nature | 107,507 | 0.000037444231 | 0.936106 mm |
| town | 48,765 | 0.000009128728 | 0.228218 mm |
| works | 63,828 | 0.000017673186 | 0.441830 mm |

The current Works **source already differs** from its old shipped file (the build
is 2,942,376 bytes). Vehicles, Nature and Town are semantically identical to their
old shipped sources. Works has these existing source count differences:

| Works root | Old vertices → build vertices | Old triangles → build triangles |
| --- | ---: | ---: |
| goods_grand | 4,564 → 4,536 | 2,512 → 2,508 |
| goods_shed | 3,017 → 3,035 | 1,644 → 1,672 |
| mill_big | 6,083 → 6,084 | 3,536 → 3,536 |
| outcrop_a | 7,384 → 7,392 | 3,472 → 3,472 |
| outcrop_b | 7,337 → 7,334 | 3,460 → 3,460 |

Those are not changes made by compression. The requested current build is
preserved, and the error/count guarantees above are against that build.
[source-metrics.json](source-metrics.json) records the comparison with the old
shipped files.

## Visual and runtime evidence

The actual Three.js GLTFLoader and its bundled Meshopt decoder loaded all four
files, preserving the root lookup names. The offline [renderer](render.mjs) uses
the current Rota material tint/AO conversion, with private geometries for each
comparison, and matched cameras/lighting. It rasterises neutral toon bands on the
CPU; it does not emulate procedural GPU surfaces, window shaders, or shadows.

Inspected [comparison.png](comparison.png), [retro car](car_retro-rear-spin.png),
[steam locomotive](loco_steam-rear-spin.png), and [lorry](lorry-rear-spin.png).
Boiler bands, lamps, wheel rims, lorry panel seams, terrace windows/chimneys, oak
silhouette and mill details remain matched, including the alternate wheel pose.
There is no visible loss at the board's model scale in these offline comparisons.
Close-up raster differences include AO rounding, toon-band boundaries and a few
edge/depth pixels; these images are not claimed to be pixel-identical.

Eight warmed alternating Node parse samples per file are recorded in
[decode-metrics.json](decode-metrics.json). The sum of per-file medians was about
97 ms before and 101 ms after; no reliable parse speedup is claimed from this
noisy concurrent run. Transfer size is the measured improvement. Actual browser
load time, device GPU performance and physical touch were not verified.

The HTTP [review page](review.html) is available for a later GPU comparison on a
running Vite server. The sandbox prevented that server from listening. Browser
automation also rejected the self-contained `file:` viewer because its URL
policy permits only HTTP/HTTPS. Blender crashed during Metal initialization
before running the render script. The offline CPU comparison above succeeded.

## Server findings

- Production `server/index.ts:864` serves `.glb` as `model/gltf-binary`.
  Static files stream directly with Content-Length. Neither gzip nor Brotli
  negotiation is implemented. Rota currently receives
  `Cache-Control: public, max-age=3600` because the immutable hash matcher only
  recognises Arena.
- In-memory requests through the real production handler with `identity`, `gzip`
  and `br` all returned 1,814,960 unchanged bytes, the `glTF` prefix, no
  Content-Encoding and the one-hour cache header. No listener or live endpoint
  was used; [server-metrics.json](server-metrics.json) contains these results.
- Dev requests go through Vite's public static middleware, not production's
  static handler. Installed Vite source configures sirv with `dev: true` and
  `etag: true`; this gives `Cache-Control: no-cache`, ETag and Last-Modified.
  Its gzip/Brotli options are not enabled. No live dev header probe succeeded.
- One-line production improvement: in the existing immutable asset regex,
  replace `\/3d\/arena\/` with `\/3d\/(?:arena|rota)\/`. Rota's content-hashed
  assets would then get `public, max-age=31536000, immutable`.
  Enabling gzip/Brotli needs content negotiation, encoding and response headers;
  it is not a one-line safe change to this streaming handler. No server/config
  code was changed.

## Checks and files

- Asset script run without `--blender`; repeated build is deterministic.
- Only the four Rota model filenames were manually patched in `.dockerignore`.
  `scripts/production-assets.mjs --write` was not run.
- `npm run check:assets`: **passed**, 597 assets, 120.84 MiB, allowlist verified.
- Focused Rota asset/engine/growth/quality/routes run: **48/48 passed**.
- Latest `node --experimental-strip-types --test tests/rota*.test.mjs` run:
  **81 passed, 4 failed** out of 85. All four failures are online HTTP fixtures
  unable to listen on localhost (`EPERM`). A traffic failure seen in the earlier
  run was absent after the concurrent traffic edits. Those files were not edited
  for this task. The full suite is therefore not reported as green.
- Scoped oxlint and `git diff --check`: passed.

Changed: `scripts/rota-assets.mjs`, `scripts/rota-model-check.mjs`,
`tests/rota-assets.test.mjs`, `package.json`, `package-lock.json`,
`lib/games/rota/assets.json`, the four Rota lines in `.dockerignore`, four hashed
GLBs replacing the old four, and this evidence folder. Blender builds and the
restricted runtime/server files were not edited.
