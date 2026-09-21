# Gamehub design direction

## Shared progress and human-only party games (21 September 2026)

Progress always sits directly below the top-left back/name control, in the shared
`GameProgress` component, on desktop and mobile. This supersedes previous centered
round counters. Atlas omits the difficulty badge. My Top Five and Atlas require
human players in every seat, including learning sessions; online starts cannot fill
empty seats with bots, and disconnected humans cannot be replaced by bots.


## Mobile navigation refinement (21 September 2026)

On phones (including short landscape), back/name and icon-only Menu (vertical dots) and Others share the first row. Player badges occupy a horizontally scrollable second row. Desktop keeps the existing stacked Menu/Others layout. Nox is the exception: only its table-rim player badges are rendered, with no Others control. Online Table administration is host-only during play and sits below the navigation and player rows. Nox's centered arrow shows alternating exchange direction during passing and clockwise order during tricks, using the engine's seat-order calculation.

## Global navigation and viewport rule (21 September 2026)

This rule supersedes conflicting layout exceptions below and applies to all games, including party games, practice and online play. Top left holds only back/return and the game name. Menu and Others stay on the right, with Others directly below Menu on desktop and beside Menu on phones, as detailed above; time/advance-time and fullscreen controls also belong on the right. Mobile player badges use a separate horizontally scrollable second row. Nox uses only its table-rim badges and has no Others control.

A playing screen should fit one viewport. Players must not have to scroll the whole page between choices, board, hand and confirmation. Reflow the active game, remove duplicate headings and reduce decorative spacing first. Preserve legible labels and usable touch targets. Put long rules, history, guess comparisons and optional inspections in overlays with internal scrolling; never conceal inaccessible gameplay using overflow clipping. Test portrait, short landscape, tablet and browser zoom; report any remaining accessibility/extreme-size scrolling fallback explicitly.

Top Tier retains a private order for every visited topic until the next round. Switching restores that order. Refreshing from an active ranking selects the first fresh topic and stays in the ranking view; refreshing from the initial chooser stays there. Two refreshes per player per round. Compact topic cards keep their title and answer chips, without a category heading.


This is the visual and interaction contract for future work. Mechanics are the stable core; names, fiction, characters, scenery and cultural references may evolve within these worlds. Do not reconstruct the previous Tide/Mora/Yatai presentation from old assets or memory.

## Mora cleanup and future-game requirements

This requirement supersedes historical sidebar and portrait-pan guidance below. Each game's entire UI—not only its board—needs its own material and shape language: hand tray, die, extension actions, habitat indicators, player badges and goals. Within a game those roles must also be visually distinct, not identical rounded panels recoloured. Preserve shared accessible interactions and `RuleExplanation` presentation.

Design dedicated landscape and tall portrait boards with independent measured coordinates but identical gameplay. Portrait play must expose every area on one screen without board scrolling. Establish readable shape/pattern correspondence between die restrictions and placement sites; names and colour alone are insufficient. Preserve existing rule memberships.

Brief new boards with localized animation layers/masks and foliage pivots so water and trees can move without moving targets or text. Respect reduced motion and visibility suspension; sound effects are deferred. See the shared world-layout skill for acceptance requirements. These are requirements, not a claim that the new artwork is already integrated.

Advanced view opens an adaptive full-screen all-player board inspection from player badges, with your own seat in the passing-order diagram and a prominent close button. Omit the duplicate self board; show each opponent’s goal progress and remaining extension uses, even when spent. It must never push or shrink the live board.

## Required naming and identity rules

Game names must be short, simple to read aloud, and reasonably easy for non-English speakers to pronounce. Prefer clear syllables and uncomplicated spelling; avoid names that rely on English puns, dense consonant clusters or opaque English compounds. Universal pronunciation is not required. Apply this rule to every future name proposal. Existing implemented names below are not automatically approved by this rule; do not silently rename them during visual exploration.

Each game must feel like its own game, with strongly distinct illustration, materials, typography, shapes and presentation, not merely another palette on a shared theme. Nox’s current visual style is approved for retention. Elsewild and Nightshift are being explored anew, including simpler names. Shared accessibility and interaction conventions remain; a shared visual skin is no longer the goal.

The library should be warm and neutral rather than bright white or themed as one of its games. Explore physical game boxes, shelves and inviting tabletop presentation. Omit the current promotional heading and supporting tagline in concepts, and use a lighter, clearly visible Play control. Opening a game can feel like taking down a box and unfolding a board; motion must remain brief, skippable and reduced-motion compatible.

Current scope (16 September 2026, revised after concept feedback): the user approved shaped game boxes for the library and a first immersive 3D implementation of the inland observatory. Keep existing navigation, omit the concept storyboard and invented navigation, and keep current public names until new names are selected. Food-game alternatives and the tropical alternative remain concepts. Concept storyboards are proposals, not functioning animation evidence.

The observatory uses lazily loaded Three.js with an orthographic camera and simple geometry, capped render resolution, on-demand rendering, resource disposal and off-screen/hidden suspension. Keep gameplay targets in the DOM and retain an illustrated fallback when WebGL fails. Animal standees have physical bases; scores remain above and cards below. Do not add orbit controls that compete with touch placement. Use inexpensive CSS depth for library boxes so browsing does not load WebGL.

## Worlds

| Public identity | Internal ID | World | Content sets |
| --- | --- | --- | --- |
| Nox | `undertow` | Improvised boats, pirate radio, nocturnal harbour, communal salvage | One deck; normal and Fast rules |
| Mora | `wildgrove` | Strange wildlife reclaiming human infrastructure | The Observatory; Floodline Station |
| Yata | `midnight` | Underground street food and night culture | After Hours; Side B |
| My Top Five | `orin` | Personal rankings and shared guesses | Two rounds |
| Atlas | `miro` | Satellite globe and shared destinations | Places; Photos; Three facts |

Nox, Mora and Yata share one rules module (`lib/games/trio/engine.ts`) because they
share a deck, a die and a trick. My Top Five and Atlas use their own party
engines behind `lib/games/standalone/registry.ts`.

Internal IDs remain stable for routes, account preferences and records. Subject kind indices remain stable within each content set; changing a picture or name must never silently alter its scoring identity.

## Artwork

Nox retains printmaking and independent zines as its visual language: imperfect ink edges, simplified expressive silhouettes, a restrained pigment palette, visible paper and occasional deliberate misregistration. Use maritime woodcuts and radio ephemera for Nox. Elsewild and Nightshift must explore independent visual languages; their former field-note and gig-poster treatments are not constraints. Cultural references should contribute an idea or silhouette, not overwhelm recognition with decoration.

Avoid glossy plastic, hyper-detailed rendering, uniform soft lighting, stock fantasy cuteness and tiny decorative detail that disappears at play size. Mature means assured graphic decisions, not obligatory darkness or violence. Keep each species and food visually distinct at thumbnail size.

Generate fresh illustrations through the imagegen skill and a delegated image-generation agent. Review actual outputs before wiring them in. Save versioned files, prompts and provenance in the repository; project assets must not depend on generated-image cache paths. Do not repeatedly edit a degraded image or substitute CSS panels for an illustrated world.

Map composition and interaction geometry are one design. Paint habitat spaces as actual places with enough room for their full capacity; set hit targets and slots against the final image. Each environment owns independent coordinates. Environment scale must make sense around the existing readable creature size. Do not shrink creatures to repair a miniature-looking map. Die groups use recognizable placement shapes and physical ground materials. Never add cryptic glyph rows or arbitrary habitat emblems; group memberships and placement rules remain unchanged.

