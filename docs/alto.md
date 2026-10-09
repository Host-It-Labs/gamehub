# Alto

Alto (`alto`) is a strategy game for 2–6 players, added on 30 September
2026 at William's request: something more strategic and longer than Nox,
Mora and Yata (10–20 minutes), where everyone still plays at the same time,
that needs no knowledge of what comes later the way Seven Wonders does, with
a base game that is quick to learn and extensions and variants on top.

## The idea

Little cargo ships between toy-like planets (the space theme since
2 October 2026; the first version was floating sky islands). Every turn,
**everyone at once** picks a planet to fly their ship to and, if they like,
one upgrade to build with the cargo they already hold. Alone on a planet
you load the whole pile, up to your hold; with others you split it evenly,
rounded down, and the rest stays. Unvisited planets keep filling, so a quiet
planet grows until someone reads the table right. Over **three years** you
fit out your ship and build up your **home base**, and everyone can see
every ship and every base all the time.

What answers the Seven Wonders complaint: **nothing is hidden but the turn's
picks**. Every upgrade of the match is laid out from the first turn (All
upgrades in the menu); the only randomness is at setup. Long-term play comes
from engines versus points, the trophy races and planning for the next year.

### Years, ship parts and base modules (3 October 2026)

William found the first table unclear: tools, gear, trophies and extras
were four words for two ideas, and the number of trips was hard to read. So:

- **Years** replace trips (Year 1, 2, 3). The round pill shows the year and
  a track of all three years, each a bar of its turns (`YearTrack`).
- Upgrades come in **two families** (`family` in `content.ts`, derived from
  the model's `tag`): **ship parts** (blue, a rocket: hold, a cargo, alone,
  shared) bolt onto your ship and load more; **base modules** (gold, an orbit:
  points, trophies, end scorers, discounts) are the building blocks of your
  home base. The shop shows them on two shelves; on phones each item keeps
  its colour and mark. End scorers count families: Refinery per ship part,
  Archive per base module, Hangar per hold, Garden per upgrade.
- First Flight reads as a story: Year 1 is mostly ship parts, Year 2 is
  half and half, Year 3 is all base.
- Every player's **base** (`alto-base.ts`) stands on the stage (side columns
  on wide stages, a row along the top on tall ones, two rows on a narrow
  stage with more than three; `arrangeStage`), yours in a Base bay beneath
  the Ship bay in the dock (side by side on phones). Your ship fills its own
  bay; opponent ships stand on their bases' pads. At the reveal every ship
  flies out and hovers in front of its planet (never through its moons,
  rings or buildings), then flies home. What each player built this turn
  rises over their base at the reveal.
- The **planets develop by year** (`buildPlanet(id, year)`): established
  natural landscapes in Year 1, settlements in Year 2, busier in Year 3.
  Next year's planets are built during the last turn of the year before.
- A **loading screen** (the wide cover and a progress bar) stays until every
  picture is decoded and every planet, base, ship and shop object is built
  and its shaders compiled; nothing pops in.

### Words: what players see, what the code says

The code keeps its first words and every id: goods are **cargo** (food,
metal, ice, crystal: indexes 0–3), islands are **planets**, plans are
**upgrades** (tags workshop and ship are **ship parts**, monument and civic
**base modules**), seasons are **years**, the Winds extension is **Comets**
and Captains is **Crew**. Saves carry `rules: 2` since the 3 October
rebalance; older saves are not restored.

## Rules (the numbers live in `lib/games/alto/content.ts`)

- Planets: two more than the players (4 at two, 8 at six), each carrying one
  kind of cargo: food, metal, ice or crystal (crystal once until the six-player table).
  Piles start at 2 and grow 2 a turn (3 at five or more players); crystal
  grows one less. A planet holds at most 10 (`pileCap`); a full one stops
  filling.
- Everyone starts with 1 food, 1 metal, 1 ice and a hold of 2.
- A turn: optionally tap one upgrade you can pay for (it is built first, with
  cargo already held; short of one kind, two of any others pay for it), then
  tap a planet. The tap on the planet is the move (no confirm plate); Undo
  takes it back while anyone is still choosing.
- Three years of 6 turns (Full) or 4 (Quick). Each year lays out six
  upgrades; they leave when it ends; each upgrade once per player.
- Ship parts: a cargo kind loads one more on every flight to it (past the
  hold); Cargo Pod and Trailer carry one more; Radar adds to lone landings,
  Robot Arm and Magnet to shared ones; Sidecar does hold and alone, Cooler
  food and ice. Base modules: points at once, trophy races paying the first
  builder most (builders on the same turn all score the prize of the last of
  them), end scorers, and discounts (Fabricator: base modules cost 1 less;
  Workshop: every upgrade).
- End: every 3 cargo left score 1. Tie: more cargo left, then shared.
- First Flight is a fixed 18-upgrade set (the way to learn); Random draws six a
  year from each year's pool of nine, all shown from the start.

