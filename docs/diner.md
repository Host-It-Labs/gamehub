# Diner

Diner (`diner`) is a real-time solo and co-op game in the spirit of Diner
Dash and Overcooked, played with a joystick on phones and the keyboard on
computers. It shares its twist with the party game Impostor: everyone in a
party of guests is dressed alike, and the mimic among them gets one detail
wrong.

Requested on 3 October 2026: an impostor party game, plus "a solo co-op game
which is kind of like the game", combined with the Diner Dash games, with a
joystick and buttons on phones. Little content, all of it good quality.

## The idea in one line

Run a 1950s roadside diner at night. Seat the guests, cook, serve and clear,
and throw out the **mimics**: shapeshifters who slip into a party of matching
guests but always get one thing wrong.

## A shift

A shift lasts **three minutes** (`SHIFT` in `lib/games/diner/engine.ts`).
You keep five stars; the coins you take decide one, two or three medals by a
target per night. No new party comes in the last 22 seconds. The shift ends
early, with no medals, if the stars reach zero.

1. **Seat.** Parties of one to four come in by the door (left wall, near the
   front) and wait side by side in one of three rows up the left wall, each
   with a patience ring beside it. Walk up to a party and press **Use**: they
   follow you in a conga line along your path. **Use** beside a free, clean
   booth big enough for them seats them. Use back at their row returns them
   to the line.
2. **Order.** After 2.4 s with the menu the booth rings a bell. **Use**
   beside it: every guest's dish shows in the bubble.
3. **Cook.** Each dish comes from its own station on the back counter. Use
   at a station to start it (no hands needed), then Use again with empty
   hands to take the plate.
   - **Grill**: burger, 4 s, burns 8 s after it is ready.
   - **Shake machine**: milkshake, 3 s, never spoils.
   - **Pie case**: a slice, at once (Night 2 on).
   - **Fryer**: fries, 5 s, burns 8 s after (Night 3).
   A plate starts smoking halfway to burning. A burnt plate goes in the bin
   at the end of the counter. You carry **one thing at a time**: a plate, a
   stack of dirty dishes, or a party you are leading.
4. **Serve.** **Use** at the booth holding a plate one of its guests wants.
   When everyone has their dish they eat for 6 s.
5. **Clear.** They leave their coins and dirty plates. **Use** at the booth
   takes both (the coins count now), then **Use** at the sink.

**Coins**: 10 per guest plus a tip of up to 5 per guest for the patience
left when they pay. **Patience** drains while a party waits in line (50 s
from full on Night 1), for its order to be taken (32 s) and for its food
(55 s); it pauses while they follow you, read and eat, and refills by 0.2 on
being seated, 0.15 on the order and 0.12 for each plate. A party that runs
out walks out in a huff: **minus one star**, and any plates already served
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
  **minus one star**.
- A mimic left alone eats with its party and, as they finish, bursts out
  with the bill (the party pays nothing) and leaves a **goo puddle** by the
  booth. Goo slows anyone in it to 45% speed. **Use** standing in it mops it
  away in 1.5 s, holding you in place.
- Night 1 has no mimics and no Out! button. On Night 2 the first mimic comes
  after 30 s, alone, when the line is empty (or 25 s later if it never
  empties); after that, two parties in five of three or four hide one. On
  Night 3 they start after 12 s and three parties in five hide one.

## Nights

Three nights, each with its own sky through the windows (a dusk sliver of
moon, a deep blue half moon, then a huge full moon), menu and booths.
Medals and best takings per night are kept on the device
(`gamehub.diner.v1`). Nothing is locked.

| Night | Name | Stations | Booths | Arrivals (s) | Medals (coins) |
| --- | --- | --- | --- | --- | --- |
| 1 | Opening | Grill, Shake | 3 (two of 2, one of 4) | 12–17 | 90 / 170 / 250 |
| 2 | Regulars | Grill, Shake, Pie | 4 | 11–15 | 110 / 200 / 290 |
| 3 | Full moon | Grill, Fryer, Shake, Pie | 5 | 9.5–13 | 130 / 230 / 320 |

**Balance** (scripted greedy bot, `lib/games/diner/bot.ts`, 12 seeds each):
a bot that pauses 0.67 s after every action, a fair model of a good player,
averages about 225 coins on Night 1, 265 on Night 2 and 250 on Night 3
(silver, sometimes gold); a slow beginner model (1.2 s) takes one medal; a
model that never spots mimics loses about a third of its takings on Nights 2
and 3. Run `node --experimental-strip-types` on a script calling
`playShift(createMatch(seed, night), true, pause)` to recheck after changing
numbers.

