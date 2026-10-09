# Lucky factory rework (8 October 2026)

William: the machines all look alike and are hard to tell apart; moving
around, putting things down, removing, editing and turning all feel
unintuitive. Rework the factory freely (machines included), keep it 3D,
migrate existing factories, and make it as easy to work with as possible:
selecting several things, copying several things.

What was wrong, seen in the dev workshop on 8 October:

- Every machine stood on the same gold plinth, in the same gold, red and
  green enamel, on a green floor. At the overview zoom they read as a row of
  small gold squares; the stamper, gilder, bot and cashier were hard to tell
  apart even at 3×.
- Direction was invisible until you selected a machine: no visible intake
  or outlet.
- Editing had hidden rules: right-click turned, a tap on a machine while
  holding another switched tools, only belts could be drawn, a group turned
  each machine in place instead of as a whole, nothing could be copied, and
  nothing could be undone.
- Two machines did almost the same thing on different tickets (stamper on
  blank tickets only, gilder on scratched ones only) and silently did
  nothing on the wrong ticket; two boosters (lamp for bots, ink well for
  printers) needed exact side contact.

## Machines

Ten machines, each with its own colour, silhouette and height. Families
(group the palette, tint the floor pad) and per-machine body colours:

| Key | Machine     | Family | Colour                            | What it does |
|-----|-------------|--------|-----------------------------------|--------------|
| 1   | Printer     | Make   | cobalt `#2f6fe0`, white paper     | Prints blank tickets of its book. |
| 2   | Belt        | Move   | charcoal `#2b2f36`, yellow `#ffc940` chevrons | Carries tickets the way it points. Drag to draw. |
| 3   | Scratch bot | Work   | orange `#ff8a2a`                  | Scratches one blank ticket at a time. |
| 4   | Cashier     | Sell   | emerald `#1fa36a`, gold coin sign | Sells scratched tickets from any side. |
| 5   | Splitter    | Move   | charcoal + yellow arrows          | Deals tickets to its front, left and right in turn. |
| 6   | Lamp        | Boost  | violet `#7b5cff`, warm light      | Printers and bots in its light work 40% faster. |
| 7   | Stamper     | Work   | red `#e0413a`                     | Stamps each ticket once: it sells for ×1.3. |
| 8   | Gilder      | Work   | gold `#f2b632` and white          | Gilds each ticket once: it sells for ×1.6. |
| 9   | Charm       | Boost  | lilac `#b07cf0`, green clover     | Printers in its glow print 5% more star tickets. |
| 0   | Bundler     | Work   | magenta ribbon `#e0559b`, kraft   | Ties 3 scratched tickets into one worth ×1.5. |

Changes from before:

- **Ink well is gone; the lamp boosts printers and bots.** One speed
  booster, one luck booster (charm).
- **Boosters reach the 8 cells around them** (a 3×3 square), not only the
  four sides, and the reach is drawn on the floor as a pool of light.
- **Stamper and gilder work on any ticket**, once each (a bundle counts as
  a new ticket). Gilder ×1.6 (was ×1.25 on scratched only).
- Unlocks keep their eras: starter 1K (printer, belt, bot, cashier),
  splitter 1.5K, lamp 8K, stamper 60K, gilder 1B, charm 300B, bundler 300T.
- Intake and output stay lenient: machines take tickets from any side but
  their front, belts from their back and sides, cashiers from all sides.

## Seeing the flow

- Every machine shows its intake (dark mouth at the back) and its outlet
  (chute with an orange lip at the front) in the model, always.
- Belts carry high-contrast chevrons readable at the overview.
- Selecting or holding a machine adds green in-arrows and an orange
  out-arrow on the floor, and boosters light their reach.
- Each working machine keeps one status lamp on top: green working, amber
  full, red stuck, dark idle.

## Editing: like a drawing app

One finger (or the left button) acts; two fingers, the right or middle
button, the wheel and the arrow keys move the camera.

**Select (V, default)**

- Tap a machine: select it. Shift/⌘/Ctrl-click adds or removes (mouse).
- Drag a machine: move it, or the whole selection if it is selected.
- Drag empty floor: box-select (Shift adds). Tap empty floor: clear.
- A single selected machine that sends tickets shows an orange handle on
  its output cell: drag it to pull a belt out of the machine.
- Arrow keys nudge the selection one cell (they pan when nothing is
  selected).

**Build (pick a machine; 1–0)**

- A ghost follows the pointer, showing ports, reach (boosters), and red
  when blocked or unaffordable. Tap/click places one; the machine stays in
  hand to place more.
- Machines face the flow on their own: a ghost next to something that
  feeds its cell faces away from it, otherwise toward a neighbour that
  takes from it, otherwise the last direction. R (or Rotate) turns it and
  that choice sticks until the tool changes.
- Belts: drag to draw a path; each belt points along the path. Drawing over
  existing belts re-routes them.
- Q picks the machine under the pointer (kind and direction).
- Esc or a right-click puts the machine back.

**Erase (E)**: tap or drag over machines to remove them (full refund).

**Selection bar** (below the floor): what is selected, its state in one
word, the printer's book (for every selected printer at once), and labelled
actions: Rotate, Copy, Delete (+refund). Groups rotate as a whole around
their centre.

**Copy and paste**: Copy (⌘C) then Paste (⌘V), Duplicate (⌘D), Cut (⌘X).
The copy follows the pointer as a ghost (R turns it), a click places it
and pays for it, and more copies can be stamped until Esc. On touch the
copy appears beside the original; drag it and press Place.

**Undo and redo** (⌘Z, ⇧⌘Z / ⌘Y, buttons in the tool rail): building,
removing, moving, turning, pasting and book changes. Removing refunds the
price of the last machine of its kind, so undoing a build or a removal
costs nothing.

## Server actions

- `factory-blueprint { id }`
- `factory-edit { remove?: Cell[]; arrange?: {x, y, to, dir}[]; build?:
  {kind, x, y, dir, book?}[] }`: atomic; removes first (refunds), then
  moves/turns the arranged machines all at once (they keep what they hold),
  then builds (pays). Everything is validated before anything changes.
- `factory-book { cells, book }`: every printer among the cells.

The old `factory-build`, `factory-remove`, `factory-rotate`, `factory-move`
and `factory-shift` are retired.

## Migration

Factory version 2. Ink wells become lamps in place; the ink blueprint
becomes the lamp blueprint (refunded at 20K when the lamp was already
owned). Tickets in machines keep their marks. Unknown machines are dropped.
