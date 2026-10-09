# Diner: the diner car — 8 October 2026

William's feedback on the 4 October campaign and kitchen, in short:

- The campaign is not a roguelite yet. It should get hard quickly on a first
  run, the shop upgrades should make the next run easier, and the difficulty
  should keep climbing.
- The choices between shifts are not substantial or interesting.
- The 3D route map makes no sense: six copies of the diner side by side on a
  toy island, not stylised, not alive.
- The controls feel off. Example: after taking a shake, pressing Space again
  starts another shake. Follow how other games handle this.
- Order bubbles, dish icons and waiting markers look ugly; the graphics overall
  look low quality. Push everything much further.
- Keep the fast, multi-tasking Overcooked × Diner Dash feel. Add mechanics as
  the run goes on. Big changes are welcome.

He approved one idea: **your diner is a chrome 1950s diner car towed down a
highway through the night**.

## The world

**The car.** A streamlined 1950s diner car: rounded chrome ends, a cherry
enamel stripe, a row of warm windows, a rooftop neon sign reading DINER, and
a swing-up awning along its long side. A rounded cab-over truck in cream and
mint tows it. The same car is the hero of both the route map and every shift.

**A stop.** The car parks and opens its long side: the awning lifts, the
counter faces out, and the crew unfolds a **patio**: a chequered deck with
booths, a low rail, string lights, a host stand at the entrance and a jukebox.
Around the patio is the place you parked at. Its landmarks rise behind the
car and around the deck's edges, so every stop looks different while the
playfield stays the same.

**Six places.** Each has its own crowd and its own scenery:

| Place | Scenery | Crowd (gameplay) |
| --- | --- | --- |
| Truck stop | asphalt lot, glowing pumps, semi trailers, tall pole sign | truckers: big parties, burgers, patient |
| Drive-in | huge glowing screen, rows of parked cars, projector beam | couples: pairs, rush at intermission, shakes |
| Fairground | Ferris wheel, carousel, striped tents, bulb strings | families: kids lose patience fast, pie |
| Harbour | plank pier, water, sweeping lighthouse, bobbing boats | sailors: spills on the wet deck, fries |
| Old Town | cobbles, brick shopfronts, clock tower, street lamps | locals: lookalike parties, mimics |
| Moon Mile | desert sand, mesas, radio dish, rocket motel sign, huge moon | night owls: brownouts, jams, everything |

Two more appear only on the map: the **Garage** (a shop) and the **Motel**
(a rest).

**The route map** is one continuous night landscape that the highway crosses
in three legs: desert, then coast, then the Moon Mile. At each junction the
road forks toward two or three places; branches rejoin. The truck drives the
car from stop to stop. The world is alive: traffic with headlights, blinking
signs, the turning Ferris wheel, the lighthouse beam, a train, drifting
clouds, shooting stars, people at the places.

## The run

A run is **one night on the road**: three legs, each four stops and a boss
(15 stops, about 12 shifts and three stops at a garage or motel). Shifts are
short: 100 s on the first leg, 110 s on the second, 120 s on the third, bosses
+20 s. A whole run is about 25 minutes.

**Lives last the whole run.** You start with 4. A party walking out costs one;
throwing out a real guest costs one. The run ends at zero. The Motel gives 2
back (up to the maximum).

**Coins pay for gas.** Your wallet lasts the run. Every fork shows its gas
price, paid when you drive there; if you cannot pay, the wallet empties and you
lose a life pushing the car. Coins left over buy equipment at the Garage.

**Every fork is a door with a reward**, chosen before you drive: the place
(its crowd), how busy it is (1–3 pips), the gas price and the reward you get
for finishing the shift: **equipment** (pick one of three), **cash** (the
shift's coins count 1.5×), **a life**, or **rare equipment** (only on busier
forks). Garage and Motel stops have no shift.

**Bosses** end each leg: *Last Bus* (truck stop: a busload arrives at once),
*The Critic* (Old Town: every party is demanding), *Midnight Feast* (Moon
Mile: everything at once). They pay rare equipment and many tokens.

**The difficulty climbs every stop**: guests arrive faster, patience shrinks,
parties grow, booths and dishes are added, and each leg introduces new
trouble. Targets (to be verified by simulation):

- a careful first-time player with no workshop upgrades loses the run around
  stop 4–6 (the first boss is the first wall);
- a strong player with no upgrades reaches leg 2's boss;
- a strong player with most of the workshop clears the night.

After the third boss, **Keep driving** continues into endless legs.

**Tokens** are the permanent currency (shown with their own icon, never called
coins). A run earns tokens for every stop reached and every boss beaten.

**The Workshop upgrades the car itself**, and each purchase is visible on the
car or the crew:

| Upgrade | Effect |
| --- | --- |
| Spare tire (2 ranks) | +1 life |
| Chrome tray | carry three plates instead of two |
| Roller skates | unlocks Dash |
| Bigger patio | one more booth from the first stop |
| Heat-lamp pass | a shelf for three plates; plates there never burn |
| Coffee urn | a coffee pot you pour for waiting parties (+patience) |
| Jukebox | Use it: everyone's patience pauses for 8 s (recharges) |
| Twin grill | the grill gets a third lane |
| Gas can | start each run with 25 coins |
| Lucky dice | one reroll of equipment offers per leg |
| Neon sign | +2 coins per paying guest |
| Road atlas | see the rewards two forks ahead |

