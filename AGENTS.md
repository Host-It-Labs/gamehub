# Task size scale

Classify every request before starting and scale the verification to it. When
unsure, pick the smaller size; the user can ask for more.

- **Small**: a rule, text, scoring, value, copy or styling tweak in known
  files. Implement, run the relevant unit tests and stop. No browser QA pass,
  no screenshots, no viewport matrix, no preview server just to confirm. The
  browser may still be used while developing if it is genuinely needed to
  find or understand something.
- **Medium**: a new feature, a changed interaction or a layout change in one
  game. Tests plus one focused browser check of the changed view.
- **Large**: a new game, world, artwork integration, shared navigation or
  cross-game change. Full verification as the sections below require.

The browser/touch/viewport checks required elsewhere in this file apply to
medium and large tasks. For small tasks, say plainly that browser QA was
skipped by size rather than implying it was done.

# Global game navigation and viewport contract

Applies to every game, every game family, solo and online, practice and live play:

- Top left contains only the back/return control and game name. Menu, Others, time/advance-time and fullscreen controls belong at the top right. Others sits directly below Menu. Keep this arrangement in portrait and short landscape too; no game-specific reversal.
- Treat the playing screen as one viewport. Strongly avoid whole-page scrolling to reach the board, choices, hand, confirmation or navigation. Reflow into columns or side rails, reduce decorative spacing and duplicate headings, and fit the active board before reducing readable text or touch targets. Never hide essential controls with overflow clipping to claim a fit.
- Keep long rules, history, comparisons and optional inspections in explicit overlays with internal scrolling and restored focus. Extreme zoom/accessibility fallbacks may scroll locally; report them honestly rather than calling them viewport acceptance.
- Preserve in-progress choices when switching between options. Refreshing options within an active view must keep that view open.
- Read [game-world-layout](.agents/skills/game-world-layout/SKILL.md) for any new game or navigation/responsive layout change, including games without illustrated boards. Reuse `GameNavigation` for party/world screens and the shared trio toolbar for Nox/Mora/Yata. Verify portrait, short landscape, tablet, desktop, long labels and maximum player counts; report browser/touch checks separately.

# Pacing: players lock choices, the host moves on

Applies to every game, solo and online. Wait for players only when they lock in
their own decision (a ranking, guess, pin, card or final submit). Never make
every player confirm moving on to the next step, reveal or round. That single
**Next** belongs to the table host, and the game waits for the host even when
everyone has locked in. The host defaults to the table creator and can be
handed to another player in the lobby; while the host is disconnected any
seated player may press Next. Bots never move the table on. See the
23 September 2026 section of [docs/DESIGN.md](docs/DESIGN.md).
Party games end each round, and each match, with a ten-second table vote
(another round or finish; which party game next). A vote never waits on
anyone: most votes wins and silence doesn't count. See the table-votes
section of the same file.

# Extension explanation UI

Required for every new or changed extension explanation:

- Use `RuleExplanation` from `components/game/extension-rules.tsx` for overview rules and individual ability or goal inspections. Customer Orders in `components/game/yatai-festival.tsx` is the reference.
- Put the requirement or action the player must understand in the shared purple callout; rewards belong in the supporting text. Keep the shared purple outcome callout, short paragraphs with bold action labels, and a separated secondary note for limits. Use the shared typography and spacing in `app/globals.css`; do not introduce per-extension text sizes, plain unstructured rule blocks, or alternate callout styles.
- Reuse the same rule components in setup, match help, and inspections. Make changes to the shared component/styles when the visual standard changes.
- Setup extension explanations use a separate, larger modal above setup, opened by long-press, keyboard inspection, or Rules. Keep setup selections intact, restore focus on close, and constrain the modal to the viewport with internal vertical scrolling.
- Keep extension controls compact and graphical; on-board overlays must not cover placement slots or add board height. Content sets and extensions are independent, so rules and art must resolve through the current content set.
- Check overview and individual inspections, narrow-screen readability, and keyboard/long-press access when changing this UI. Report separately whether browser and touch behavior were actually checked.

# Gamehub creative direction

