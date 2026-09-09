# Tabletop design

## Artwork

Use the preserved Yatai cover as the visual style reference: rounded shapes, expressive silhouettes, rich color and broad painterly shading. Keep enough detail to feel warm and crafted, without realistic surface noise or an overly flat cartoon finish. Generate new artwork from text descriptions only; never feed an already generated image back into generation. Record provenance and prompts in the versioned artwork notes.

Serve optimized WebP assets at practical display sizes. Decode the game artwork behind a loading screen before revealing the table. Keep original PNG masters for future exports. Food uses independent transparent images so neighboring sprite cells cannot leak into the card edges.

Grove's river crosses the middle of the illustrated board. Interactive regions follow the six clearings and river, and printed rules remain in the artwork. Keep those same rules accessible through hold or keyboard inspection. Only live counts and scores need small UI badges; do not cover illustrated headings with duplicate plaques.

Yatai uses a warm wooden table and varied cream, green and blue serving dishes, with large illustrated food arranged in loose stacks.

## Choices and controls

Players exchange Tide cards simultaneously. Grove and Yatai drafting choices are also simultaneous: lock each choice privately, then reveal and resolve the complete batch together. Tide tricks and die rolls follow their required turn order. Bots may decide while humans deliberate.

Card actions require confirmation by default. Tide passes always require explicit confirmation, even when Confirm moves is off. Show the prepared action, Confirm and Clear above the hand; keep the passing recipient and table diagram button in the hand control row below. The Confirm moves checkbox is always available and remembers the preference separately for each game in this browser.

Clicking a die rolls immediately. Auto-roll dice is a separate optional setting, off by default and saved per game in this browser. It only rolls when that player is allowed to roll. Place it next to Confirm moves. A gentle glow highlights the die when the player can roll.

Use a slow, small opening on mouse hover and keep the full opening when a card is selected. Touch hover must never keep a deselected card raised. Dragging shows an insertion marker and moves neighbors. Hold or press I to inspect; do not add eye buttons. Respect reduced motion.

Horizontal areas accept a vertical mouse wheel when the document and nested content have no vertical scrolling to perform. Keep overflow indicators beside the scrollbar.

## Tablet proportions

Grove and Yatai scale their entire 3:2 board, pieces and hit targets together. Desktop boards fit both dimensions of the available frame. Tide has a plain background that fills the frame freely; scale its trick content down to fit without scrolling. Grove's artwork and interactive regions retain matching proportions.

On touch devices, Grove and Yatai keep their hands underneath the board. Both use the available height instead of shrinking to fit the width; excess width scrolls horizontally using native scrolling only. Portrait keeps the readable 340–456px minimum board frame height. Landscape removes that minimum and fits the board, controls and hand into the screen, without forcing horizontal overflow or vertical page scrolling. Keep board proportions intact. Detect any coarse pointer so an attached iPad trackpad does not disable touch sizing.
