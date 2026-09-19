# Observatory full-bleed table — 19 September 2026

User feedback on the first paper-world integration: no paper texture or border
around the board; the woodland must fill the whole screen, eating the outer
forest as needed; the tray, actions and goals must be unique handmade objects;
the die must show squares and circles, not "stone" or "timber" scenes; goals
must be readable; the scene must visibly move; the phone tray was broken.

## Framing contract

`paperWorldFrame(art, surface, stage)` in `lib/games/mora-world.ts` places one
uniformly scaled source on the whole table surface (`.table-layout`):

1. Hard: the gameplay crop stays inside the stage (the `.board-viewport` box
   between the toolbar/player band and the hand dock).
2. Preferred: the scene covers the surface, so the scale is the cover scale
   whenever the crop still fits the stage.
3. Then: complete landmarks stay on screen; the crop is centred in the stage.

`components/game/scroll-area.tsx` measures the surface and stage, and places the
board at the crop. `ObservatoryScene` draws the source through
`paperWorldTarget` exactly as before.

Where the source cannot reach the surface edges (phones, ultrawide, short
laptops), the canvas first paints a soft darkened copy of the same source, and
the sharp scene's outer margin (never the crop) is feathered into it. No paper
table, no second illustration, no stretching. The `.table-layout` background is
a deep forest tone that only shows before the image loads.

Desktop stage reserve shrank from `18vh` to `12vh` at the top; the scene now
provides its own headroom. Measured coverage (`scripts/measure-observatory-framing.mjs`):
1280×720, 1440×900, 1512×982, 1133×744 cover; 1912×952 misses by 1% (soft copy
shows a few pixels at the sides); phones and tablets show the soft copy above and
below.

## Objects

- Placement pads: thin ink outlines over the painted pads, square for
  Courtyard/Roof garden/Root hollows, round for the others; highlighted when the
  die allows them and when a selected creature may go there.
- Die: chalky stone cube. The four static faces engrave a six-cell map of the
  habitats (squares upper-left group, circles for lookout/trail/channel); lit
  cells are the allowed pads. Empty and New species keep their own glyphs.
  Captions are the engine's `dice[].name`.
- Sanctuary goals: cream field-notebook card, dark ink, readable over the forest.
- Creature tray: layered cardstock with a bark edge (stacked box-shadows), open
  top so the fanned pieces rise out of it. `--fan-lift` scales the arc per
  breakpoint (16px desktop, 12px laptops, 9px portrait, 0 on short landscapes).
  The portrait frame is 88px tall so no piece leaves the tray.

## Animation

Crown sway is now visible (±0.02 rad plus a slow lift), pond ripples gained a
travelling glint, three slow cloud shadows cross the whole woodland in multiply
blend, and 26 pollen motes drift upward. All of it stops under reduced motion,
off screen and in hidden tabs; the cadence stays 25 fps and DPR ≤ 2.

## Phone artwork still needs regenerating

The portrait source has only 130 px of forest above the crop and 176 px below
(8% and 11% of its height). A phone needs roughly 208 px of UI above the stage
and 186 px below at a crop scale of about 0.37, so the sharp scene ends well
inside the screen and the soft copy fills the rest. To make the sharp art cover
a phone by itself, regenerate the portrait composition with the same sanctuary
occupying only the central ~55% of the height: about 400 px of continuous
expendable woodland above and 440 px below at 1024×1536, and 60 px on each
side. Keep all seventeen pads, the pond on the left margin, and the release
clearing. After generating, remeasure `observatory-portrait-art.json` (crop,
pads, labels, release, protected landmarks, foliage and water polygons) and rerun
`tests/observatory-layout.test.mjs`.

Verified in the built-in browser at 1440×900 and 375×812: scene covers the
desktop; phone shows soft-copy margins with no rectangle; goals card readable;
tray contains the fanned pieces; canvas pixels change over time. Real-device
touch, GPU and reduced-motion appearance were not checked.

## Second pass (same day)

Cloud shadows removed. Wind now moves the woodland itself: the source is redrawn
as 48 px tiles nudged by three overlapping gust waves, clipped away from
habitats, landmarks, Release and the pond, so foliage shivers while everything
gameplay-related stays still. The pond surface shifts in 3 px bands with
incommensurate periods instead of travelling ripple lines; nothing loops.

Dock: the tray is centred (landscape: `left:50%` plus a width that leaves room
for the actions on the left and passing on the right); the goals card stands
directly above the die and extension actions, bottom-left on desktop and above
the action row on phones. The die is a small paper cube with a lit top and a
shaded side; the tray is a shallow wooden box (grain rim via border-box
gradient) lined with cream paper.

Framing now constrains the gameplay union box (`paperWorldPlayBox`: pads,
labels, standees, Release) rather than the crop, which zooms phones in by about
17% and enlarges labels (portrait heading `clamp(11px, 3.6cqw, 15px)`). Portrait
stage: top 110 px, bottom 272 px.

## Prompt for a phone source that covers by itself

See the prompt in the chat hand-off and below. Target: 1024×1536, sanctuary
(all six habitats, pads, label ground and Release) inside x 150–875, y 230–1030,
continuous expendable woodland everywhere else, no framing or rim.