Render gameplay numbers, names, suit symbols, formulas and explanatory text as crisp accessible DOM content. Box-cover titles are the exception: generate their lettering inside the artwork, with accessible names on the surrounding controls. Keep responsive covers, loading manifests and optimized images synchronized. Preserve alpha on tokens.

## Extension contract

One extension means one mechanic. Content sets are independent of extensions. Every extension works alone and in every combination for its game.

- Nox: Shields; Turning Tide; Salvage.
- Elsewild: Roam; Migration; Sanctuary Goals.
- Nightshift: Customer Orders; Specialty Stalls; Market Seasons.

Setup has one Extensions heading. Tiles contain the same emblem used in-game, a short title, an unmistakable enabled state, and a separate information button within the tile boundary. Never nest interactive controls. Opening rules must not change selection.

All overview and individual rules use `RuleExplanation`: action/requirement in the shared purple callout, rewards and examples in supporting paragraphs, limits in the separated note. Reuse these components in setup and match help. Show setup rules in a larger viewport-constrained modal with scrolling, accessible title, keyboard and long-press access, and restored focus. Do not append explanatory blocks below tiles.

Game actions are tactile graphical pieces with clear available, selected, waiting and spent states. Larger controls may use reclaimed interface space, but must never cover card slots or inflate the illustrated board. Short labels and counters are useful; rules prose belongs in inspection. Stalls are a prominent action, not an inconspicuous utility icon.

## Attention and confirmation

The top player display is the source of turn and readiness information. Identify who can act and who is still deciding, including simultaneous exchanges, drafting and Salvage. Do not restore the bottom status strip. Use the shared animated, nonverbal status indicators for deciding, committed and waiting, plus a separate die-roller indicator. Shapes and accessible labels remain meaningful with reduced motion. Connection problems must remain visible near these states.

Use a brief animation and a distinct sound when a player becomes actionable, respecting mute and reduced motion. Do not loop attention effects or replay cues on ordinary rerenders. Place confirmation immediately beside the hand in every game. Preserve the user's confirmation preference; exchanges and secret Salvage commitments always have an explicit lock action.

Nox seats players around a table, anchored to the viewer. Card position communicates ownership; a clockwise marker and lead badge communicate order. Reveal completed tricks before gathering them toward the winner. Display ordinary penalties and Salvage adjustments distinctly. Process capture events once and in sequence; do not infer captures from current cards after a round reset.

Ambient animation enhances the place without becoming another game object. Floodline water uses a transparent masked canvas with DOM hit targets above it. Suspend it off-screen and in hidden tabs; reduced motion gets a static frame. No wandering CSS rabbits.

## Rules and data

Salvage claims are secret simultaneous submissions from eligible non-leaders before any card is played. One claim per round; no final-trick claims. Reveal only after all eligible players commit. A successful claimant gets −6, an unsuccessful claimant +3, after Shields modify ordinary trick penalties. Negative scores are valid. Printed ranks and follow-suit rules never change.

Migration moves one sheltered creature once per match before normal placement. It ignores the die for relocation, excludes Release, requires destination capacity, preserves remaining source order, and appends to the destination. Normal placement is validated against that resulting board. Submit both changes atomically; cancellation spends nothing. Roam can accompany the normal placement.

Goals must reinforce habitat rules. Floodline's path goal requires A–B–A; its Beacon goal requires other occupied habitats without the Beacon species. Content-aware logic is shared by scoring, goal progress, explanations and bots.

State version 4 replaces earlier playable saves. Old solo resumptions are removed on load; incompatible online games return to their existing lobbies on server startup, without manufacturing results. Accounts, memberships, preferences and completed history remain. No old game engine is retained for those matches.

## Validation

Run tests, typecheck, lint and build. Cover independent extensions, combination matrices, normal/Fast decks, both content sets, all seat counts, private submissions, invalid actions, reconnects, stale requests, state resets and bots using only public information.

Use `node --experimental-strip-types scripts/simulate-salvage.mjs 25` to reproduce the automated policy comparison. The result measures particular bots, not proven human balance. Report counterexamples and limits honestly.

Inspect generated art and verify all asset references. Browser, touch, sound and motion acceptance require actual interactive checks; static checks do not establish them. Follow the user's explicit browser-tool permission constraint. Never report deployment or production acceptance from local validation.

Implementation evidence and balance limitations: [redesign-validation.md](redesign-validation.md). Asset provenance and prompts: [artwork-manifest.md](artwork-manifest.md).

## Observatory and game-box prototype validation

The approved paper-diorama concept is implemented as a Three.js 0.186.0 textured relief surface, not a fully modelled orbitable environment. The environment fills the presentation background; the playable board retains proportional coordinates and native horizontal exploration on narrow screens. Pawn standees and their raised bases remain DOM/CSS. Mouse movement shifts the relief light; reduced motion disables that response. Rendering is on demand, capped at 1.5 device pixel ratio and 1.5 million pixels, suspended when hidden/off-screen, with a static image fallback for renderer/texture failure. Full WebGL resources and observers are disposed on exit.

Library boxes use CSS perspective and independent proportions (compact harbour card box, arched nature box, conventional food box). The neutral library keeps the existing header and Play/Resume flows; there are no invented navigation items, tutorial panels, promotional heading or coming-soon placeholders. Mora and Yata were subsequently selected in the refinement below; Nox was subsequently selected as the pirate game’s public name.

Production sources: `public/art/observatory-diorama-v1.png` and `public/art/box-{undertow,wildgrove,midnight}-v1.png`. Box fronts are equal 512px thirds extracted from the delegated atlas. `scripts/optimize-artwork.mjs` produces actual-width responsive variants and the preview manifest. See [concept provenance and alternatives](concepts/2026-09-16/README.md) for the exact imagegen prompts and inspected references.

After integration: 85 tests passed, including artwork decoding, responsive image sizes, map capacities/coordinates and the existing mechanics suite. Typecheck, lint and production build passed. The build emits a chunk-size advisory; Three.js is dynamically imported only by the observatory. No browser, touch, GPU performance or visual interaction acceptance was performed. No commits, pushes or deployment.

## Refinement after box and observatory feedback (16 September 2026)

Public names Mora and Yata are restored at the user's request. Nox is now selected for the pirate game (superseding the unselected Nami proposal). Internal IDs are unchanged. Creature art and player portraits are explicitly deferred.

The library uses compact wrapping shelf items for a growing catalog. Nox is a smaller worn card box; Mora keeps an arched botanical stone/paper silhouette; Yata has a conventional box with Mora's footprint. CSS front, back, spine and top faces expose depth at rest and turn front-on on hover/focus. Reduced motion keeps the resting pose.

The Observatory uses exactly one scene within an edge-to-edge board viewport; the table surrounding it is made of complementary materials and does not repeat the image. Preserve the scene's 3:2 proportions; native scrolling exposes any overflow on short or narrow screens. Version 2 has seventeen physically divided habitat spaces (4/4/2/3/3/1), with matching independently measured coordinates. The static fallback is hidden only after the WebGL surface is ready. Player and action controls use paper, wood and stone treatments; their shared behavior is retained.

Source and generation prompt: [observatory v2](concepts/2026-09-16/observatory-v2.md). The user has not requested browser/computer-use tools, so browser, touch and visual interaction acceptance remain unverified.

## Compact boxes and Nox naming (16 September 2026)

The user selected **Nox**, replacing Blackwake. The `undertow` ID, saves and rules are unchanged. Each box front occupies approximately half its previous area (120px instead of 170px wide for Nox; 148px instead of 210px for Mora/Yata). Nox has a 14px card-box depth. Buttons retain 44px minimum height, with natural-height details and wrapping actions; the old 42px details row and clipped overflow no longer apply.

