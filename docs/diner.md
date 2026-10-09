# Diner

Diner (`diner`) is a real-time solo and co-op game in the spirit of Diner
Dash and Overcooked, played with a joystick and buttons on a **sideways
phone** and the keyboard on computers. It shares its twist with the party
game Impostor: everyone in a party of guests is dressed alike, and the
mimic among them gets one detail wrong.

The box offers two ways to play alone: the **Campaign** (a roguelite night
on the road, driven on a little 3D map) and the **Levels** (forty short
shifts, each opened by finishing the one before). At a table, up to four
people play a level together online. The diner is **a cab-over truck towing
a chrome kitchen trailer**: at every stop it opens its long side as a
serving hatch onto a wooden patio, and the place around the patio changes.

## Levels (free play)

Forty levels in eight chapters of five, one place each (Truck stop,
Drive-in, Old Town, Fairground, Harbour, Moon Mile, then Back roads and
Midnight, which visit every place again). The fifth level of each chapter is
a boss. `lib/games/diner/levels.ts` builds every level from a short draft
(name, booths, dishes, trouble, kit) and one difficulty curve.

- **Opening.** Level 1 is open. A level is **finished** with a medal (at
  least the bronze coins) and a life left, and that opens the next. Medals
  and best takings per level stay on the device (`gamehub.diner.levels.v1`,
  `diner-store.ts`).
- **What changes.** Each level brings something: a dish (shakes at 2, fries
  at 6, pie at 16), a trouble (rushes at 5, mimics at 11, big spenders at 15,
  impatient kids at 17, spills at 21, brownouts at 26, jams at 27), a booth
  (two to six), or a piece of the campaign Workshop's **kit** handed out for
  good: Chrome tray (level 6), Roller skates (11), Coffee urn (16), Heat-lamp
  pass (21), Twin grill (26), Jukebox (31). Lives drop from five to four
  (chapter 5) and three (chapter 8). Shifts last 90 s to 140 s, bosses 20 s
  more.
- **The opening card** lists what is **new** tonight (a picture, a name and
  one line each), the trouble already met that is on again, the **kit** you
  carry, and the three medal targets.
- **Difficulty** rises by guest flow (arrivals × party size, about 1.9× from
  the first level to the last), patience, booths, stacked trouble and fewer
  lives. Each trouble slows arrivals a little, so a level is hard because of
  its trouble, not because trouble piles on the busiest pace.
- **Medal targets are measured**: `scripts/diner/levels-balance.mjs --write`
  plays every level with the bot (a sharp player pausing 0.67 s after each
  action, a careful one 1.2 s, 24 seeds) and writes the targets into
  `levels.ts`: bronze about what a careful player takes early on and a sharp
  player's weaker shifts late on, silver a sharp player's usual shift, gold a
  good one. Result (`docs/concepts/2026-10-09-diner-levels/balance.txt`): the
  careful player finishes chapter 1 levels 83–100% of the time, mid-game
  levels about half the time and the last chapter 8–46%; the sharp player
  finishes 88–100% until the last two levels (67%, 75%); gold takes a great
  shift (about one in five).

## Campaign: one night on the road

A run is three **legs** (desert, coast, the Moon Mile), each four **forks**
and a **boss** (`lib/games/diner/road.ts`, `campaign.ts`). Every fork is a
choice between exactly **two stops**, and either leads on to both stops of
the next fork. Two shifts side by side are a real trade: one calmer road
(busy 1) that pays cash ×1.5 or a life, one busier road (busy 2–3) that pays
equipment (rare when busiest). The third fork of each leg pairs a shift
with a rest: the **Garage** on the first leg, the **Motel** on the second,
either later.

