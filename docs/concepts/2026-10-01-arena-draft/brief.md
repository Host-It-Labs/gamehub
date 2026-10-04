# Arena: drafts, eight more troops, living field (1 October 2026)

William's round of feedback (all decided by him unless marked "our call"):

1. **Versus deck choice leaves the setup box.** No deck editor in the setup
   tab. Setup gains one switch, **Draft**, off by default.
   - **Draft off**: pressing Play opens the battle's loading screen with a
     quick deck picker over it; you pick (or keep) your deck of eight while
     the assets load. Efficient but it should feel good.
   - **Draft on**: a quick draft before the battle (see Split draft). Must
     feel fast, not one-pick-each-in-turn. In 2 v 2 you see what your
     teammate is drafting.
2. **Quest starts with a quick draft** of the starting deck, with hard
   choices (see Bundle draft). The starting charm pick is removed.
3. **Eight new troops**, at least three of them tanks (see Roster). With one
   tank, a deck without the Dino felt unplayable in Quest.
4. **Card portraits redone, all of them**: in action, not smiling or posing
   for the camera; the character still big and centred.
5. **Walks**: human troops walk robotically. The Robots are fine, the Biplane
   and the Balloon are fine; every walking human must walk naturally.
6. **The field is bland**: towers, map, grass and trees should feel alive
   (grass that reads as grass and moves, trees that sway, livelier towers).
   The Meteor (the "fireball") must visibly come from your own king tower,
   not out of the sky.
7. **Quest map**: integrate it with its background painting (today it looks
   layered on top); the painting looks blurry; more animated, more game-like.
8. **Card stats**: a button in the setup to browse every card with its
   stats; in game on desktop, hovering a card in your hand or any troop on
   the field (yours or the other side's) shows that card with its stats in a
   panel at the right, over the forest.

## Split draft (Versus, our call)

Fast, simultaneous, and every choice has a cost: what you leave goes to your
opponent.

- Two rounds. Each round every player sees an offer of **four cards** at the
  same time, keeps **two**, and the two they leave go to the player across
  from them (their lane opponent in 2 v 2). After two rounds each player has
  2 + 2 kept + 2 + 2 received = **eight cards**.
- Each round has a short clock (about 12 s; a full ring that drains). When it
  runs out the device keeps the two highest-rated cards for you. Bots pick
  instantly with the same rating.
- Offers are built so every deck ends playable whatever is kept: each offer
  of four holds one card per role (a tank or win condition, an air answer,
  a splash or swarm answer, a spell or support), drawn from the 24 cards with
  no card appearing twice in the same match's offers. The Meteor may appear
  in only one offer.
- **2 v 2**: you see your teammate's offer and their picks live (their
  current choices glow on their cards), and they see yours; leftovers go to
  your lane opponent. Like team drafts in other games, you can plan the
  pair together (one takes the tank, the other the air answer).
- After the second round the final eight show briefly (about 1.5 s) and the
  battle starts. The whole draft fits in about 30 s and runs during loading.

## Bundle draft (Quest start, our call)

- Three quick rounds. Each round offers **three bundles of two cards**; you
  take one bundle. Six cards make the starting deck (Quest decks hold 5–8).
- Bundles are built for hard choices: a strong card paired with a weak or
  awkward one against two solid middling cards; a tank paired with nothing
  for air against two air answers; the Meteor against two troops. Over the
  three rounds the offers always allow a playable deck (at least one tank or
  win condition, at least one air answer).
- Cards still locked in Quest (unlocked per boss) never appear.
- Online co-op: the host picks, the partner's taps show as suggestions, like
  every other Quest choice. No starting charm.

## Roster: eight new troops (our call; "tank" marked)

Ids are stable and lower case. Four women, four men, eight eras; no
silhouette repeats an existing figure's.