New version-2 box art uses close compositions, visibly worn printing, playing cards for Nox, creature pieces for Mora and a stall sign for Yata. Titles remain accessible DOM text. Mora uses a continuous arched limestone silhouette repeated through its depth, including the curved roof, rather than a disconnected rectangular top or mismatched spine. See [box art provenance](concepts/2026-09-16/box-v2.md).

Validation for this refinement: all 85 tests, typecheck, lint, production build and diff whitespace checks passed. HTTP tests and the build required loopback networking outside the restricted sandbox. All three generated source images were visually inspected and responsive variants decoded by the artwork test. Browser rendering, touch interaction and the resulting CSS depth remain unverified.

## Mora paper-world refinement (16 September 2026)

Creature art is no longer deferred: both content sets now use twelve freshly generated layered-paper creatures with preserved alpha and unchanged kind indices. The Observatory and Floodline Station were freshly generated as tactile paper worlds; architecture, foliage, floors and water share the tree material language. All seventeen placement centers in each map were measured against the new art. Sources and exact built-in imagegen prompts: [Observatory](concepts/2026-09-16/observatory-paper-v3.md), [Floodline](concepts/2026-09-16/floodline-paper-v1.md), [creatures](concepts/2026-09-16/mora-paper-creatures-v1.md). `node scripts/prepare-mora-paper-creatures.mjs` reproduces the creature crops.

Habitat titles are smaller and no longer carry die-group glyphs. Each full board shows current / maximum habitat points and a short scoring condition. DOM equality/inequality marks sit between relevant spaces; multipliers reinforce cross-habitat scoring. Die help names the actual destinations for each content set. Maxima are per-habitat ceilings, not a promise they can all be reached in one match. Placement legality and scoring rules are unchanged.

Both maps now use the shared proportional fit calculation: landscape fits within both available dimensions, portrait uses available height with horizontal exploration. Vertical board panning is removed. The paper table replaces the separate dark player strip and wooden hand strip; Observatory player tags overlay the quiet upper scene on taller landscape screens when goals do not occupy that edge. Short screens and goals retain their own player row to avoid covering gameplay. The board remains proportional rather than stretched to every screen ratio, with fixed controls outside the horizontally panning map.

Validation: all 91 tests, typecheck, lint, production build and diff whitespace checks passed. HTTP tests and prerender needed sandbox-external loopback access. New tests enumerate all local species arrangements to check the four local habitat ceilings and exercise cross-habitat ceilings, pair symbols and die destination text. Generated art was visually inspected and runtime images decoded with alpha/dimension checks. Browser, touch and visual layout acceptance remain unverified; no browser/computer-use tools were requested. No commit, push or deployment.

## Observatory surrounding scenery and floating hand (16 September 2026)

The Observatory alone now places its unchanged proportional board over a wider generated paper woodland backdrop, covering the table to the edges of desktop screens. Only the outer 3% of the board illustration is feathered into the surroundings; gameplay targets, creature positions, and labels remain unmasked. The backdrop is a static compressed WebP and adds no rendering loop. Floodline and other games retain their existing presentation.

The Observatory's equality and inequality markers are omitted; its scoring descriptions and multipliers remain. Its orange hand tray and shared ability backing panel are removed. Individual creatures use rounded pale pieces, raised rims and grounded shadows; dice and extension actions float independently above the scenery. Selected pieces retain a visible outline, keyboard focus remains distinct, and reduced motion disables transitions.

Artwork source, generation prompt, and optimized output: [surrounding scenery provenance](concepts/2026-09-16/observatory-surroundings-v1.md). Browser and touch appearance have not been checked.

Validation for this refinement: all 91 tests, typecheck, lint, production build, and scoped diff whitespace checks passed. HTTP tests and prerendering needed local networking outside the sandbox. The build retains its chunk-size advisory. The generated 1536 × 1024 surroundings were visually reviewed and the 438,606-byte WebP decoded by the artwork suite. The composed browser layout and touch behavior remain unverified. No commit, push, or deployment.


## Unified Observatory scene and readable controls (16 September 2026)

The Observatory now uses `observatory-unified-v1`, freshly generated as one continuous forest with all seventeen spaces. The central 80% is the playable rectangle. Measured habitat coordinates are converted into that rectangle; the whole illustration is rendered once behind the table and follows the board's scale and horizontal pan. There is no independent surroundings image or masked internal board edge. Only the outer perimeter fades into an olive table ground on screens wider than the illustration. The existing optional WebGL relief and static fallback both use the same full source; miniatures show the matching central crop.

Navigation, identity/progress, passing direction, table inspection and left-side actions have opaque light backgrounds and dark text. The hand has a rounded backing and a shallow upward arc, with native horizontal scrolling retained. Short screens scroll the complete table to keep controls reachable. Sanctuary goals have a dedicated centered lavender row immediately below the players in solo and online Observatory matches, distinct from player score tags. Floodline retains its existing presentation. Mechanics and scoring are unchanged.

The image was visually inspected; browser, touch, GPU, keyboard interaction and final rendered layout have not been checked. Source and exact prompt: [unified art provenance](concepts/2026-09-16/observatory-unified-v1.md).

Validation: all 91 tests, typecheck, lint and production build passed; tests and prerender used loopback access outside the sandbox. The existing large-chunk advisory remains. No browser or touch checks, commit, push or deployment.

## Reference-matched paperland and simple creatures (16 September 2026)

The user's supplied handcrafted concept is the visual reference, retained as `docs/concepts/2026-09-16/observatory-paper-style-reference.png`. The active scene is now `observatory-paperland-v4`: chunky layered cardstock foliage, folded observatory architecture, stacked terrain, woodland on one side and a modest farm valley on the other. The playable crop is x16%, y13%, width65%, height65%, midway in scale between the earlier close board and the rejected distant panorama. Its upward offset gives nursery standees headroom. All seventeen spaces were remeasured; labels sit below their groups.

`observatory-layout.ts` owns the crop shared by map targets, miniatures and full-screen rendering. Following the supplied desktop screenshot, the entire source now uses one uniform scale: sides and corners are never independently stretched. The board grows to keep real scenery behind the fixed controls and cover every edge, and native scrolling in both directions exposes any gameplay overflow. Both the SVG fallback and optional on-demand Three.js relief render one continuous surface. No independent surroundings image, repeated board or fade into flat green is used. Regression checks cover the screenshot’s 1906 × 939 size, phone, tablet, desktop, ultrawide, advanced-view sidebar and both ends of horizontal/vertical scrolling. They assert uniform pixel scale as well as scene coverage and target alignment.

Six new inland creatures use simple printed-paper silhouettes with warm cream cut edges. They retain their original species indices and rules, and all inland token contexts use the v2 images. Floodline's coastal creatures are unchanged. The hand uses matte paper pieces on a rounded tray with a bottom gap and floating shadow. Sanctuary goal medallions are 44px with 34px icons (40px creature cutouts), in their distinct row beneath player tags.

Source prompts and geometry: [paperland v4](concepts/2026-09-16/observatory-paperland-v4.md) and [creatures v2](concepts/2026-09-16/mora-paper-creatures-v2.md). Sources and alpha were inspected. All 94 tests, typecheck, lint, production build and whitespace checks passed. Tests and prerender used loopback access outside the sandbox; the existing bundle-size advisory remains. Browser, touch, keyboard interaction and GPU visual acceptance remain unverified. No commit, push or deployment.


### Screenshot-driven distortion correction

