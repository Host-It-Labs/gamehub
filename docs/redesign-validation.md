# Field edition implementation and validation

Implemented locally on 2026-09-16. No commit, push or deployment. Existing related work was retained.

## Delivered

- Public identities: Blackwake, Elsewild and Nightshift; internal IDs and account preference keys remain stable.
- Three independent extensions per game. Tack and Nurture are removed from playable rules. Salvage resolves private simultaneous claims, with Shields applied before the −6/+3 adjustment. Migration and placement resolve atomically, including combinations with Roam.
- Content-aware goals, scoring and bots. Floodline's path rewards A–B–A; Beacon rewards occupied habitats without its species. Other goals were audited: diversity reinforces the garden, pairs can be satisfied in pair-scoring regions, species spread supports the inland shared habitats, and whole-board goals do not prescribe a locally losing arrangement.
- Compact setup tiles with one Extensions heading and separate information controls. Shared rules appear in accessible large modals. Top player states, hand-adjacent confirmations, a distinct turn cue and prominent extension actions replace the old bottom strip.
- Blackwake's illustrated oval seats 2–6 players with the viewer at the bottom. Completed tricks carry immutable cards, hazard, ordinary points and per-seat score changes. The UI consumes new event IDs in order, skips historical captures on initial load, and waits for its queue before opening solo results.
- Thirty production illustrations: three covers, two independent environments, one table and twenty-four transparent creature/food tokens. Code renders ranks, suits, names and scores. The tropical water canvas uses a land/boardwalk mask, visibility suspension and a static reduced-motion frame.
- State version 4 rejects incompatible resumptions. On the next server startup, incompatible live online games return to their existing lobbies without manufactured results. Membership, accounts, preferences and recorded completed history remain. Retained mechanics' setup choices are migrated; newly introduced mechanics start disabled.
- A prepared online move survives other players committing. Connection status distinguishes saving, retrying and reconnecting. Reconnecting during the same decision does not replay the turn sound.

## Automated checks

`npm test`: **85/85 passed**. `npm run typecheck`, `npm run lint`, and `npm run build`: **passed**. Full tests and prerendering used authorized localhost binding outside the restricted sandbox. `git diff --check` also passed.

The suite covers a 240-game configuration matrix: all eight extension combinations, both sets (or normal/Fast Blackwake), and every player count from two through six. It validates each intermediate save and legal termination. Additional focused tests cover hidden commitments, duplicate submissions, stale requests, reconnect serialization, negative scores, Shield/Salvage order, token resets, Migration capacity and ordering, rejected atomic actions, coastal goals, bot counterplay, preference migration, and capture-event IDs across round transitions.

Artwork tests decode every active CSS texture, map, cover variant and token; check all token alpha channels; verify cover widths; and confirm both maps' slot capacities and target bounds. Optimized derivatives are reproducible with `node scripts/optimize-artwork.mjs` using the pinned Sharp dependency. Originals and prompts are retained in [artwork-manifest.md](artwork-manifest.md).

## Salvage policy experiment

Reproduce with `node --experimental-strip-types scripts/simulate-salvage.mjs 25`. Raw results: [salvage-simulation.json](salvage-simulation.json).

900 complete games: 25 paired seeds × 3 claim policies × 3 player counts × 2 deck sizes × Turning Tide on/off. Shields are enabled. The focal seat rotates by seed; opponents and all ordinary card choices use the medium bot's public-information policy. “Always” claims at the first eligible opportunity; “never” always passes. Lower mean penalty is better.

| Players | Deck | Turning Tide | Strategic | Always claim | Never claim |
| --- | --- | --- | ---: | ---: | ---: |
| 2 | Normal | Off | 81.68 | 81.68 | 87.40 |
| 2 | Normal | On | 92.72 | 92.72 | 88.96 |
| 2 | Fast | Off | 24.44 | 24.44 | 22.20 |
| 2 | Fast | On | 24.72 | 24.72 | 22.96 |
| 3 | Normal | Off | 80.48 | 80.48 | 74.20 |
| 3 | Normal | On | 85.60 | 85.60 | 77.56 |
| 3 | Fast | Off | 24.68 | 27.52 | 21.40 |
| 3 | Fast | On | 28.24 | 28.36 | 24.20 |
| 6 | Normal | Off | 61.04 | 71.16 | 62.48 |
| 6 | Normal | On | 73.92 | 88.80 | 77.32 |
| 6 | Fast | Off | 15.44 | 28.40 | 15.00 |
| 6 | Fast | On | 14.56 | 28.44 | 14.60 |

Always claiming does not dominate these results. In six-player normal games the strategic policy beats both fixed claim policies; in several smaller games never claiming does better. A focused test also verifies that a revealed opposing claim changes a bot's preference toward contesting an otherwise clean trick. Weak public-information hands produce an abstention preference.

These are bot-specific observations, **not established human balance**. Twenty-five seeds per condition are a small sample; the experiment has no confidence intervals, no human playtest and no exhaustive opponent-policy search. The strategic bot still behaves like always-claim in several two/three-player configurations and overclaims there. The agreed −6/+3 values are unchanged. Ignoring ordinary penalties and future token value, claiming's adjustment alone breaks even at a one-third capture probability; actual decisions also depend on ordinary trick cost and opponents' response.

## Evidence boundaries

All generated output was visually inspected by the delegated artwork agent; final maps and representative cover/table/token outputs were also reviewed during integration. Geometry, source references and responsive variants were checked statically.

Browser/computer-use testing was not authorized. Responsive rendering, keyboard focus restoration, long-press/touch handling, audible cues, visual water-mask alignment and animation timing remain **unverified interactively**. Automated rule/event tests and successful builds do not establish browser acceptance. No live server data or deployed application was changed.