| Id          | Name        | Era / look                                                        | Role                                                                                                         |
| ----------- | ----------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| diver       | Diver       | 1890s brass deep-sea diving suit, round helmet, weighted boots, a wrench | **Tank**, 5 elixir. Fights troops and towers. Armour: every hit on him loses a flat amount, so swarms and arrows barely scratch him. Slow. Man. |
| sumo        | Sumo        | Edo-era sumo wrestler, mawashi belt, topknot                      | **Tank**, 6 elixir. Huge hit points, very slow. Lands with a stomp that makes nearby enemy troops target him for a few seconds (taunt); his slaps knock troops back. Ground only. Man. |
| linebacker  | Linebacker  | 1950s American football, leather helmet, big shoulder pads        | **Mini-tank**, 3 elixir. Fast for a tank; her first hit on each new target is a tackle that knocks it back and stuns it briefly. Ground only. Woman. |
| beekeeper   | Beekeeper   | 1920s countryside beekeeper, veil hat, smoker, hive box on her back | **Spawner**, 4 elixir. Fragile; every few seconds releases a small swarm of bees (tiny flyers, fast, low hit points) while she walks. Woman. |
| drummer     | Drummer     | Napoleonic-era drummer, shako, snare drum                         | **Support**, 3 elixir. Never attacks; friends near him move and strike faster (a beat aura). Follows the nearest friend like the Medic. Man. |
| firefighter | Firefighter | 1930s fire brigade, brass helmet, hose with nozzle                | **Control**, 4 elixir. A short water jet in a cone: steady damage and pushes ground troops back. Ground only. Man. |
| jetpack     | Jetpack     | 1960s retro space-age rocketeer, bubble helmet, jetpack           | **Air fighter**, 4 elixir. Flies, fast, fragile; quick blaster shots at air and ground. Woman. |
| explorer    | Explorer    | 1910s polar explorer, fur parka hood, goggles, ice rifle          | **Slow**, 4 elixir. Ranged frost shots at air and ground; each hit slows the target's moves and attacks for a moment. Woman. |

Bees: a spawned unit (`bee`), not a card.

## Who owns what (agents working at the same time)

Several agents edit this tree at once. Re-read a file right before editing
it; never revert, reformat or "clean up" someone else's lines; never
`git stash`, `git checkout --` or commit. Run `npx oxfmt <your files>` only
on your own files (never `npm run format`). Add your own test file
(`tests/arena-<topic>.test.mjs`) instead of rewriting shared ones.

| Agent          | Owns                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| troops-engine  | `lib/games/arena/cards.ts`, `engine.ts`, `bot.ts`, `decks.ts`, card stats and abilities, Quest pools in `quest.ts` (`LOCKED`, `STARTING_POOL`, rewards), `arena-rules.tsx`, the Cards section of `docs/arena.md` |
| figures        | `assets/arena/blender/figure_<new id>*.py`, `components/game/arena/moves/<new id>.ts`, `moves/index.ts`, new ability effects in `effects.ts` (bees, water jet, frost, drum beat, taunt, armour sparks), sound fallbacks in `sound.ts`/`audio.json` for the new troops |
| portraits      | `assets/arena/cards/card-<id>-v7-*.png`, `CARD_ART` in `scripts/arena-assets.mjs`, the cards part of `assets.json` |
| walk           | the shared walk in `components/game/arena/troops.ts`, `lib/games/arena/gait.ts`, `moves/types.ts`; walk-only tweaks in existing `moves/<id>.ts` |
| world          | `terrain.ts`, `world.ts`, `materials.ts`, `static-batch.ts`, `assets/arena/blender/towers.py`, `masonry.py`, `props.py`, `forest_kit.py`; the Meteor's flight in `effects.ts` |
| draft          | Versus: `arena-box.tsx` deck/draft parts, `deck-editor.tsx`, new `lib/games/arena/draft.ts` and draft UI, the loading-time deck picker in `arena-game.tsx`, the online draft and deck phase in `server/arena.ts`, `room.ts`, `online.ts` |
| quest          | Quest start (`quest.ts` start screen and actions, no charm), its UI and the whole map in `quest-view.tsx`/`quest.css`, new map paintings, the online Quest start in `server/arena.ts` |
| cardinfo       | new `components/game/arena/card-info.tsx` (stats panel and the card browser), the hover in `arena-game.tsx`/`view.ts` picking, the Cards button in `arena-box.tsx` |

`scripts/arena-assets.mjs` rewrites the whole manifest: take the lock
before running it and release it after
(`until mkdir /tmp/arena-assets.lock 2>/dev/null; do sleep 5; done` …
`rmdir /tmp/arena-assets.lock`), and always pass `--only=` with your part.

Verification: the shared dev server runs on http://localhost:3017 (do not
start or stop it). Another agent's half-finished edit may break it for a
minute; retry before blaming your change. Use your own headless Chrome on a
private port in the 97xx range with its own profile, `--mute-audio`,
`--enable-gpu --use-angle=metal` (see the headless notes in memory);
`window.arenaDebug` drives battles in development. Only the main session
uses the Browser pane.