The former peripheral-region stretching was visibly wrong even though coverage tests passed. It has been removed, rather than hidden by changing the illustration. The corrected tests explicitly forbid multiple independently scaled regions and compare horizontal and vertical source-pixel scale. Large scenes now require native two-axis scrolling when they do not fit the available board viewport. The supplied screenshot established the defect; no live browser or touch verification was performed for the correction.


## Taller source and single visible scene (16 September 2026)

The active source is `observatory-paperland-tall-v5`, a fresh 1024 ×1536 paper landscape with substantial additional scenery above and below the sanctuary. Width and the handcrafted materials follow v4. `observatory-art.json` owns source dimensions and the 780 ×520 gameplay crop at125,445; map coordinates, crop generation, preloading, miniatures and both renderers use this shared contract.

The root table no longer paints a separately scaled CSS background image. The board placeholder is removed once the scene mounts, and the SVG fallback is hidden when WebGL is ready. Thus only one scene is visible, including when the renderer fails. Its uniform scale supplies real edge coverage; no sides are stretched or repeated. Typical portrait phones/tablets keep their previous playable scale. Landscape can zoom and use native scrolling to fill its width while keeping controls outside the scroll region and every target reachable.

Regression checks cover the tall source/crop dimensions, uniform pixel scale, all seventeen target centers, absence of a second CSS table image, preservation of ordinary portrait scale, and edge coverage across scrolling at phone, portrait tablet, landscape iPad Mini, desktop and ultrawide sizes. The artwork and cropped derivative were visually inspected. Live browser/touch/GPU appearance remains unverified.

Validation for tall v5: all 96 tests, typecheck, lint, production build and whitespace checks passed. HTTP tests and prerender required sandbox-external loopback access. The existing bundle-size advisory remains. No live browser/touch verification, commit, push or deployment.

## Landscape crop visibility (16 September 2026)

Landscape Observatory sizing now fits the entire gameplay crop into the available board area with 24px vertical clearance. It no longer enlarges the board solely to make the portrait source cover a wide table. The landscape board frame and viewport allow visible overflow so standees, focus outlines and Release cannot be cut off at the action-row boundary. Portrait geometry is unchanged. A single uniformly scaled scene remains; wide screens can expose the paper table at the sides because the source is portrait. Full-width scenery at this smaller gameplay scale would require a wider composition, not a duplicated or stretched background.

Focused artwork/layout tests (8), typecheck and lint passed. Browser and touch appearance remain unverified.

## Wide-source framing prototype (16 September 2026)

The active source is now `observatory-wide-v7.png`, a fresh 1536 × 1024 landscape composition. Its gameplay crop is 384 × 256 at (560,368), one quarter of both source dimensions. This provides continuous scenery beyond the board in all directions while keeping the previous portrait scale and the fitted, unclipped landscape board. All seventeen target centers were remeasured. No CSS background copy, stretched margins, or artificial upscaling is used. The shared metadata remains authoritative for scene, targets and miniatures.

Geometry checks now cover edge-to-edge artwork at landscape iPad Mini, desktop, 3440 × 1440 ultrawide, and a desktop with the opponent sidebar. An exceptionally short 2560 × 680 viewport still prioritizes the complete playable crop over full scenery coverage; the source cannot cover that extreme at this scale. Portrait exploration remains unchanged.

This is deliberately a framing iteration before final artwork polish. The image generator returned 1536 × 1024 despite a higher-resolution prompt; the central crop has only 384 native pixels of width, so source sharpness remains limited. The on-demand WebGL renderer now supports up to DPR 2 / 8 million pixels instead of DPR 1.5 / 1.5 million, avoiding additional full-screen canvas downsampling on ordinary desktops. Reduced motion, visibility suspension and resource cleanup are unchanged. See `concepts/2026-09-16/observatory-wide-v7.md` for provenance. Browser/touch acceptance is still pending.

Validation for this framing iteration: all98 tests, typecheck, lint, production build and diff whitespace checks passed. Source and gameplay crop visually inspected; live browser/touch rendering remains unverified. No commit, push or deployment.

## Tighter artwork v8 integration (16 September 2026)

Active source: `observatory-wide-v8.png`, 1536 × 1024. The logical 528 × 352 crop at510,300 increases native gameplay pixels by89% over v7. The scene continues beyond that logical rectangle, so outer painted pad rims remain visible; the source is not cut into a board/background pair. Portrait scroll padding reveals the outermost creature standees. All17 target centers were remeasured. Board sizing stays unchanged and the standard coverage fixtures pass, including the supplied desktop framing. Native image resolution remains finite; this is a sharper allocation, not a claim of4K art. No browser/touch verification.

## Stable camera and floating hand standard (16 September 2026)

The Observatory play stage is now positioned independently of normal UI flow. Landscape reserves upper scenery for the dome; portrait reserves space for player/goal information. Optional goals, hand confirmation and remaining creature count do not change stage dimensions. The scene and all placement targets move together. The hand tray is always580px wide subject to available viewport width, with fixed breakpoint height and a safe-area gap below. Empty and partial hands retain that geometry. Actions and confirmation float beside the hand rather than consuming camera height.

Release now sits on the left winding path (approximately source425,627), outside the logical crop; portrait exploration has additional left clearance so it remains reachable. Placed creatures no longer have CSS oval bases. The image itself is unchanged.

Future illustrated-game work must follow [game-world-layout](../.agents/skills/game-world-layout/SKILL.md), linked from AGENTS.md. It records shared source/crop math, separate landscape/portrait planning, pixel-density constraints, delegated generation briefs, fixed hand/camera invariants, and honest device validation. These are project-wide layout requirements; individual games retain their own art direction. A first-pass workflow improves predictability but cannot guarantee exact image-generator composition.

## Native-resolution refinement outcome (16 September 2026)

The user accepted v8's stable framing and requested higher native detail. v9 and v10 were generated as tighter/high-resolution candidates, but both returned1536 ×1024 despite explicit3072 ×2048 requests. Both also exceeded their specified gameplay footprint and raised the dome beyond the approved framing. They are retained with provenance but are NOT active; installing them would reintroduce roof cropping or border/scale regressions. v8 remains the active artwork. No artificial upscaling is represented as recovered detail.

The project skill is installed in `.agents/skills/game-world-layout/SKILL.md`, discoverable by Codex, and linked from AGENTS.md. It now includes native sampling-density calculation, actual output metadata verification and approved-screenshot visible-area measurement. Source metadata owns the roof landmark used by geometry checks. Coverage fixtures use the current fixed stage rather than the obsolete UI-content-sized stage. Native high-resolution asset replacement remains outstanding; the built-in tool did not deliver it. The optional CLI/API route is not authorized or configured (no API key present) and was not invoked.

## User-selected v10 and bottom dock (16 September 2026)

v10 is now active at the user's explicit selection. Shared metadata uses its actual1536 ×1024 source and822 ×548 logical crop at372,220; all17 targets and habitat labels are remeasured. The user accepts the built-in tool's available resolution; API generation is out of scope. Source and board WebP exports retain native dimensions at quality94.

Minimum uniform cover scaling removes the remaining left/right/bottom paper gaps and gives the board more width. A measured roof offset keeps the dome landmark in view. This supersedes the former landscape fit-with-margins policy. Hand size and optional UI remain independent of camera sizing. Controls now form a bottom dock alongside the tray: die then vertically stacked extension actions on the left, passing/table view on the right. Responsive side columns reserve room for these controls while the hand scrolls within a stable tray. The project skill records this layout and the user's built-in-generation constraint.

Geometry/type/lint checks do not establish live overlap or touch acceptance; no browser tools have been requested. In particular, cover scale can exceed the old logical stage height on wide screens and needs device review with the dock.