### Extensions (each one mechanic, independent)

- **Comets** (Winds in the code): each turn one planet gets 3 more; the next comet is always shown;
  never the same planet twice running. No new control.
- **Orders**: three open orders (a few cargo for points), the next one shown.
  Filling one is your build for the turn; first come, simultaneous fillers all
  score.
- **Flags**: landing alone plants a flag; at the end the most flags on each
  planet scores 5, a tie 2 each. No new control.
- **Crew** (Captains in the code): before the first turn everyone picks one of two crew
  (Pilot, Farmer, Miner, Ice Fisher, Jeweller, Scout, Trader,
  Architect), each bending one rule. Since 3 October: Pilot takes 1 more
  when sharing (was a bigger hold: about +6 points, far too strong), Farmer,
  Miner and Ice Fisher also start with 2 of their cargo, the Trader starts
  with 1 crystal, and the Collector became the Architect (base modules cost
  1 less).

A fifth idea, Rivals (banners compared with neighbours each year), was
tried in simulation and dropped: bots and likely players build the same
banners, so it rarely changed anything, and it added an icon to every card.

## Balance

Measure before changing numbers. Four scripts play medium bots against each
other (`node --experimental-strip-types scripts/<name>`):

- `alto-balance.mjs [games] [options] [levels] [sizes]`: scores, upgrades
  built per year, how often each upgrade is built and how its builders do,
  pile sizes at each year's end and cargo loaded by kind.
- `alto-strength-matrix.mjs [games] [sizes] [options]` (node, no flag; runs
  `alto-strength.mjs` in parallel): for every upgrade, one bot **leans** hard
  toward it or **never** builds it, at 2, 3, 4 and 6 players; both should
  stay near 0 points against the table. `!` marks an upgrade that is too
  strong (leaning gains, or skipping it costs, over 1.5), `?` a weak one.
- `alto-strategies.mjs`: bots leaning to engines, trophies, ship parts or
  extras against plain bots.
- `alto-crew.mjs`: each crew's win rate and points.

The 3 October 2026 rebalance (William: crystal piled up in the first trip,
some upgrades felt over- or underpowered), all bot figures, not human ones:

- Before: the Cargo Pod was nearly mandatory (skipping it cost 5 points),
  Lighthouse, Magnet and Observatory paid too well, Statue, Pool and Factory
  too little; Year 3 bots could afford almost everything; metal was asked
  for far more than food or ice; crystal was never needed in the first trip
  and food piles reached 29.
- Now: piles cap at 10 and crystal fills by one less; every year asks for
  food, metal and ice about evenly (First Flight costs 7/7/7 plus 1 crystal
  in Year 1, 7/7/6 plus 5 in Year 2, 10/10/10 plus 11 in Year 3), so every
  kind of planet gets visited and each kind is loaded about equally. Year 3
  costs more, so players build about 2.5–3 of its six.
- First Flight: every upgrade within about ±2 points leaning or skipping, at
  every table size. Each one is built by 11–94% of bot players (the
  Harvester is the rarest; the Statue and the Radar at small tables the most
  common).
- Random sets keep some table-size effects on purpose: alone bonuses
  (Radar, Sidecar) are strongest at two players and shared ones (Robot Arm,
  Magnet) at four and more.
- Styles: an engine, ship-part or extras lean lands within about 3 points of
  plain bots; a pure trophy rush is the weakest, by about 8 points at two
  players.
- Crew: within about ±2.5 points except Pilot at two players (sharing is
  rare there) and Scout at four; everyone is offered two, so a weak pick can
  be avoided.
- Averages (Full, First Flight): 70 points at two players, 55–61 at three to
  six; winner margins 3.5–6.5; 8.5–10 upgrades each.

Earlier lessons still hold: passive "make a good every turn" workshops
flooded the economy, and "simultaneous builders all take the top prize"
made races meaningless.

## 3D

One canvas (`alto-scene.tsx`) sits between the painted space and every
control. It draws the planets (`alto-3d.ts`, built in code, one look per year:
`buildPlanet(id, year)`), every player's base (`alto-base.ts`) with opponent ships
(`alto-ship.ts`) on their pads and your ship in its own bay, and, in a second pass with its own viewport per
item, the shop's upgrade objects. The DOM keeps the layout (`arrangeStage` in
`alto-table.tsx` sizes the planet and base slots; slots never overlap and
each planet is scaled so everything it carries, `Planet.reach`, fits its slot)
and every number and button; the deck has no z-index and no transform, so
its panel paints under the 3D and its controls over it.

- Loading: the scene builds everything the table shows in slices of a frame,
  then compiles every shader (`compileAsync`) before the loading screen goes.
  A builder that throws is logged and skipped, never a stuck loader.
- Bases: an asteroid chassis with a habitat hub, landing pad and sixteen
  fixed mounting sockets, filled in build order. It grows once: a compact
  deck with the inner ring's five sockets until those five are built, then
  the full deck (before any ghost needs an outer socket). `alto-modules.ts`
  makes simple space hardware attached directly to those sockets. Module
  models are built once per page and shared by clones.