- Read [docs/DESIGN.md](docs/DESIGN.md) before visual, interaction, naming or extension work. Current implemented names are Blackwake, Elsewild and Nightshift; new names are under exploration and internal IDs remain stable.
- Required naming rule: game names must be short, simple to read aloud, and reasonably easy to pronounce for non-English speakers across languages. Prefer clear syllables; avoid English-dependent puns, opaque compounds and difficult consonant clusters. Treat proposed names as provisional until chosen; do not rename running games during concept-only work.
- Abstract strategy games (Nox, Mora, Yata) take short abstract names. Party and less abstract games (Know Me, Quiz) take plain, literal names that say what the game is; never an invented word.
- The previous names, themes and artwork are not design constraints. Invent names and imagery consistent with the documented worlds; preserve gameplay and scoring identity unless a rule change is requested.
- Give every game a strongly distinct visual identity, including materials, typography, palette, illustration and presentation; palette swaps of one shared skin are insufficient. Keep Blackwake’s approved printmaking direction. The library is a warm, neutral home for these distinct worlds. Review generated images and delegate image generation. Each Elsewild environment has its own geography and slot coordinates; match environment scale to readable creatures.
- Each extension adds one mechanic and is independently selectable. Setup has one Extensions heading, compact graphic tiles, and an information control on each tile. Rules use the shared modal and RuleExplanation.
- Put turn/waiting states beside the top players, confirmations beside the hand, and prominent graphical actions near the hand. Never restore the bottom status strip.
- Respect reduced motion and mute. Validate hidden simultaneous decisions and atomic moves in solo and online play; report browser/touch checks separately.
- **Hard rule: no noise text in the playing layout, in every game.** No eyebrows, subtitles, taglines, duplicate game titles, or helper and status sentences. The board, buttons, avatars, dots and images carry the state. Keep only content (prompts, clues, answer labels), names, scores and one short word per action; explanations go in Rules. When in doubt, cut the text.
- **Hard rule: never ship a flat, uninspired screen.** Give every game depth and energy (a considered palette, light, glow or material, and a centrepiece worth looking at) while staying sleek rather than busy. Wrap prompts with `text-wrap: balance` so lines never break awkwardly.
- Know Me (`orin`, formerly Tribu) holds Top Five and Dial as one game with an opening vote and an again/switch/end vote each round; see the Tribu section of [docs/DESIGN.md](docs/DESIGN.md). Always everyone for themselves: no teams. Only Top Five prompts carry a flag, on each option.
- Quiz (`miro`, formerly Sabi and Mundo) holds short trivia games the same way, Atlas and Sizes today, always everyone for themselves; see the Sabi section of [docs/DESIGN.md](docs/DESIGN.md). Every Quiz game uses the shared measuring-desk pieces in `components/game/sabi.css` and `sabi-steps.tsx`, and scores up to 100 per prompt. The Know Me and Quiz sets share `lib/games/party/tribu.ts` (the switch) and `components/game/reveal-motion.tsx` (quick reveal motion: count-ups and staggered drops and pops, under two seconds, off under reduced motion). New reveal and results screens use that kit.

# Illustrated board workflow

Before creating or changing a game's illustrated board, responsive scene framing or hand presentation, read [game-world-layout](.agents/skills/game-world-layout/SKILL.md). Use its shared source/crop geometry, landscape and portrait planning, and generation brief. Keep the scene viewport independent of extensions, confirmations and hand count. Hands occupy a rounded floating tray above the bottom safe area that never zooms the world. Mora and Yata keep a fixed-size tray. Nox is the exception by decision: its plank shelf shrink-wraps the cards in hand (`--hand-step` from the card count in `table-worlds.css`), the die column stands exactly as tall as the shelf, and the confirm plate sits level beside it with Clear always present. Every die uses the shared cube in `components/game/die.css`; games set only `--die-size` and the face colours, never their own cube geometry. Apply this workflow to future games while preserving each game's distinct art direction.

- In an open illustrated game, float navigation/menu controls rather than reserving a top bar. Scale the fixed hand dock down on tablets and phones. Short landscape phones must show every playable area without board scrolling, even when this takes precedence over scenery edge coverage. Fullscreen/landscape requests must be user-triggered, feature-detected and optional when unsupported; never block portrait play on unsupported devices.

- Illustrated-board generation must protect complete landmark silhouettes (roofs, lookout huts, flags, canopies and bases), not only placement slots. Derive their safe source region from current device cameras and offsets before prompting; only expendable scenery may extend outside it. Keep the approved source/crop footprint during artwork refreshes. See the game-world-layout skill for measurement and acceptance checks.

- Before regenerating illustrated boards for zoom/framing feedback, compare source/crop ratios, complete-landmark bounding-box ratios, native slot size and per-device sampling density. Specify a measured intermediate composition; do not turn a small crop miss into a large global zoom-out. Use device-specific landmark fitting when appropriate, with both edge-coverage and landmark checks.

- Illustrated-board framing must be checked after browser zoom crosses responsive breakpoints. Derive minimum source-cover scale and maximum full-landmark fit from actual available dimensions, permitting modest closer framing where spare room exists. Test iPad-size and fractional browser-zoom viewports; do not regenerate artwork to conceal a camera-sizing bug.
- For any full-bleed illustrated board, follow [docs/illustrated-worlds.md](docs/illustrated-worlds.md): it names the data contract, runtime pieces, tooling and the two artwork skills.

- Shared game navigation: Others always sits directly beneath Menu, and player badges share the top navigation baseline in every world and viewport. Remove redundant Table and passing-direction controls; passing order remains available inside Others. Accepted artwork is fixed; do not leave A/B review selectors in playing scenes.


# Library cover artwork

- Use dedicated full-bleed square illustrations, equally sized across the library.
- Generate the exact current game title inside the image, with legible custom
  typography integrated into the composition. Never overlay visible DOM titles
  or add duplicate titles to cover art. Keep accessible control and dialog names.
- Regenerate from written game/theme/style briefs without previous images as
  references unless the user explicitly requests a reference-based edit.
- Represent the game's world and meaningful elements in its own visual style;
  never use a gameplay screenshot, interface replica, box mockup or gray mat.
- Review title spelling, thumbnail legibility, edge coverage and square framing
  before integration. Preserve sources, versioned outputs and exact prompts.
- `lib/games/box-covers.ts` is the shared library/online cover source. Update the
  game registry, covers and public UI together when changing public names; keep
  stable internal IDs and saves intact.

## Shared game progress

Every game shows round/progress directly beneath the top-left back/name control on every device, using `GameProgress` from `components/game/game-progress.tsx`. Do not put round counts in the center navigation line or in a bottom action panel. Atlas does not show a medium/hard badge. Know Me (Top Five and Dial) and Quiz (Atlas and Sizes) require human players in every seat; no solo bot matches, bot-filled online seats, or bot replacements.