## Floating navigation and compact mobile dock (16 September 2026)

The Observatory toolbar now floats above the scene as separate backed controls and no longer consumes a layout row. The scene can shift upward32px, bounded by measured roof clearance, with bottom coverage included in scaling. Tablet tray dimensions are capped at430px/106px with54px pieces; phones/short landscapes use360px/86px and44px pieces. Width remains fixed per viewport regardless of hand count.

Short landscape phones use a dedicated56px-top/104px-bottom stage and fit the whole logical board, every placement and caption without scrolling. This deliberately prioritizes playable visibility over edge-to-edge image coverage. Representative568×320,667×375,844×390 and932×430 geometry cases pass. The bottom dock remains independent of extensions/confirmation.

A shared fullscreen button requests document fullscreen from a tap and then requests landscape orientation on coarse-pointer devices when supported. It catches rejection and keeps the game usable. It cannot force browser support or bypass user activation. Portrait fallback is retained. MDN fullscreen/orientation API documentation was consulted; actual phone/iPad/browser operation is not verified.

## Compact header islands (16 September 2026)

The title/progress group no longer flexes across the toolbar, which was creating the apparent white bar. Games and the separate compact Mora/round group sit on the left; fullscreen is beside the menu on the right in solo and online play. Fullscreen remains visible on unsupported browsers and explains failure rather than silently disappearing. Scene offset can lift artwork/targets together by56px with1px roof clearance; source sizing reserves the corresponding bottom margin. Browser rendering remains unverified.

## Desktop caption clearance and right-anchored actions

Fullscreen and Menu now share an explicitly right-anchored toolbar group in solo/online views. Desktop/tablet landscape scene offset uses the actual hand tray's top edge and leaves24px below the entire gameplay crop, with at least96px upward movement. This intentionally prioritizes lower-caption visibility over retaining upper scenery/roof clearance. Short landscape phones retain their fit-without-scroll behavior. Regression checks cover caption clearance and remaining bottom artwork coverage.

## Device-specific framing refinement

Approved desktop behavior at widths1280px and above is retained. Landscape tablets below1280px use a proportional fit within the stage and no desktop upward offset; portrait fits all rows vertically with horizontal-only native exploration. Short landscape phones have a larger40px-top/80px-bottom play stage, a64px dock and38px pieces, increasing board scale relative to the previous56/104 stage. Labels/navigation use compact bounded typography. The logical board remains fully visible; the tighter source may leave scenery margins at ratios where uniform full-screen coverage would hide gameplay. No stretched or repeated scenery is introduced. Browser/device acceptance remains unverified.

## Landscape phone side controls and advanced-view fit

Short landscape phones now reserve side rails for UI: navigation, players and actions left; goals, a fixed two-column creature tray and passing right. The central stage uses nearly the full height, with one uniformly scaled scene covering the tested phone ratios. This supersedes the bottom-dock rule for short landscape phones only. Tray geometry remains independent of hand count. Desktop/tablet advanced view fits the remaining play column and reduces scale in proportion to its lost width; it does not inherit desktop cover zoom or its large upward offset. Geometry checks cover phone source coverage and advanced-view shrinking; live browser/touch acceptance is separate.

## Fresh handmade-paper Observatory (v14)

The original user reference now guides the active regenerated board: layered cardstock foliage, cream paper architecture and muted moss/ochre colours. The Watchpost is a raised timber lookout; the Dry Channel is a continuous pale rocky bed, making them visually distinct. All17 positions are remeasured. The source remains1536×1024 with the approved822×548 crop at372,220, preserving the established camera and device coverage. Runtime and miniature WebPs retain native dimensions at quality94. Earlier candidates are preserved; v14 supersedes v10. See the v14 provenance for generation prompts and corrections. Mobile side-control overlaps remain a separate UI follow-up; this artwork change does not claim to resolve them.

## Protect complete landmarks, not only playable slots

The user identified clipped Observatory roofs and the lookout hut even though placement platforms remained visible. Earlier guidance allowing the dome outside the gameplay crop was incorrect for the approved desktop camera. Future artwork briefs must protect complete main silhouettes inside the common visible source area, including roofs, flags, bases and canopies. Outer scenery may crop; main landmarks may not. On the current1280×720 desktop camera, source above roughlyy263 is clipped; the generation target therefore places full primary forms in the lower central region with extra clearance. Retain the approved source/crop footprint rather than expanding it to accommodate a missed composition. The shared skill is consolidated around measured gameplay, protected-landmark and expendable-scenery regions.

### Integrated protected-landmark v17

Fresh v15 was corrected to v16 for whole-scene placement, then v17 for a smaller inward root hollow. Active1536×1024 source and822×548 crop are unchanged in dimensions. The highest main form now begins at sourcey335, rather than earlier roofs abovey110. All six complete landmark bounds live in `observatory-art.json` and are checked against normal/advanced desktop, tablet and landscape-phone camera transforms, including80px top-control clearance on larger devices. The17 slots and labels are remapped; no camera or UI changes were needed. Source retains native pixels with quality94 WebP exports. These checks establish geometry, not live browser/touch acceptance.

## Balanced v18 composition and measured desktop fit

The v17 safety correction over-reduced the sanctuary. v18 increases landmark bounding height15% and bounding area21%, with its highest point93source pixels higher. Source/crop dimensions remain unchanged; all17 positions and Release are remapped. Normal desktop now clamps preferred scale and vertical offset to the full landmark bounds between80px header clearance and dockTop−24px; it no longer requires the art itself to reserve y335 universally. Source-edge coverage and full-landmark visibility pass together, including3440×1440. Native pad detail remains comparable, not upgraded resolution. Ratios, formulas, fixtures and sampling-density output are recorded in `concepts/2026-09-16/observatory-framing-calibration.md`, with a reusable measurement script linked from the shared skill.

## Closer tablets and desktop browser zoom

The v18 source is retained. Normal landscape camera now uses one source-coverage/landmark-fit calculation above500px height across desktop and tablet widths. It prefers8% closer framing, grows enough to close feasible edge gaps, and caps before landmarks hit the header/dock. Browser zoom no longer triggers a tablet contain-fit that ignores source borders; resize handling includes visualViewport and window events. Geometry fixtures exercise fractional browser-zoom dimensions and iPad Mini/Pro sizes. Shared skill, instructions and calibration measurements document the formulas and limitations. Native image resolution is unchanged.

## Active paired paper Observatory (19 September 2026)

The active boards are now separate landscape and portrait paper worlds with measured17-space maps. See [implementation and validation](concepts/mora-paper-world-v1/implementation.md) and [generation prompts](concepts/mora-paper-world-v1/prompts.md). `lib/games/mora-world.ts` is the current framing contract; it supersedes earlier Observatory cover-zoom/panning recipes above. Source, targets and local foliage/pond animation share one transform. Complete landmarks take precedence when the source cannot cover an extreme aspect ratio; neutral paper remains visible around the source.

The controls use actual fibrous paper texture with distinct folded, stitched, leaf and stamp silhouettes. One shared accessible animated player-status vocabulary spans games. Advanced inspection retains opponent goals/remaining abilities and shows the viewer's seat in passing order without a duplicate self board. The source images and static geometry were reviewed; live browser/touch acceptance is separate.

## Observatory full-bleed table (19 September 2026)