**The road map** (`overworld.ts`, `overworld-models.ts`,
`overworld-layout.ts`) is a small toy world you drive: the same rig, short
and chunky, on a winding road through the desert, the coast and the Moon
Mile (dusk, twilight, night). The camera follows the truck from behind and
above, close, and draws toward the fork ahead so both stops show. Each stop
has a paved lot with a glowing ring and its landmark beside it (pumps under
a canopy and an EAT sign; a drive-in screen with parked cars; a turning
Ferris wheel and a striped tent; a lighthouse with a sweeping beam; a clock
tower and shops; a rocket sign and a radio dish; a garage; a motel with a
neon arrow). A sign floats over each lot: the place, busy flames, gas and
the reward. Road-closed barriers stand past the fork; flags mark the stops
already made. Drive with the stick or WASD (off the road is slower; rocks,
cacti and landmarks stop you). Rolling into a lot shows its card (the crowd,
the trouble, busy, gas, reward, a warning when the wallet cannot pay the
gas) with **Stop here** (Space). A tap on a sign drives there by itself.
The truck parks, and the shift opens. Rewards, the Garage, the Motel and the
end of the run are panels over the map.

**Play** with a run under way asks first: **New run** (the run ends; banked
tokens stay) or **Continue**. Continue on the box goes straight back.

| Place | Crowd and trouble |
| --- | --- |
| Truck stop | big parties, patient, burgers |
| Drive-in | couples, rushes at intermission, shakes |
| Fairground | families, everyone less patient, pie |
| Harbour | spills on the deck, fries |
| Old Town | lookalike parties: many more mimics |
| Moon Mile | brownouts and two-tap jams |

From the second leg every place adds demanding guests and, when busy, jams;
on the third every stop adds one more trouble. Bosses: **Last Bus** (truck
stop, huge rush waves), **The Critic** (Old Town, every party demanding),
**Midnight Feast** (Moon Mile, everything).

**Lives last the run**: 4, plus the Workshop's spare tires. A walk-out or a
wrong Out! costs one; the run ends at zero. **Coins** stay in the wallet:
gas is paid when you drive (an empty wallet costs a life instead), the rest
buys at the Garage. Shifts last 100 s (desert), 110 s (coast) and 120 s
(Moon Mile), bosses 20 s more. **Tokens** bank after every shift and buy the
**Workshop**'s permanent car upgrades (Gas can, Spare tire, Coffee urn, Neon
sign, Bigger patio, Twin grill, Roller skates, Heat-lamp pass, Jukebox,
Lucky dice, Road atlas, Chrome tray); purchases wait until no run is under
way. **Equipment** (25 items, `campaign-content.ts`) lasts the run.

Balance on the 9 October floor (`scripts/diner/balance.mjs`, 30–40 seeds): a
careful newcomer (1.2 s between actions, no Workshop) falls at stop 5, the
first boss, in the median; a sharp player (0.67 s, no Workshop) reaches the
second boss (stop 10) and never beats the night; with the full Workshop 95%
beat the night.

The run saves after every step and every four seconds of a shift
(`gamehub.diner.campaign.v3`): Continue restores the shift exactly.

## The idea in one line

Run a 1950s roadside diner at night. Seat the guests, cook, serve and clear,
and throw out the **mimics**: shapeshifters who slip into a party of matching
guests but always get one thing wrong.

## A shift

The floor (`lib/games/diner/layout.ts`, 9 October 2026) is wide and shallow
for landscape screens: 15 m across, the kitchen hatch along the back, a gate
in the left rail near the back, three rows for waiting parties down the left
side, six booth spots in two rows of three, the jukebox on the right side.
Both front corners hold only planters: touch controls sit over them. A
level or stop sets the shift's length, lives and medal targets. No new party
comes in the last 22 seconds. The shift ends early, with no medals, if the
lives reach zero.

1. **Seat.** Parties of one to four come in by the gate (left rail, near the
   back) and wait side by side in one of three rows down the left side, each
   with a patience ring beside it. Walk up to a party and press **Use**: they
   follow you in a conga line along your path. **Use** beside a free, clean
   booth big enough for them seats them. Use back at their row returns them
   to the line.
2. **Order.** After 2.4 s with the menu the booth rings a bell. **Use**
   beside it: every guest's dish shows in the bubble.