**Equipment** (one of three after a shift, or bought at the Garage) lasts the
run. Every item changes how you play; no item is a bare few percent:

- Kitchen: Turbo grill, Quick blender, Heat lamps, Auto restock, Prep shelf.
- Service: Picture menus, Order pad (reach twice as far), Warm welcome,
  Express eaters, Set menu.
- Money: Tip jar, House special, Combo till, Cash runner.
- Trouble: Dishwasher, Rubber boots, Night watch, Safety net.
- Rare: Chrome tray and Roller skates (when not owned), Second wind (+2 lives),
  Golden spatula (nothing burns this run).

## Controls

Two buttons, as now: **Use** and **Out!** (from the first mimic). Roller
skates add **Dash**. The rule, in one line: *Use gives what's wanted, takes
what's ready, and starts what's needed.*

- **Two hands.** You carry up to two plates (three with the Chrome tray). A
  stack of dirty plates fills both hands. Leading a party needs no hands: you
  can lead a party and carry plates at the same time.
- **Give first, then take, then start.** At any target, Use first gives
  something you hold that it wants (a plate to a guest who ordered it, dirty
  plates to the sink, a burnt plate to the bin, a party to a free booth), then
  takes something ready if you have a free hand (a plate, a table's coins and
  plates, a waiting party), then starts a machine.
- **A machine makes what is ordered, plus one spare.** Use starts a dish only
  while fewer of it are cooking, ready or carried than guests are waiting for,
  plus one. Taking a shake and pressing again no longer starts a shake nobody
  wants; the button shows no action there.
- The target is always outlined in the room, and Use shows its picture and one
  word. A refused press gives a small shake, never a surprise.
- Repairs are taps (as now); mopping holds you in place (as now).

## Mechanics by leg

| Leg | New | Dishes | Booths |
| --- | --- | --- | --- |
| 1 Desert | seating, orders, cooking, burning, washing; Last Bus | burger, shake; fries from stop 3 | 3 → 4 |
| 2 Coast | mimics and Out!, demanding guests, jams, spills; The Critic | + pie | 4 → 5 |
| 3 Moon Mile | brownouts, kids, all crowds mixed; Midnight Feast | all four | 5 |

Place crowds layer on top: a fork's place decides which of the leg's troubles
you get, so forks really differ.

## Look

Premium stylised 1950s Americana at night: chunky readable forms with soft
bevels, glossy enamel, real chrome reflections, warm bulbs and neon that bloom,
cool moonlight and deep indigo shadows. Cherry, cream, mint and chrome stay the
diner's own palette; each place brings its own accents (sodium orange at the
truck stop, cinema blue at the drive-in, candy colours at the fair, teal water
at the harbour, gaslight amber in Old Town, violet and moon-white on the Moon
Mile). Nothing flat: every surface has light, material and a reason to exist.
Gameplay readability always wins: guests, plates, machines and bubbles must
read at phone size.

Order bubbles and icons are redrawn as polished illustrated pictures (dishes
that look delicious, clear patience), not flat line drawings.

## Who builds what

The 3D work is split in half (William, 8 October). Each side owns whole files.

**Codex: the places**

- `components/game/diner/diner-car.ts` — the diner car and truck (shared by
  the shift stage and the map), with its workshop upgrade variants.
- `components/game/diner/places.ts` — the six places, at stage scale and map
  scale, plus the Garage and Motel at map scale.
- `components/game/diner/stage.ts` — the shift environment: the car opened up,
  its counter and back wall, the patio deck, booths, rail, host stand,
  jukebox, string lights and the place around it, built to
  `stage-contract.ts`.
- `components/game/diner/campaign-world-models.ts`, `campaign-world.ts` — the
  route map, rebuilt, drawing the run's map from `lib/games/diner/road.ts`.
- Retires `roadside.ts`, `interior-furniture.ts` and the room half of
  `models.ts` once the stage replaces them.

**Claude: the things you touch**

- Engine, run, map logic and balance hooks: `lib/games/diner/*`.
- The counter machines (`stations.ts`), food and dishes (`food.ts`), the goo
  mimic, effects (`fx.ts`), carry poses, lighting, camera and post-processing
  (`view.ts`, `framing.ts`).
- All interface: HUD, bubbles, icons, map panels, forks, garage, workshop,
  results, rules.

**Codex also** runs headless balance simulations of the run once the new rules
exist, and reviews the code before it ships.

## Acceptance

- The run: a fresh profile's simulated careful player dies around stops 4–6;
  upgrades move that measurably; every fork shows place, busy pips, gas and
  reward; equipment changes how a shift plays.
- The controls: no Use press starts a dish nobody needs; two plates in hand;
  the target is outlined; bots and online co-op still work.
- The world: one diner car, one continuous road, places that read at a glance
  and move (traffic, wheel, lighthouse, signs); each shift shows its place
  around the patio.
- Quality: renders reviewed at play size on phone and desktop, in motion,
  before integration.