The Observatory scene now covers the whole table: `paperWorldFrame` keeps the gameplay crop inside the stage between the UI bands and otherwise scales the single source to cover the surface, eating the outer woodland. No paper texture or border surrounds the board. Where a screen cannot be covered (phones, ultrawide), the canvas paints a soft darkened copy of the same source and feathers the sharp scene's outer margin into it; the crop is never feathered. Pads carry square/round ink outlines; the die engraves a six-cell habitat map on its four static faces; goals sit on a cream field-notebook card; the creature tray is layered cardstock with a bark edge and an open top for the fanned pieces. Wind shivers the woodland tiles around the still habitats, the pond surface shifts without looping, and pollen drifts; all stop under reduced motion. The tray is centred, the goals card stands above the die and actions, and phones frame the gameplay union box rather than the looser crop. The portrait source still needs regenerating with far more woodland above and below; see [full-bleed notes](concepts/mora-paper-world-v1/full-bleed.md).

## Observatory v2 art and dock refinements (19 September 2026)

Both boards use the v2 paper-world sources with pads roughly twice as large; the framing constrains the gameplay union box and the phone now covers without a soft margin. Player tags have a fixed width with truncated names; a centred Boards control under the tags opens the table inspection (tags only preview on hover); the passing box is gone from the Observatory dock. The inspection has a sticky one-line passing cycle, no titles or goal ledgers, and three boards across with several opponents. The die is a real CSS cube that tumbles and settles on the result. Habitat labels are larger with plainer scoring summaries. See [prompts-v2](concepts/mora-paper-world-v1/prompts-v2.md).

## Observatory interaction pass (19 September 2026, later)

Pads carry no overlays; the only drawn cue is an elliptical cream ring on each habitat that can take the chosen or dragged creature. Migration is a direct board interaction: tap or drag a placed creature to a ringed habitat; the picker is gone. Placement plays a short portal landing (glow ring opens, creature drops through). Player tags are flat, collapse to avatar and score when the row would overflow, and carry the roller mark on their corner. The second line holds a round marker with punched holes and an "Other players" control opening the inspection, whose cards put name, remaining abilities, goals and score on one line above each board, with the passing cycle shown once with the first player repeated at the end. Habitat cards are quieter paper with a cream score pill. Phones show avatar-only tags inside the toolbar, no title, dots-only menu. The `imagegen-brief` skill under `.claude/skills` prints hand-off prompts for ChatGPT image generation; the pending brief lowers the courtyard building to one storey on both boards.

## Sanctuary goals without luck (19 September 2026, later)

The six species-specific goals ("Rust Fox homes" and so on) are replaced by goals about how the sanctuary is built: Full houses (two habitats filled), Square country (six creatures on square spaces), Round country (five on round spaces), Mirror terraces (two species living in both Courtyard and Roof garden), Channel colours (three species in Dry channel) and Big family (four of one species). The other six goals are unchanged. Goal indices stay 0–11, so saved matches keep their goal ids. The goals card is one piece: holding it opens a wide inspection listing every goal with progress; individual goals are no longer separately inspectable. Drag targeting on the board is by overlap: a creature touching a habitat's ring counts as over it.

## Artwork candidates and the review switcher (19 September 2026, later)

v3 candidates (`mora-paper-world-{landscape,portrait}-v3-{a,b}.png`, one-storey observatory) reuse the v2 pad geometry exactly, so they are registered as variants in `lib/games/observatory-variants.json` rather than new metadata. `paperWorldFor(tall, variant)` swaps only the image paths; `scripts/optimize-paper-worlds.mjs` produces crops for every registered variant. A floating review control, `components/game/art-variant-switcher.tsx`, lets the table flip between candidates and remembers the choice in the browser. It is temporary: remove the `<ArtVariantSwitcher/>` lines in solo and match once a variant is chosen, and keep the component for the next round of candidates.

## Nox cabin and Yata night market (19 September 2026)

Nox and Yata now play on full-table environment plates, the way the Observatory does. `lib/games/table-world.ts` holds the measured geometry for each plate (`nox-world-{landscape,portrait}.json`, `yata-world-{landscape,portrait}.json`): the painted table or counter, the seat ring, blank signboards, protected landmarks and animation layers. `frameScene` in `mora-world.ts` is the shared framing rule for every world; `paperWorldFrame` and `tableWorldFrame` only supply their play box. `components/game/world-scene.tsx` paints one plate across the table with a soft copy where it cannot cover, breathing lantern pools and shifting sea behind the cabin windows, and publishes the plate's placement as `--world-x`, `--world-y` and `--world-scale` so CSS can pin controls to painted objects. `scroll-area.tsx` stages any board carrying `data-paper-world` and `data-world`.

Nox is the captain's cabin. The chart table is painted; the DOM table only anchors the crew's seat tags and played cards. Each player's avatar, name, penalty score and turn state sit on the painted stool for that seat (`seats` per player count in the plate metadata), so Nox has no top player row; the spoken turn status and connection warning remain. The hand is a plank shelf whose cards overlap along it and fold into a second overlapping row only when one row would overflow (flex wrap; never a horizontal scroll). Shields, Salvage and Turning Tide are hung iron objects beside the same bone cube die as Mora, its faces cut with the four suits (spades and hearts repeat on the last two); confirm is a brass plate beside the hand on wide screens and above it elsewhere. Since 19 September 2026 (evening) Nox has no Sort, Pass-to or seating-popover controls and no selection count: a selected card rises out of the overlapping fan and comes to the front instead of relying on an outline the next card would hide; the round note sits top centre as an iron version of Mora's paper label; and four brass arrows chased into the table rim show the round's direction (clockwise on odd rounds, the other way on even), changing once per round rather than per trick.

Yata is the toon night market. The collection board stands on the painted red counter as six outlined plates; the hand is a row of tickets on the wooden ledge, two rows of three in portrait. On wide screens the chosen menus, the stall permit and the Market Seasons forecast hang on the painted left signboards and passing on the right ones; narrower screens use the bottom dock. Player tags are outlined pennants under the lantern string.

The plates are the closest of the generated candidates (`production-README.md` in the concepts folder records every attempt); all missed the strict band targets, so the framing metadata absorbs the difference. `tests/table-worlds.test.mjs` checks source and derived sizes, the play box inside the stage across the device set, edge coverage on desktops and stable variant identity. `scripts/optimize-paper-worlds.mjs` now derives WebP plates and overviews for every world; `scripts/measure-table-bounds.mjs` reports a plate's table bounds. The `ArtVariantSwitcher` takes a game and flips Nox between its two landscape cabins; remove it once one is chosen. Browser checks covered desktop and portrait for both games in solo play; online tables share the same components.

## Nox: the Gilt Hold (19 September 2026, night)

The captain's cabin plates are replaced by the **Gilt Hold**: the treasure hold below the waterline, drawn as a straight-down plan so the flat cards lie on a flat surface (see the "Flat pieces on a painted world" section of the game-world-layout skill). The playing surface is the black oilcloth lid of an iron-banded chest with a riveted rim; loot, a skull in a tricorn, a rat and an open grating over black water fill the room around it. Chosen plates: `nox-gilthold-landscape-v2-a.png` and `nox-gilthold-portrait-v2-a.png`, the two that passed the band measurements (`docs/concepts/2026-09-19-nox-cabins/README.md`). The Poison Lantern direction was not selected.

Geometry in `lib/games/nox-world-{landscape,portrait}.json`: `table` is the rim's outer edge, `seatRing` a small margin around it, and the seat anchors sit on the rim band (viewer on the bottom rim, left of centre so the confirm plate stays clear; the others clockwise on the left rim, top corners, top centre and right rim; portrait pulls the side seats one tag inside the rim so phones do not clip them). The direction ring became four arrowed strokes along the inside of the rim. Animation: the lantern pool breathes, the water under the grating shifts, and marked coins glint (`animation.glints`, drawn by `world-scene.tsx`); all still under reduced motion. The variant registry is empty again. Card shadows fall downward to match the lantern above the far edge.