3. **Cook.** Each dish comes from its own machine in the kitchen hatch. Use
   at a machine starts a dish and Use again takes it when ready. A machine
   only starts a dish someone still needs (counting what is cooking, ready,
   held or shelved); with nothing ordered it makes one ahead. You carry
   **two plates** (three with the Chrome tray); a stack of dirty plates fills
   both hands. **Use gives what's wanted, takes what's ready, starts what's
   needed**, in that order, at whatever you face.
   - **Grill**: burger, 4 s, burns 8 s after it is ready (two lanes, three
     with the Twin grill).
   - **Shake machine**: milkshake, 3 s, never spoils.
   - **Pie case**: a slice, at once.
   - **Fryer**: fries, 5 s, burns 8 s after.
   A plate starts smoking halfway to burning. A burnt plate goes in the bin.
   Leading a party needs no hands.
4. **Serve.** **Use** at the booth holding plates its guests want.
   When everyone has their dish they eat for 6 s.
5. **Clear.** They leave their coins and dirty plates. With empty hands,
   **Use** at the booth takes both (the coins count now), then **Use** at the
   sink.

Kit (from the levels, or the campaign's Workshop): the **heat-lamp pass** (full hands shelve a plate, a free
hand picks one up; three plates), the **coffee urn** (a pot of three pours;
pouring for a party below 65% patience gives it 40%), the **jukebox** (Use
it: everyone's patience pauses for 8 s, then it rests 45 s) and **roller
skates** (Dash: a quick burst, 1.6 s cooldown).

**Coins**: 10 per guest plus a tip of up to 5 per guest for the patience
left when they pay. **Patience** drains while a party waits in line (54 s
from full on level 1, 27 s at the far end of the curve, a fifth less for
impatient crowds), for its order to be taken (35 s down to 17 s) and for its
food (60 s down to 30 s); it pauses while they follow you, read and eat, and refills by 0.2 on
being seated, 0.15 on the order and 0.12 for each plate. A party that runs
out walks out in a huff: **minus one life**, and any plates already served
stay dirty on the table.

## Mimics

Every party is dressed alike: the same hat (none, a red cap, a bowler, an
orange beanie, a cowboy hat), the same shirt colour (six, picked to stay
apart under warm light), plain or striped, with or without big dark
glasses. Skin and hair differ from guest to guest and are never a clue. A
**mimic** copies the outfit but gets **exactly one part** wrong: another
hat (or none), another shirt colour, stripes the others lack (or the other
way round), or glasses. Mimics only hide in parties of **three or four**,
so the rest always show the real outfit. Waiting parties stand in one row
facing the room, so every outfit is in full view on a phone.

- **Out!** throws out the guest you face, marked by a red ring on the
  floor. A mimic pops back into purple goo with one big eye and flees out of
  the door: **+15 coins**, and the rest of the party is happy again (full
  patience). Throwing out a real guest makes the whole party walk out:
  **minus one life**.
- A mimic left alone eats with its party and, as they finish, bursts out
  with the bill (the party pays nothing) and leaves a **goo puddle** by the
  booth. Goo slows anyone in it to 45% speed. **Use** standing in it mops it
  away in 1.5 s, holding you in place.
- Mimics arrive with level 11 (and the campaign's second leg). The first
  mimic of a shift comes alone, to a quiet door (or 25 s later if the line
  never empties); after that the level's share of parties of three or four
  hide one (three, five or seven in ten).

## Co-op

One to four waiters share the diner, each in their seat colour (teal, coral,
gold, blue cap, apron and bow tie). Coins, lives and medals are shared.
The top badges show full names when they fit and colour-coded seat numbers
on narrow screens. Those same numbers mark the other waiters in the room.
More waiters bring guests faster (×1.6, ×2.1, ×2.5) and raise the medal
targets (×1.7, ×2.2, ×2.6); three or four waiters open the next booth, up to six.

**Online.** A table's host opens Diner's box at the table, picks a level
(any they have opened on their device) and presses Play; everyone seated (one to four people, no bots) lands in a
room at `/diner/<token>` and Back returns to the table. The server
(`server/diner.ts`, shapes in `lib/games/diner/room.ts`) runs the one true
shift thirty steps a second. Each device sends its own input steps (the
stick in sixteenths and its presses) about twenty times a second, repeating
the ones not yet acknowledged, so a lost request loses nothing; the server
applies one step per tick from each waiter's queue (two or three if a
device ran ahead, holding the last movement briefly if one runs late).
Snapshots go out about twelve times a second, packed to about a tenth of
their plain JSON. Your own waiter moves at once on your device with the
same movement code; each snapshot says which of your steps the server has
applied, so the device starts again from the server's position, replays the
rest and eases any difference away. Everyone else is drawn 4.5 steps behind
the newest snapshot, between the two around that moment. Waiters can walk
about while the room waits for everyone (at most 15 s), then a 3-2-1
countdown opens the doors. A waiter whose device is away just stands still.
The host starts the next shift (Again, or the next level). Rooms live in
memory; a restart ends running shifts.

## Controls

- **Phones: sideways.** Diner is the one game that plays in landscape on a
  phone (`DinerLandscape`, `diner-landscape.tsx`): an upright phone sees
  "Turn your phone sideways to play", and the fullscreen request locks
  landscape where the browser allows (`mobile-viewport.tsx`). On the left, a
  floating joystick (touch anywhere in the lower left, the stick appears
  under the thumb and follows it past the rim; it rests in the corner over
  the planter). On the right, a large round mint **Use** button showing the
  picture and one word for what it will do now, a red **Out!** above it
  (from the first mimic) and the pink skate **Dash** beside it; your hands'
  plates above them. Short haptic taps where the browser allows. The same
  stick drives the truck on the road map.
- **Tablets**: the stick and buttons float over the lower corners.
- **Computers.** WASD or arrows to walk (and drive), Space or E for Use, Q or
  X for Out!, Shift to dash (with skates), Escape for the menu (and pauses
  solo). A slim strip at the bottom shows your hands and the keys, with
  Use's picture and word.

## Screen

The deck fills the screen: the camera frames the patio rail to rail and the
kitchen hatch from a 44° angle on landscape screens (56° on tall ones), as
large as it fits, and the place's ground covers the rest. On a 1440×900
desktop that is about 90 px per metre, on an 844×390 phone about 46.

- **Top bar**: back and the name (a neon script) with the level or stop
  ticket top left; the clock in the centre (red in the last 20 seconds, a
  Rush or Brownout chip beneath it when on); a dark pill with coins, a medal
  track (bronze, silver, gold ticks that light as you pass them) and lives,
  then the menu (Resume, How to play, Restart, Levels, sound, Fullscreen,
  Shift goals, Leave) top right. On a sideways phone the clock moves beside
  the back button and the ticket and name go.
- **Bubbles**: over booths, the order (a bell, then dish pictures that tick
  off as they are served, a meal ring while eating, the coins left); beside
  waiting parties, a heart in a draining patience ring and the party's size;
  high in the hatch over each machine, its lanes (a ring that fills while it
  cooks, glowing when ready, flashing when it smokes, a wrench when jammed).
- **Cards**: the opening card (kicker, name, place; what is new; also
  tonight; your kit; the medal targets; Open and Levels) and the results
  card (medals, coins, lives, Next level, Again, Levels).

## Look

Since 9 October 2026 (after William found the 8 October shift too bright,
oversaturated and busy around a small deck, and the trailer "behind" the
counter senseless): **the trailer is the kitchen**. A rounded cab-over truck
(cream over sage, chrome grille, round lamps) hitched at the left end tows a
long cream trailer whose patio side opens as one wide hatch under a striped
scalloped valance; the machines stand on its steel worktop, which reaches
out as a serving ledge, with a teal-tiled wall, a shelf of jars and a warm
strip light behind; below the ledge the counter front is cherry enamel with
chrome flutes (`rig.ts`). The patio is warm wooden planks with the diner's
checker as a runner where the waiters work, a low chrome rail with a
cherry kick rail and gate, sage booths, a jukebox angled toward the room,
planters in the front corners and lamp posts with bulbs strung down both
sides (`stage.ts`). Around it, a few things per place on the edges and one
landmark far behind for tall screens (`scenery.ts`, grounds in
`grounds.ts`). Light is calmer (`lighting.ts`): one soft warm flood from the
front left that casts readable shadows, a cool moon rim, warm light inside
the hatch, exposure 0.9 and bloom only on neon and bulbs, with a soft
vignette. The palette is enamel rather than neon (cherry #b3363b, sage
#8fbcaa, cream #ece3cf).

**Pictures**: order bubbles, the Use button, equipment and Workshop cards use
illustrated stickers, and the map signs, lot cards and level chapters use
painted postcards of each place (`scripts/diner/slice-stickers.mjs`; sources
and prompts in `docs/concepts/2026-10-08-diner-car/art`). Diner is
development-only, so these are not in the production asset allowlist yet.

Mimics in their true form are glossy purple goo with one big eye.

## Sound

`components/game/diner/sound.ts` synthesises everything, so nothing is
downloaded: a counter bell for an order, a ding when a plate is ready, the
grill's sizzle, the blender's buzz, pops, plate clinks, coins, soap bubbles,
a gooey pop for a caught mimic, a squelch for a burst, a grumble for a
walk-out, a mop's squeak, the door bell, ticks in the last ten seconds and a
jingle at the end. The jukebox plays a slow doo-wop (I–vi–IV–V, minor from the
Moon Mile chapter on) at the Ambient level. Pause, hiding the page and leaving silence it.

## Code

- `lib/games/diner/` — `engine.ts` (pure fixed-step sim), `content.ts`,
  `layout.ts` (floor plan, collision, routes), `levels.ts` (the forty
  levels), `road.ts` (the night's forks), `campaign.ts` and
  `campaign-content.ts` (run, equipment, Workshop), `bot.ts`, `room.ts`
  (wire shapes and packing; level rules are rebuilt on each device), `art.ts`.
- `components/game/diner/` — `diner-game.tsx` (the shift screen),
  `diner-hud.css`, `diner-levels.tsx` (the level grid), `diner-campaign.tsx`
  (the road map screen), `diner-landscape.tsx`, `level-notes.ts` (what's new,
  in words); 3D: `view.ts`, `framing.ts`, `lighting.ts`, `rig.ts` (the truck
  and trailer), `stage.ts`, `scenery.ts`, `grounds.ts`, `stations.ts`,
  `food.ts`, `models.ts`, `kit.ts`, `fx.ts`, people; the road map:
  `overworld.ts`, `overworld-models.ts`, `overworld-layout.ts`; `joystick.tsx`,
  `session.ts`, `online.ts`, `sound.ts`, `icons.tsx`, `diner-box.tsx`,
  `diner-rules.tsx`, `diner-room.tsx`, `diner-store.ts`,
  `diner-equipment.tsx`. `/diner/lab` (development) shows `?scene=stage`,
  `rig`, `shift&level=12`, `levels` or `campaign` on its own.
- `server/diner.ts`, routes `/api/diner/<token>` in `server/index.ts`.
- Tests: `tests/diner.test.mjs`, `tests/diner-levels.test.mjs`,
  `tests/diner-online.test.mjs`, `tests/diner-campaign.test.mjs`,
  `tests/diner-campaign-store.test.mjs`, `tests/diner-visuals.test.mjs`,
  `tests/diner-parallel.test.mjs`, `tests/diner-people.test.mjs`,
  `tests/diner-availability.test.mjs`.
- In development `window.dinerDebug` holds the session, the view, the
  controls and the stick, and `window.dinerMap` the road map, for scripted
  checks.
- The 8 October route map, diner car and places (Codex's half) were retired
  on 9 October; their sources are in the art archive
  (`gamehub-art-archive/diner-snapshot-2026-10-09`).
