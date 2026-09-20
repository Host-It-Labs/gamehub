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
- The previous names, themes and artwork are not design constraints. Invent names and imagery consistent with the documented worlds; preserve gameplay and scoring identity unless a rule change is requested.
- Give every game a strongly distinct visual identity, including materials, typography, palette, illustration and presentation; palette swaps of one shared skin are insufficient. Keep Blackwake’s approved printmaking direction. The library is a warm, neutral home for these distinct worlds. Review generated images and delegate image generation. Each Elsewild environment has its own geography and slot coordinates; match environment scale to readable creatures.
- Each extension adds one mechanic and is independently selectable. Setup has one Extensions heading, compact graphic tiles, and an information control on each tile. Rules use the shared modal and RuleExplanation.
- Put turn/waiting states beside the top players, confirmations beside the hand, and prominent graphical actions near the hand. Never restore the bottom status strip.
- Respect reduced motion and mute. Validate hidden simultaneous decisions and atomic moves in solo and online play; report browser/touch checks separately.

# Illustrated board workflow

Before creating or changing a game's illustrated board, responsive scene framing or hand presentation, read [game-world-layout](.agents/skills/game-world-layout/SKILL.md). Use its shared source/crop geometry, landscape and portrait planning, and generation brief. Keep the scene viewport independent of extensions, confirmations and hand count. Hands occupy a rounded floating tray above the bottom safe area that never zooms the world. Mora and Yata keep a fixed-size tray. Nox is the exception by decision: its plank shelf shrink-wraps the cards in hand (`--hand-step` from the card count in `table-worlds.css`), the die column stands exactly as tall as the shelf, and the confirm plate sits level beside it with Clear always present. Every die uses the shared cube in `components/game/die.css`; games set only `--die-size` and the face colours, never their own cube geometry. Apply this workflow to future games while preserving each game's distinct art direction.

- In an open illustrated game, float navigation/menu controls rather than reserving a top bar. Scale the fixed hand dock down on tablets and phones. Short landscape phones must show every playable area without board scrolling, even when this takes precedence over scenery edge coverage. Fullscreen/landscape requests must be user-triggered, feature-detected and optional when unsupported; never block portrait play on unsupported devices.

- Illustrated-board generation must protect complete landmark silhouettes (roofs, lookout huts, flags, canopies and bases), not only placement slots. Derive their safe source region from current device cameras and offsets before prompting; only expendable scenery may extend outside it. Keep the approved source/crop footprint during artwork refreshes. See the game-world-layout skill for measurement and acceptance checks.

- Before regenerating illustrated boards for zoom/framing feedback, compare source/crop ratios, complete-landmark bounding-box ratios, native slot size and per-device sampling density. Specify a measured intermediate composition; do not turn a small crop miss into a large global zoom-out. Use device-specific landmark fitting when appropriate, with both edge-coverage and landmark checks.

- Illustrated-board framing must be checked after browser zoom crosses responsive breakpoints. Derive minimum source-cover scale and maximum full-landmark fit from actual available dimensions, permitting modest closer framing where spare room exists. Test iPad-size and fractional browser-zoom viewports; do not regenerate artwork to conceal a camera-sizing bug.
- For any full-bleed illustrated board, follow [docs/illustrated-worlds.md](docs/illustrated-worlds.md): it names the data contract, runtime pieces, tooling and the two artwork skills.

- Shared game navigation: Others always sits directly beneath Menu, and player badges share the top navigation baseline in every world and viewport. Remove redundant Table and passing-direction controls; passing order remains available inside Others. Accepted artwork is fixed; do not leave A/B review selectors in playing scenes.
