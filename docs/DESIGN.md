# Tabletop design

## Artwork

Use the preserved Yatai cover as the visual style reference: rounded shapes, expressive silhouettes, rich color and broad painterly shading. Keep enough detail to feel warm and crafted, without realistic surface noise or an overly flat cartoon finish. Generate new artwork from text descriptions only; never feed an already generated image back into generation. Record provenance and prompts in the versioned artwork notes.

Serve optimized WebP assets at practical display sizes. Decode the game artwork behind a loading screen before revealing the table. Keep original PNG masters for future exports. Food uses independent transparent images so neighboring sprite cells cannot leak into the card edges.

Game boards must feel like exciting illustrated places with personality. Never substitute a dashboard, a uniform grid of panels, word-heavy cards, or CSS-only scenery for a requested illustrated environment. Use dimensional terrain, rich color, and distinctive landmarks coherent with the game's creatures. Vary habitat shapes, sizes, elevation, and capacities according to their effects, including single-creature habitats. Integrate each capacity space into the scenery and align live pieces to those exact spaces. Give future maps and creature sets their own coherent visual world. Keep explanations available through hold or keyboard inspection; short in-world labels must not cover the environment.

Mora's beginner map is a fresh woodland sanctuary illustration, without central water. Its six habitats use 4, 4, 2, 3, 3, and 1 creature spaces. The discard basket belongs inside the illustrated top-right rim. Beginner scoring involves only your own board, not neighbours. Generate fresh art from text, not repeated edits of degraded images. Shared map geometry positions artwork targets, creature slots, and labels consistently in solo play, online play, and opponent previews.

Yatai uses a warm wooden table and varied cream, green and blue serving dishes, with large illustrated food arranged in loose stacks.

## Choices and controls

Players exchange Tide cards simultaneously. Grove and Yatai drafting choices are also simultaneous: lock each choice privately, then reveal and resolve the complete batch together. Tide tricks and die rolls follow their required turn order. Bots may decide while humans deliberate.

Card actions play immediately by default. Tide passes always require explicit confirmation, even when Confirm moves is off. Show the prepared action, Confirm and Clear above the hand; keep the passing recipient and table diagram button in the hand control row below. The Confirm moves checkbox is always available and remembers the preference separately for each game in the signed-in account, or in this browser for guests.

Clicking a die rolls immediately. Auto-roll dice is a separate optional setting, off by default and saved per game in this browser. It only rolls when that player is allowed to roll. Place it next to Confirm moves. A gentle glow highlights the die when the player can roll.

Use a slow, small opening on mouse hover and keep the full opening when a card is selected. Touch hover must never keep a deselected card raised. Dragging shows an insertion marker and moves neighbors. Hold or press I to inspect; do not add eye buttons. Respect reduced motion.

Horizontal areas accept a vertical mouse wheel when the document and nested content have no vertical scrolling to perform. Keep overflow indicators beside the scrollbar.

## Tablet proportions

Grove and Yatai scale their entire 3:2 board, pieces and hit targets together. Desktop boards fit both dimensions of the available frame. Tide has a plain background that fills the frame freely; scale its trick content down to fit without scrolling. Grove's artwork and interactive regions retain matching proportions.

On touch devices, Grove and Yatai keep their hands underneath the board. Both use the available height instead of shrinking to fit the width; excess width scrolls horizontally using native scrolling only. Portrait keeps the readable 340–456px minimum board frame height. Landscape removes that minimum and fits the board, controls and hand into the screen, without forcing horizontal overflow or vertical page scrolling. Keep board proportions intact. Detect any coarse pointer so an attached iPad trackpad does not disable touch sizing.

## Extensions

By default, an extension introduces **two distinct, substantial gameplay components** that complement the base game. Preserve its recognizable decisions, rhythm, and way of playing. The new components should create exciting choices and interact with the existing game; they may add significant strategic layers and complexity even when the base game is simple. Change this two-component default only when the user explicitly requests otherwise. Keep extensions optional, explain both components before play, and make their choices and scoring visible in play.

Extension setup tiles use a small, friendly eye badge in a rounded box, absolutely positioned over the top-left corner, with a comfortably clickable target. Do not add extension badges, eye buttons, or separate rules buttons to the game interface. Keep full rules in the existing rules view and make every ability inspectable by holding it or pressing I when focused, including spent and unavailable abilities.

Represent each gameplay component with a distinctive, graphical button or choice of illustrated buttons. Prefer recognizable pieces, dish artwork, icons, small counters, and visible selection marks over sentences and dropdowns. Give controls accessible names and explanations. Selected, available, locked, and spent states must remain distinguishable; do not rely on color alone. Reserve space for counters and state marks so buttons never grow, shrink, or move when their state changes. Use the same controls in solo and online play. Reuse existing artwork or vector icons where suitable.

Keep all extension abilities at the left of the same hand toolbar as passing, table, sorting, and selection controls. Give adjacent abilities the same height and compatible visual weight. Do not show a redundant “Your hand” label or hand-count indicator. Ability graphics should explain their action (for example, Tack shows changing suits), rather than merely decorate the theme. Hold/I inspection should provide the complete rule, restrictions, costs, refresh timing, and a useful example.

Keep extension state on its controls and affected board pieces. Ability controls remain present when locked or spent. After a menu locks, collapse its alternatives but retain the chosen illustrated menu with progress and reward. Mark permits directly on the affected dishes, with bonus progress. Do not insert explanatory summary text or extra rows into the player's board. Neighbour previews show chosen menus above the board and the same piece markers as the player's board. Preserve the base board geometry and keep food, labels, and scores inside their plates.

### Yatai — Lantern Festival

Yatai retains its six dish formulas, twelve picks over two rounds, simultaneous private drafting, and alternating passing direction. Lantern Festival adds customer orders and specialty stalls; neither consumes or replaces food cards. See [the expansion rules](yatai-lantern-festival.md).

New Lantern Festival matches draw six distinct menus from the predefined 26-menu catalogue, offering three per round. Store these offers in the match so all seats and resumed saves share them; older saves keep their original offers.

Mora placement highlights use only a fine rounded border, never a translucent fill over the illustration or empty nests. Keep terrain light and softly detailed while labels and playing pieces stay sharp. Optional ambient motion must stay subtle, ignore pointer input, avoid scoring spaces, remain distinct from player pieces, and stop under reduced-motion preferences. Each habitat rule should depend on the species placed there; avoid generic occupancy switches.

## Extension tiles and explanations

Use the shared extension picker for every extension: a custom vector emblem, title, selected indicator, and neutral letter-i information control. Do not add subtitles or layout-test extensions. Tide's Shield/Tack extension is named Change of Tack; its saved-game mechanics and configuration remain compatible.

Use `RuleExplanation` for extension and ability inspections: lead with a highlighted outcome, follow with short paragraphs led by bold action labels, and place limits or cancellation details in a secondary note. Keep examples concrete. Explain only the inspected element: customer orders show order rules, and stall actions show stall rules. Reuse `CustomerOrderRules` and `AbilityRules` between setup and table help instead of copying long descriptions.

Keep ability controls icon-only, with enough intrinsic width for their symbols and a reduced-motion alternative. Customer-order tickets and circular stall actions have distinct shapes and spacing. Mark each fulfilled dish in green; after its round, retain a compact result at the left showing a check or cross and points, without a fraction counter.