## Co-op

One to four waiters share the diner, each in their seat colour (teal, coral,
gold, blue cap, apron and bow tie). Coins, stars and medals are shared.
More waiters bring guests faster (×1.6, ×2.1, ×2.5) and raise the medal
targets (×1.7, ×2.2, ×2.6); three or four waiters get one more booth.

**Online.** A table's host opens Diner's box at the table, picks the night
and presses Play; everyone seated (one to four people, no bots) lands in a
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
The host starts the next shift (Again, or the next night). Rooms live in
memory; a restart ends running shifts.

## Controls

- **Phones (portrait only).** The diner fills the top of the screen; the
  controls sit beneath it on a cherry counter front, with the coins (and a
  medal track) and stars on a strip at its top. Left: a floating joystick
  (touch anywhere in the left part, the stick appears under the thumb and
  follows it past the rim; it tracks one finger, so a second finger can press
  a button). Right: a large mint **Use** button showing the picture and one
  word for what it will do now (Lead, Seat, Order, Cook, Take, Serve, Clear,
  Wash, Bin, Mop, Back), and a smaller red **Out!** above-left of it (from
  Night 2). Short haptic taps where the browser allows.
- **Tablets on their side**: the stick and buttons sit on rails beside the
  room.
- **Computers.** WASD or arrows to walk, Space or E for Use, Q or X for Out!,
  Escape for the menu (and pauses solo). A cream ring on the floor marks what
  Use will act on.

## Screen

Back control and the name (a pink neon script) top left; the shift clock as
a cream enamel pill in the centre (it turns red in the last 20 seconds and
ticks in the last ten); coins, the medal track and stars with the menu
(Resume solo, How to play, Restart solo, sound, Fullscreen, Leave) top
right. On phones the bar holds only back, the clock and the menu. Online,
the waiters' badges hang under the clock and other waiters carry their name
over their head. Bubbles over booths show the order (a bell, then dish
pictures that tick off as they are served, a meal ring while eating, the
coins left on the table); stations show a cooking ring, a bouncing plate
when ready and a red flashing ring when it smokes. No other text.

## Look

A 1950s roadside diner at night, seen from the front at a 52° tilt with an
orthographic camera that fits the whole room on any screen: cherry and cream
checkerboard, a cherry enamel counter with chrome bands, pastel pink walls,
mint vinyl booths with chrome-rimmed tables, a mint fridge, a jukebox
cycling its colours, a pink coffee-cup neon and a teal star in the middle
window, the night outside the back windows. Warm key light with soft
shadows, pools of lamplight on the floor, corners falling into shade, the
lot outside lit by the diner. Everything is modelled in code
(`components/game/diner/models.ts`, merged per material with vertex colours)
as chunky toys: big heads, outfits that read on a phone. Mimics in their
true form are glossy purple goo with one big eye.

Feedback: steam and sizzle on the grill, bubbles from the fryer and the
sink, a buzzing blender, sparkles when a plate is ready or served, gold
sparkles and flying coins into the counter when a table is cleared, angry
red puffs over impatient guests, a goo splash and "+15" when a mimic is
caught, a burst of goo when one gets away, a swinging door, a bin lid that
flaps.

## Sound

`components/game/diner/sound.ts` synthesises everything, so nothing is
downloaded: a counter bell for an order, a ding when a plate is ready, the
grill's sizzle, the blender's buzz, pops, plate clinks, coins, soap bubbles,
a gooey pop for a caught mimic, a squelch for a burst, a grumble for a
walk-out, a mop's squeak, the door bell, ticks in the last ten seconds and a
jingle at the end. The jukebox plays a slow doo-wop (I–vi–IV–V, minor on
Night 3) at the Ambient level. Pause, hiding the page and leaving silence it.

## Code

- `lib/games/diner/` — `engine.ts` (pure fixed-step sim), `content.ts`,
  `layout.ts` (floor plan, collision, routes), `bot.ts`, `room.ts` (wire
  shapes and packing).
- `components/game/diner/` — `diner-game.tsx` (screen), `view.ts`,
  `models.ts`, `kit.ts`, `fx.ts` (3D), `joystick.tsx`, `session.ts` and
  `online.ts`, `sound.ts`, `icons.tsx`, `diner-box.tsx`, `diner-rules.tsx`,
  `diner-room.tsx`, `diner-store.ts`.
- `server/diner.ts`, routes `/api/diner/<token>` in `server/index.ts`.
- Tests: `tests/diner.test.mjs`, `tests/diner-online.test.mjs`.
- In development `window.dinerDebug` holds the session, the view, the
  controls and the stick, for scripted checks.