## Yata: the counter from above (19 September 2026, night)

The night-market plates are replaced by **the counter from above**: the same toon night market, now drawn as a straight-down plan so the flat plates and tickets lie on a flat surface (the "Flat pieces on a painted world" rule). The serving counter is a red enamel rounded rectangle with a cream rim; the customers' plank ledge runs along the bottom for the hand, the cook's side with steamer, wok, bottles and the one big lantern sits above, and two blank cream menu boards lie flat on the cobbles beside the counter for the chosen menus, the stall permit and the seasons forecast (left) and passing (right). Light comes from the lantern above the far edge, so every drawn shadow falls straight down. The approved toon style paragraph, the enamel chips, the angular tickets, the outlined pennants and the red arcade confirm are unchanged.

Candidates `yata-counter-{landscape,portrait}-v2-{a,b}.png` all came back in true plan view and passed the side and bottom bands; both portraits carry a deeper cook's band above the counter than briefed (kept, since it is expendable scenery). `lib/games/yata-world-{landscape,portrait}.json` describe the `-a` plates with the counter box set to the intersection of both candidates so the plate grid lines up on either; both candidates are registered in `lib/games/table-world-variants.json` for the floating switcher until one is chosen. The menu-board pins in `table-worlds.css` read the board source coordinates from custom properties; plates carry per-dish rings (no red ring on the red enamel). Portrait tightens the ticket hand and reserves `--world-dock-reserve` for the wrapping dock rows so they no longer climb onto the counter; phone plates drop the dish names. Measurements and prompts: [yata counter concepts](concepts/2026-09-19-yata-counter/README.md). The superseded night-market plates moved to the art archive.

## Night library and open-box setup (19 September 2026)

The user chose Direction D from the library concepts (`concepts/2026-09-19-library-directions`, queue 04 landscape and queue 13 portrait; the images live in the art archive). `components/game/library.tsx` is now a magazine front page: a slim icon rail, a search-and-filter bar, a "Tonight" hero with stat chips, six friend avatars and the only Play button, a live column (open tables, weekly leaders) and four horizontal shelves. Boxes no longer carry Play or Resume; each shows player count and play time and opens the setup modal. Phones stack the hero and live column and show shelves as two-column tiles under section dividers.

`components/game/game-box.tsx` draws every box from three CSS faces at one shared angle with a deep visible side; sizes travel as `--gw/--gh/--gd` so stylesheets can resize per breakpoint. The three real covers are crops of the live board plates (`public/art/box-*-v3.png`: the Nox cabin, the Mora observatory, the Yata canal market). Twenty-two placeholder games in `lib/games/library-fixtures.ts` fill the shelves with material, palette and motif only; friends, open tables and the leaderboard there are fixtures too, and no navigation item beyond Play with friends and Settings leads anywhere yet.

Setup follows the Direction M open-box concept in `components/game/setup-box.tsx`: the lid carries the cover, title and stat chips; the kraft tray holds a Learn leaflet, seat tokens for players, three pawns for bot difficulty, folded boards for content sets (Nox shows its Fast mode deck instead), printed extension tiles with emblem, check and info mark, and one cream Play plate. A saved match appears as a continue strip at the top of the tray, which replaces the library's Resume button.

### Shared table navigation

Across every game, align the top player badges with the floating navigation controls. Put Others directly below Menu, retaining the public-information inspection and focus return. Do not add separate Table or pass-to-player controls. Artwork candidate switches belong to development review, never the accepted playing scene. Keep these placements consistent through landscape, portrait and narrow layouts.

### September 20: requested rule and library refinements

The library opens with the six implemented IDs on one shelf and concept games below. Developed games have dedicated illustrated fronts and spines, varied compact proportions and a complete bottom face. Setup keeps its cover and tag strip, uses a quiet plain insert and places equally prominent Play and Continue actions together.

Nox uses a centered table-plane arrow, larger seat labels and played cards, and a centered near-side seat at two or three players. Fast exchanges 3 cards at 2–3 players and 2 at 4–6. Normal exchanges about a quarter of the dealt hand, bounded to 2–4 cards: 3/4/3/3/2 at 2/3/4/5/6 players. Fast’s marked 4 costs 10 penalty points; normal’s marked 8 remains 40. New duels retain five ranks per suit in normal mode and three in fast mode, including the penalty rank. Already-started exchanges and older full decks finish with their saved configuration.

Glasshouse now scores 2 per creature plus 4 for a full matching pair and a different guest, maximum 10. New matches receive one Roam. Floodline uses landscape A with its own measured geometry; both orientations have a two-slot cave. Mangrove rewards matching pairs (9; different 0; single 1), the cave rewards different pairs (7; matching 2; single 1), and Lighthouse scores 5 only for a species sheltered nowhere else. Matching goals and explanations follow these rules, superseding earlier tuning notes above.

Undo has a permanent themed position beside the hand. It clears preparation, including migration, and can withdraw an unrevealed simultaneous choice while another player is still choosing. It never rewinds information already revealed to another player.

## Roka, Talo and Soma

Roka replaces Orin as a freely communicating cooperative volcanic-island rescue. Talo replaces Vela as a four-player team expedition through a shifting sandstone temple. Soma replaces Miro as a storm-stranded airship repair game with one hidden saboteur. Internal IDs remain `orin`, `vela`, and `miro`; the new rules use save marker `rules: 2`. These games launch without extensions.

All games use isolated interactive practice: players can experiment, advance the clock manually, and begin a freshly seeded real match afterward. Roka, Talo and Soma have separate illustrated environments, material cues and original ambient soundscapes. Their source art, rules, privacy boundaries and validation are recorded in `docs/concepts/2026-09-20-roka-talo-soma/IMPLEMENTATION.md`.

## September 20: party-game replacements (supersedes Roka, Talo and Soma)

The three adventure additions are retired. Their stable IDs now host **Top Tier**, **Outfox the Fox**, and **Hot Streak**, with save marker `rules: 3`. Their predecessor implementations are removed from live code.

Top Tier and Outfox use a 116-topic original catalog, three choices per player, no written answers, concurrent private ranking, alternating Sun/Moon teams and team-private guesses. Top Tier puts exactly one item in each S/A/B/C/D tier. Outfox adds a sixth-answer decoy and confidence scoring. Every player is guessed once per round, across two rounds. These are personal-preference adaptations; do not present Outfox lists as measured surveys or factual rankings.

Top Tier is tactile cream/plum stationery and coloured tier strips. Outfox is moss-green cloth, cream cards and rust-red fox illustration. Hot Streak is a bright night stadium with original racing mascots, ticket drafting, secret deck manipulation, a timed automatic race, collisions and payout over three races. Preserve reduced motion and mute. New original covers and sprites have exact prompt/provenance records in `docs/concepts/2026-09-20-party-replacements/`.

### Party rules refinement (20 September 2026; supersedes the party rules above)

All three party games support individual play at 2–6 players, including 3 and 5.
Team mode always means **exactly two equal teams**, available at 4 and 6 players
(2 vs 2 or 3 vs 3). The user's final clarification supersedes the brief mention
of pairs. Setup and online lobbies expose the same mode choice; changing to an
odd player count selects individual play. Internal IDs remain unchanged; the
new rules marker is `rules: 5`, rejecting incompatible prior party-game saves.

Top Tier keeps simultaneous private preparation. Each player's list gets a turn
in the spotlight. Only the opposing team guesses in team mode; in individual
mode everyone except the owner guesses separately. Score one per exact tier
plus two for a perfect five. Two rounds; highest score wins, ties share victory.


