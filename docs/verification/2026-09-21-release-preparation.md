# Release preparation — 21 September 2026

## Included changes

- Removed the separately implemented Orin, Vela and Miro worlds (`coast`,
  `meadow`, `canal`) and Find the Lie/Outfox (`vela`): engines, UI, dedicated
  artwork, data, game-specific tests and generation tooling. My Top Five
  (`orin`) and Atlas (`miro`) remain playable with their existing public IDs.
- Added the host-only **Background sounds for everyone** table preference.
  It defaults off for new and older multiplayer tables, persists, and updates
  all connected clients through SSE. Local mute and volume remain effective.
- Atlas teams now choose all three destination pins in one 60-second turn,
  then switch teams. One captain handles the round. Teams alternate who starts
  between rounds; destinations reveal in sequence after both sets lock.
- Docker public assets use a generated allowlist. The build checks that every
  required asset exists and rejects any extra public file in its context.
  Refresh with `node scripts/production-assets.mjs --write` after asset changes.

## Compatibility

My Top Five saves retain rules marker 6. Atlas moves to marker 9 because its
team choices now contain three selections. Earlier Atlas matches return to
setup/lobby. Unsupported game tables recover to Nox lobbies with their members
retained. No production database was accessed or modified during preparation.

## Automated validation

- TypeScript and lint passed.
- All 200 tests passed, including full games, private state, complete Atlas
  team turns, independent selections, captain stability, timeout fallbacks,
  online persistence/stale-command rejection, and host ambience permissions,
  persistence and SSE delivery.
- Docker build passed with the strict asset check: 143 public assets,
  29.80 MiB. Built client payload: 31.76 MiB; image: 199,950,438 bytes.
- Image inspection found no removed-game assets or `lib/games/worlds` engine.
- Final container smoke passed: health, SPA routes, accounts, match/session
  persistence across restart and non-root runtime.
- Local image: `gamehub:release-prep`.
- Image ID: `sha256:fb97980ae6dcae6b5e329d72c9e766ebb3ff99737bc8cd34ab534eccd85fb58d`.

## Remaining acceptance and publication

Browser, touch, responsive viewport, WebGL and audible device playback were
not checked. No release was published, no tag was created, and nothing was
committed or pushed. Package version remains 0.22.0; the next version and
publication remain a separate release step.
