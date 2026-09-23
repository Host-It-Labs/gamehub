# Folio and Relic finishing pass — 23 September 2026

Two games, Folio and Relic, were built over the preceding days but never
landed: they sat entirely uncommitted in the working tree. This pass verified
them, finished the removal work the Relic rewrite had left half-done, and
committed the result to a branch.

## Included changes

- **Finished the Relic removal.** The rewrite into the scratch-ticket desk
  removed the earlier dig game from the UI but left its parts behind.
  Deleted `components/game/relic-panels.tsx` (908 lines, unreferenced),
  `components/game/relic-art.tsx` (used only by those panels) and
  `lib/games/relic/worlds.ts` (used only by that art, plus one test).
- **Pruned `components/game/relic.css` from 2,534 to 244 lines.** Only 17 of
  its 122 classes were still reachable; the rest styled the dig grid, patches,
  strata, workers, wallet and site heading. The three world classes
  (`relic-dunes`, `relic-cavern`, `relic-ruins`) are kept: `relic.tsx` still
  builds them dynamically for the saved-desk colour dot. Eight dead
  `@keyframes` and an extreme-zoom fallback that targeted removed elements
  went with them.
- **Dropped the `measured cameras protect whole landmarks` test** from
  `tests/relic.test.mjs`. It only exercised `relicCamera` from the deleted
  `worlds.ts`, framing scenery that no longer renders.
- **Archived unused artwork** to `~/Documents/code/gamehub-art-archive`
  (moved, not deleted): the six dunes/cavern/ruins world images, which only
  the deleted `worlds.ts` referenced and which were therefore being copied
  into the production image, and the five superseded `box-relic-blind-v1`
  cover derivatives. Removed the empty `public/art/relic/tickets` directory.
- **Fixed the Relic cover preview.** `lib/artwork-previews.json` listed a
  320 px WebP URL where every other entry carries an inline 24×24 base64
  LQIP, so the blur-up placeholder was itself a network request. Regenerated
  it with the same `sharp` recipe as `scripts/optimize-box-covers.mjs`, and
  added the missing 1254w entry to its `srcSet`.
- **Tidied `scripts/production-assets.mjs`**: removed two redundant manual
  `add()` calls (the source scanner already finds both scratch-desk images)
  and a stray triple blank line.

## Effect on the production image

The allowlist drops from 164 assets / 35.12 MiB to 158 assets / 33.10 MiB.
The 2 MB removed is the dunes/cavern/ruins art, which was reaching the image
only because dead code referenced it.

## Automated validation

- TypeScript and lint passed.
- All 476 tests passed (477 before, minus the removed camera test).
- `npm run check:assets` passed: 158 production assets, 33.10 MiB, allowlist
  verified.
- `node scripts/relic-smoke.mjs` passed: two guests, scratch coverage and
  payout, activity endpoint, disk restart, deduplicated retry, two SPA routes
  and seven WebP assets.
- `node scripts/folio-smoke.mjs` passed: production shell, invitation
  preview, two-seat lobby, cover and background assets.
- Docker build passed with the strict asset check, which rejects any extra
  public file in the build context. Image `gamehub:folio-relic`,
  `sha256:65eb444af4b4c3c9188c666c41c280745ae3910d89aa81155bc670001f528f55`,
  204,102,165 bytes.
- Container smoke passed: health ok; `/relic`, `/folio` and both 32-character
  invitation routes serve 200; the Folio backgrounds, the scratch desk art
  and both box covers serve 200; the archived `dunes-landscape-v1.webp` is
  correctly absent (404). The container was removed afterwards.

## Visual check

The pruned Relic hub was rendered as static pages under `work/` with the
pruned CSS inlined, and screenshotted fresh and with saved desks, at desktop
width and at 375×812. Title, facts row, desk cards, the three world colour
dots, the form and the primary button all render, and the 600 px media query
reflows the hub into one phone viewport. The pages were deleted afterwards.

## Not done

- **Browser and touch behaviour were not checked**, in Folio or Relic. No dev
  server runs in an unattended session; the check above is a static render of
  one screen's CSS, not interaction.
- **The Relic engine still carries the earlier dig systems** — `HELPERS`,
  `ARTIFACTS`, `GOALS`, digging, restoration and museum income — and
  `tests/relic.test.mjs` still covers them. They are left in place on purpose:
  `docs/relic.md` says old room purchases are refunded at their original
  prices and old collections stay stored, so the legacy model is what the
  documented migration reads. Whether any of it can now go is a question for
  William, not a safe unattended removal.
- **No release, tag or push.** Version stays 0.23.0.