- Framing (3 October 2026, William: bases too zoomed out, opponents' ships
  tiny): each base is fitted to its slot's actual width and height by
  measuring what is drawn in the slot's orientation (`baseFrame` in
  `alto-framing.ts`), with the docked ship's box for opponents. A pick not
  yet built never enters the frame; a new module or the bigger deck eases
  the zoom. Opponent tiles are wider than tall, with the cargo tag beneath
  (on small tiles only the avatar, on the base's corner).
- Your dock: the Ship bay above the Base bay, each wider than tall; the ship
  is fitted to its visible hardware independently of the base. Owned
  upgrades sit in the cargo row (a count per family, names while they fit,
  then pictures, then counts only; `useOwnedFit`); on phones they take a
  second line under the cargo, Undo at its end. The shop marks Selected,
  Queued and Owned distinctly; cost pips shrink only as far as their number
  needs to fit the item.
- Loading rocket: the nose follows the clockwise orbital tangent.
- Ships: only ship parts bolt on (the souvenir stickers and the hull
  Telescope are gone; the Telescope is a base module). At the reveal each
  ship flies from its pad and hovers in front of its planet, beyond
  `reach`, so it never passes through moons, rings or buildings.
- Collisions are checked, triangle by triangle:
  `node --experimental-strip-types scripts/alto-fit.mjs [ship|base]` (every
  ship part against every other and against the hull, legs, engine and
  flame over 61 poses; every base piece against every other and the docked
  ship). On 3 October it found the Cargo Pods cutting the lower fins and the
  Scoop meeting the folding front leg; both mounts moved.
  `node --experimental-strip-types scripts/alto-planet-check.mjs` builds every
  planet in every year and checks that no two features touch, that moons
  (now on fixed orbits round the spin axis), rings, shards and clouds clear
  everything standing, that `reach` matches the drawn extent, and that each
  year keeps the year before's features in place.
- Years: Year 1 has full orchard crowns, produce, ore outcrops, snowy groves
  and ice floes around a first settlement. Year 2 adds buildings and machinery;
  Year 3 adds more of everything and one landmark per planet
  (a village, an ore works, a launch pad, an igloo village, a fishing camp, a
  crystal refinery or temple).

`/alto/lab` (development only) shows every planet, six ships, a home and the
shop; `?one=<planet id>`; `?view=planet:<id>&year=<1–3>`, `?view=ship`,
`?view=upgrade:<id>`, `?view=base&mods=<ids|all>` one object filling the
screen with its triangle and draw counts (`yaw`, `pitch`, `dist`, `still`);
`?stills` renders the transparent stills that `scripts/alto-art.mjs` turns
into the 2D pictures (inspections, rules, setup). `?stills=modules` renders
only the seventeen revised hardware models; `scripts/alto-module-art.mjs`
turns those preserved v3 sources into thumbnails. `?stills=planets` exports
the revised landscapes with the live table's lighting; `scripts/alto-planet-art.mjs`
turns their preserved v4 PNGs into inspection thumbnails. The earlier renders
stay intact. `?table&year=2&built=all`
shows the real interactive table using a development fixture, without
reading or writing a saved match; `seats=6`, `long` and `orders` exercise
the fullest layout.

## Where it lives

- Rules: `lib/games/alto/` (`content.ts` data, `engine.ts` state and turns,
  `bot.ts`, `text.ts` plain words, `lessons.ts` the Learn coach, `art.ts`
  asset paths, `room.ts` online view types).
- Table: `components/game/alto/` (`alto-table.tsx` the one screen for solo
  and online, `alto-box.tsx` setup, `alto-game.tsx` solo with bots and the
  device save `gamehub.alto.v1`, `alto-room.tsx` online, `alto-rules.tsx`,
  `alto.css`).
- Online: like Rota and Arena, a table launches its own room
  (`server/alto.ts`, SQLite table `alto_rooms`, routes `/api/alto/:token`,
  page `/alto/:token`); bots fill empty seats and fly for anyone away 45 s;
  the table's admin keeps the Table button and starts another match.
- Tests: `tests/alto.test.mjs`, `tests/alto-online.test.mjs`,
  `tests/alto-framing.test.mjs`; checks
  `scripts/alto-fit.mjs` (3D collisions) and the balance scripts below.
- Art: `docs/concepts/2026-10-02-alto-space/README.md` (every prompt and
  pick of the space set; the sky-island set is in `2026-09-29-alto`), sources
  in `public/art/alto/`, stills in `public/art/alto/stills/`, delivery files
  from `scripts/alto-art.mjs`. The attached-hardware brief and model mapping
  are in `docs/concepts/2026-10-03-alto-hardware/README.md`, with transparent
  source renders in `public/art/alto/stills-v3/` and delivery files from
  `scripts/alto-module-art.mjs`.