**Atlas** replaces Hot Streak completely in live code, using stable ID `miro`.
It is a shared geography route challenge with a navy survey-chart identity,
cream route cards, amber paths and a native SVG cover. Every player/team gets
identical cities and instructions in every round. Six rounds cycle through
west-to-east, north-to-south, and nearest-to-farthest from one shared capital.
Answers stay private until everyone locks; there is no speed bonus. Score one
per correct position plus two for a perfect five. Near-ties are excluded.
The globe reveals city locations and the ordered route, with an optional spin
and zoom interaction, keyboard controls, reduced-motion support and a flat-map
fallback when WebGL is unavailable. City coordinates come from the World Bank;
map geometry comes from Natural Earth. The cover is code-native cartography,
not generated bitmap artwork. Attribution lives in `public/maps/README.md`.

Setup keeps one Learn control at the top and only Play/Continue in its footer.
All list games use drag handles with pointer capture and keyboard arrow support.
Correct/wrong reveal rows animate with reduced-motion overrides. Sound respects
mute. Teammates share drafts; only the rotating captain locks. Every player
acknowledges each reveal, including in practice and online play.

Verification: `docs/verification/2026-09-20-party-refinements.md`.

## Library cover contract (21 September 2026)

All shelf boxes share Mora's square face proportions and the same depth ratio
(24% of face width). Size the whole box to its shelf cell, allowing only the
small clearance needed by the projected spine and hover movement. Do not size
boxes by game identity, title length, or cover aspect ratio.

Covers are dedicated thematic illustrations in the game's own visual language:
show its world, materials and meaningful motifs, never a screenshot or replica
of the gameplay interface. Compose new covers as full-bleed squares without
external mats, gray padding, baked-in box mockups, UI or duplicate titles.
Generate the exact current game title inside the image itself, with expressive
typography and placement designed as part of the composition. Never layer a
visible DOM/CSS title over a finished cover. Keep the title safely inside the
face and readable at shelf-thumbnail size; retain accessible names on controls
and screen-reader dialog headings. Show the complete square in setup too. Fill the face with artwork rather than
using contain/letterboxing; recompose art when cropping would lose its subject.
Existing approved art directions remain distinct across games.


### Fresh cover generation and party names (21 September 2026)

This contract supersedes the historical DOM-title and cover-proportion notes
above. Cover regeneration is blind by default: use written game identity,
mechanics and art-direction briefs only; do not inspect or supply previous cover
images as references. Review newly generated results for title accuracy,
thumbnail readability, complete square composition and thematic identity before
integration. Preserve versioned source files, exact prompts and provenance.

Current party names are **My Top Five** (internal `orin`, formerly Top Tier),
**Find the Lie** (internal `vela`, formerly Outfox the Fox), and **Atlas**
(internal `miro`). These games use straightforward descriptive names. My Top
Five ranks five personal favourites for others to guess; Find the Lie mixes
five factual answers with one invented decoy. Stable IDs, save formats and
rules remain unchanged by this naming update. Public names on covers, setup,
help, solo games and online tables must agree.

### Atlas two-round format (21 September 2026)

Atlas now uses two rounds: medium then hard. Both run Places → Photos → Three
facts, with one shared destination per category and six distinct destinations
in total. Everybody independently prepares all three private pins at the start of each
round, in any order, then locks all three together. Once everyone has locked,
each team gets its 20-second turn to select a frozen teammate pin for Places,
then Photos, then Three facts. All three pins stay frozen throughout the round. Starting teams alternate each category,
so both teams start each category exactly once. Captains rotate per category.
Each reveal waits for everybody to continue. Individual play skips discussion.
Closest-pin and 100 km bonus scoring are unchanged. Rules marker 8 rejects
incompatible earlier Atlas saves. The map is a borderless satellite 3D globe
with gesture controls and only a World reset button.


### September 21: custom and uneven teams, lobby presence

This supersedes the equal-team restrictions above. My Top Five and Atlas accept 2–6 players in two non-empty, customizable teams; an odd
player count keeps every player (five defaults to three versus two). Setup
shows each player’s team, including bots. The host controls multiplayer teams;
guests see the assignments live. Moving the last player out of a team swaps
them with the first player on the other team so both teams remain playable.
Assignments persist through practice, match start and saves. Removing a lobby
member preserves the remaining players’ assignments.

Disconnected guests are named inside shared setup with a host Remove button.
Play and Learn remain disabled until they reconnect or are removed; the server
also checks presence when starting, covering a disconnect after the last update.
Empty seats continue to be filled by bots.

Mora hand artwork is anchored directly to its circle, with a 1.06 image scale
and a small visible margin. This avoids nested button percentage-height sizing
while retaining the current circles, tray, board artwork and camera.

### September 21: shared opponents and silent teammates

My Top Five now uses rules marker 6. During each author's list, the opposing
team edits one shared ranking and its captain locks it. Each of the author's
teammates guesses independently and silently, and the author also stays silent.
Average those eligible teammates' raw guessing points for their team's gain on
that list; compare that with the opposing team's shared score. The author is
excluded from the average. A singleton author's team earns zero on its own list.
Individual mode remains private guesses by everyone except the author. Old
My Top Five saves need a fresh match because the guess structure has changed.

The author sees their locked order during guessing. All guesses appear inline
on reveal, with an internally scrolling comparison area. Shared ranking changes
are sent as ordered draft moves during dragging, visible only to that guess's
teammates; silent guesses remain private. Player badges show pending/completed
actions in My Top Five and Atlas. Team names are Team A and Team B, and setup uses two compact columns with player transfer buttons.

Find the Lie is removed from the library, online catalog, engines, data and assets.
Yata no longer shows Sort in solo or online play. Board navigation asks before
leaving, including same-document browser/device Back; reload and document exits
use the browser's native beforeunload warning where the browser supports it.
Browser and touch acceptance are separate from automated checks.

## Removal and multiplayer ambience (21 September 2026)

The remaining playable games are Nox, Mora, Yata, My Top Five and Atlas.
The separate lighthouse, kite-racing and canal games (storage IDs `coast`,
`meadow`, `canal`) and Find the Lie/Outfox (`vela`) are removed, including
their engines, UI, dedicated artwork, data and game-specific tooling.
My Top Five keeps `orin` and Atlas keeps `miro`, preserving their saves.
Legacy tables with an unsupported game reopen as Nox lobbies, preserving
the table and its members without loading retired rules.

Multiplayer background ambience defaults off, including tables saved before
this setting existed. The table host controls a persisted `ambienceEnabled`
setting from Table settings; changes reach every player via the existing
SSE stream. Hosts can change it during a match without resetting play.
Device mute and volume still apply; the host cannot force a muted device
to play audio. Solo ambience preferences are unchanged.

Docker includes only the explicit production asset allowlist maintained by
`node scripts/production-assets.mjs --write`. The Docker build checks this
list before compiling. Source art, unused candidates, old covers, unused
audio and development data are excluded from the build context.

## Atlas complete team turns (21 September 2026)

This supersedes the category-by-category discussions above. Each team now
chooses all three frozen pins during one 60-second turn, using the same
captain throughout the round. The captain may select different teammates for
each destination, switch tabs without losing choices, and confirm only when
all three have a choice. The other team then chooses its complete set. Missing
choices at timeout use the captain's frozen pins. The first team is random
in round one and the other team starts round two; full captain rotation is
not required. After both teams lock, reveal the three categories in sequence.
Rules marker 9 rejects the earlier one-choice team state; affected Atlas
tables return to the lobby, preserving their participants. My Top Five is
unchanged. Browser, touch and audible playback acceptance remain separate.
