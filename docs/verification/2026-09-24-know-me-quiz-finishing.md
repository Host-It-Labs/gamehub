# Know Me / Quiz finishing pass — 24 September 2026

The 23 September sessions built the Know Me and Quiz party sets, the table
votes, the reveal-motion kit and the Floodline three-round rework, but ran out
of context before landing any of it: the whole body sat uncommitted in the
working tree (87 modified files, 38 new ones). This pass verified it, fixed
what it found, and committed it.

## What was already there

Know Me (`orin`: Top Five + Dial) and Quiz (`miro`: Atlas + Sizes) as switch
sets, `lib/games/party/tribu.ts` and `vote.ts`, the ten-second round and
next-game votes, `reveal-motion.tsx`, the shared `sabi.css` measuring desk,
the Floodline three-round board and goals, and the new box covers. `AGENTS.md`
and `docs/DESIGN.md` had already been updated to describe all of it.

## Fixed in this pass

- **A stale Floodline artwork assertion.** `tests/table-worlds.test.mjs`
  still asserted the previous accepted board
  (`mora-floodline-landscape-v3-a-two-pads`); the three-round rework replaced
  it with `v5-b`. This was the one failing test in the tree (495/496). The
  assertion now checks that neither orientation lets a candidate id override
  the accepted `-v5-b` art, which is what the rule in `mora-world.ts` is for.
- **The Quiz step rail was unreadable at desktop width.** `.sabi-steps > *`
  (specificity 0,1,0) sets the compact `padding: 4px 6px`, `gap: 6px`,
  `font-size: 13px` for the three step tabs, but `.party-table button`
  (0,1,1) in `party-table.css` beat it and imposed the full-size button
  metrics (`padding: 10px 16px`, `gap: 8px`, 16px). Each tab's label was left
  35 px and clipped to a single letter — "1 A…", "2 T…", "3 C…" — in both
  Quiz games. The four `.sabi-steps > *` rules are now scoped
  `.party-table .sabi-steps > *` (0,2,0). Sizes reads "Animal / Thing /
  Country" and Atlas "Place / Harder / Final" in full again.
  The deliberate `@container (max-width: 300px)` rule that keeps only the
  current step's name on narrow cards still applies.
- **Finished the team-picker deletion.** `components/game/team-picker.tsx`
  was staged as deleted, but its 17 `.team-picker*` selectors (19 lines) were
  left behind in `setup-box.css`. No component emits those class names any
  more; removed. The engines keep their `mode: 'teams'` support for existing
  saves, which is deliberate and untouched.

## Automated validation

- `npm run typecheck`, `npm run lint`: pass.
- `npm test`: 496/496 pass (was 495/496).
- `npm run build`: pass, 5 routes.
- `npm run check:assets`: 162 production assets, 32.75 MiB, allowlist verified.
- `node scripts/relic-smoke.mjs` and `node scripts/folio-smoke.mjs`: pass.

## Visual check

Dial, Sizes and Atlas were rendered to static pages with `react-dom/server`
and the component CSS inlined, then screenshotted at 1280×800, 844×390 (short
landscape) and 390×844 (portrait). The step-rail bug above was found this way.
Confirmed in all three: the back control and `GameProgress` sit top left,
Menu top right with Others directly below, and each state fits one viewport
with no page scrolling. The pages were deleted afterwards.

## Not done

- **Docker build and container smoke did not run.** Docker is not available
  on this host in an unattended run. `npm run check:assets`, which is what the
  Docker build gates on, passed. CI will run both on push.
- **Browser and touch behaviour were not checked.** No dev server runs in an
  unattended session; the check above is a static render, not interaction.
  The Sizes mat and the Atlas globe are client-measured
  (`useLayoutEffect`) and network-backed, so neither drew in the static
  render — their contents are unverified here.
- **Formatting was not applied.** `oxfmt` reports issues across the repo,
  including files this work never touched, and CI does not check formatting.
  Reformatting only the changed files would have buried the diff.
- **No release, tag or push.** Version stays 0.23.0.

## The nightly instruction to rebuild Orin, Vela and Miro

The `run-night` task still asks for Orin v1-a, Vela v1-a and Miro in a third
style. Those three playable worlds were deliberately removed and that removal
shipped in v0.23.0 (`6fbca6d`); see
`docs/verification/2026-09-21-release-preparation.md`. `docs/DESIGN.md` and
`docs/verification/` hold no later decision reversing it, and the pitch
document the task cites,
`docs/concepts/2026-09-19-new-game-pitches/README.md`, no longer contains
them — it now holds only Lumo, Kiri and Tolu. They were not rebuilt. This is
the fourth run to reach this conclusion.
