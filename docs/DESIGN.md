# Gamehub design direction

## Real ambience recordings; Nox passes five (12 October 2026)

William tried a soundscape layered from six generated 30-second ElevenLabs
loops for Nox and found it, and every older soundscape, poor. All of them are
gone: the Freesound snippets cut by `build-ambience.mjs`, the ElevenLabs beds
and details, the new layers, the Sound Lab's mixer and the scripts behind
them (in the art archive, `retired-soundscapes-2026-10-12`). Each world now
plays **one real field recording** found online, quietly, with nothing
layered on top; the player crossfades random windows of it so it never loops
audibly. Sources and licences are in `public/audio/ambience/CREDITS.md`. The
Sound Lab plays a world's recording with one Play button.

Nox passes **five cards, three on the Fast deck**, at every seat count, as
Papayoo does.

## Sound: every game synthesised, one shared Your turn (11 October 2026)

William liked how Diner's sound is made, so every game's sound effects are now
synthesised in the browser the same way (`lib/games/sound`): oscillators,
filtered noise, FM bells, plucked strings and a small room, nothing
downloaded. Each game has its own sounds in its own material: Nox cards on
ship's timber, a brass bell and a concertina; Mora paper, moss, a wooden
flute and birds; Yata bamboo, porcelain, a koto and a wind chime; Know Me a
retro studio (console buttons, electric piano, brass), with a dial for Dial
and coins for Ten Coins; Quiz a measuring desk (ruler ticks, enamel stamps,
a tape measure, xylophone), with its own select sound for Atlas, Sizes,
Years and Order; Impostor pencil, cork pins and late-night vibraphone and
bass; Puzzles a pencil, a rubber stamp and a celesta; Lucky glass, coins and
a marimba; Rota sleepers, rails and a steam whistle; Alto console blips,
docking clamps, a sonar ping and a synth pad. Diner keeps its own.

- **Your turn is the only shared sound**: three rising glass chimes, and a
  soft amber glow that breathes in round the edge of the screen
  (`components/game/turn-signal.tsx`, mounted once in the root layout). The
  glow shows with sound off, never takes a tap and has no words.
- **Arena's troops keep their recordings.** William heard the synthesised
  troops and asked for the originals back: every troop's arrival, attack,
  fall, abilities, shots and blasts are the ElevenLabs clips again, with the
  newer troops borrowing as before. Arena's cards, towers, clock, Meteor,
  end stings and Quest cues are synthesised, and its music stays recorded.
- **Lucky never hisses.** Buying a ticket (a coin in the slot), moving or
  placing a machine (two soft marimba notes) and a losing ticket (a gentle
  two-note fall) are tones only; the crumple of noise is gone. The foil
  scratching still follows the finger.
- Every cue is loudness-matched to the old clips' levels:
  `node scripts/sound-levels.mjs` renders each one offline and writes
  `lib/games/sound/levels.json`; run it after changing a cue (`--check`
  reports drift). The recorded ambience beds are unchanged.
- **Sound → Sound Lab** plays every game's sounds, Your turn with its glow,
  Arena's troop recordings and music, and Diner's cues and jukebox. The old
  ElevenLabs effect clips and their sources are in the art archive
  (`gamehub-art-archive/public/audio`, `assets/audio`, `assets/arena/audio`).

## Arena: cartoon card portraits (10 October 2026)

William's review of v13: the painted portraits looked like real people, with
realistic colouring; the Cowboy was the best because it is more stylised and
a little cartoony. Every card except the Cowboy (the Samurai too) and both
library covers are regenerated (v14) in one cartoon look, a notch more
cartoony than the Cowboy and in the same world as the 3D figures: sturdy,
chunky shapes, adult heads only slightly larger than life, simplified
expressive faces (ivory eyes, dark pupils, bold brows, clear mouth shapes),
matte surfaces and saturated but never garish stylised colour, never
photographic skin or lighting. Still text only, two variants each, the pick
recorded with every prompt in
[concepts/2026-10-10-arena-portraits](concepts/2026-10-10-arena-portraits/README.md).
The card framing is unchanged (top-left fifth free for the cost badge), so
`CARD_ART` in `scripts/arena-assets.mjs` only points at the new files. The
covers are served as `box-arena-blind-v3` and `box-arena-wide-v3`. The Cowboy
(v10-b) is now the most realistic card of the set; it still sits with the
others at hand size.

## Library: footage at a true 60 fps, a staged Arena battle (10 October 2026)

William found the footage choppy, about 5 frames a second. Measured, the old
clips were 30 fps with only 16 different pictures a second (Arena wide: 164
of 300 frames), and the 3D games played at a third of their speed. Two bugs
in `scripts/reels/record.mjs`: frames were read through a concat list whose
times ffmpeg rounds to 1/25 s, so no clip could hold more than 25 different
frames a second; and DevTools' `Animation.setPlaybackRate`, used to slow CSS,
also slows the frame times games read, so a game filmed `slow` 3× ran 9×
slower and the sped-up clip was still in slow motion. Every clip is now:

- **60 fps with 60 different frames a second.** Each of the clip's 60 slots a
  second takes the newest screencast frame by then, fed to ffmpeg as an exact
  60 fps sequence. A take logs how many different frames a second it kept;
  `minFps` 55 re-films a moving 3D game, slower each time (`slow` up to 24).
  3D games film at `slow` 8 (Arena: ~150 frames sent a game second, 59–60
  kept). A keyframe every two seconds.
- **At the game's own speed.** The page's clocks, timers and CSS/Web
  Animations are slowed together in the page; the Arena take checks its
  match ran 30 ticks a game second (10.00 game s in 80 real s at 8×).
- **Cuts follow the master's compression**: a driver's `crf` now applies to
  its 720p cut too, and the 360p cut two steps above it (`scripts/reels/tiers.mjs`),
  so a phone's 720p clip of a busy 3D game stays well under the master.
  Arena at crf 30: 4.3/4.0 MB wide/tall masters, 1.8 MB 720p, 0.4 MB 360p
  (were 5.9/5.1, 3.6, 0.7 MB).

**Arena's clip is staged** (`scripts/reels/games/arena.mjs`): the bots are
off and a fixed schedule of real card plays (and two Meteors) runs on match
ticks, so every take shows the same ten seconds on the game's own camera.
It opens calm with a red Samurai and two Cadets already marching down one
lane; blue answers with Robots half a second in, the other lane wakes at
1.6 s, and both sides keep dropping troops until battles rage at both
bridges, a Meteor crashing into each (about 6.8 and 8.4 s), ending with some
nearly 30 troops on the field. Troops have 1.6× hit points on both sides so the
fights build instead of trading one for one.

**Diner's clip is six quick cuts** (`scripts/reels/games/diner.mjs`, joined
with hard cuts by the driver's `cut`): 1⅔ s each of a busy patio on the
game's own camera, played by the game's bot from fixed seeds and ticks found
in Node: seating a conga line (truck stop), taking a shake and fries at the
hatch (drive-in), serving pie (fairground), clearing, a skate dash and the
sink (harbour), Out! on a mimic that pops into goo (drive-in at night), and a
brownout and the jukebox (Moon Mile). The tall clip is the sideways phone's
own framing turned a quarter clockwise, since upright the game shows a thin
strip of deck. 60 unique frames a second; crf 26: 2.4/2.3 MB, 1.2 MB 720p,
0.4 MB 360p.

**Lucky's clip is seven quick cuts** (`scripts/reels/games/relic.mjs`, 14.6
s, hard cuts) on fresh development workshop desks: five tickets won on the
perfect line, each scratched most of the way through the real commands and
finished on camera with real strokes, ending in a jackpot paying out (a miss
pointing at the last 7, two Twins pairs, a Garden path in one stroke, a Gold
Mine dig that opens a patch of ground, a Sea Chart ship sunk); then the
factory on its own 3D camera, close on a working line and pulling back to
the whole floor; then the upgrade tree, a little over half bought (staged
over the workshop's ranks), the camera gliding across the paths to the Sun &
Moon prize, bought, which opens Almanac, bought too. Ticket and tree shots
move the page as a camera, all on the page clock. 59–60 unique frames a
second; crf 26: 6.5/6.3 MB, 3.4 MB 720p, 1.1 MB 360p.

**Puzzles' clip is a run in seven cuts** (`scripts/reels/games/folio.mjs`,
15.4 s, hard cuts), each staged from a prepared save (a seeded run or
practice puzzle from the engine, written over a fresh one in the dev
database) and finished with real inputs: the route, the camera gliding up
the red trail to the open stops as the host picks Word guess; the word
landing and circled in red; a Nonogram sailboat's hull drawn and printed; the
last Connections band; a Sudoku row filled; a Minesweeper dig clearing the
field; then the trail rising to the boss, picked, and pulling back to the
act. A page camera on the page clock, filmed 4× slow (6× for the map); 60
unique frames a second; crf 26: 4.7/4.1 MB, 2.6/2.3 MB 720p, 0.8/0.7 MB 360p.

## Library: shelves without paging, played last first (10 October 2026)

William tried a full-screen footage with one row of nine covers under it
the same day and preferred the 9 October layout, so on wide screens the
cover grid stays beside the footage (covers left, footage right) by his
choice. This supersedes the shelf paging, the order and the Play plate's
place in the 9 October section below.

- **The Play plate sits in the footage's bottom-right corner**, not its
  middle, so the game playing is never covered. Same plate (glass at rest,
  brass and a little larger on hover or focus, **Play with friends** with a
  people icon), smaller: a 40px button and the word on wide screens, inset
  14–24px; on phones only the 38px brass button in its glass ring, 10px in
  from the corner (clear of the rounded edge; on Nox it sits in the empty
  end of the hand tray). The whole footage still opens the game.

- **Shelves show every game at once** on landscape screens: tiles shrink so
  six fit across (Quick games has six) and every shelf shares that size, at
  most 232px, with no arrows (dragging stays). A tile narrower than 200px
  stacks the time over the kind, as phones do, so no kind is cut. Portrait
  tablets and phones keep the paging shelf. Measured tiles: 180px at
  1280×800, 205 at 1440×900, 215 at 1920×1080.
- **Played last comes first.** The showcase's covers and every shelf put the
  games this browser opened from the library most recently first, then the
  never-played ones in the documented order (`lib/games/library-recent.ts`,
  `gamehub.last-played.v1` in local storage; blocked storage reads as
  nothing played). The footage starts on the first of them. The order is
  read once as the library mounts, which is before its first paint (the
  page renders only in the browser), so nothing reshuffles in view; a game
  opened now moves up the next time the library shows.

## Diner: a subtler cook, and public (10 October 2026)

- **A subtler cook.** William found the 9 October Diner covers' server too
  feminine. He keeps some softness but reads clearly as a young man at first
  glance: a plainly masculine face (jaw, chin, straight brows, no eyeliner or
  long lashes), a warm boyish smile and neat styling, a light skater's pose
  instead of a dancer's. Fresh text-only square and wide covers from the
  accepted prompts with only his description changed (`box-diner-blind-v4`,
  `box-diner-wide-v4`); prompts, variants and the pick in
  [concepts/2026-10-10-diner-cook](concepts/2026-10-10-diner-cook/README.md).
  The in-game waiters never had that treatment and are unchanged.
- **Diner is public.** The development-only gate (`isGameAvailable`,
  `lib/games/availability.ts`) is gone, with every check behind it: the
  library entry, shelves and showcase, footage, the `/diner` and
  `/api/diner` routes, the table's room launch and lobby vote, the solo,
  room and table setup boxes, and the production asset allowlist, which now
  ships Diner's covers, stickers, postcards and footage. Diner sits fourth in
  the library (Arena, Rota, Mora, Diner, …) and on the Stay a while shelf.
  `/diner/lab` stays development-only.

## Rota: covers about roads and trains (10 October 2026)

William found the 9 October mill-town covers generic and too zoomed out, and
the "ROTA" lettering generic. Both covers (square `box-rota-blind-v5`, wide
lid `box-rota-wide-v5`) now show what you do in Rota, framed close: a
top-and-tail goods train mid-route on a curve, points into a siding, a level
crossing, a station, a brick road bridge over the cutting, and a new street
square floating down onto its glowing plot with dashed chalk lines where the
routes go next. The title is **Rota** (capital R, lowercase o-t-a) in cream
enamel letters with a crimson outline and a railway line down every stroke,
the t's crossbar a level crossing, the a turning into a cobbled street, and a
small train riding the word.

- **Drawn as the game's own pieces.** The prompts describe, in words, the
  board and models from the code: the site's sage grass and cinder with
  chalk survey lines and glowing legal squares, setts between kerbs with
  flagstone pavements, single track on cinder ballast, the brick overpass
  with sandstone coping, the white-and-red crossing gates, the red-brick
  station hall with its canopy on maroon brackets, 2-6-2 tank engines and
  planked vans in the seat liveries, red-brick terraces under slate.
- **Palette: the middle ground.** v3 was a brown, grey dusk; v4 a vivid
  bright day with lime grass. v5 is soft late-morning daylight under a pale
  blue sky, sage and olive greens, warm brick and slate, crimson, navy and
  bottle-green liveries: moderately saturated, like a model-railway diorama.

Prompts, the code mapping and every pick:
[concepts/2026-10-10-rota-covers/README.md](concepts/2026-10-10-rota-covers/README.md).

## Quiz: Tower by placement, a drafting Expedition (10 October 2026)

William's request: Tower should be about placement, not points. Points felt
unfair, the best answer taking most and everyone else barely anything. Tower
and Expedition should last 4 or 8 rounds, and the host should be able to play
4 more at the end. He did not understand Expedition at all: replace it with a
simple draft. Supersedes Tower's floors and Expedition's routes in the
4 October Trivia section, and the scoring numbers in the 2 October Quiz
section.

- **Length.** Setup's **Rounds** row offers **4** or **8** for Tower and
  Expedition (it takes the place of Next round, which only Quick Play has, so
  the setup keeps its height). Every four rounds play each of the four games
  once, in the host's order. After the last round the host's pick is
  **4 more** or **End**: 4 more carries on with the same towers or
  collections for another four rounds, up to **12 rounds** in a match (the
  party round limit, which also keeps the prompts fresh). The round pill
  reads round / planned rounds and grows with 4 more.
- **Tower by placement.** A round's points only decide where you finish in
  it. First place earns as many blocks as there are players and each place
  below one fewer: 4/3/2/1 with four players, 6/5/4/3/2/1 with six (the
  most Quiz seats), 2/1 with two. Tied players share the higher place and
  the places below carry on counting: two tied first of four get 4 each and
  the next gets 2. Last place always earns at least one block. Each block
  is a floor; the tallest tower wins, total points break a tie, and an
  exact tie is shared. The badge counts floors and round wins.
- **Expedition is a draft.** In one sentence: *finish higher to pick first,
  and collect finds; the more of one kind you hold, the more each is
  worth.* After each round the camp lays out **one find more than there are
  players**. Everyone picks one, in the order they finished the round: the
  winner first, last place from the last two, and the find nobody takes is
  lost. Tied players pick in order of who is behind on the expedition, then
  fewer total points, then seat order turning each round. Four kinds:
  **Crystal** (cobalt), **Fossil** (tomato), **Gold** (sun), **Fern**
  (green). One find in every offer is **big** and counts as two of its kind.
  A kind with n finds scores 1 + 2 + … + n (1, 3, 6, 10, 15, 21), so
  building one kind pays, and collections are public, so taking the find
  the leader needs is a real choice. The best collection wins, then total
  points, then the tie is shared.
- **Pacing.** A pick is that player's own decision: the table waits for
  whoever's turn it is and nobody presses Next between picks. The host's
  pick of the next game opens once the last find is taken and works as
  before. Each pick is one atomic move keyed to the draft step.
- **Look.** Expedition is a field camp on the measuring desk: the offer lies
  on the green cutting mat as glossy enamel specimens under the lamp (a
  faceted crystal, a spiral fossil, a gold nugget, a pressed fern), the big
  find larger with a halo. The pick order is a row of avatars with their
  place; the picker's is lifted and glowing, and only their offer is live.
  Every player has a specimen case with four compartments that fill as they
  pick, with the collection score on it. A taken find drops into its case.
  Tower keeps its 3D arcades, which now stack up to 72 floors (six players,
  twelve rounds), and its ledger shows each round's new blocks. The
  trail-and-travellers 3D world remains only for older saves.
- **Scoring is proportional.** Every Quiz game still scores up to 100 a
  prompt, now with no cliffs: each step closer is worth about the same, and
  nothing only comes where a guess shows no real knowledge.
  - **Atlas**: 100 within 50 km, 78 at 300 km, 62 at 600 km, 44 at
    1,200 km, 22 at 2,500 km, nothing at 4,500 km (was 72, 52, 30, 10 and
    nothing at 4,000 km).
  - **Sizes**: 100 within 10%, 84 at ×1.25, 62 at ×1.5, 34 at twice or
    half, 14 at ×2.5, nothing at three times (was 48 at ×1.4 and nothing
    at twice).
  - **Years**: counted years off (a fifth before 1800, half from 1800 to
    1949) score 100 exact, 94 at one, 84 at three, 72 at six, 55 at twelve,
    30 at twenty-five, nothing at fifty: nothing at 250 years off before
    1800, 100 from 1800 to 1949, 50 since 1950 (was 80 at one year and
    nothing at thirty).
  - **Order**: every pair the wrong way round costs 25: 100, 75, 50, 25,
    then nothing (was 100, 50, 20, then nothing).
  The 2 October model (weak / average / strong player, points a prompt)
  moves from Atlas 31 / 50 / 71, Sizes 42 / 55 / 73, Years 25 / 43 / 63,
  Order 43 / 62 / 83 to Atlas 40 / 59 / 77, Sizes 60 / 71 / 84, Years
  46 / 65 / 82, Order 63 / 78 / 91; a weak player's zero scores fall from
  15–25% of prompts to 6–12%, and a blind guess still earns 2–27. Know Me
  already scores closeness in even steps (Top Five 2/1, Ten Coins two a
  coin, Dial's 4/3/2 bands) and is unchanged.
- **Older saves.** New matches carry Trivia rules **3**. Rules 2 Tower
  (a floor per 100 points, two more for the round's best) and route
  Expedition saves, and the older shop saves, keep loading and finish under
  their own rules, with their own help and 3D. The four games keep their
  rules markers; a round in progress scores its remaining prompts on the new
  curves.

## Library: covers on the left, the footage is Play; Folio becomes Puzzles (9 October 2026)

William's review of the library (supersedes the parts of the 8 October
section it names):

- **Covers left, footage right** on wide screens, as on phones. The cover
  grid still fills the footage and caption's height exactly.
- **The footage is the Play button.** The Play button under it is gone; a
  Play plate sits in the middle of the footage (glass at rest, brass and a
  little larger on hover or focus; **Play with friends** with a people icon
  on a With friends game), and the whole screen opens the game. Under it sit
  only the name, time and kind, on one row on wide screens.
- **Kinds may be two words** when one word says too little: Trick taking,
  Card drafting, Set collecting, Mind reading, Best guess, Draw & bluff,
  Brain teasers, Scratch cards, Tower battle, Roll & draw, Engine builder,
  Serving rush. At most two words and 14 characters; on a phone tile the
  kind stacks under the time so it is never cut.
- **Order**: Arena, Rota, Mora, Diner, Alto, Yata, then Nox, Puzzles and
  Lucky; the With friends games close it, Trivia, Impostor, then Know Me.
  The shelves follow the same order.
- **Drag to scroll.** A mouse can hold a shelf and drag it sideways, like a
  finger; letting go after a drag never opens a card (`useDragScroll`,
  `components/game/use-drag-scroll.ts`).
- **Folio is called Puzzles** in public (title, box and wide covers, menus
  and messages); its id, route and saves stay `folio`. Its covers, Rota's
  (now its model-railway mill town) and Diner's (a slim, softly effeminate
  young man as its cook) were regenerated the same day.
- **Footage is filmed at 1080p** (1920×1080 wide, 1080×1920 tall) so it
  stays sharp on large screens.

## Arena: one painted card set, a bigger Dino, shots you can see (9 October 2026)

*Card portraits superseded on 10 October 2026 by the cartoon set (v14) above;
the rest of this section stands.*

William's review: the card portraits were two sets, the semi-realistic painted
look of the Samurai and Cowboy beside flatter cartoon v7 art. He prefers the
painted one, so every card except those two is regenerated in it (v13). **Card
art is generated from text only, never from a base or reference image**: a
first pass that restyled the v7 cards from the images themselves (v11, v12)
came out yellower and worse and was rejected. v13 uses one shared style
paragraph written from the Samurai and Cowboy prompts, with an explicit
neutral colour balance, and each card's written subject (prompts in
[concepts/2026-10-09-arena-portraits/v13](concepts/2026-10-09-arena-portraits/v13/README.md)).

- **Dino** is drawn 12% larger than the other figures (`FIGURE_SIZE` in
  `components/game/arena/troops.ts`; drawing only, its footprint and reach
  in the engine are unchanged).
- **The Inventor's lightning** leaps from her wand's tip to the target as she
  thrusts it: a jagged, forked ribbon (a blue glow round a white core) that
  re-forks every few frames and fades in about a fifth of a second, with a
  flash at the wand. Chain jumps draw the same bolt. The shot itself was a
  dot crossing the field in one frame, so nothing showed before.
- **Guns flash.** Every troop shot now goes off with a flash and sparks
  where it leaves (smoke for the rifle, the cannon and the frost gun), and
  ray guns, the rifle and the frost gun fire from the barrel's end (the
  weapon part's far tip, measured once per figure) instead of the chest.

## Lucky: level IV, upgrade tiles, a guide beside the ticket (9 October 2026, evening)

William asked for a more premium name than Boss, upgrades that pop instead of looking faded, the ticket guide beside the ticket on desktop, tickets that can simply lose, and a few factory editor touches. This supersedes the Boss, upgrade-colour and guide notes of the section below.

- **IV.** The fourth difficulty is simply **IV**, the same numeral style as I–III, but it reads as more: a dark sapphire chip across beneath I II III, a sapphire gradient when chosen, on the ticket's badge and in the toast that opens it. Until it opens it shows only a lock, so what it is stays a surprise. (Briefly named Diamond the same evening; internal IDs stay `INFINITY_AT`, feed kind `infinity`, CSS `is-four`.)
- **Upgrade tiles, not medallions.** The six paths stay side by side on one page on desktop, but each is a column of tiles in tree order (Books twice as wide: each book's prize beside its helper, one book per row), all on the same eight-row grid so tiles line up across paths. A tile is a rounded enamel square in its path's deep colour (`RICH` in `relic-scratch-upgrades.tsx`; book tickets sit inside it, never spilling out), the name, what it gives now in the path's colour (×2.2, 30%, every 7th; bare numbers keep their label), a bar of ranks and the price (a lock when it is not open yet, a check when maxed). Affordable tiles have a cream edge and a small arrow; the selected one wears its path's colour. Each path's header carries a thin progress bar. The lines of the old tree are gone; the bar below still says what an upgrade needs first. Phones and short screens show one path at a time, tiles flowing into as many columns as fit.
- **The guide stands beside the ticket** on wide screens, at the top of the rail above the hearts or payout and Buy, so the ticket is bare. Phones and portrait tablets keep it on the ticket's heading. Both slips share one hidden-per-book setting.
- **Tickets can lose.** Insurance is gone: a ticket that pays less than it cost is a loss, shown as such. Its Shop slot is now the **Loyalty card** (every 10th, 7th, then 5th ticket bought is free, any book). Saved Insurance ranks were refunded. When the purse cannot pay for any ticket, Buy turns green and becomes **Free · Lucky Seven I** (the house ticket), and the Lucky Seven book wears a green rim.
- **Factory tools: select, erase, pan.** Pan sits in the tool rail beside select and erase, only one of the three is on, and **Space** (or P) toggles it; its key hint is a drawn space-bar mark. Undo and redo show ⌘Z / ⇧⌘Z (Ctrl Z / Ctrl Y elsewhere) only while ⌘ (Ctrl) is held. A selection box is a brighter fill with a solid cream-gold edge drawn over the machines, and the machines it would pick are marked while you drag.

## Lucky: calm colour, a Boss level, a guide on every ticket (9 October 2026, later)

William found the ∞ treatment boxy and too vibrant, the factory clashing with the chill green interface (too bright, oversaturated, flying coins), the upgrade tree too golden, the charm's spin jumpy and the lamp meaningless. He then asked for the fourth difficulty to read as the hardest level rather than ∞, for the XP a ticket earns to be shown, and for a hideable how-to on every ticket. This supersedes the ∞ and colour notes of the section below.

- **Flat, full colour, no bling.** The interface is solid enamel colour: no gold halos, rainbow foil or glowing text. Buy and the payout are flat cream; a selected book keeps only its gold rim. In the upgrade tree every disc is a solid fill; an upgrade you can pay for wears a **cream ring** and a cream price, the selected one a ring in its path's colour, and a maxed one is flat gold.
- **The Boss.** The fourth difficulty is the book's **Boss**: a skull and the word Boss, in the stamper's muted brick red, on the book (across beneath I II III), as the ticket's badge and in the toast that opens it. No halo; a Boss ticket looks like any other. Internal IDs stay (`INFINITY_AT`, feed kind `infinity`).
- **XP on the payout.** Under the coins, a green strip counts up the XP the ticket earned and shows the book's level bar it fed.
- **A guide on the ticket.** Every ticket carries a cream slip of two short rule lines (shared `RuleList`) laid over its painted heading, above the panel or beside it on Sea Chart, never on the cells, so play goes on with it open. It shows on the blank ticket too, so you read it before buying. The × hides it for that book (remembered in the browser); a book button brings it back. Facts you cannot work out stay in view either way: Ladder's cards (1–N), Gold Mine's dynamite count and Sea Chart's fleet. On phones, Sea Chart's slip sits just above the ticket.
- **A factory in the desk's greens.** The floor is pale sage stone, the frame bottle-green enamel with a satin brass cap (no chasing bulbs), the machines the same hues muted, satin rather than lacquered, lit a little lower. Booster squares are faint. A sale shows only its total popping over the cashier: no coins fly, no gold burst.
- **Turbo, not a lamp.** The lamp machine (ID `lamp`) is now a **Turbo**: a squat violet engine drum whose three-bladed cream rotor turns slowly at rest and spins up while it speeds its neighbours, a speed dial whose needle swings into the red, and eight arrows round its foot pointing at the cells it reaches. Boosters ease their energy and accumulate their spin, so neither the Turbo nor the charm's clover ever jumps when a neighbour starts or stops.

## Lucky: one desk, the factory full size (9 October 2026)

William found the factory too small and the interface around it disconnected from it, and asked for the whole Lucky interface to be rethought, keeping only the tickets as they are shown (large). He also asked for a fourth, endless difficulty and for book levels earned by how well you play (see the rules section of [relic.md](relic.md)).

- **One desk.** Every view sits on the same painted green desk under one warm lamp. The factory is a toy model standing on that desk, its soft shadow drawn under the frame, not a box floating in a dark void. Every control is a plate from the factory's own set: bottle-green enamel, a brass rim and cream lettering; the selected tab and tool are cream enamel like the floor tiles.
- **The factory fills the screen.** The 3D floor is full bleed and the camera fits it in the space the floating controls leave (`setInsets` on the world, measured from the top bar, the dock and the tab bar), so it is about a quarter wider on desktops and much taller on phones. The machines sit in a brass tray along the bottom (tools, then the ten machines in palette order); the bar naming what is held or selected appears just above the tray, beside the view controls, and is empty when nothing is held. On phones only Fit stays (pinch zooms). The factory stays built while another tab covers it and stops drawing, so switching back is instant.
- **Tickets: pick, then Buy.** Tapping a book on the shelf picks it (and shows its blank ticket); its difficulties sit on the book, I II III in a row and **∞** across beneath them, a dark foil strip with a rainbow edge. One button beside the ticket buys the picked book (**Again** when it is the same as the last), so it never moves; Enter does the same. The ticket keeps its size; its hearts or payout and Buy sit right beside it on wide screens and in one row under it on phones and portrait tablets, where the shelf becomes a strip on top. An ∞ ticket is held in a slow rainbow halo.
- **∞ and skill levels.** Every book gains a fourth, harder difficulty, ∞, which opens once the book's level 3 is complete. Book levels now come from XP earned by how well each ticket is played against its average (none for a poor one), weighted I 0.1, II 0.25, III 0.5, ∞ 1, so easier tickets still level a book, only slowly. The payout shows the XP earned, and opening ∞ is announced like a level. Numbers in [relic.md](relic.md).
- **Where hands are.** Desktops keep the three tabs at the top centre beside the purse. Phones and touch tablets move them to a tab bar at the bottom, under the thumbs, with the purse in the middle of the top bar; Buy, the machine tray and the upgrade Buy all sit just above it.

## Lucky: a factory you can tell apart and edit like a drawing (8 October 2026)

William found every factory machine too alike to tell apart, and moving, placing, removing, editing and turning them unintuitive. He asked for a free rework (machines included), kept in 3D, with existing factories migrated, multi-select and copying, and as easy to work with as possible. The brief and the before/after review are in `docs/concepts/2026-10-08-lucky-factory-rework.md`; details in [relic.md](relic.md).

- **Every machine owns a colour and a silhouette**: cobalt printer with its paper roll, orange scratch robot, emerald cashier under a gold coin sign, charcoal belts and splitter with yellow chevrons, violet lamp, red stamper press, gold gilder drum, lilac charm with a clover, kraft-and-magenta bundler. The shared gold plinth is gone; each machine stands on a pad tinted with its colour, on a warm, lighter workshop floor. Intakes are dark mouths at the back, outlets orange-lipped chutes at the front, always visible.
- **Fewer, clearer machines**: ten (the ink well is gone). Boosters reach the eight cells around them and light that square: the lamp speeds printers and bots, the charm adds star tickets. The stamper (×1.3) and gilder (×1.6) work on any ticket, once each. Old factories migrate: ink wells become lamps where they stood.
- **Editing works like a drawing app**: one finger or the left button acts, two fingers or the right button move the view. Tap selects, drag moves (the whole selection with it), dragging empty floor box-selects, a selected machine's orange handle pulls a belt out of it. Held machines face the flow by themselves; belts are drawn along a drag and re-route belts they cross. Groups rotate as a whole. Copy, paste, duplicate and cut carry directions and books; undo and redo cover every change and cost nothing, because removing refunds exactly what building charged.
- **The bar under the floor** names what is held or selected, its state in one word and its labelled actions (Rotate, Copy, Delete with its refund, Place on touch); with a mouse it names the machine under the pointer. Ghosts show in the machine's own colours, red where they cannot go; boosters show their reach while held or selected.

## Library: gameplay footage and three shelves (8 October 2026)

William found the box shelf obscure: a cover does not say what playing is
like, or whether you can start alone. A first round tried live code-built 3D
dioramas; he dropped them the same day for **real footage of each game**
(the diorama code is in the art archive, `retired-dioramas-2026-10-08`).

- **Footage.** Every game has a short silent clip of itself playing, with its
  interface hidden (no top bar, badges, round pill, menus, docks of buttons or
  notices; the board, pieces and the hand stay). Each game is filmed twice:
  **wide** on a 1280×720 desktop screen and **tall** on a 390×693 phone
  (encoded at 1920×1080 and 1080×1920 since 9 October 2026), so
  each device sees the game as it would play it there. Clips live in
  `public/reels/<id>-wide|tall.mp4` with a first-frame `.jpg` still, listed in
  `lib/games/library-reels.ts`. `scripts/reels/record.mjs <id>` re-films a
  game against the dev server (one driver per game in `scripts/reels/games/`:
  the CSS it hides, how it gets into a match, and how it keeps playing, using
  the game's own bots for your seat where possible). Re-film a game when its
  look changes. Clips stay under 8 MB (most 10 s clips are 1–6 MB at crf
  23; a driver may set its own `crf`). On a loaded machine a driver's `slow`
  runs the page's clock slower so 3D games still film smoothly, and `minFps`
  re-takes a scene that captured too few frames (60 fps since 10 October
  2026, see that section). A game
  that holds several games or boards films them as `scenes` joined by short
  crossfades (9 October 2026): Know Me shows Top Five, Dial and Ten Coins,
  Quiz all four of its games, Folio four puzzle kinds and Mora each board,
  each scene a choice made with real input and then its scoring. Rota films
  the default map without water; Yata shows its real cards with extensions
  on.
- **Showcase** (`components/game/library-showcase.tsx`): the current game's
  footage on a big screen (the tall clip on a portrait phone), every game's
  cover beside it to pick from, and the name, time, kind and one **Play**
  button beneath the
  footage, never over it, since hands of cards sit at the foot of most games.
  Each clip plays once and the next game follows; hovering or focusing the
  showcase keeps the current game looping. A bar on the active cover fills as
  the clip plays. Games without footage show their cover for seven seconds.
  Reduced motion shows the still and never advances. **Play with friends**
  (people icon) on a With friends game. Games you can play alone come first
  in the covers, the With friends ones last with a people badge. On wide
  screens the cover grid never scrolls: the showcase solves its width and
  column count (`--rail-w`, `--rail-cols`) so the covers fill the footage and
  caption's height exactly, however many games there are, and a wheel over it
  moves the page. On phones the covers are a column left of the footage that
  scrolls, with a button beneath it for the next page (back to the top at the
  end), and **Play** keeps the name's row so it never moves (9 October 2026).
- **Cards** (`GameCard`, `components/game/game-card.tsx`) are the square
  covers, which carry the game's title, so no name is printed under them;
  only the time and kind chips. On a desktop, hovering a card lifts it and
  plays the wide footage inside the square (cropped from the middle); the
  clip loads the first time it is wanted. Touch screens, data saver and
  reduced motion keep the cover.
- **Three shelves.** **Quick games** (Arena, Nox, Mora, Yata, Rota, Alto: one
  match), **Stay a while** (Arena's Quest, Lucky, Folio, Diner: runs, shifts
  and a factory you come back to) and **With friends** (Impostor, Know Me,
  Quiz: the human-only games, from `isHumanOnlyGame` in
  `lib/games/player-policy.ts`, so the shelves look the same in development).
  A game with a second, longer way to play (`longMode`, Arena's Quest) sits on
  both of the first two shelves; its chip shows only the match time (the
  Quest time is not shown). A table lobby shows the same games as two
  shelves, Party first, then Games.
- **Stats.** The library shows only time and **kind**, never the player count.
  Kind (9 October 2026, replacing the Easy/Medium/Deep depth layers, which
  were hard to make honest) is one badge with a word or two for what the game
  is played as, not its theme or its crowd: never "Party" on a With friends
  game, never "Space" on Alto (`kind` in `lib/games/library-fixtures.ts`,
  `Kind` in `components/game/library-stats.tsx`). The chip row never wraps;
  keep kinds short enough to fit a phone shelf tile. The setup lid keeps
  players and mode beside them.

The small table spots (a table's handoff, the friends list, the waiting view)
keep the box for now. This supersedes the shelf rows and sealed boxes in the
Night library section below.

## Arena: solid buildings, shields and fresh figures (4 October 2026)

Tower shells are smaller on every screen: 0.85 of native size on landscape
and 0.9 on portrait. Their archers keep their readable size independently.
Standing bases are solid rounded squares. Ground troops route round them,
pushes stop at their faces, and low shots cannot cross them. Elevated arrows
and lobbed bombs retain their flight paths. Ground foot placement and attack
lunge respect the stone while keeping the body's walking path intact.

Shields are a reusable second health pool. Hits drain their actual remaining
capacity, with excess reaching health. Four seconds without damage starts a
five-second refill from empty. Gladiator stays at three elixir, with 850 health,
650 shield, and 125 damage every 1.1 seconds. His cyan shield track sits above
the separate health track and carries a shield icon; it remains visible empty
or full. Status effects use a calm row of small enamel medallions above them.

Dino has a near-horizontal trunk, a deep skull, bent weight-bearing legs and
a long rear tail, with matte forest hide, ochre undersides and amber eyes.
Sumo has connected anatomical shoulders and arms, separate fingers, an adult
face, a weighted abdomen and close woven blue mawashi. Both use deforming skin
and fresh matching painted card portraits. Detailed editable masters are
reviewed before separate runtime copies are optimized, following the mandatory
high-fidelity-3d skill. Other figures and portraits retain their approved
sources. The [written briefs and visual reviews](concepts/2026-10-04-arena-quality-rebuild/brief.md)
record the rebuilt sources and the rejection of the earlier v8 models.

Cowboy, Samurai and Wizard follow the same source-first rebuild. Authored adult
faces, separate fingers and connected deforming garments replace the earlier
rounded faces and detached sleeve joints. Cowboy keeps his two-handed rifle,
Samurai his lacquer armour, pleated hakama and katana, and Wizard his ordered
silver beard, woven robes and bent felt hat. Fresh painted portraits match
each figure. Independently reviewed game copies keep their native scale at
17,184, 19,079 and 18,431 triangles, within their original geometry costs.
Wizard plants the actual staff shoe after final body placement, checking the
whole shoe against the bridge while keeping the overhead cast free and its
gripping wrist attached. Detailed masters, original sources and rejected
reductions remain preserved. Rigid surfaces stay batched, with only weighted
cloth and anatomy drawn as independent skins. Wizard's first idle draw also
initializes its fidget state after a slow frame; see the
[three-character brief and reviews](concepts/2026-10-04-arena-three-characters/brief.md).

Selecting and dragging a card share one stats preview. Narrow screens use a
compact panel above the hand; wide screens use the existing inspection band.
It never changes the field camera or intercepts the placement gesture.
See [arena.md](arena.md) for the rules and runtime contracts.

## Diner: levels, a road you drive, and the kitchen in the truck (9 October 2026)

William played the 8 October diner car and found it still poor: free play
was three nights with nothing to work toward; Play silently resumed an old
run; the route map was convoluted, too far away, with roads that made no
sense and odd shading; the shift's deck was small on a desktop, surrounded by
noise; everything was too bright and oversaturated; and a trailer standing
behind a separate counter made no sense. He asked for many hard levels that
hand out the campaign's upgrades and say so, a prompt before a new run, a
simple cartoony 3D world to drive a truck around choosing between two places
(Mario or Overcooked style), a deck that fills the screen, sideways phones
with a stick on the left and buttons on the right, calmer light, and a
trailer that is the kitchen. All of it was done without Codex, at his
request. Details in [diner.md](diner.md).

- **Levels.** Forty short shifts in eight chapters, one place each, a boss
  closing every chapter. A medal with a life left opens the next level. Each
  level adds a dish, a trouble, a booth or a piece of the Workshop's kit
  (Chrome tray, Roller skates, Coffee urn, Heat-lamp pass, Twin grill,
  Jukebox), and the opening card lists what is new, what is on again, and
  the kit you carry. Medal targets come from the bot (`levels-balance.mjs`).
  Online tables play a level the host has opened.
- **A road you drive.** Every fork is two stops. The map is a small toy world
  (desert at dusk, coast at twilight, the Moon Mile at night) you drive the
  chunky rig around with the stick or WASD, close behind the truck; a sign
  over each lot shows place, busy flames, gas and reward, and rolling into a
  lot offers Stop here. Landmarks are cartoony and chunky; roads are clean
  ribbons with cream lines, no odd shading.
- **Play asks.** With a run under way, Play asks New run or Continue.
- **The deck fills the screen.** The floor is wide and shallow (15 m, six
  booth spots, the line down the left from a gate at the back, both front
  corners clear for touch controls), framed rail to rail at 44°. The HUD is a
  slim top bar and, on keyboards, a strip of key hints.
- **Sideways phones.** Diner is the one landscape game: a rotate screen on
  upright phones, a floating stick over the left planter corner, round Use,
  Out! and Dash buttons over the right one.
- **The trailer is the kitchen.** The cab-over truck tows a cream trailer
  whose patio side opens as one wide hatch: machines on its steel worktop, a
  tiled wall behind, a striped valance above, a cherry counter front below.
  The same rig, short, is the truck on the map.
- **Calmer.** One soft warm flood with readable shadows, a cool rim, warm
  light in the hatch, low exposure and bloom only on neon; a wooden deck
  with the checker as a runner; enamel colours instead of neon ones; a few
  quiet things per place at the edges.

This supersedes the route map, the diner car and the places of the 8 October
section below, and its free-play nights.

## Diner: the diner car, a real roguelite and Use that does the obvious thing (8 October 2026)

William's verdict on the 4 October campaign: not a roguelite, choices not
substantial, a route map of six diners "placed next to each other", a dead
world, controls that surprise (pressing Space after taking a shake started
another shake), ugly icons, low-quality graphics. He approved one idea: **the
diner is a chrome diner car towed down a highway at night**. This section
supersedes the 4 October campaign and route map; the brief is
[concepts/2026-10-08-diner-car/brief.md](concepts/2026-10-08-diner-car/brief.md).

- **The run is a roguelite.** One night: three legs of forks, a boss each.
  Lives last the whole run; coins pay for gas between stops and for the
  Garage; tokens buy Workshop upgrades to the car itself (more lives, a
  third hand, Dash, a coffee urn, a jukebox, a heat-lamp pass…). It gets hard
  quickly: a careful newcomer falls around the first boss.
- **Every fork is a door with a reward.** Place (its crowd and trouble),
  busy flames, gas and the reward are all on the card, painted postcards of
  each place. Equipment changes how a shift plays; no bare few percent.
- **Use does the obvious thing.** Two hands. At whatever you face, Use gives
  what is wanted, then takes what is ready, then starts what is needed. A
  machine never starts a dish nobody needs (one ahead when nothing is
  ordered). Leading a party needs no hands. New verbs arrive as Workshop
  upgrades (pass, coffee, jukebox, Dash), never as clutter on the first run.
- **One car, many places.** Every shift is played on the car's unfolded
  patio; the place around it (truck stop, drive-in, fairground, harbour, Old
  Town, Moon Mile) is the scenery and decides the crowd. The route map is one
  continuous night landscape with the car driving the forks.
- **Night light.** The patio is the warm bright centre; the place falls into
  moonlit haze with neon and bulbs blooming. Gameplay reads first.
- **Pictures, not glyphs.** Bubbles, buttons and cards use illustrated
  stickers; patience is a draining bar or ring; machine bubbles sit above
  the machines and carry no words.
- **Split work.** Codex built the places (car, truck, stage, places, route
  map); Claude built what you touch (machines, dishes, people, effects,
  lighting, camera, interface).

## Diner: the night route and a tactile kitchen (4 October 2026)

The solo game now offers a roguelite campaign beside the three free-play
nights. Its 18 shifts cross six districts, with two seeded routes per shift
and a boss every third shift. Bosses test service, repairs, demanding guests,
careful cooking through brownouts, mimic spotting, then all those skills
together. Each win offers three equipment choices; 30 pieces of equipment
and three repeatable supplies change real simulation rules. Banked earnings
buy 13 permanent workshop upgrades with 28 ranks. A cleared campaign can
continue into harder, repeatable overtime circuits. Online co-op keeps free
play. See [diner.md](diner.md) and the
[campaign evidence](concepts/2026-10-04-diner-overhaul/campaign-validation.md).

- **A full viewport.** The 3D canvas covers the screen. The stick and action
  buttons float over the lower corners, labeled coins and lives sit under the phone
  top bar, and the complete kitchen, booths, queue and doorway fit between
  them. Broad screens lower the camera to show faces; portrait retains its
  overview. Warm wall and quieter floor continue beyond the room.
- **Materials and people.** Enamel, vinyl, brushed chrome, tile grout,
  painted wood, cloth and skin have their own textures and roughness.
  Sculpted profiles, separate hair, ears, hands and articulated limbs give
  guests friendly expressions and readable outfits. Eating, impatience and
  carrying animate their own joints. Outfit clues keep their original rule.
- **Readable machines.** Dish markers identify every station while idle.
  The grill, mixer and fryer each have two independent cooking lanes from
  the first shift. One tray still carries one item. Cooker needles, heating,
  two turning spindles, fryer lifts, a pie lid and running
  wash water show activity. Jammed machines show a wrench and amber lamps;
  brownouts slow cooking and dim the kitchen. Normal walking remains
  4.2 units per second; Space/Use stays the same.
- **A run you can leave.** Atomic local checkpoints retain the full shift,
  wallet and equipment. Boss results settle once; stale checkpoints cannot
  undo earnings. The shared Leave dialog confirms the saved run. Blocked
  browser storage is reported instead of claiming a save.
- **Art and planning.** Fresh square and wide covers use a painted
  mid-century diner illustration with the title integrated into the art.
  The campaign follows a live 3D night landscape through Roadside, Midtown,
  Fairground, Docks, Old Town and Moon Mile, with floating shift and equipment
  choices and a workshop overlay. Exact prompts and native sources are preserved in the
  [artwork record](concepts/2026-10-04-diner-overhaul/artwork/README.md).

## Trivia: three ways to play the mini-games (4 October 2026)

Tower's floors, Expedition's routes and the four-round length are superseded
by the 10 October Quiz section above; this describes rules 2 saves.

William renamed Quiz to **Trivia** and asked for three match formats: a simple
one, one where points and victories build something, and a longer journey with
more choices. He selected **Expedition with routes and trophies** for the last.
The library, setup lid and public copy now say Trivia. The internal `miro` ID,
mini-game IDs and compatible saved matches stay stable.

- **Quick Play** keeps the flexible match: Atlas, Sizes, Years and Order share
  cumulative points. After every round the host picks another mini-game or
  End, up to twelve rounds. Its optional ten-second table vote is unchanged.
- **Tower** lasts four complete rounds: Atlas, Sizes, Years and Order once
  each, with three prompts in every round. The host picks their order from the
  games still to play. Each hundred points builds one floor; each round winner
  earns two extra floors, including tied winners. The tallest tower wins, then
  total points. The host ends the match after the fourth round.
- **Expedition** plays the same four complete mini-games once each. Before
  each round, choose just one private route and lock. Trail always moves one
  step. River moves two with 150 points, otherwise one. Summit moves three with
  240 points, otherwise none. Every three steps earns a checkpoint trophy
  automatically. There are no coins, supplies or purchases in new matches.
  Furthest distance wins, then points; an exact tie is shared. After round four
  the host ends directly, without another lock from every player.
- **Shared play.** Each prompt still scores up to one hundred points. These
  games remain human-only in production and everyone plays for themselves.
  Route choices stay private even from the host until the next round begins;
  readiness is public. You can unlock before everyone locks. The host moves
  reveals and picks the remaining games, regardless of a previous Quick Play
  voting preference. Quick Play has no round pill; fixed modes use the shared
  four-round pill. Setup keeps the three graphical mode pieces and shared
  Rules, long-press and keyboard inspection.
- **3D presentation.** The warm measuring desk frames complete miniature
  worlds. Tower builds sandstone arcade floors with lacquer bases, recessed
  enamel windows, brass trim, ribbed copper/teal roofs and cloth pennants. The
  roof lifts before new tiers land and settles afterwards. Expedition follows
  an actual sculpted path through a pine grove, river bridge, sewn camp and
  mountain trophy, with detailed seat-coloured traveller tokens, moving water
  and quiet cloth motion. The accessible score ledger remains available when
  WebGL is unavailable. Landscape and portrait cameras fit the complete forms
  to the measured canvas. Motion stops when hidden or reduced motion is set;
  closing the board disposes its renderer and resources. Results retain the
  3D world and shared reveal/count-up pieces. Editable sources, briefs and
  visual evidence live in [the 3D record](concepts/2026-10-04-trivia-3d/verification.md).
- **Existing matches.** New states carry `trivia.rules: 2`. Marker-absent
  five-round Tower and eight-round Expedition saves finish under their original
  scoring and shop rules; their help and round pill match those rules. Older
  Quick Play saves remain compatible.
- **Development testing.** Tower and Expedition have a Debug entry in the
  local development menu. Live tables open an independent review tab; the
  review bench opens its debug controls in place. Switch modes, set two to six
  seats, pick mixed/perfect/missed scores and an Expedition route, simulate a
  complete round, jump to results, restart or replay the last 3D animation.
  Simulations use legal answers, locks, reveals and host picks. Completed
  progress and fully locked decisions are retained. Debug data stays in the
  review tab and never writes to a live table. Production has no Debug entry.
- **Artwork.** Fresh square and wide sources, exact prompts and crop reviews
  are preserved in [the cover record](concepts/2026-10-04-trivia-covers/README.md).
  Both covers have the title integrated into the art, with no visible DOM title.

## Diner: a night diner, co-op, with mimics (3 October 2026)

William asked for a solo and co-op game in the spirit of the impostor party
game combined with Diner Dash, played with a joystick and buttons on phones,
working on phones and computers, with little content but all of it good.
**Diner** (`diner`, plain literal name) is listed first under Solo & co-op.
Rules, numbers, online play and code are in [diner.md](diner.md).

- **The twist.** Every party of guests wears the same outfit; a mimic in a
  party of three or four gets exactly one part wrong (hat, shirt colour,
  stripes, dark glasses). Out! throws out the guest you face: a mimic pops
  into purple goo (+15 coins), a real guest takes the party and a star with
  them. Missed mimics burst out with the bill and leave goo to mop. Skin and
  hair vary freely and are never a clue. Night 1 teaches the loop with no
  mimics and no Out! button.
- **Readable on a phone.** Waiting parties stand side by side in one row
  facing the room (a 2×2 huddle hid the back row's shirts), figures are drawn
  1.3 times life size with chunky hats and wraparound shades, and the patience
  ring sits beside the row, never over it.
- **Real-time and real 3D**, a third exception to the painted-plate rule
  after Arena and Rota: an orthographic camera at 52° fits the whole room on
  every screen; everything is modelled in code as chunky toys with vertex
  colours, merged per material (vinyl, enamel, chrome, neon, glass).
- **Its own world.** A 1950s roadside diner at night: cherry and cream
  checkerboard, cherry enamel counter with chrome bands, pastel pink walls,
  mint booths, a jukebox and a pink-and-teal neon cup, each night with its own
  sky and moon. The HUD is diner hardware: chrome-rimmed cherry buttons, a
  cream enamel clock pill, menu-card plates with a striped awning edge, a pink
  neon script for the name. No text on the table beyond names, numbers and
  the one word on the Use button.
- **Controls.** Phones: the room on top, a cherry counter front beneath with
  a floating joystick (one finger, so a second can press a button), a big
  mint Use button showing what it will do now, and a red Out!. Tablets on
  their side put the stick and buttons on rails beside the room. Computers:
  WASD or arrows, Space or E, Q or X, Escape.
- **Top bar, by decision:** back and name left, the shift clock as the centred
  pill (it is the shift's only progress, like a round count), coins, the
  medal track and stars with the menu on the right; phones keep back, clock
  and menu only, with coins and stars on the counter front.
- **Online co-op is server-authoritative** rather than lockstep (Arena's
  lockstep is too slow for walking a character): each device predicts its own
  waiter and replays its unacknowledged steps on every snapshot, everyone
  else is interpolated a few steps behind.
- **Sound is synthesised** (bell, sizzle, blender, coins, goo) with a soft
  doo-wop jukebox loop at the Ambient level; nothing to download.

## Impostor: draw the secret word, find the odd one out (3 October 2026)

William asked for an imposter party game in the spirit of the Jackbox one
where everyone gets the same prompt and the impostor gets something a little
different, playable on phones and computers, with little content but all of
it good. **Impostor** (`impostor`, a plain literal party name) is its own box
on the Party shelf, 3–8 players, human-only online like Know Me and Quiz.

- **Rules.** Everyone gets the same secret word; the impostor gets its close
  neighbour (Cat and Fox, Moon and Banana, Ice cream and Microphone) and is
  **not told**, so part of every round is realising it might be you, as in
  Undercover. Everyone draws their word at once against an 80-second clock
  (Done to finish early), then every drawing goes up on the board and
  everyone writes one word (the server refuses a word that names your own),
  then everyone accuses one player and locks. Accusing an impostor scores 2;
  an impostor without the most accusations escapes and scores 5 (a tie at
  the top catches them). Seven or eight players have two impostors with the
  same word. The role goes round: nobody is the impostor twice before
  everyone has been once. The reveal stays up while the host picks Next
  round or End (or, with Votes on, the table has ten seconds). Rules marker
  1; engine `lib/games/party/impostor.ts`, tests `tests/impostor.test.mjs`.
- **Content.** 40 word pairs (`impostor-words.ts`): concrete, quick to draw
  with a finger, simple English, no brands or people, each pair drawing
  alike but not the same. A table gets pairs it has not drawn first (the
  content history now covers Impostor as it does Atlas).
- **Look: an evidence wall at night.** Ink-navy walls, one warm lamp from
  above, a cork board in a dark wooden frame, cream index cards held by red
  pushpins, manila tags for the secret words, typewriter labels, red string.
  The reveal strings every accuser to their suspect, counts the pins, stamps
  IMPOSTOR on the impostor's card and tags every card with the word it had.
  Drawings use three inks (graphite, red, blue) and three nibs on a square
  card; strokes are packed two characters a coordinate and sent one by one
  (requests are capped at 8 KB), so the clock never loses a card.
- **Viewport.** The board picks the column count that gives the cards the
  most room, so three to eight cards fit one screen on phones and desktops.
  Up to eight badges stay on one row: when names do not fit, a badge
  contracts to the avatar with its score on a chip and its state on its
  shoulder. With seven or eight players the finale lists the standings in two
  columns so the next pick stays on screen. Table seat counts now go to
  eight (other games keep their own limits).

## Yata: the cards' drawings on every counter (3 October 2026, evening)

William asked to bring back the card illustrations on the counter instead of
the 3D renders, keeping the new presentation of each dish's name and score,
on every menu. Supersedes the two Tokyo 3D sections below.

- **Every menu's counter shows the card drawing** (`tokenImage`), Tokyo,
  Bangkok, Mexico and Puebla alike, in Others and inspections too.
  `dishRender` is gone; the Blender sources and 3D renders stay in
  `assets/yata` and `public/art/optimized` but nothing serves them.
- **The 3D layout stays:** no plate rings, the drawn dish stands on the
  counter, up to three more servings peek out behind it with a ×N chip, an
  uncollected dish is a dim imprint, and one cream tag carries the name and
  the score coin (the name folds away on small counters). Hot dishes steam on
  every menu (Gyoza, Ramen, Takoyaki; Bao, Rice; Tacos, Tamales; Quesadilla,
  Pozole, Mole).
- **Nothing spills out of its cell.** The phone counter no longer enlarges the
  dish past its tall cell; the drawing sits low on its tag, and the servings
  behind it are offset so every copy stays inside the cell.

## Yata: Tokyo's 3D dishes match the cards (3 October 2026, later)

William confirmed that the counter should keep modeled 3D dishes, with the
same cartoon style, vessels, ingredients and portions as the existing tickets.
The glossy v1 renders had sparse Ramen noodles, small toppings and an empty
Yakitori tray; they also introduced realistic surface grain.

`assets/yata/blender/tokyo_toon.py` rebuilds the six servings with clean cel
colour bands and dark ink contours, using chunky card-matched geometry.
Ramen fills its blue wave bowl with thick noodles and large egg, scallion,
fishcake and nori toppings. The skewers fill their tray, the pickle cuts stay
readable, and Takoyaki sits in an angular paper boat. There are no image
textures, photographic noise, bump maps, glossy materials or raster edits.

The new source PNGs live in `assets/yata/renders/tokyo-toon-v2`; the exporter
fits them to the same 720×540 counter frames and writes lossless v2 WebPs.
`dishRender` selects them for Tokyo, including Others and inspections.
`ArtworkLoading` now decodes the six counter renders before lifting its curtain.
The current ticket illustrations, counter layout, collection interactions,
scoring and other menus are preserved. Earlier source models and v1 exports
remain available. The written brief is in
`docs/concepts/2026-10-03-yata-card-matched-3d/README.md`.


## Yata: Tokyo's dishes in 3D on the counter (3 October 2026)

William asked for the Tokyo counter to be redone with a high-quality 3D model
of each of its six dishes, kept close to the drawings, laid on the table, with
the score and name redesigned around them. Tokyo is the trial; Bangkok and the
plaza menus keep their drawn dishes until he has seen it.

- **Models are code, renders are stills.** `assets/yata/blender/tokyo.py`
  builds Gyoza, Ramen, Yakitori, Pickles, Takoyaki and Dango over a small kit
  (`dishkit.py`): lathed plates and bowls, parametric dumplings, swept
  noodles and skewers, garnish dropped onto the food by raycast, and
  procedural node materials (no small baked images, the reason the 25
  September 3D stages failed). Cycles renders each one with the same
  orthographic three-quarter camera, the stall lantern's warm key from the
  far side, a thin ink outline and a shadow catcher, so the contact shadow is
  in the alpha. `node scripts/yata-dish-renders.mjs tokyo` trims each render
  into a 720×540 webp (`yata-dish3d-tokyo-<kind>-v1.webp`, `dishRender` in the
  engine). Live three.js was not used: stills are sharper for food and cost
  nothing at play time.
- **The dishes stand on the enamel themselves.** The toon plate rings are gone
  for Tokyo; each dish brings its own vessel and shadow and takes most of its
  cell. Extra servings peek out behind the front one (up to four shown, a ×N
  chip from two), set higher on the counter, a little smaller and in the
  lantern's shade. A dish not yet collected is a dim sepia imprint of itself.
  Ramen, Takoyaki and Gyoza steam gently (off under reduced motion).
- **One tag per dish:** a cream pill with the name and a dark score coin,
  hanging over the bottom of the dish. When the counter is small (phones,
  opponents' mats in Others) a container query folds the name away and leaves
  the coin. On phones the dish spills a little past its tall cell rather than
  leave a gap above the score. Inspecting a dish shows the render on a tile of
  red enamel.
- The hand tickets keep the drawings for now.

## Quiz: its own pick and splash, a 3D Sizes table, even scores (2 October 2026)

William's request: Quiz's pick and the splash before each game looked too
much like Know Me's. Keep the idea, make it feel different, maybe more 3D.
Sizes felt clunky; its silhouettes should be 3D things you can move around
and try at different sizes. Years' pin head should take a click. And no
Quiz game should hand out far more points than another.
Supersedes the scoring numbers in the 29 and 23 September sections below.

- **The pick is a row of index cards** (`QuizPick`, `quiz-pick.tsx` and
  `quiz-pick.css`). The 3D enamel blocks tried first the same day were
  dropped at William's request: no 3D, Know Me's format, Quiz's own
  materials, nothing that reads as a new style. Each game is a cream index
  card lying on the desk, a window of cutting mat in its colour (Atlas
  cobalt, Sizes tomato, Years sun, Order the game's green, End kraft) with
  its mark on the mat, its name on the ruled card under a red margin line.
  Cards deal in, lift and straighten on hover, play their mark, and a picked
  one takes a big enamel pin at the top. Votes are enamel pin heads along
  the bottom edge. Phones: two cards a row, End a low card beneath.
- **The splash is Know Me's burst on the desk** (`QuizIntro`,
  `quiz-intro.tsx` and `quiz-intro.css`, the same length): the game's
  cutting mat slides in under the lamp, its mark lands, its name drops on an
  index card, then it zooms away. Each game has its own motion: Atlas' globe
  spins and a pin drops in, Sizes' tape runs out and the big block grows,
  Years' pin arcs onto the ruler and sparks, Order's cards stand up one by
  one. Off under reduced motion.
- No sunbursts, rays or game-show plates in Quiz. Know Me keeps `TribuVote`
  and `GameIntro`; `standalone-table.tsx` picks by set.
- **Sizes is a 3D table.** Every silhouette is now a solid piece extruded
  from its outline (`size-scene.ts`, three.js) on the green cutting mat,
  lit by the desk lamp with real shadows: the reference in cream, yours in
  glossy tomato enamel. Animals, objects and landmarks stand up like thick
  standees; countries lie flat like map pieces, seen from above. Drag either
  piece to move it; drag the red one over the cream one and it steps in front
  (or lies on top, for countries) so the two compare outline to outline.
  The camera cannot be moved (3 October 2026): one fixed angle, turned and
  raised enough to show the pieces' depth, always framing both pieces, so
  there is no orbit and no zoom. Size the red piece with the tape measure up the right
  edge (a log scale, so tiny and huge sizes are equally easy; a cream notch
  marks the reference's size), its corner knob (a large tomato grip with resize arrows and a pinging
  halo, so it reads as a handle), the wheel, a pinch or the
  arrow keys on the tape. The recentre button puts the pieces back. The reveal raises the reference, the true size in gold and every
  guess in its player's colour out of the mat in a row, best first, the
  labels pinned under each piece; hovering or tapping one fades the others.
  Outlines are traced from the silhouette masks by
  `scripts/build-sizes-outlines.mjs` into `size-outlines.json`. Without
  WebGL the flat board remains.
- **Years: the pin's head is a handle.** Its round head stands above the
  ruler and used to let clicks through; grabbing it now drags the year from
  where it is, without jumping.
- **Even scores.** A Monte Carlo model of weak, average and strong players
  on the real content (Atlas places, Sizes pairs, Years events by era,
  Order sets) showed Order far too generous: a weak Order player outscored a
  strong Atlas player, and a random order scored 36. Every game is now tuned
  so the model's average player scores about 50 a prompt and a strong one
  70–80, with a random guess near nothing (Sizes about 18):
  - **Atlas**: 100 within 50 km, 72 at 300 km, 30 at 1,200 km, nothing at
    4,000 km.
  - **Sizes** scores how many times too big or too small, so double and
    half cost the same: 100 within 10%, 78 at ×1.2, 48 at ×1.4, 22 at
    ×1.6, nothing at twice or half. The reveal's *Off* is the same measure.
  - **Years**: older events give more room. Years off count a fifth before
    1800 and half from 1800 to 1949, then 100 for the right year, 80 one
    counted year off, 55 at four, 20 at fifteen, nothing at thirty: nothing
    at 150 years off before 1800, 60 from 1800 to 1949, 30 since 1950.
  - **Order** scores by pairs the wrong way round: 100 perfect, 50 for one
    pair, 20 for two, nothing for more (it was 20 a thing in place, 10 one
    off). Sorting five things is still the easiest of the four; tighter sets
    would let a gentler rule return.
  The model's assumptions and tables are in
  [the verification note](verification/2026-10-02-quiz-3d-and-scoring.md);
  no real play has calibrated it.

## Know Me: Ten Coins, Me cards, a livelier pick (2 October 2026)

William's request: This or That and How Many felt binary and rigid next to
Top Five and Dial; How Many's rate-yourself slider was fine but not a whole
game. A first replacement pair, Who Said It (match unsigned answers) and
Most Likely (point at a player), was rejected the same day: answers gave
their authors away, and pointing at people was not interesting. Know Me is
now three games: Top Five, Dial and Ten Coins. Picking a game should feel
exciting.

- **Ten Coins** (`coins`): everyone at once gets their own prompt with four
  options (A perfect weekend: Sleep, Friends, Adventure, Food), picks one of
  two, and shares exactly ten coins between the options the way they really
  are. Then everyone guesses every other player's split, one tab per player,
  and locks once; the splits are revealed one by one. A perfect read scores
  10, like a perfect Top Five, and every coin out of place costs 2. It reads
  how much, not only what: 7-1-1-1 and 3-3-2-2 are different people. Tap a
  slot to set a pile, tap its top coin to take one back, or use − and +; a
  tray of ten coins shows what is left. Content in `coin-prompts.ts` (60
  prompts, every option something a reasonable person could pile coins on).
- **This or That, How Many, Who Said It and Most Likely are gone**; saves
  mid-game in any of them no longer load.
- **Dial's Me cards** keep How Many's good idea: each player's second offer
  is a "Me" spectrum (Night owl – Early bird) marked with their face. Taking
  it, you turn the dial to where you really are instead of writing a clue,
  and the table aims for that. Same bands and author average.
- **The pick is a row of lit cards** (`set-pick.css`): each game in its own
  colour with a turning sunburst, its mark big, its name on a plate. They
  deal in, lift on hover, play their mark (the needle swings, the coin
  flips) and ring when chosen. Know Me's marks are chunky ink-outlined
  objects (`know-me-marks.tsx`). Three games sit in one row with End
  beneath on phones.
- **Every pick opens with a burst** of about a second (`GameIntro`,
  `game-intro.tsx`): the game's colours flood in as a sunburst, its mark and
  name land with a motion of their own (Top Five's ribbons race in, Dial's
  needle whips, Ten Coins' stacks rise and the last coin spins down), then
  it zooms away. Never on a reload or at End; off under reduced motion.

## Arena: the field turned on wide screens, calmer wind, a pop-up cannon (2 October 2026)

William's review of the living field and the desktop view:

- **Wide screens look across the field.** Looking down the field on a
  landscape screen left a narrow strip in the middle with forest on both
  sides, and everything on it felt small. Wherever the free area is at
  least 1.3 times as wide as it is tall, the camera now stands off the near
  side wall at 50°: your king at the left, the other at the right, the
  lanes running across the screen and the river down the middle. The field
  fills the width and is drawn about 1.4 times larger; with their own
  growth below, troops are about 1.6 times their old size. Phones
  and portrait tablets keep the steep view down the field. The desktop
  hover card lies on its side in the meadow under the field, right of the
  hand. Numbers in [arena.md](arena.md).
- **Everything on the field grew about 15%**: troops (and with them their
  rings, shots and bars) and the towers (drawn at 0.8 of the model, from
  0.7). The scenery keeps its size.
- **The trees no longer wobble.** Each crown rippled vertex by vertex and
  bent with the square of its height, so the trees looked like they were in
  a microwave. A tree now leans stiffly from its foot as one piece, slowly
  and only a little; bushes and grass keep their bend and flutter.
- **The flags wave in a light breeze**, about a quarter of the old swing,
  slower.
- **The king's deck is clear.** The rear keep, its tiled roof, chimney and
  pennant are gone. While the king sleeps a round iron hatch sits in the
  middle of the deck; when it wakes a cannon about twice the old size
  springs up through it with a puff of dust.

## Arena: drafts, eight more troops, a living field (1 October 2026)

William's round of feedback, all at once. The brief, roster and draft designs
are in [concepts/2026-10-01-arena-draft](concepts/2026-10-01-arena-draft/brief.md);
numbers in [arena.md](arena.md).

- **Deck choice leaves the setup box.** It keeps one **Draft** choice, Off by
  default. With Draft off every Versus battle opens with a deck picker over
  the loading screen: your last eight ready, every card below it cheapest
  first, the ready-made decks one tap, the average elixir as a bare number,
  one Ready. Online the room waits for everyone's Ready, at most 30 s.
- **Split draft** (Draft on, `lib/games/arena/draft.ts`): two simultaneous
  12 s rounds. Each offers four cards, one per role (win condition, air,
  splash, spell or support, derived from tags and stats); you keep two and
  the two you leave go to the player across, so every pick costs something
  and everyone ends with eight different cards. The clock running out keeps
  the highest-rated pair; bots draft instantly. In 2 v 2 you watch your
  teammate's offer and picks live. The room runs it online.
- **Quest starts with a Bundle draft**, not a charm: three rounds of three
  pairs, take one, six cards. Pairs are built for hard choices (a standout
  tied to a weak card, a tank with no air answer, the Meteor against two
  troops); every outcome can take towers and answer flyers.
- **Eight new troops, three of them tanks**, so a deck without the Dino has
  a front line: Diver (armour), Sumo (landing taunt, slaps push), Linebacker
  (3-elixir tackle), Beekeeper (bees), Drummer (beat aura), Firefighter
  (pushing water cone), Jetpack (fast flyer), Explorer (frost slows). The
  Medic, Drummer and Beekeeper are supports that follow the nearest friend.
  In 10 000 seeded bot duels every new card wins 45–56%. Cowboy, Viking,
  Gladiator shield and Balloon were nudged. Sumo and Drummer unlock in
  Quest; the other six start in the pool. Until ElevenLabs credits return
  (about 26 October) the new troops borrow existing sounds.
- **Card portraits v7, all 24**: caught mid-action, eyes on a target off to
  the right, never smiling at the viewer; still big and centred.
- **Natural walks**: feet plant and never slide; hip, knee and ankle are
  solved onto them each frame, with heel-to-toe roll, a pelvis that drops
  and rises, counter-turning shoulders and lagging arms. Each troop picks a
  gait profile (`lib/games/arena/gait.ts`). The Robots keep their clockwork
  scurry; Biplane and Balloon are unchanged.
- **A living field**: about 150 000 grass blades coloured by the turf under
  them, one valley wind through grass, flowers, bushes and trees, drifting
  cloud shadows, flickering torches, chimney smoke, butterflies, birds,
  falling leaves, water churning at the bridges; towers carry waving team
  cloth and the king a tiled roof and lit windows. Grass thins on the
  pacer's lower rungs; reduced motion keeps only gentle movement.
- **The Meteor is hurled from the caster's own king**, a flash and smoke on
  its roof and a burning arc that lands on the engine's 30th step.
- **Quest map in the painting**: new crisp region paintings (the old ones
  were upscaled, low-contrast and blurred behind panels), stops as emblems
  on plinths in perspective, worn trails with footprints, flags on cleared
  stops, fog that rolls back, a token that walks to the chosen stop.
- **Card stats**: a Cards button in the setup and a Cards entry in the
  battle menu open a browser of every card; on desktop, hovering a hand
  card or any troop shows its card in the forest right of the field,
  outlined in its side's colour (`lib/games/arena/card-facts.ts` derives
  every number and ability line from the card itself).

## Alto: a longer strategy game where everyone plays at once (30 September 2026)

William asked for a more strategic, longer game (10–20 minutes) that keeps
everyone playing at the same time, without Seven Wonders' need to know what
the deck holds, a simple base and extensions and variants from the start.
**Alto** (`alto`, an abstract short name) is sky-island trade: every turn
everyone picks an island and may build one plan with goods already held;
alone you load the pile up to your hold, together you split it. Nothing is
hidden but the turn's picks: every plan of the match is on the table from the
first turn. Rules, numbers, balance and code map: [docs/alto.md](alto.md).

- **Look.** Luminous gouache storybook: a peach-and-powder-blue morning sky,
  eight painted floating islands (each good twice, all distinct), plan
  miniatures on linen cards with brass rims, enamel captain medallions and
  cream airships carrying a pennant in the seat colour. Not paper, not a flat
  poster, not toon, not 3D. One sun, upper left; shadows fall down-right.
- **Table.** Islands float in the sky between the top bar and a linen tray;
  the tray holds your goods, hold, All plans and Undo in its top row and the
  season's six plans beneath (three by two on phones). Tap a plan to prepare
  it (your goods show what it takes), tap an island to fly: that tap is the
  move. The reveal flies every ship in with its load; a season word drifts in
  on a cloud. No helper text on the table.
- **Variants.** Voyage: Quick (4 turns a season) or Full (6). Plans: First
  Flight (fixed) or Random (six of nine a season, all shown). Extensions:
  Winds, Orders, Flags, Captains.
- **Online** follows Rota: the table launches an Alto room; bots take empty
  seats and fly for anyone away.
- **3D planets (2 October 2026).** William asked for the islands to become
  3D planets that look different from one another, a real ship in each
  player's colour flying to the planet picked, and 3D objects for the plans,
  built at full detail first and optimised later. Every island is now a small
  planet drawn by code over the painted sky (forest, terraced quarry, meadow
  with wandering sheep, ice and crystal with a ring; the second island of each
  good is a variation: autumn wood, red canyon, lavender downs with windmills,
  rose crystal). Your airship leaves the tray when you pick; at the reveal
  every ship flies in from its badge, circles its planet and flies home. In
  the tray Shrine, Kite and Sawmill are animated 3D objects for now; the other
  plans keep their painted miniatures until the first round of feedback. The
  DOM keeps every control and number; without WebGL the paintings stay.
- **Space theme (2 October 2026), replacing the look above.** William asked
  to move Alto right away from its sky-island theme and layout while keeping
  the planets: ordinary, relatable space hauling, not hard sci-fi, with
  spaceships instead of balloons, new cargo, new things to buy that match,
  and upgrades that show on your ship and the opponents' ships. The rules and
  numbers did not change; only words, pictures and layout did, and every id
  stayed so saves and rooms still load.
  - **Words.** Cargo is food, metal, ice and crystal (crystal the rare one);
    plans are *upgrades* bolted onto your ship (tools load more, gear carries
    more, trophies and extras score); seasons are *trips*; Winds became
    **Comets**, Captains became **Crew** (Pilot, Farmer, Miner, Ice Fisher,
    Jeweller, Scout, Trader, Collector). Planets: Orchard and Pumpkin (food),
    Rust and Anvil (metal), Frost and Floe (ice), Prism and Shard (crystal).
  - **Look.** Soft painted toy-space: a deep navy and violet night with a
    warm sun on the left; cream hulls with one bright stripe in the seat
    colour; controls in the hull's cream enamel; the deck at the bottom a
    dark navy hangar; Futura-style rounded display type. Planets carry about
    a dozen big things each (apple trees, greenhouses, pumpkins and
    sunflowers, mining towers, a furnace, igloos, ice floes and a whale, big
    crystals) instead of hundreds of specks, so they read on a phone.
  - **Table.** Planets are laid out as large as the stage allows. On wide
    screens they zig-zag between an upper and a lower lane (2 October
    feedback: one straight row left them small on desktop), otherwise rows
    whose shorter ones sit in the gaps; the pile under each.
    The deck: your own 3D ship standing on a lit pad (it lifts off when you
    pick and lands back after the reveal), your cargo, All upgrades and Undo
    in the row above the shop, and the shop's upgrades as 3D objects on lit
    pads rather than cards. Tapping an upgrade shows it see-through on your
    docked ship; every ship carries everything its player has built.
  - **Costs (2 October feedback).** A short upgrade used to fade as a whole,
    hiding the very cargo you were missing. Now a cost is one cargo icon per
    unit on a small tray, measured against your hold: bright for cargo you
    have, ringed gold where a swap (two of any others) covers it, an empty
    red socket where you are short, faint where a discount takes it. Only
    the name and effect of a short upgrade step back. Orders and
    inspections use the same row.
  - **Models (2 October feedback).** The first models read as basic shapes;
    every planet feature, the ship and the six upgrades were rebuilt with
    many more polygons and real sub-parts (bevels, trim, panels, rivets,
    layered foliage), within per-object triangle and draw budgets.
  - **Every upgrade modelled (2 October, after William approved the six).**
    Tools and gear bolt onto the hull at their own mounts (Robot Arm under
    the right flank, Cutter on the left, Trailer towed under the tail,
    Magnet swinging under the belly, a Sidecar with a dog in goggles, a
    retro Fridge strapped on the left). There is no room for trophies and
    extras on a hull, so they ride as die-cut souvenir stickers, like a
    travel suitcase, each showing its own picture; in the shop they are
    small dioramas (a lighthouse on rocks, a museum with a dinosaur, a pool
    with a rubber duck, a market stall with all four cargo). A cost unit a
    discount takes off is struck through in green.
  - **Scope of the first pass.** The first trip's six First Flight
    upgrades were modelled first (Cargo Pod, Harvester, Drill, Scoop,
    Telescope, Radar), by William's request, so he could react before the
    rest. Captains' crew badges, cargo icons,
    the space plates and both covers were generated fresh.

## Rota: a roll-and-draw route game on a surveyor's desk (30 September 2026)

William asked for a game highly inspired by Railroad Ink, fully built and
balanced, with extensions and maps and as much content as the other games.
**Rota** (`rota`) is its own game: its name, look, maps, extensions and
numbers are Gamehub's. Rules, content, code map and the balance runs are in
[rota.md](rota.md).

- **Play.** Everyone rolls the same dice and draws roads and rails on their
  own survey sheet at once: three route dice and a junction die a round, one
  special a round (three a match). Networks score by the exits they link,
  the longest road and rail a point a square, the centre a point a square;
  loose ends cost one each. Four maps (Meadow, Harbour, Ridge, Capital) and
  four extensions (Rivers, Plans, Towns, Rockfall), each one mechanic and
  independent. 1–6 seats; solo against bots, or online from a table.
- **Look.** A surveyor's cyanotype sheet on a walnut drafting desk at
  night, one brass lamp from the top-left. Routes are white ink drawn by the
  app (cased roads with a dashed centre line, rails on sleepers, pale river
  channels, stations as small buildings, bridges with parapets), hazards in
  red pencil, towns in gold ink. The dice are the shared cube in ivory with
  blue printed routes (junction die brass-tinted, river die pale blue and
  dashed as optional); specials are a brass stencil strip; the score is the
  drawing's title block; plans are taped cream notes. Condensed engineering
  lettering throughout. A compass, set square and red pencil rest on the
  desk where there is room.
- **Pacing.** Players lock their own round with Done; the round resolves
  once all have and the next dice roll at once, with no host Next (nothing
  is revealed that the table needs to talk over, as in Mora's picks). A
  person away 45 seconds has a bot build their round. The table admin
  starts another match from the results.
- **Layout.** One viewport everywhere: the sheet takes the height between
  the top bar and the dock; on wide screens plans sit left and the title
  block right, narrower screens put them in a strip under the sheet. Undo
  has its own slot in the dock row above the dice; Done sits beside them.
  Phones use the shared top bar; six badges fit as contracted badges.

### Rota in 2.5D: a model railway (2 October 2026)

William: rethink Rota as "3D elements that we place on the map", with
"little trains and little cars that go around the map", towns in 3D, "2.5D",
high-resolution models made in Blender; "you can completely redesign
everything". The rules and numbers did not change. Brief and asset list:
[concepts/2026-10-02-rota-3d/brief.md](concepts/2026-10-02-rota-3d/brief.md).

- **Look.** The cyanotype desk is retired. Rota is a hand-built model
  railway layout in late-afternoon sun, rendered live with three.js from a
  fixed three-quarter camera (41 degrees down, a long lens) with a soft
  tilt-shift on the scenery above and below the board. The plot is fresh
  flock grass with mown grid lines and warm hay-toned centre squares,
  framed by a dry-stone wall that opens where exits leave; the landscape
  fills the screen to every edge (rolling farmland with fields, hedges,
  farms and woods; Harbour's sea and lighthouse, Ridge's mountains and
  pines, Capital's town blocks; villages along roads that leave the board).
- **Pieces.** Roads, rails and rivers are swept in code along the same
  paths the vehicles follow: asphalt with cream kerbs and dashes, ballast
  with sleepers and steel rails, river channels carved into the ground with
  one water plane under the whole land. Overpasses hump over the rail on
  stone piers; bridges carry parapets; stations, towns, tunnel portals,
  rubble, buffer stops and road barriers (the loose ends) are Blender
  models with high-resolution tiled textures (generated tiles, made
  seamless, with normal and ORM maps). Pieces drop onto the board with a
  small bounce.
- **Traffic.** Cars drive on the right of every road network, trains of a
  locomotive and two or three cars run every rail network in the sheet
  owner's seat colour; they stop at stations, turn back at dead ends,
  arrive and leave by the exits joined to the network, and vanish into
  station halls and tunnels. Reduced motion parks them.
- **Controls.** The DOM keeps every control: the squares are real buttons
  laid over the drawn ground through a perspective transform (matrix3d
  from the camera), so tapping, dragging dice, the keyboard and screen
  readers work as before. Without WebGL (or while the models load) the
  drawn sheet shows instead. Dice faces and specials show the pieces as
  small 3D tiles once the board has rendered them; Others shows a picture
  of each opponent's board.
- **Signage.** Controls are railway enamel: deep green and cream, Gill Sans
  at semibold, the score as a green enamel board, specials on a cream plate.

### Rota as a cel-shaded picture book (2 October 2026, later)

William on the first 3D pass: "too realistic … but basic at the same
time"; the grass ugly, everything too small, "on mobile the game looks
completely" broken. Make it more cartoony, bigger and cleaner, make cut
routes clear, animate vehicles meeting them and turning back, and keep
Rota's own style apart from the other 3D games. Supersedes the look and
traffic bullets above; rules, layout of controls and numbers unchanged.

- **Look.** A cel-shaded picture book: every surface a clean flat colour
  (the Blender tints brightened and more saturated), three hard light
  tones (`MeshToonMaterial` with a three-step ramp), softened baked AO,
  and dark ink lines round every silhouette from a depth-edge pass
  (`three/ink.ts`). No photographic tiles (the 27 MB of texture downloads
  are gone; `public/3d/rota/tex` is no longer shipped), no tilt-shift
  blur. Neutral tone mapping, a bright sky fill so shade is never black.
  Arena stays glossy plastic toys under realistic light; Rota is drawn
  ink-and-colour.
- **Palette.** Two clean meadow greens in big soft patches; the plot a
  fresh lawn mown in a checker with pale grid lines; butter-yellow centre
  squares; slate-blue asphalt with cream kerbs and dashes; warm sand
  ballast with toffee sleepers and pale steel; bright turquoise water
  with white foam along every shore; terracotta and cornflower roofs.
- **Scale.** Roads 0.40 wide (lanes ±0.10), track gauge 0.126 on 0.34
  ballast, cars at 1.55× and trains at 1.4× their models, stations 1.35×,
  town houses 1.22×, trees 1.3×, barriers and buffer stops 1.45×.
  Overpasses rise to 0.36 so trains clear them. The camera has a longer
  lens (26°) and frames the board tighter.
- **Phones.** Tall stages look down more steeply (49° up to 72°), so the
  board fills the width and grows taller instead of a squat strip; the
  score plate sits centred under it when there are no plans.
- **Cut routes.** Every loose end has a big barrier or buffer stop and a
  pulsing red half ring on its open edge.
- **Traffic at dead ends.** Vehicles brake evenly to a stop short of the
  barrier. A car swings round in a half-ellipse U-turn into the other
  lane, leaning out of the turn; a train bumps the buffer stop with a
  small spring back, waits and runs back, the locomotive pushing. Cars
  avoid dead ends too short to turn in when there is another way. New
  vehicles pop in with a small overshoot; ones whose road is taken up
  shrink away instead of vanishing.

### Rota as a mill town (3 October 2026)

William on the picture book: three squares of rail sitting between two
things "just seems weird"; cars drive up to stations and vanish; cars are
as big as the houses; cars sink into the road going uphill and trains drive
through each other. "It shouldn't feel toy-like" (it is not an easy game),
and when someone builds a loop of road the board should fill up around it,
"so it kind of builds up to be a town". He chose a mill town over a canal
town and a valley ringed by tunnels. Supersedes the look, scale and traffic
of the two sections above; the rules, numbers and controls are unchanged.
Brief, scale table and model list:
[concepts/2026-10-03-rota-mill-town/brief.md](concepts/2026-10-03-rota-mill-town/brief.md).

- **The world.** The board is a cleared site in the middle of a northern
  industrial town, about 1950. The town round it already exists: its
  streets and its railway arrive at the edge of the site, and those are
  the exits. Roads are cobbled **streets** with flagstone pavements; rail
  is a **works railway**, so a short piece of rail is a siding serving a
  works and a shunting engine works it. Stations are **goods stations**
  (a shed with doors on every side), overpasses brick road bridges over a
  brick-walled cutting, centre squares the town's civic heart. Ridge's
  peaks are gritstone outcrops with a tunnel through; Harbour's sea is the
  docks, its piers stone wharves with a crane; rubble is old workings caved
  in; the Towns extension is called **Mills** (id `towns` unchanged).
- **The town grows** (`lib/games/rota/growth.ts`). Terraces line every
  street, mills, warehouses, sheds and coal drops every track, corner pubs
  and corner shops take the corners where routes meet or bend, civic
  buildings the centre, gas lamps the pavements. The more exits a network
  links, the grander it grows (cottages, then terraces, then three storeys
  and five-storey mills with chimneys). A loop of street becomes a block
  lined inside and out. Nothing stands on a route or leaves its square,
  and nothing is so tall that it hides the middle of a route or an open
  square from the camera: on the near side of a street the town steps down
  to cottages and lock-ups. New buildings rise out of the ground. When the
  match ends the empty squares fill too (allotments, a park with a
  bandstand, back-to-backs).
- **One scale.** A square is 25 m and every model is its true size divided
  by 25 (a car 0.16 long, a two-storey terrace 0.31 to the ridge); only the
  track gauge is widened a little. There are no per-family multipliers.
- **Traffic** (`lib/games/rota/traffic-sim.ts`, pure and tested). Every
  vehicle rests on two axles on the routes' one height profile, so it
  tilts up and over a bridge and down into the cutting. Trains hold the
  squares they stand on and the next before they enter it, so two never
  meet; one kept waiting backs off. Street crossings and a goods shed's
  yard take one vehicle at a time; turning vehicles keep their patch of
  street clear. A lorry calls at a goods shed door, waits and turns round
  in a three-point turn; a shunter meets the buffers gently and backs off.
  Vehicles come and go only out of sight: trains in a tunnel mouth off the
  board, street traffic past the edge of the picture. A network with no
  way out keeps one resident vehicle. Nothing is ever hidden on the board.
- **Look.** Sooty red-brown brick, blue-grey slate, sandstone, cobbles and
  flags under a low golden sun in a smoky haze, chimney smoke drifting
  east; still drawn in flat toon tones with ink lines, but sober colours.
  Liveries are railway paint in the seat colours. The old town round the
  site is a grid of cobbled streets on the half-squares (where the exits
  run) with blocks of terraces, mills, chapels and a gasholder, thinning
  into moorland.

### Rota: crisp surfaces and adaptive quality (3 October 2026, later)

William asked for much higher-quality ground, houses and streets, with
automatic reductions only when the client cannot keep up, and natural
traffic around cut routes. The mill town, its proportions, camera and
rules stay the same.

- **Surfaces are procedural** (`three/surfaces.ts`), drawn at the actual
  canvas resolution: running-bond brick, overlapping slates, worn setts,
  sandstone flags, cinder, grass, ballast and timber grain. Model UVs use
  their physical material scale; generated streets and town rows use a
  world-space projection. The grid and the town's surrounding streets use
  the same material functions. Recessed joints, per-stone variation and
  fine relief keep the three-tone lighting and ink. Pixel derivatives
  filter subpixel detail rather than letting roofs and ground shimmer.
  There is no low-resolution colour atlas to enlarge or texture download.
- **Quality starts high on phones too** (`lib/games/rota/quality.ts`).
  Native density up to 3×, with a six-million-pixel budget (never below one
  pixel per CSS pixel), 4096 shadows and up to four-sample antialiasing where
  the GPU supports it. Dense displays already supply fine edge sampling, so
  only lower display densities add multisampling; lowering quality never
  switches it on. Only the scene target allocates
  depth; the ink target stores HDR colour without duplicate depth/MSAA.
  Sustained slow frames step down to balanced, then low: lower shadow and
  sampling budgets, canvas density and fine-grain octaves. Sustained
  headroom recovers quality gradually. Loading, hidden pages and resizing
  get a grace period; a single stall does not lower quality. A lost GPU
  context restores at low quality before trying larger buffers again. Buildings,
  routes, simulation and the grid's tap targets never change with quality.
- **Traffic keeps its direction.** Fork and cross segments only join when
  their tangents agree, including the trail behind a train. Small cars and
  vans use three steering arcs with a pause at each gear change, with the
  whole body checked inside the kerbs and clear of sheds and barriers.
  Buses and lorries avoid branches without space to leave. Curved and raised
  connections, and adjoining junctions, reserve a clear way through before
  entry. A shunter reverses along the same track with its physical axles,
  body heading, pitch and wagon positions intact; a short siding receives a
  consist that fits. Harbour's short wharves are visible scenery, never a
  place for traffic to appear or vanish.
- **Small phones.** Six contracted badges, including three-digit scores,
  fit at 320 px without sideways scrolling; the material quality changes
  neither the controls nor their hit boxes.

### Rota: clear edges, readable points and phones (3 October 2026, evening)

William: the old town's small streets also touched the board, so they
looked like more places to connect; on phones the view was "completely
messed up", the points were hard to follow, the specials were tiny, and
other players' boards were hard to read at an angle.

- **Only exits touch the board.** The first ring round the site is an
  unbroken terrace backing onto the hoarding, two rows back to back across
  their yards, broken only where a main road or the railway leaves. A
  narrow back lane rings the terrace, and the old town's lanes start
  beyond it. Back lanes are narrower and paler than the streets you build
  (`LANE_HALF`, `RING` in `three/ground.ts`; the terrace in
  `three/scenery.ts`).
- **Phones look almost straight down.** Tall stages pitch the camera up
  to 76°, so the squares stay square instead of flattening into a wedge.
  Dice faces and specials are pictures of the piece seen straight down,
  never a tilted tile inside the tilted cube.
- **Points you can open.** The score block (the whole breakdown on wide
  screens, the total on phones) opens the points panel: each category's
  workings (every network and the exits it links, the longest routes,
  centre squares, mills, plans, loose ends) and the one-line rule behind
  it (`scoreParts` in `lib/games/rota/score.ts`). Phones put the plans and
  the total in one row under the board.
- **Bigger specials**: 60 px on wide screens, 44 px on phones.
- **Others shows plans.** Each other sheet is pictured straight down
  through a long lens, cropped to the board, larger.

### Rota: a living town, dusk and a loading screen (8 October 2026)

William is demoing Rota in his CV portfolio, ending on the finished board,
and asked for it to load quickly, make sense in motion and look as alive as
possible: a loading screen instead of a blank board, trains that never seem
to reverse, traffic only where it can come from, many more cars, people
walking the housing, crossings with lights, and lived-in houses.

- **Loading screen** (`rota-loading.tsx`). A goods train with an engine
  at each end crosses a brick viaduct into the mill town at golden hour.
  It never jumps: the town's layers, arches, rails and wheels slide at
  steady speeds as compositor animations, so they stay smooth while the
  board is being built (William found a train tied to the download share
  "jagged"). A light along the parapet fills, with a long ease, as the
  models arrive. The moment the board is drawn the train pulls away out of
  the picture as the screen fades into it (the station arrival it once
  waited for was dropped the same night, below). It never shows when the
  models are cached. The setup box starts the download while it is open.
- **Fast models.** The four GLBs are quantized and meshopt-compressed by
  `scripts/rota-assets.mjs` (15.7 MB to 5.2 MB, same geometry, under a
  millimetre of error at real scale), decoded with three's meshopt decoder,
  and served with immutable caching like Arena's.
- **Top and tail.** Every train has an engine at each end facing out, so
  whichever way it runs an engine leads.
- **Only live networks carry traffic.** A network carries vehicles when it
  runs off the board, or when it links two goods stations at least one of
  which a live network of the other kind serves. A siding or street that
  leads nowhere stays empty.
- **Busy streets.** Each street network that runs off the board carries
  about one vehicle per 0.7 squares of street, up to 22. Dead ends and
  junction corridors admit only what can turn or leave, so the streets
  never lock. The first network's traffic is fast-forwarded half a minute
  before anyone sees it, new vehicles start just out of the picture, and a
  vehicle leaving is gone once the picture has lost it.
- **Dusk.** The afternoon wears on with the match: golden in round one,
  blue hour when the match is over (`BoardView.dusk`, 0 to 0.8 over the
  rounds, 1 at the end). Windows light one by one, gas lamps throw pools on
  the setts, vehicles show head and tail lamps; routes and marks stay as
  readable as by day.
- **Town life.** Residents walk the back lanes and the old town's streets
  outside the hoarding (never the board or the exit roads) and call at real
  doors; zebra crossings with Belisha beacons where they cross a road exit,
  gated level crossings with red signals on the rail exits, closing for
  real trains; washing lines, birds and household smoke. Implementation
  notes: [concepts/2026-10-08-rota-town-life/verification.md](concepts/2026-10-08-rota-town-life/verification.md).

### Rota: traffic that flows, and passengers at the stations (8 October 2026, night)

William found the loading screen dragging on after the board was ready (it
waited for the train to run into a station and brake) with a glitch as the
train sped up; cars piling up, each waiting for the one ahead to finish a
whole square "though there's no light"; and asked for cars and trains to
set people down at the stations, realistically, with good pavements.

- **Loading ends when loading ends.** When the board is drawn the train
  pulls away out of the right edge (an accelerating compositor transition)
  while the screen fades (opacity only); about 0.7 s, nothing waits. The
  glitch was the old arrival: a frame loop changing every animation's
  playback rate while the main thread was busy drawing the board.
- **Junction boxes, not held squares** (`traffic-sim.ts`). Each way through
  a junction holds only its box: the stretch where its lane crosses or
  merges with another's. Cars drive up to the box's mouth inside the
  square, share the junction with anyone whose lane never meets theirs
  (opposite straights, two right turns), follow the car ahead straight
  through, give way first come first served, and only go in with room for
  their whole body beyond. Bends and bridges are never held. Drivers follow
  with the intelligent driver model: gentle starts after a short reaction,
  easing for bends (tighter turning right, on the inside), and a car ahead
  that is driving on counts as clearing the way. Measured over twelve bot
  boards: cars stood 63% of the time before, about 12% after; the median
  stop fell from 10 s to under 2 s (`work/` stats harness, not shipped).
- **Stations are ranks and termini.** Cars queue nose to tail on a
  station's street like a taxi rank, as many as fit, each pulling up short
  of the station steps, setting down, and turning round in turn. Trains run
  in to the platform and stand with their tail on the track behind (before,
  a train that did not fit the short station track never called at all).
- **Passengers** (`lib/games/rota/passengers.ts`, drawn by
  `three/passengers.ts` with the residents' figures at true size). A car's
  passengers duck out of the kerb-side doors, step up onto the pavement,
  walk to and climb the station steps and go in at the booking-hall door;
  a railcar's step down from its doors onto the platforms and walk in.
  People come out to wait on the platforms (facing the track) and at the
  kerb, and get in when their train or car comes; the vehicle stands as long
  as they need and its doors open and shut around them. Nobody waits where
  no passenger train or car runs, and anyone left waiting goes back in.
- **Stations rebuilt for people.** Passenger stations replace the goods
  sheds: a booking hall with a door in every wall on a platform-level bank,
  side platforms along each track with lamps, benches and a nameboard, and
  a flight of steps down to each street. Passenger trains are two-car
  diesel railcars (cab at each end); goods trains still run top and tail.
- **Pavements.** Every street and junction now has a granite kerb line and
  a darker gutter between the flags and the setts.
- **Mill sites** (the Mills extension) show their footings only while the
  site is empty; once a piece is laid there the town grows over it.
  Models brief and review:
  [concepts/2026-10-08-rota-passengers/models.md](concepts/2026-10-08-rota-passengers/models.md).

## Know Me and Quiz: everyone guesses everyone, four games each, the host picks (29 September 2026)

William's request, all at once:

- **Know Me guesses everyone at once.** Every Know Me game now runs in three
  steps: everyone answers for themselves at once; then everyone guesses
  **every other player at once**, one tab per player (their face and name),
  with **Next** walking to a player not yet seen and **one Lock** for all
  of them; then the answers are revealed one player after another, the host
  pressing Next between them. Points land as each player is revealed. Top
  Five (rules 7) and Dial (rules 3) moved to this format; saves from the
  one-list-at-a-time rules are retired. Top Five's team play, already off in
  setup, is gone from the engine.
- **Next says what comes next.** In every Know Me and Quiz reveal the
  host's Next names what it opens: the next player (avatar and name) in
  Know Me, the next place in Atlas (the photo's thumbnail and *Final* for
  the final), the next item in Sizes, the next event in Years, the next set
  in Order, and *End of round* (a flag) at the end. One shared piece,
  `NextStep` in `components/game/know-me-parts.tsx`.
- **Two new Know Me games.** **This or That** (`pick`): five shared pairs a
  round (Beach or Mountains?); pick your own side of each, then everyone's;
  2 points a right guess, 10 for all five, like a perfect Top Five. **How
  Many** (`many`): pick one of two questions about yourself (How many alarms
  do you set? Out of 10, how competitive are you?) and set your real number
  on a slider; the others guess it. The exact number scores 4, then 3, 2, 1
  inside bands that grow with the question's range (5%, 12%, 25%, never
  tighter than 1, 2, 3). The reveal is a ruler: the answer glows teal inside
  its bands and every guess drops in as an avatar. Both use the game-show
  look (cream cards, ink outlines, hard shadows). Content in
  `pick-pairs.ts` (150 pairs) and `many-questions.ts` (90 questions).
- **Two new Quiz games**, after the timeline and sorting dailies, on the
  measuring desk like Atlas and Sizes: three prompts a round, lock once,
  the host reveals them one at a time, up to 100 each. **Years** (`year`):
  one event from before 1800, one from 1800–1949, one since 1950, in a
  shuffled order (the eras are never labelled on screen); drag a tomato pin
  along a cream timeline (1000–2025) and fine-tune on the close-up ruler
  beneath it, joined to the timeline by a loupe funnel. The step tabs show
  each event's number and year so far; the other events' numbered markers
  stay on the timeline, so the three read in order, and tapping one picks
  it. No nudge buttons (2 October 2026). Right year 100,
  2 off 90, 5 off 78, 10 off 62, 20 off 45, 40 off 25, 75 off 10, 120 or
  more nothing, straight lines between. The reveal zooms the timeline to
  where everyone landed, the true year in gold. **Order** (`order`): five
  things to sort by a measure (Tallest first) on cream strips on the mat;
  20 per thing in its place, 10 one place off. The reveal lays the true
  order out with every value. Content in `year-events.ts` (74 events,
  undisputed years only) and `order-sets.ts` (39 live sets, neighbours at least
  about 15% apart so sources never disagree). Every set must be one an
  ordinary player can reason about: planet masses, lake depths, waterfall
  heights, desert sizes and capitals' altitudes were retired on 2 October
  2026 for everyday sets (inventions, games, brands, temperatures,
  pregnancies, team sizes, speeds).
- **The host picks by default.** Setup has a **Next round** choice: *Host
  picks* (the default) or *Everyone votes*. With the host picking, the
  opening pick, every end-of-round pick and the next-game pick after a match
  wait on the table host alone, with no clock; everyone else sees the tiles
  and who picks. The server refuses anyone else's pick. *Everyone votes*
  keeps the ten-second votes as they were. Stored as `votes` on the set
  state and `partyVotes` on the table.
- **Four games and End** on the pick: five tiles in a row on wide screens,
  two columns with End across the bottom on phones.

## Arena: eight new troops, Quest, a real loading screen (29 September 2026)

William's round of feedback, all at once (brief in
[concepts/2026-09-29-arena-quest](concepts/2026-09-29-arena-quest/brief.md)):

- **Two ways to play.** The box opens on **Versus** (the 1 v 1 and 2 v 2
  battles, as before) or **Quest**, a roguelite played alone or by a table of
  two. Versus now takes a **deck of eight** from the sixteen cards, built in
  a larger modal above the setup (`deck-editor.tsx`); each player brings
  their own online, and bots draw one of five ready-made decks
  (`lib/games/arena/decks.ts`).
- **Eight new troops, each a new role**, not a variant: the Pirate (cheap,
  fast, leaps at the first enemy for a double blow), the Viking (spins his
  axe round, rages below half health), the Gladiator (a shield soaks the
  first hits), the Medic (heals, never fights), the Miner (digs to any spot
  on the field), the Balloon (slow air tank for towers, crashes with a bang),
  the Inventor (lightning that jumps to three enemies and stuns) and the
  Gunner (a cannon that outranges towers, helpless up close). Four women and
  four men from eight eras; silhouettes never repeat an existing figure's
  (no second long coat or pointed hat). Numbers in [arena.md](arena.md).
- **Quest** (`lib/games/arena/quest.ts`, pure and shared with the server):
  three regions (Greenwood, Sunstone, Frostpeak), each a map of stops in five
  rows up to a boss. Battles (two minutes) pay gold and a choice of a new
  card or an upgrade (+10% a level, up to 5); elites and bosses give charms
  (fourteen passive boosts); camps rest or train; shops sell and remove;
  strangers offer a trade. Three hearts; a loss costs one. Each boss beaten
  unlocks one of five held-back cards for every later quest. Two players
  share one run and deck and fight two against two; the host makes each
  choice and the other player's taps show as suggestions, as in Folio.
- **Loading screen**: a painted splash with the title in the art, the deck's
  cards lighting up one by one as it loads, and one thick progress bar with
  a percentage. No sizes, no explanations. Decoding and shader warm-up fill
  the last part of the bar, so it never sits full while nothing happens.
- **A little less bright, better textures.** About 13–15% less bright with
  deeper, more saturated greens and real shadows; new painted tiles for the
  meadow, clay paths, forest floor and stone at full strength, and more
  painted detail on bark, foliage and rock.
- **Looser walks and a coat that trails.** See the walk notes below; the
  Cowboy's duster hangs from the waist on its own parts and follows the
  legs with a lag instead of swinging rigidly with each thigh.

## Mora: two new boards, Census, and goals you can read (29 September 2026)

- **Goal pictures.** Every Sanctuary Goal draws what it asks for in the board's
  own language (`components/game/goal-icon.tsx`): square or round pads (the die's
  two shapes), creatures as coloured dots (one colour is one species, different
  colours are different species, brown is any species) and dashed outlines for
  whole habitats. "Three alike in the Mangroves" shows three same-colour dots on
  three square pads; "A–B–A–B on the Pier" shows alternating dots on round pads
  with an arrow. The generic Lucide icons per goal type are gone.
- **Migration is retired.** William found it did the same job as Roam without
  being interesting. Old saves load: `upgradeSave` drops the flag, and a locked
  move that used it is withdrawn so that player chooses again.
- **Census replaces it.** At the end each species is counted across the table:
  the most on one board earns +3, tied leaders +1 each. It is the only Mora
  extension that looks at other players' boards, so it adds denial drafting. The
  crown in the dock shows your points; tapping it opens the count per species.
  Others shows each player's Census points.
- **Sunset Motel** (`desert`, intermediate, three rounds, 23 spaces) and
  **Glacier Dam** (`alpine`, advanced, four rounds, 28 spaces), each with six
  habitats, its own creatures and its own twelve goals; scoring in
  [the board rules](mora-board-rules.md). Motel: a desert roadside motel taken
  back by the desert (terracotta, sand, cactus green, faded turquoise). Dam: a
  mountain hydro dam taken back by snow and alpine plants (snow, ice blue, slate,
  pine, larch gold, a red cable car). Road and Spillway fill in order, like the
  Pier. Generation briefs and choices:
  [new boards record](concepts/2026-09-29-mora-new-boards/README.md).

## Yata: four menus in two places (29 September 2026)

William found **After Hours** and **Side B** confusing: nothing in either name
says what you will eat or why it is called that. The menus are now named for a
city, which says the cuisine at once and reads the same in any language. The two
Asian menus stay at the night-market counter; two new Mexican menus play on a
new plaza plate. Internal ids stay stable (`beginner`, `intermediate`), so
saves, accounts and online tables keep working.

| Menu | Id | Level | Rounds | Place | Dishes |
| --- | --- | --- | --- | --- | --- |
| **Tokyo** (was After Hours) | `beginner` | Beginner | 2 | counter | Gyoza, Ramen, Yakitori, Pickles, Takoyaki, Dango |
| **Bangkok** (was Side B) | `intermediate` | Intermediate | 3 | counter | Bao, Roti, Chilli, Rice, Spring roll, Coconut |
| **Mexico** | `plaza` | Intermediate | 3 | plaza | Tacos, Salsa, Elote, Tamales, Guacamole, Churros |
| **Puebla** | `fiesta` | Advanced | 4 | plaza | Quesadilla, Pozole, Mole, Tostada, Cactus, Flan |

- **Asian dishes that did not read as Asian were redrawn, not rescored.** Sesame
  balls became **Takoyaki**, the Western-looking pudding became **Dango** (three
  balls on a skewer suits its sets of three), Corn became **Spring roll** (Elote
  now belongs to Mexico), and the Coconut lost its cocktail umbrella for a Thai
  street-vendor coconut. Every dish keeps its kind index and scoring.
- **Mexico** keeps one idea per dish, new to Yata: a topping that needs a base
  (Salsa counts your Tacos), a race with second place (Elote), big sets of four
  (Tamales), a dish that rewards a short menu (Guacamole counts dish types you
  lack) and a capped square (Churros 1 · 4 · 9 · 16).
- **Puebla** is the advanced menu: pairs that grow (Quesadilla 5 · 7 · 9…), a
  race with a loser (Pozole: most +8, fewest −8, never at two players), a dish
  that snowballs (Mole, 1 per other Mole, up to 4), a crowd to avoid (Tostada is
  worth nothing to whoever has the most, ties included), odd counts (Cactus) and
  timing (Flan is dessert: 6 in the last round, 2 before). Flan was first "2 per
  dish type you have 3 of"; with 24 picks everyone always has that, so it paid
  8 a pick and was replaced.
- Round counts come from `yataRounds(contentSet)`; every menu longer than two
  rounds carries the `menuRounds` marker, and the Mexican ones must. Unmarked
  Bangkok saves still play their original two rounds. The supply is six of each
  dish per round, enough for six seats. Orders offer three recipes each round
  (12 of 26 at four rounds), and Seasons features every dish once a round.
- Bots add a look-ahead for the Mexican menus (`setPotential` in
  `lib/games/trio/bot.ts`): the best average gain of the next few copies of a
  dish, so they start sets, pairs, squares and odd counts. Balance:
  `node --experimental-strip-types scripts/yata-menus-balance.mjs 40`. Medium
  bots average about 39 (Tokyo), 62 (Bangkok), 55 (Mexico) and 66 (Puebla)
  points per player, and every Mexican dish earns between 2 and 3.6 per pick,
  except Tostada at two players (1.4), where "most, ties included" is a race to
  take fewer. These are bot figures, not human balance.
- **The plaza** (`yataWorldFor` → `plaza`, plates in
  `lib/games/yata-plaza-{landscape,portrait,phone}.json`) is a Mexican taco stand
  at dusk, drawn in the same toon language and plan view as the counter so the
  plates, tickets and menu boards sit in the same places: a turquoise enamel
  counter under a punched-tin star lantern, a comal and tortilla basket on the
  cook's side, terracotta tiles, marigold petals and flag strings. Hot pink
  takes the lantern red's place (`--market-accent`), plate rings avoid
  turquoise, and the Mexican dishes are drawn on non-turquoise vessels.
  Prompts and attempts: [new menus](concepts/2026-09-29-yata-new-menus/README.md).

## Setup boxes: one height, paged rows (1 October 2026)

Setups used to be as tall as their settings: Know Me 516px, Rota over 1000px
with a scroll. Every setup now has one height, set by Nox, the reference: a
deck pair beside three extensions (744px on a desktop, about 706px of it
used; 620px on a phone), capped by the screen. `components/game/setup-pages.tsx`
holds the pieces:

- `SetChoiceRow` shows boards, maps, menus and decks **two at a time** and
  `ExtensionRow` shows extensions **three at a time**. More sit behind a pager
  at the end of the row's label: one small capsule holding arrows either side
  of one dot per page, the More arrow in the game's colour. It stays inside
  the label's line with a few pixels clear of the cards beneath (the old 28px
  arrows sat on the cards' top edge), and its finger-sized targets never
  reach into the row below. A dot on another page carries a ring when
  that page holds the pick or a switched-on extension, and a setup opens on
  the page with its pick.
- `SetupOptions` is the settings grid. When its rows still do not fit (an
  online table adds Leads and Next round, a phone stacks Alto's rows) it
  splits at a visual row and the rest wait on a second page, with the same
  pager centred above Play. Waiting rows are hidden, not unmounted, so
  nothing picked or typed on them is lost. Fewer settings sit in the middle
  of the room rather than above a gap.
- On short screens the lid trims to its middle band (down to the phone cut)
  before a row has to wait; 720px-tall laptops fit every game on one page.
- Order is the same everywhere: Players, Bots, then the game's own choice
  (board, map, menu, deck, voyage and plans), then Extensions. Alto puts
  Players, Bots and Voyage in one row of three; Rota's map cards are the same
  2:1 card as every other board.

## Nox: the Papayoo deck, three players and the Anchor (2 October 2026)

William did not understand Mutiny and asked for a rule that also works at three
players on the Fast deck, for Nox to follow Papayoo more closely, and for the
Fast deck to be exactly half of the normal one.

- **The deck.** Four plain suits of 1 to 10 and Storm, the bad suit, of 1 to
  20: 60 cards, as in Papayoo. The **Fast deck is the normal deck halved in
  every way**: plain suits 1 to 5, Storm 1 to 10 (30 cards), the marked 4
  worth 20 against the 8's 40, Gold 10 against 20, Dawn 10 against 20, and
  half the cards to pass, rounded up (3 against 5). `stormRanks`, `tideDeck` and the
  value helpers in the engine hold this; a test checks every value is half.
- **Seats.** Nox needs **three players**; the duel deck and two-player Nox
  are gone. The Fast deck plays **three or four**: its 30 cards deal 10 or 7
  each (two stay face down at four). `seatRange` in the engine drives the
  setup (two never shows, five and six grey out under Fast), the online
  configure command (a seat count it no longer allows moves to the nearest
  one) and save validation (two-player saves and Fast saves above four no
  longer resume). Passing: 5 cards, 3 on the Fast deck, at every seat count
  (12 October 2026; it used to shrink from 4 to 3 with more players).
- **Mutiny is retired**, replaced by **Anchor** (`anchor`): the **Storm 1**
  doubles every card in the trick that holds it, Gold included; Dawn's extra
  points are added after. Nothing new to press: the lowest Storm card is the
  perfect card to sink under someone else's bigger Storm. It first sat on the
  1 of the die's suit, but medium bots found a scoring trick for it in only
  10% of normal three-player rounds (that suit rarely carries points). The
  Storm 1 lands in a scoring trick every round on both decks; over 40 medium
  bot matches per setup it adds 4% (normal, three players) to 12% (six, or
  Fast at four) of all points and changes the winner in 12–30% of matches.
  `upgradeSave` strips `mutiny`, every `haul` and Mutiny's event marks.
- **Showing the stakes.** Gold is struck in gold: foil card stock, brown ink,
  a bright inner rim and a slow glint, with its value on a dark tab (the
  cabin table strips card shadows, so the old thin rim never showed). The
  Anchor card carries an anchor ×2 tab and a cream rope rim. At the heart of
  the table, Dawn's sun with its +20 waits small all round and rises, bright
  and glowing, for the last trick; an anchor ×2 disc drops in while the
  Storm 1 lies in the trick. Score pops carry an anchor or a sunrise.

## Nox: Gold and Mutiny replace the old extensions (29 September 2026)

*Mutiny and the duel deck were retired on 2 October 2026, see above.*

William did not like any of Nox's extensions. Shields, Turning Tide and Salvage
each added a layer that was more annoying than interesting: something new to
press, or a rule to keep checking. He pointed to Yata as the model: its best
extensions give a known choice a new reason, with no new button. All three are
removed from the engine, bots, setup, table, rules and online tables. Nox's
extensions now follow one test: **no new control, only a new reason to play a
card.** You still only pick cards to pass and cards to play.

- **Gold** (`gold`). The top card of the die's suit (the 10, or the 5 in Fast)
  takes half the marked card's value off whoever wins it: 20, or 5 in Fast.
  Suddenly some tricks are worth winning, and the Gold trick is where the
  marked card gets dumped. The card shows its value on a gold tab inside a
  thin gold rim; the die's popover names it. Scores can go below zero.
- **Mutiny** (`mutiny`, three or more players, normal deck). Win every Storm card and the
  marked card dealt in a round and they cost you nothing: every other player
  takes those points instead. It settles on the trick that brings in the last
  penalty card (the score pop carries a skull), so everyone watches the player
  who is hoarding and sometimes eats a small card to stop them. Players carry
  `haul`, the round's penalty points from penalty cards. `mutinyPlays` turns
  it off, and greys the setup tile, in two cases measured with bots: with
  two players one perfect dodge hands the other a Mutiny in about 60% of
  rounds, and in the Fast deck's five-card suits whoever holds the lead takes
  everything (hard bots managed it in about 40% of rounds). With the normal
  deck and three or more players it is a long shot: about 0–2% of rounds for
  medium bots and about 7% for hard bots at three players. Medium bots do not
  chase or block it; hard bots' rollouts score it for real.
- **Dawn** (`dawn`, added 1 October 2026 as the third extension). Whoever wins
  the round's last trick takes extra points, as much as Gold takes off: 20, or
  5 in Fast. Nothing new to press: it only changes which card you keep for the
  end (a low one) and makes the last lead a threat. The score pop on that trick
  carries a sunrise. Measured with medium bots over 150 matches each, Dawn is
  about 18% of all points and changes the match winner in about 13% of
  three-player matches, 7% at four and 2% in the duel.
- **Old saves.** `upgradeSave` in the engine strips the retired fields from
  solo saves and online tables before validation; a match that used them
  plays on under the plain rules with its scores kept (a Salvage decision in
  progress becomes the trick's first play). The retired sixth `createGame`
  argument stays as an ignored slot so positional callers keep their meaning.

## Floodline: use the phone's lower stage (28 September 2026)

Portrait phones up to 600 CSS px wide use a taller fresh composition,
`mora-phone-floodline-v7-a`, with larger vertical gaps between habitat rows.
The lowest label centre is about 56 px lower at 390×844, while creature size
stays 28.42 px. Portrait tablets keep v6-c, which already fills their shorter
stage; desktop keeps its existing landscape source. The board, placement
coordinates, scene camera, miniatures and preload list use the same phone
selection. The hand and controls retain their existing positions.

This source was generated independently from text, with no image references or
edits. Six normal-phone coverage and full-landmark checks pass. Two short-phone
windows still need the existing soft scenery margins. Live browser verification
was unavailable in this follow-up because the browser connection timed out.
Measurements and sources are in [the taller composition record](concepts/2026-09-28-mora-clean-boards/floodline-v7-review.md).

## Mora: artwork quality follow-up (28 September 2026)

Observatory's Watchpost and Glasshouse label groups sit 4 CSS px lower in
portrait, keeping each title, score and explanation together. Courtyard stays
in place because its explanation is already close to Watchpost.

Floodline's repeatedly edited v5-g source was rejected for degraded detail.
Generate every replacement candidate afresh from its written brief without
image references. This also applies to framing corrections: improve the brief
and start again. Image edits require an explicit user request. This rule is
saved globally in Codex AGENTS.md and in the project artwork skill.
The replacement is `mora-phone-floodline-v6-c`: a fresh text-only source with
23 measured pads, the same gameplay crop and creature size, and no image edits.
Its Release label sits below the middle-row explanations with clear spacing.

## Mora: clean phone boards and compact information (28 September 2026)

Both portrait boards were generated afresh from written briefs, then corrected
for framing: Observatory `mora-phone-observatory-v5-c` and Floodline
`mora-phone-floodline-v5-g`. Organic ground and water replace the horizontal
strips in front of habitats. The 17 and 23 placement spaces keep their capacities;
measured coordinates follow the new pictures. Creature sizing remains close to
the previous phone boards. Complete structures fit the normal phone frames,
including Floodline's shorter lighthouse and signal mast below the badge row.

Habitat explanation cards have less padding on all sides. In Others, Roam and
Migration are small icon-and-count columns beside the three goals, on one row
with room between goals. At 360 px and below, one opponent board per row keeps
that information readable. Goal inspection still opens from the shared control.

The shared scene camera's landmark containment interval now has the correct
lower and upper bounds: a feasible full-landmark fit wins over the preferred
horizontal nudge, without changing scale. Sources, prompts, measurements and
validation are in [the artwork record](concepts/2026-09-28-mora-clean-boards/README.md).

## Arena: heraldry, articulated walks and calmer musical urgency (28 September 2026)

Tower backs now carry heraldic shields; their sides and backs have restrained
vertical team-colour ribbons. The castle adds gold pinstripes, rear lanterns,
a crown crest and a small roof pennant, within the existing size envelope.
Meadow paint has slightly more colour variation and the terracotta paths
have warm shoulders and broad painted strokes, without fine texture noise.

All walking figures have separate knee and ankle joints in their Blender
assets. A recovering leg bends at the knee, the ankle counters the hip and
knee to keep the sole level, and late stance includes a small toe-off.
Body bob is reduced. These joints also exist in deployment previews;
head proportions and the smaller Dino stay unchanged.

Troops retain a living, targetable troop lock through walk/attack transitions
while that target stays within sight plus a small tolerance. Death, invalid
target type or leaving sight releases it. Approaching a tower can still be
interrupted by defenders. Placement warnings are amber exclamation badges
above enemies that could hit the new unit, replacing the ground range discs.

Sound Lab offers two alternative Arena music pairs from unused original
ElevenLabs takes 2 and 3. New generation attempts failed for insufficient
funds; the exact prompt and result are preserved in `music-v2/generation.json`.
Each final-minute loop uses the same recording as its battle loop, remastered
with an 8% pitch-preserving tempo lift, bass/low-mid emphasis and gentle
compression. The game retains take 1 with the same revised final-minute
processing. Previewing never changes the game's music selection.

## Arena: one cartoon world and expressive faces (28 September 2026)

Mobile and desktop use the same simplified tower shells, figures, scenery
and native-resolution texture sources. Device performance controls only
rendering quality: full screen density (up to 3× DPR) and 4096 shadows at
entry, then measured frame pacing adjusts resolution and shadow cadence.
The lower rungs retain native density on 1× screens and at least 1.5× on
denser screens; shadow detail drops before render resolution.
Phone troop framing remains tied to the viewport, not the quality tier.

The world uses jade meadow without a checkerboard, terracotta paths,
pale sandstone towers, teal trees and muted lavender rocks. Fresh grass,
forest-floor, foliage and stone textures are retained at their native
1254-square resolution; grass repeats every 3.2 metres instead of stretching
one tile over 12.8 metres. Texture anisotropy uses the GPU's supported maximum.
Trees have fewer small canopy clumps and softer surfaces; bark, masonry,
bridges and rocks use restrained painted detail and low relief throughout.
Tower footprints, platform heights, the 0.7 scale and the camera are retained.
Tower bodies now use a continuous rounded sandstone shell with a subtly
tapered wall, softened lip, one heraldic shield and a clean team-colour
parapet. The king has a nested hipped terracotta roof. The projecting foot
and horizontal stacked courses are removed.
The Dino's whole visual model is 22% smaller, including the placement
preview and articulated limbs; gameplay collision and stats stay unchanged.

The oversized-head experiment is removed. Adult head proportions stay at
1×. The Blender sculpts use clearer ivory eyes, dark pupils, catchlights and
shaped brows; the Samurai's full face mask is removed, helmet openings are
wider, hat fronts are shortened and lifted, and the pilot parks his goggles
above exposed eyes. The refinement removes the craned-back neck: humans
lift only 5°, robots and pilot 4°, and the Dino is neutral. Eyes and brows
are larger within the unchanged skull; clear mouth shapes distinguish the
confident Cowboy/Cadets and focused guard/Samurai. These are
painted expressions, with the existing head/attack animation joints intact;
placement ghosts and battle figures share the same model.

The ready moment lasts one second and every seat starts at 7/10 elixir.
One short original brass cue marks battle start, at a consistent pitch;
music begins with battle rather than during the ready moment. Refill rates
stay unchanged. These are Arena tuning choices inspired by the genre, not
a claim to reproduce Clash Royale's exact rules.

## Arena: smaller towers, full-size archers (27 September 2026)

Both side towers and the central castle are drawn 30% smaller on both teams.
Their archers keep the approved size and stand on the lowered platforms.
Rubble, health-bar positions and projectile heights follow the smaller
buildings. The camera, troop sizes and gameplay remain as approved.

## Arena: quieter effects and more visible figures (27 September 2026)

The effects bus is about 10 dB quieter; the music mix stays at its existing
level. Wide views lower the camera from 50° to 42°, retaining the fitted
whole field; portrait keeps its 70° view. Troops grow 18% on every device,
with another 12% across both horizontal model axes so their silhouettes
read from either team's end. Placement previews use the same proportions.
The existing portrait size boost remains, and tower guards follow the shared
figure proportions. This updates the higher-camera direction below.

## Lucky: a 3D factory you can read (3 October 2026)

William found the painted factory cold and hard to read: it was not obvious how the machines worked or what state they were in, and tickets flying into machines and money going up looked poor. He asked for a 3D factory where everything is animated, still efficient on desktop and phones, and nicely balanced.

- **The floor is live 3D**, an explicit exception to the 2D board games like Arena and Rota: enamel-and-brass toy machines modelled in code, on the painted tile floor in a brass frame with chasing marquee bulbs, under warm light with real shadows. Rounded housings, mechanical fittings and distinct enamel, metal, rubber and glass materials retain their detail close up. The camera fits the whole floor and turns it upright on phones, so building works as before (tap, drag lines, drag machines, marquee, keys).
- **Inspect the factory:** zoom from the complete overview to 4× with the wheel, a pinch or the +/− buttons. Pan with the arrow button or a middle-mouse drag; Fit restores the overview. Zoom keeps the viewing angle and the floor under the pointer still. A pinch cancels a pending edit, and neither finger can place, move or remove a machine when it lifts. Resizing preserves zoom. Full model geometry, antialiasing and mipmapped full-size tickets stay sharp at every distance; close views start with finer shadows. Frame pacing reduces shadow refreshes before making a modest resolution reduction, never below 85% of native resolution or one drawing pixel per CSS pixel.
- **Every machine shows how it works**: the printer's drum and press, the bot's coin arm scrubbing the ticket on its platen, the stamper slamming, the till's drawer and flag, the splitter's arrow to its next exit. Boosters glow and link to what they help only while they help.
- **Every machine shows its state**: a lamp (green working, amber full, red stuck with a warning disc, dark idle), gauges on printers and bots, a one-word state in the inspector, and in/out arrows on the selected or held machine. Belts with a stuck ticket stop.
- **Tickets and money move properly**: tickets glide and slide into intakes, lie on platens while worked and drop into the till; each sale bursts coins from the till, a coin arcs into the purse and the amount rises over the till.
- **Balance**: a printer now takes a third of a scratch bot's time on its book, so one printer keeps three bots busy on every book (it used to starve Fast printers and ink wells completely); the gilder, charm and bundler blueprints arrive with Ladder, Gold Mine and Sun & Moon instead of all being bought by minute 26. Pacing milestones are unchanged.

Details in [relic.md](relic.md).

## Lucky: unlimited book levels (27 September 2026)

Book levels now continue indefinitely, distinct from the three puzzle difficulties.
The shelf shows the numeric level, a gold progress bar and exact ticket counts.
After difficulty III opens, each new level needs 15 more hard tickets than the
previous one (reduced by Early print); each adds 50% of the level 3 value to both
prizes and prices, including factory sales. Existing progress is retained.
Twins I uses the former II puzzle, II uses the former III, and III allows one mistake.
A development-only **Dev workshop** creates a separate late-game save for solo or
a table, with high book levels and a large, busy, deliberately inefficient factory.
This replaces the maxed-book endpoint described below.

## Immediate private placement (27 September 2026)

Mora and Yata show your submitted creature or dish on your own board immediately,
including its extension effects, and remove it from your hand. Online placement
previews before acknowledgement; a failed submission restores the authoritative
board. Reloading restores your accepted pending placement. Undo withdraws it while
another player is still choosing. Other seats see only the resolved board until
all choices are ready; previews never rotate packets or reveal other decisions.
Placement sounds play when you act. Strategy matches with only bot opponents
omit the next-turn cue; human multiplayer keeps it.

## Arena: cartoony, a higher camera, fair lanes and sound (27 September 2026, later)

William's review of Arena against the classic cartoon tower-battle game,
all decided by him:

- **Cartoony, brighter, everywhere.** The board read too dark and too
  realistic, most of all on phones and in the woods. The graphite studio
  void is gone: the valley sits under a clear bright sky with a light haze
  in the distance, lit by a stronger sun and sky, with a tone curve that
  keeps colours saturated and bright blue water. The surface tiles are
  regenerated as stylised cartoon textures, high quality but with less
  detail (v4). This supersedes the realistic miniature materials of the
  Collector's Diorama; the models and their shapes stay.
- **Cartoony cards that show the count.** The card portraits were too
  perfect and too AI-looking; the new set (v5) is drawn as cartoon
  characters, and each shows how many troops it brings: two Cadets, three
  Robots.
- **A higher camera, the same angle everywhere.** 70° on phones, 50° on
  wide screens (it was 59° and 33°), so troops coming at you read all the
  way up the field. Phones always show the whole field with both side walls,
  level on both sides; wide screens let the valley fill the sides and let
  the near wall ends drop beside the hand so the field is as big as it can
  be. The valley's slab is wider so no edge of the screen shows the void.
- **Troops keep their lane.** A card's troops walk the lane of the spot it
  was dropped on, whatever their formation or shoves; they change lanes only
  by chasing an enemy troop over the middle. A lane whose small tower fell
  leads to the king over its own bridge. The Dino goes for its lane's tower,
  not whichever tower is nearest.
- **A warning while placing.** Holding a troop card shows, as red dashed
  rings, the reach of every enemy tower and troop that would shoot it where
  it would land.
- **Elixir visibly refills** on every browser: each bead's fill is set
  directly every frame.
- **Natural walks.** Ground troops plant each foot and sweep it back at the
  ground's speed, then lift and swing it through; the body dips on each
  step, rolls onto the planted foot and the arms swing with the opposite
  leg (the Robots and the Biplane were already fine).
- **Phones adapt, strong phones match the desktop.** Every device starts at
  its best; if frames slip the pacer steps down a ladder (60 fps cap,
  shadows every other frame, resolution, shadow size) only as far as that
  device needs, climbs back when there is room, and never hunts up and
  down. This reverses the earlier "never lower quality" rule for weak
  devices only.
- **Sound in the style of the genre.** A whoosh and thump as a card lands,
  a cue for each troop arriving, its attacks and its fall, arrows, cannon,
  collapsing towers, the Meteor, horns, a countdown tick and end stings,
  all generated with ElevenLabs (sound.ts). Original orchestral battle music
  now replaces woodland ambience: relaxed and cheerful near 96 BPM, rising
  to about 144 BPM for the final minute and overtime, with crossfades and
  music ducking for major cues. Overtime elixir generation is **2.5×**;
  the final regulation minute stays **2×**.

## Mobile library and Yata refinements (27 September 2026)

- On phones the library's multiplayer action is a compact icon immediately
  before Menu, and each shelf shows two larger covers with a peek of the next.
- Setup keeps **Learn**, **Play** and, when progress exists, **Continue** in
  its bottom row. Play is the largest action and starts directly, with no
  second choice modal. Learn stays available regardless of completed games.
  Folio and Lucky keep their existing run pickers in that same footer.
- Quiz Sizes follows a growing or shrinking silhouette with its camera,
  zooming back in as it shrinks but never closer than the initial comparison.
- Yata's phone tray reserves two rows even with a partial or empty hand, so
  drafting from four tickets to three cannot move the board or dock. Tickets
  give food more space and scoring text two more pixels. Dish names use bold
  slanted market-sign lettering rendered as text.
- Others reuses the public Market Seasons route: a tick replaces each matched
  dish, unmatched dishes fade, and private pending choices never count. Phone
  routes run horizontally like the main phone board.


## Arena: Collector's Diorama, a Medieval board (26 September 2026, night)

William tried the Toybox direction (toys on a child's bedroom floor) and
stopped it: keep the collectible feel, but grown-up, never childlike and
never in a room. From two new mockups
([concepts](concepts/2026-09-26-arena-retheme/README.md)) he chose
**Collector's Diorama** (`arena-collector-desktop-v1.png`, brief
[diorama.md](concepts/2026-09-26-arena-retheme/diorama.md)):

- **The battlefield is a premium collector's diorama**: a master
  model-maker's miniature landscape on a slim bevelled graphite plinth,
  floating in a soft graphite studio void and lit like a luxury product shot
  (a large warm key light up to the left, a cool rim light behind, studio
  reflections). The landscape ends at the plinth in a clean cut showing turf,
  earth and rock.
- **A genre per side, Medieval for now.** Later each side's half and towers
  take a genre of their own (two to choose from, more after). For now both
  sides are Medieval, as the mockup's near half: a cobbled field with moss
  and grass in the gaps, moss-covered dry-stone walls, a stone-embanked
  river of dark glossy water, an old stone arch bridge (left) and a
  timber-decked bridge (right); stone keeps with slate roofs and big team
  banners, round stone watchtowers with pennants, tumbled stone for rubble.
- **The first Arena's forest is back round the board**, rebuilt at diorama
  quality (clump-foam oaks and pines, fractured rocks and cliffs, tufts),
  with camp dressing (wells, carts, hay, a tent per side, torches and team
  banner posts). Materials are realistic miniature tiles (v3), team colour
  only in heraldry.
- **The HUD is the display case**: dark matte smoked glass with thin brass
  edges, collector cards with a holographic foil border, faceted violet cost
  crystals and a slim segmented elixir bar. On phones the top right holds
  only a square with the time (the crowns and pause button give way; the
  time opens the menu) and the field rises to just below the top edge.
- **This round is the board only.** The troops, their card art and their
  animation are the next round. Kept from the Toybox work for it: the
  Meteor replacing the Knight (rules in [arena.md](arena.md)), the troop
  names, the springy animation system and the finished figure models (in
  `assets/arena/blender/troop_*.py`, not yet built into the game).
- **Phones, a bigger field and full sharpness** (same night, after his
  review). The phone view tilts to 63° and crops the meadow outside the
  fence, so the field fills more of the height and the far king's turrets
  reach almost to the top edge (its bar is held on screen over its roof).
  Phones draw at their screen's full density with desktop shadows; they
  had looked soft at 1.6×. Trees keep their models (fine on desktop).
- **Figures in the mockup's collector style**: hand-painted miniatures,
  grown-up and sculpted, in `figures.py` (review shots in
  `concepts/2026-09-26-arena-retheme/figures-v1/`). Built: the watchtower
  guard (a hooded, bearded longbowman in a team tabard who turns side-on,
  draws to the cheek and looses arrows; the towers now shoot arrows), the
  Samurai (navy lacquered lames laced in cream, gold kuwagata, a two-handed
  katana) and the Dino (a navy-hided rex with gold-edged armour plates and
  a cream belly). They await William's verdict before the rest follow; the
  card portraits are still the Toybox ones.

## Arena: every figure built, era cards, x-ray and fair placement (27 September 2026)

- **All eight collector figures are in the game** (`figures.py`): the Cadets
  (1960s pressure suits, retro ray guns), the Robots (1950s enamelled tin,
  the key turning on the back), the Cowboy (an 1880s duster and a
  lever-action rifle held in both hands), the Biplane (a 1917 doped-linen
  model with a wooden propeller and a pilot), the Wizard (a cobalt robe, a
  charcoal mantle, a staff with a glowing crystal kept upright as he casts),
  beside the Samurai, the Dino (now with muscled legs and flank scales) and
  the tower guard. Cadets and Robots are plainer than the Samurai.
- **Cards show each character close up, in its own era**, in the game's own
  clean 3D look: William found the first era set (detailed product shots
  of painted miniatures on bases) too detailed and the characters too small,
  so the chosen set (v4) crops in so the character fills the card, keeps the
  surfaces smooth and the detail to what reads, and blurs a simple backdrop
  of its era (a lunar landing, a Cretaceous jungle, an atomic-age lab, a
  castle courtyard, a frontier town, a 1917 airfield, a tower library, a
  dusk valley for the Meteor). The library box and the setup lid follow the
  same look: the diorama on its plinth, figures of several eras over the
  bridges and a brass "Arena".
- **Hidden troops show through** as soft silhouettes in their team's colour
  as you see it, where towers, keeps, bridges or scenery cover them; the
  placement ghost too. The tower guards never do.
- **A card is never lost to a bad drop.** While you drag, the tray fades so
  the field beneath it (behind your king) takes the card; a drop on the
  river, the enemy half or a tower goes to the nearest legal spot, which the
  ghost shows as you drag with a faint line back to your finger. Letting go
  over the cards themselves still cancels.
- **Troops never get stuck on their own towers** (they walk round them) and
  wide troops queue at bridges; two Dinos meeting head-on pass.
- **Lower cameras**: 33° on wide screens, so the valley reads deep; 59° on
  phones, so the view is not a flat map. **Phones draw figures larger**
  (2.3 times their footprint instead of 1.75), with their rings, shots and
  bars; towers keep their size.
- **The valley is full**: dense woods of pines and oaks (far trees use
  lighter models), hedges, rocks, deadwood, paddock fences and camp
  clutter, with lanes, river and the near end kept clear.

## Others and leaving, reworked (26 September 2026, evening)

William's direction for Mora and Yata's Others and for leaving a game, all
decided by him:

- **Others looks like Menu.** The Others button wears the same island as
  Menu in each world. Hovering lifts it a touch; nothing lights up behind
  the word.
- **Mats look like your own board.** Each opponent's mat in Others is drawn
  the way this screen draws your board: Mora's landscape or portrait map
  (habitat labels cut to their scores, creatures a little larger), Yata's
  wide counter, or the phone's near-square counter with round plates.
  Phones show two mats to a row and wide screens up to three; the panel is
  only as tall as it needs, and nothing sits under the close button.
- **The passing loop.** The passing order is one row of avatars in the order
  the cards travel this round, with a line back to you underneath. Tapping
  an avatar jumps to that player's mat, and the mats follow the same order.
  Names show on wide screens; phones keep the avatars only.
- **Yata's resources are icons.** Stall permits are the stall icon with the
  number left; Market Seasons stays written out. The list of open stalls is
  gone: the stall sign on the plate shows where each one opened, and it is
  bigger on the mats (icon only on phone plates).
- **Leaving asks once, and says the game is saved.** The Saving screen is
  gone. Leaving a saved board-game match, an online match or a Folio run
  opens one shared dialog (`components/game/leave-dialog.tsx`): a check
  mark, the question, a line saying the game is already saved, then
  **Leave** above **Keep playing**, the same order everywhere, solo or
  online. Lucky leaves directly once its scratches have landed, as it did
  before the Saving screen.

## One menu, plain rules, a saving beat (26 September 2026)

William's direction, all decided by him:

- **Nothing can be selected or copied.** Text, rules and images cannot be
  selected, copied, long-pressed for a callout or dragged out, on any device.
  Fields you type into still work normally; invitation links are shared with
  their copy buttons.
- **Arena's How to play is the model for every explanation.** Every game's
  rules now use the same few pieces (`components/game/rules.tsx`): short
  sections with a plain two-to-four word heading, one or two short
  paragraphs with the key words in bold, one purple note for limits, and
  compact name-and-line lists for cards, dishes, habitats, books and
  puzzles. All the explanation text was rewritten simpler: the board games
  and their extensions (Nox's especially), Know Me, Quiz, Folio and Lucky
  (whose How to play was the worst). The old purple "outcome" callout is
  gone.
- **One menu for every game.** The Menu button drops a panel down the right
  side (`components/game/game-menu.tsx`) instead of opening a modal over the
  table; a tap outside only closes it. Every game lists the same things in
  the same order: How to play, the game's own entries, sound switches
  inline, fullscreen, extra content such as Lucky's totals or the host's
  table settings, and Leave. Arena's pause button opens it too, led by
  Resume, and the battle stays paused while it is open. Lucky's separate
  mute, help and fullscreen buttons moved into it.
- **No Confirm moves, no Advanced view.** Both settings and the account
  preference behind Confirm moves were removed: tapping or dropping a card
  plays it at once. Nox's pass keeps its lock plate (Secret Salvage, which
  also had one, was retired on 29 September 2026).
- **Leaving shows that the game is saved.** (Superseded the same evening:
  the Saving screen was replaced by one leave dialog that says the game is
  saved; see the section above.)

## Nox: the Chart, a flat treasure-map poster (26 September 2026, latest)

William found the painted Gilt Hold the one Gamehub world that looked AI
generated, and asked for Nox to be redesigned. After two rounds of desktop
mockups (`docs/concepts/2026-09-26-nox-redesign/`) he chose the flat graphic
poster style, kept pirate themed, and picked **Chart**: the table is the open
sea at the centre of a 1950s pictorial treasure map, drawn by a great graphic
designer. He asked for the interface to follow the mockup as closely as
possible, not only the board.

- **Plates.** `nox-chart-landscape-v1-b.png` and `nox-chart-portrait-v2-a.png`
  (production notes and measurements in the concept folder's `production/`).
  The playing surface is a flat, even navy rectangle inside a cream-and-red
  twisted-rope rim; around it the chart: compass rose, crescent moon, volcano,
  an X island at the end of a red dotted route, a galleon, a sea serpent, a
  skull island and a whirlpool, in flat shapes. The moon at the upper left is
  the one light: its translucent wedge breathes, the open sea's wave marks
  drift, and the X, the compass and the flag glint. The geometry keeps the old
  footprint, so the camera framing is unchanged; `table` is the rope's outer
  edge and the seat anchors sit on the rope.
- **Materials of every app-drawn piece** (table-worlds.css §2, the Nox tokens
  `--nox-*`): navy fills, cream edges, treasure red for action and turn, teal
  for direction, one heavy geometric sans (Futura first) and flat offset
  shadows falling to the lower right. No gradients, glows or bevels.
- **Cards.** Cream card stock with a thin inner line, a heavy index (rank and
  small suit) at the top left and one big flat suit mark in the middle, which
  shows only where no card overlaps it. Spades black, hearts red, clubs teal,
  diamonds palm green; Storm cards are split red and black with a cream bolt.
  A costly card's penalty sits on a small red tab. The face lives in
  globals.css, sized in container units, so the hand, the table, the
  inspection dialog and the drag ghost share it.
- **Seats.** Navy pills edged in cream lying on the rope: a black flag disc
  with the seat's own emblem (a pierced heart, crossed cutlasses, a skull and
  crossbones, an hourglass, a crescent and star, a compass star;
  `nox-emblems.tsx`), the name and the score. Side seats are upright capsules
  along the rope. The player to act gets a red ring and a red edge; LEAD is a
  red tab. On portrait screens the name gives way to the emblem.
- **Direction.** Four teal chevrons just inside the rope, one per side, chase
  each other clockwise or counterclockwise (this supersedes the single centred
  arrow of 19 September).
- **Dock.** On wide screens one rope-edged navy tray holds the die, the tokens,
  the hand, the confirm plate and Undo, which is a round cream button at the
  tray's right end (it had been drawn off-screen on wide desktops). Elsewhere
  the hand's own tray takes the rope edge. The die is the shared cube in cream
  stock. (Nox's extensions have no tokens since 29 September 2026.) Pass, Lock and Play are flat red plates; Clear and
  the other choices are cream-edged navy; disabled plates stay solid.
- **Navigation.** Back and the Nox wordmark share one navy pill (it reads over
  the moon), Menu is a round cream button with three bars, and the round pill
  is cream. Nox has no top badge row, so on wide screens the round pill sits on
  the top line, level with Back and Menu, clear of the seat tags. Phones keep
  the shared top bar.
- **Covers.** New square and wide covers in the same poster style
  (`box-nox-blind-v2`, `box-nox-wide-v2`); the lid sentence now reads "A pirate
  treasure map at night".
- **Known limit, unchanged from the Gilt Hold.** On short wide windows (for
  example 1536x730) and portrait tablets the table cannot be large enough to
  cover the full width, so a soft copy of the chart fills thin side bands.

## Arena: online, two against two, a bigger field (26 September 2026, later)

William's first round of feedback on Arena, all decided by him:

- **Online and 2 v 2.** Arena now runs at tables as well as solo. The host
  opens Arena's box at a table, picks **1 v 1** or **2 v 2**, arranges who
  plays blue and red (tap a name to swap; bots fill empty seats) and presses
  Play; everyone lands in an online room at `/arena/<token>` and Back returns
  to the table. Solo also offers 2 v 2 (you and a bot ally against two bots).
  In a team battle every player keeps their own hand and elixir, teammates
  share their half, and towers have 1.7 times the hit points and hit 1.25
  times harder, because twice the troops come at them. The host starts the
  next battle; nobody else is asked to confirm. A player who drops out is
  covered by a bot after five seconds and takes the seat back on return.
- **Lockstep, not video.** The server owns the clock and the one true match
  and streams every tick with the cards played on it; every device runs the
  same deterministic simulation on the same cards (the engine avoids
  Math.hypot and trigonometry in anything that decides the battle, so every
  browser computes identical numbers). A checksum every second catches any
  drift, and a drifted device takes a fresh snapshot. A card you play online
  waits as a pulsing ring until the server echoes it; the one-second deploy
  hides the round trip.
- **Top of the screen: back and the clock, nothing else.** An exception to the
  shared navigation contract, by decision: no game name, no player names or
  badges and no Menu button. A back button at the top left (asks before
  leaving); at the top right the clock with the two crown counts beneath it,
  and beside it a small pause button (a settings button online, where the
  battle cannot pause) that opens Resume, How to play, Sound and Restart. The
  clock warms and ticks each second in the last minute, flares red in the
  last ten seconds and burns in overtime. The freed height goes to the field.
- **A wider, lower view on wide screens.** Tall screens keep the steep view
  (57 degrees, which William liked on phones). As the free area gets wider
  the camera drops to 38 degrees with a 40 degree lens, so on a laptop the
  field spans most of the width and recedes into the woods; the strip behind
  your king may sit under the hand. A player on the red side sees the same
  framing from the other end, with their own team drawn blue.
- **Bigger troops.** Troops are drawn 35% larger (the guards on the towers
  follow), which reads much better on phones; flyers fly higher to match.
- **Tower guards stop spinning.** With nothing in range the guards and the
  king's cannon now look calmly out over the field; before, the red side's
  guards turned half a circle every frame.
- **Smooth at 60 and above without lowering quality.** Every troop part on the
  field is drawn through one batch per material, so a crowded 2 v 2 costs
  the same few draw calls as an empty field; walls, towers and scenery are
  merged or instanced and culled. A frame pacer settles a fast (120 Hz)
  screen on a steady 60 when it cannot keep up, and only lowers the drawing
  resolution a little if even 60 slips, stepping back up once there is room.

## Arena: a real-time battle in 3D (26 September 2026)

At William's request Gamehub gains its first real-time game and its first real
3D world: **Arena** (id `arena`, provisional plain name), a Clash Royale-style
battle against a bot, listed first under Strategy. This is a deliberate
exception to the 25 September decision that board games stay painted 2D
plates: Nox, Mora and Yata are unchanged, and the painted-plate rules of the
game-world-layout skill still apply to them.

**Rules** (`lib/games/arena/engine.ts`, `bot.ts`, `cards.ts`; details in
[arena.md](arena.md)): an 18 × 32 tile field, a river with two bridges, a king
and two smaller towers a side. Both sides hold the same eight-card deck, four
in hand and the next one shown; a played card goes to the back. Elixir starts
at 5, refills one per 2.8 s up to 10, twice as fast in the last minute and 2.5× as fast in
overtime. Three minutes; more crowns wins; level crowns go to a one-minute
sudden-death overtime, then to the weaker tower. The king sleeps until hit or
until one of its towers falls; a fallen small tower opens a pocket a few rows
past the river. Eight original troops: Knight, Archers, Ogre (towers only),
Imps, Duelist, Ranger, Drake (flying, splash) and Mage (splash). The
simulation is a fixed 30 Hz step, deterministic from its seed. The bot uses
the same rules and elixir; it lets attackers walk into tower range, answers
with a cheap fitting counter, ignores what its troops already cover, builds
pushes behind a tank and backs up survivors. Easy, Medium and Hard differ in
reaction, counter choice and placement (hard beats medium beats easy in
bot-against-bot tests). (Online and 2 v 2 followed the same day; see above.)

**Why the textures are sharp this time.** The rejected 3D stages baked a whole
scene into one small atlas and flat colours. Arena instead dresses every
surface with high-resolution painted tiles (generated, made seamless, with
derived normal and roughness maps; 2048 px on desktops, 1024 on phones),
applied at a fixed real-world density, so detail stays crisp at any zoom.
Ambient occlusion is baked per vertex in Blender. Everything else is modelled:
towers, bridge, wall, troops (jointed parts animated in code: walk cycles
driven by distance, swings timed to the engine's hits) and scenery.

**Loading and caching.** The first battle downloads about 25 MB with a
progress bar over the cover art; files carry content hashes, live in Cache
Storage and are served `immutable`, so later visits open from the device.
Opening Arena's box starts fetching in the background.

**Screen** (the top bar is superseded above). One full-screen 3D field fitted
between the top bar and the hand tray. The hand is four portrait cards with the
next card smaller at the left and a violet elixir tube beneath; drag a card
onto the field, or tap it then tap the field; the drop zone shades itself
while a card is held. There is no Undo: moves are real-time. Menu pauses.
Health bars float over towers (with numbers) and over damaged troops.

**Art.** Stylized hand-painted fantasy miniature in warm late-morning sun;
blue for you, red for the bot. Prompts, picks and the texture list:
[arena concepts](concepts/2026-09-26-arena/README.md). Models are code in
`assets/arena/blender/` (run `node scripts/arena-assets.mjs`); the runtime is
`components/game/arena/`.

## Motion, original foley and Sound Lab (26 September 2026)

All seven games use small, finite transitions for stage changes and settled
actions: newly dealt pieces, placement, readiness, scores, votes, puzzle
stages, tickets and upgrades. `game-motion.tsx` observes explicit markers on
the existing elements. It never remounts a stage to animate it, moves a board's
hit targets, or restarts a stage for a draft keystroke or an unchanged poll.
The shared party reveal kit remains in use. Reduced motion cancels the added
motion immediately.

Sound effects share four gentle ElevenLabs cues across games: picking up,
placing or locking, the local player's next turn, and final scores (since
11 October 2026 every game synthesises its own; see that section). Short,
soft attacks and conservative levels keep repeated actions unobtrusive.
The shared player limits concurrent sounds and rapid repeats, abandons stale
downloads, and stops pending and active effects on mute, exit or backgrounding.
Nox trick captures are silent; the final-score cue belongs to the results
presentation. Winners see a brief glitter burst, with a static ornament for
reduced motion. Tied winners count, spectators do not. Lucky retains its
continuous gesture-driven foil sound and uses the shared cues for discrete
actions; it has no match-ending celebration.

Strategy games retain their original ambient recordings, levels and timing:
Nox's hull and swell, Mora's forest, and Yata's market. Floodline keeps its
separate coastal environment. The generated alternatives remain available
only in Sound Lab. No background music is added to the other games.

**Sound → Sound Lab** opens `/sound-lab`: compare backgrounds, audition each
layer or effect, and try the four shared cues at their gameplay levels.
The selected live cues are pickup B (Bright wood tick), place F (Gentle settle),
turn C (Rising chimes), and the earlier final-score B (Marimba flourish, 1.28 s).
The longer final-score candidates remain available for comparison. Letters
identify individual sounds rather than fixed instrument families. Unchosen
candidates stay preview-only; earlier comparisons and per-game effects remain
in collapsed sections. Change
ambient layer levels and spacing, then **Save preview** to
save that world's audition settings on this device. Saved previews do not
change game ambience. Full previews use the same
scheduler as play. Previewing is explicit, switching sounds stops the previous
preview, and leaving or hiding the page stops it. Online ambience still needs
the table host's permission.
Exact generation prompts, files and validation: [sound library](audio/README.md).

## Mora: overgrown paper boards (25 September 2026)

Both Mora boards were regenerated as painted 2D plates in the look of the box
cover: places that nature has taken back, still a handmade cut-paper diorama.
The Observatory is a ruined hilltop observatory (broken dome and rusted
telescope, a roof garden on a mossy arched ruin, a tree that swallowed a stone
arch, a rusted glasshouse, a stone aqueduct for the dry channel, an iron and
timber watchpost). Floodline Station is a railway station flooded by the sea
and taken back by sea life only: seaweed, kelp, algae, barnacles, coral and sea
grass on the ruins, a railway viaduct for the pier, a carriage grown through by
mangroves, a flooded tunnel for the sea cave, a stone signal lighthouse. No
forest plants at sea. Each place stands apart on its own terrace or island with
its own material, so the six places read at a glance. Creatures are unchanged
paper standees. Framing, orientation sizes and place arrangement follow the
previous accepted boards in spirit, but the landscape boards are now a wide
shallow band (gameplay between about 22% and 70% of the height, no station
building on Floodline) and the portrait boards a compact central column, so
the scenery reaches every edge of common desktop windows and phones; see the
game-world-layout skill, "Desktop side borders", and
`scripts/check-board-cover.mjs`. A 3D stage experiment the same day was
rejected and removed; boards stay painted plates. Prompts and choices:
[mora overgrown 2D](concepts/2026-09-25-mora-overgrown-2d/README.md).

## Mora: phone boards, short names, plain scoring and true covers (27 September 2026)

William found the phone boards spent too much room on scenery: the spaces
and creatures were small, the habitat text too small, and phones hid the
place names. He also asked for simpler scoring on both boards and covers
that show the game as it looks.

- **Scoring.** No more lone-creature points and no "echo" wording.
  Observatory: Courtyard unchanged (2 / 6 / 11 / 17), Garden 8 per pair,
  Hollow a pair for 9 or nothing, Glasshouse 3 each if its species lives in
  another habitat, Channel 2 per creature, Watchpost unchanged. Floodline:
  Pools 7 per pair, Beach 3 per different species, Mangroves three alike
  for 12 or nothing, Pier unchanged, Cave 3 each if its species lives in
  another habitat, Lighthouse unchanged. Mirror shores now asks for a pair
  in Pools (not an exact pair). Table in `docs/mora-board-rules.md`.
- **Short names.** Courtyard, Garden, Hollow, Glasshouse, Channel,
  Watchpost; Pools, Beach, Mangroves, Pier, Cave, Lighthouse. Area indices
  and saves are unchanged.
- **Phone boards.** New dedicated portrait plates with the places packed
  together and larger pads (`mora-phone-observatory-v4-b`,
  `mora-phone-floodline-v4-f`). On a 390×844 phone creatures grow from about
  29 to 38 px (Observatory) and 26 to 30 px (Floodline, whose 23 spaces set
  the limit). The plates are extended with their own mirrored scenery above,
  below and at the sides so phones and portrait tablets are covered.
- **Portrait labels.** The short name rides in the score pill again on
  phones and portrait tablets, and the scoring line reads at 12 px (up from
  about 9), in cards at most 128 px wide so neighbours never collide.
- **Covers.** The square box and the setup lid now show the overgrown
  observatory and the flooded station in the board's cut-paper style, with
  the game's own animals as cream-edged paper stickers (fox, barn owl, hare,
  frog, pine marten, crab, sea turtle) instead of invented moss creatures.

Prompts, attempts and measurements:
[mora phone boards](concepts/2026-09-27-mora-phone-boards/README.md).

## Lucky: playing together, maxed books and a smoother factory (26 September 2026)

William's friend, playing on his own PC while William hosted, waited about ten seconds for every payout; William wanted to see his friend play, to hear what others buy and win, a factory that runs and reads better, and prices that make sense book to book.

- **Payouts are immediate on any connection.** Scratch points are thinned to what the coin can cut and everything queued while a command is in flight goes as one (`breaks` mark lifted coins), so a fast mouse over the internet no longer queues seconds of strokes.
- **Watch is a little TV** in a corner (drag it to another): another player's whole screen, their tab, ticket, factory tool and upgrade, drawn at their own screen size and scaled down, with their pointer. With a mouse, players on the same tab see each other's named pointers. Purchases (books, upgrades, machines), what a ticket just paid and levels opened show as short notes under the purse, which keeps one size.
- **Levels feed the factory**, and a book whose level III has been played through is **maxed** (★): its factory tickets sell for ×1.5. Each book on the shelf shows how far it is toward its next level, then toward being maxed.
- **Every book costs about four to six times the one above it at every level**; book prices keep the old pacing.
- **The factory**: the select tool is the default and a picked machine can be put down again; a locked machine is explained, then bought with **Unlock**; keys V, E, R, 1–0, Delete and Esc; mouse users select several machines and move or turn them together. Tickets are small, slide under a machine that takes them, peek out of its output and slide into the cashier, which flips a coin. Upgrades that can be bought wear a still gold arrow instead of pulsing.

## Lucky: bought tickets in hand, harder books, a tree of upgrades (25 September 2026, later)

William found the first level of every book "brain dead", did not understand Ladder, saw the old full-page menu flash, and wanted tickets to cost something, no table, far more upgrades and a factory that is nice to look at.

- **Tickets are bought.** A ticket costs half of what a careful player wins with it, so a perfect ticket about doubles its price and a messy one loses; the payout shows the net. An empty purse always gets a free Lucky Seven I.
- **One ticket in hand, always open.** The table is gone: the shelf buys a ticket straight into your hand, the shelf waits while it is scratched, and **Again** buys the same one when it has paid.
- **Every level I is a real puzzle.** Lucky Seven starts at 4×4 and, once every 7 is found, scratches the misses left by itself. Twins is now a deduction puzzle: side-by-side pairs share a number and the ticket splits one way only. Ladder is now higher-or-lower on a column of cards from a small deck. Every other book starts one step harder, up to 8×8 Crown Jewels.
- **Forty upgrades in six branches** (Scratching, Luck, Payouts, Shop, Books, Factory), drawn as little trees of medallions with "?" for what is not yet in reach; every book on the shelf gets its own prize upgrade and a helper.
- **The factory is painted**: enamel-and-brass top-down machines, a tiled floor in a brass frame, running belts carrying the books' own tickets, and machines that can be dragged to a new cell.
- A desk link shows the desk while it loads and a small name card for an invited player; there is no Lucky menu page. Rules: `docs/relic.md`.

## Lucky: puzzle tickets on a table (25 September 2026, superseded)

Relic is now **Lucky** (internal ID `relic`): the old name no longer fit a scratch-ticket game, and a plain word says what it is and reads the same in every language. William asked for books that each feel like a little game, in the manner of LinkedIn's daily puzzles; for upgrades that feel like big steps; for exciting, real-looking ticket symbols; and for no collect-then-next routine.

- **Every book is a puzzle under foil** with three levels that open by playing the book and can always be switched back: Lucky Seven (arrows toward the 7), Twins (arrows toward each twin), Garden (Zip path), Ladder (always higher, colour bands), Gold Mine (minesweeper), Sun & Moon (Tango), Sea Chart (battleships) and Crown Jewels (Queens). The logic books are generated with exactly one answer. Rules are in `docs/relic.md` and How to play; the shelf shows one short hint per book.
- **The table**: books on the shelf lay tickets on a felt table, up to twelve per player; a ticket lifts over the table to be scratched; it pays the moment it is over (no collect button), shows what the other seals hid, and offers Next (same book) or Another.
- **Each book has its own die-cut shape and print style** (fairground stub, art deco arches, scalloped seed packet, Swiss-poster tower, riveted mine sign, celestial medallion, torn sea chart, jewelled shield), and the revealed seals use one sheet of glossy prize symbols with coin values.
- **Upgrades are big**: ×2 prizes, ×1.35 coin, jackpots ×3 to ×20, extra mistakes, ×1.5 factory speeds, each rank with its own price across the whole game. The factory still opens at 1K.

## Setup modal and wide covers (25 September 2026)

William liked the setup lid (cover plus stat chips) but not the tray under it, and asked for covers that fill the wide lid instead of a small square in a coloured band. Every game now has a dedicated **wide cover** with its title painted in, cut to exactly 3:1 (`wideCover` in `lib/games/box-covers.ts`, delivery files from `scripts/optimize-wide-covers.mjs`; prompts, attempts and picks in [wide covers](concepts/2026-09-25-wide-covers/README.md)). The brief keeps the title and subjects inside the middle 30–70% of the generated height, so the lid may trim up to a fifth of the 3:1 band on short screens (`clamp(26.67cqw, 30dvh, 33.34cqw)`). The square covers stay for the library boxes.

Yata's cover was too realistic and detailed next to its flat toon table, so both its square and wide covers were regenerated in the table's cel-shaded toon paragraph (`box-yata-toon-v1`); the gouache cover moved to the art archive.

The tray is rebuilt in `components/game/setup-box.tsx` and `setup-row.tsx`: calm paper, small uppercase labels, and the game's own palette (`--box-deep` as the accent) on every selected state and on Play. Players and bot strength are segmented tracks (bots carry one to three bars). The content set is a pair of picture cards that show what you will play on: Mora's **Board** shows each board (`mora-*-preview-v1.webp`, the middle of the overview plates), Yata's **Menu** its six dishes, Nox's **Deck** a fan of cards. Extensions are rows with a visible on/off switch and an info mark (three tiles in a row on phones), still opening the shared rules modal by long-press, I or the mark. Learn, Play and Continue close the tray. Folio and Relic reuse the same shell, rows and buttons. On a 375px phone every setup fits without scrolling.

## Tribu refinements: closer scoring, finite spectrums, changeable votes (23 September 2026, later)

- **Top Five scores by closeness.** Each of the author's answers earns 2
  points where the guess ranked it exactly, 1 point one rank away, nothing
  further off; a perfect list is 10 (`nearPoints` in
  `lib/games/party/ranking.ts`). Replaces one point per exact rank plus two
  for a perfect five.
- **Top Five reveal is five straight Dials.** Each of the author's answers,
  in their order, gets a five-slot track: the real rank glows in Dial's teal
  bullseye colour, the ranks beside it are the pale near band, and every
  guess drops in as an avatar where that player ranked it. Dial-style score
  chips (avatar, name, +points; a perfect list gets the burst) follow, and
  the full lists stay behind the people button. In short landscape the
  scores stand in a column beside the tracks.
- **Dial spectrums must be finite.** A spectrum belongs only if the table
  agrees on what its two ends mean. Open-ended magnitudes with no shared
  frame (Slow–Fast, Tiny–Huge, Cheap–Expensive, Quiet–Loud and the like: fast
  compared to what?) are retired, together with near-duplicates. Rows are only
  appended or retired, never removed, so saved ids stay stable.
- **Votes can change until they close.** In every set vote (Tribu and
  Sabi, opening and end of round) a player can switch their vote while
  anyone is still undecided; the vote closes the moment everyone has voted
  or the clock runs out. The online next-game vote already allowed this.

## Know Me and Quiz: plain names, no teams, a host picker (23 September 2026, latest)

- **Names.** Abstract strategy games (Nox, Mora, Yata) keep short abstract
  names. Party games take plain, literal names. Tribu (`orin`) is now
  **Know Me**; Sabi (`miro`) is now **Quiz**, a generic name because it will
  hold more trivia games than Atlas and Sizes. Internal ids, saves and the
  Tribu/Sabi code names in source stay. New covers in
  [the cover notes](concepts/2026-09-23-know-me-quiz-covers/README.md).
- **No teams.** Know Me and Quiz are always everyone for themselves. Setup has
  no play-mode choice; the server ignores any team request and every new
  match, practice and switch is individual. The engines still read old team
  saves.
- **Host picker.** In the online setup box the play-mode choice and the
  explanation paragraph are gone. In their place is the row of players at the
  table, with a crown on the host; the host taps another player to hand
  hosting over. Empty seats show as dashed chairs. Rules stay in Rules.
- Folio and Relic boxes on the shelf now show their printed covers and spines
  (they have no engine id, which had left them as blank placeholders).

## Sabi: small trivia games, Size It Up and a new Atlas (23 September 2026, later)

Supersedes the Mundo section below where they differ.

- **Sabi** (provisional name, internal id `miro`; was Mundo) is a set of
  short trivia mini-games, not only a world game. It holds **Atlas** and
  **Sizes** today and is meant to take more. Its structure is unchanged: an
  opening vote, an again/switch/end vote after every round, shared totals
  and round count. The name was chosen to be short and easy to say in any
  language.
- **Scores share one scale.** Both games give up to 100 points per prompt,
  so neither dominates the carried totals: a Sizes comparison scores 0–100,
  and every Atlas pin scores 0–100 by its own distance (26 September 2026:
  100 within 25 km, falling steadily to nothing at 4,000 km; the old
  closest-pin-takes-it scoring left everyone else on zero).
- **Sizes is Magnitudle's Size It Up, nearly one to one.** A cream reference
  silhouette stands at true scale on a ground line; players drag a tomato
  silhouette to move it, pull its corner handle (or pinch) to resize it,
  zoom the board with + and −. They size all three comparisons, moving
  freely between the tabs, and lock once at the end (changed 23 September
  2026; a lock per comparison was dropped). The host then reveals the three
  one at a time. A reveal lines up on the mat the reference, the true size in
  gold, and every player's guess in their colour, best first. The gold answer
  appears only once. Oversized guesses keep their full silhouette, overflowing
  their reserved slot and clipping only at the mat edge, without a fade. Hovering or tapping a player, on the mat or
  in the list, dims the rest. It counts a "52 / 100" up with *Off by*, prints
  a one-line fact, and lists everyone's points. Scoring is
  Size It Up's curve on relative error (6% off or less scores 100; 12% → 90,
  20% → 78, 32% → 62, 50% → 45, 75% → 30, 110% → 18, 160% → 0, straight
  lines between). Each round is three comparisons: an animal, an object or
  landmark, then a country (east to west
  or north to south, from the Natural Earth outlines). The target is between
  a fifth and eight times the reference. A lock can carry all three sizes so
  the last drag and the lock land as one move. Silhouettes are three generated 4×4
  sheets, thresholded to alpha masks by `scripts/build-sizes-silhouettes.mjs`
  with each cell's box in `lib/games/party/size-silhouettes.json`; the
  catalogue with real sizes and facts is `lib/games/party/size-things.ts`.
- **Atlas rounds: two places and a final.** Each round is an easier named
  place, a harder named place (never the headline cities: no Paris, London,
  New York, Rome, Tokyo…), then the final: a photograph and two clues that
  never name the place, its country or its people. Named places live in
  `lib/games/party/geo-names.json`; the 23 photographed finals stay in
  `geo-places.json`. Rules marker 10.
- **Atlas globe (23 September 2026, later).** The globe stands free on the
  desk with a thin sky-blue rim, no mat behind it. Close up it drapes Esri
  World Imagery tiles over the bundled Blue Marble texture, sharper the
  closer the camera (to about 60 km up), with the credit shown while tiles
  are in view. Dragging keeps the ground under the pointer at every zoom, and
  zoom works in altitude so it slows near the ground. Pins are map pins with
  their tip on the spot, drawn above the globe and hidden past the horizon.
  At the reveal every guess draws an arc to the answer and the globe turns to
  show them.
- **One look for the set: the measuring desk.** A deep green self-healing
  cutting mat with a pale grid and ruler ticks is the board of every Sabi
  game (Sizes stands its silhouettes on it; Atlas's globe is the exception
  and stands free on the desk); cream index cards with a red rule hold the steps, the prompt and
  the results; glossy enamel tomato buttons; warm lamp light from the upper
  left on a pale wooden desk. Shared pieces in `components/game/sabi.css`
  and `sabi-steps.tsx`: `.sabi-stage`, `.sabi-board`, `.sabi-card`,
  `.sabi-steps`, `.sabi-results`, `.sabi-actions`. New Sabi games build on
  them. Never Tribu's neon night, never the old gouache poster. Cover:
  `box-sabi-blind-v1`; prompts in
  [the Sabi concept notes](concepts/2026-09-23-sabi/README.md).

## Mundo: Atlas and Sizes, and reveals with a pulse (23 September 2026)

- Superseded by Sabi above: the name, the look, Sizes' rules and Atlas's
  rounds. The set structure and the reveal kit below still hold.
- **Reveals with a pulse.** Every party reveal and the match results use one
  kit, `components/game/reveal-motion.tsx`: numbers count up, items drop or
  pop in one after another, and a perfect answer gets a ring burst. Each
  reveal settles in under two seconds and is instant under reduced motion.
  Top Five flips its ranks in one by one, then the guesser chips, then the
  scores. Dial blooms its bands from the hidden point, swings the guesses in,
  then pops the scores. Atlas lists teams closest first with distances
  counting up. Sizes counts the answer up, shrinks countries to scale, drops
  the guesses onto a log ruler and pops the points. The results screen counts
  down from last place to the winner, who lands last with a crown and a light
  sweep.

## Tribu, and no noise on the table (23 September 2026)

- **Tribu** (provisional name, internal id `orin`) replaces My Top Five and
  Dial as separate games. It is one party game about how well a group knows
  each other, and it holds both: **Top Five** and **Dial**. A match opens with
  a ten-second vote between the two. Every round ends with a ten-second vote:
  the same game again, the other game, or **End**. The game being played wins
  any tie it is part of and an empty vote. A tie without it prefers playing
  over ending, and the opening draws at random when nobody votes. Points carry
  across games: each player's total is what the results show. Top Five keeps
  its teams option, and a team's points count for each of its players. Dial is
  always everyone for themselves. Rounds keep counting across a switch, up to
  twelve. The saved state is always one of the two games (`orin` or `dial`);
  `lib/games/party/tribu.ts` swaps it when the table switches, keeping seats,
  log, round and totals. Old Dial tables open as Tribu.
- **Look.** A retro game show (changed 23 September 2026; the night-party
  indigo was dropped). The table stands on an illustrated 70s studio set
  (`tribu-studio-landscape-*` / `tribu-studio-portrait-*`): curtains, marquee
  bulbs, podiums, plants and lights at the edges, a calm lacquered stage in
  the middle under a soft cream wash. Tribu will hold more games, so the art
  is general: no dials or ranking cards in the set or the cover
  (`box-tribu-blind-v2`, the set with a lit "Tribu" marquee). Surfaces are
  cream with chunky dark-brown ink outlines and hard offset shadows in tomato
  red, mustard and teal, under a heavy rounded display face. The Dial is a
  game-show wheel: a teal→mustard→orange→tomato band inside a tomato rim of
  marquee bulbs that chase while the clues are written, with each author's
  two spectrums above it as large segmented options. Top Five uses cream
  contestant cards with a coloured header band. Never dark, never neon, no
  bare sunburst, no close-up grinning faces.
- **Flags.** Removed from the table for now (23 September 2026). The
  `content_flags` log and endpoint stay so they can come back.
- **Top Five prompts are taste, not reasoning.** A prompt belongs only if the
  ranking shows something about the person. Retire anything that reason can
  settle: the most useful thing, what to bring to an island, the animal you'd
  least like to fight, the skill everyone should have.
- **Hard rule: no noise text on the playing screen.** Every game. No
  eyebrows, subtitles, taglines, duplicate game titles or helper sentences
  ("Only you can see this", "Drag the needle…"). The board, buttons, avatars,
  dots and images carry the state. What stays is content (a prompt, a clue,
  answer labels), names, scores and one short word per action (Lock, Next).
  Explanations belong in Rules.
- **Hard rule: no flat, uninspired screens.** Every game needs depth and
  energy: a considered palette, light, glow or material, and a centrepiece
  worth looking at. Stay sleek, not busy: one strong idea, not piles of
  ornament. Long prompts use balanced wrapping (`text-wrap: balance`) so lines
  never break awkwardly.

## Table votes, Dial, and better conversation starters (23 September 2026)

- **Round votes.** Every party game (My Top Five, Atlas, Dial) is open-ended.
  After a round's last reveal the host presses Next, then everyone has ten
  seconds to vote *Keep playing* or *Finish here*. The most votes wins, silent
  players don't count, and a tie or an empty vote keeps playing. Everyone
  voting closes it early. This is the one exception to the host-moves-on rule:
  a vote is each player's own choice and never waits on anyone. Practice votes
  have no clock. Atlas runs out of places after seven rounds; the others stop
  at twelve.
- **What next?** When a party match finishes online, the results show a
  ten-second vote between the party games that fit the table. The winner
  starts at once with the same players; a tie is settled at random; nobody
  voting leaves the table on the results with Play again and Library.
- **Dial** (internal id `dial`, provisional name) is our Wavelength-style
  game. Each round every player gives one clue, all at once like Top Five's
  lists (26 September 2026): each picks one of two spectrums, sees their own
  hidden point, types a short clue and locks. Then the clues are read one
  after the other; everyone but the author turns their own dial privately and
  locks, and the host moves on. Within 2 scores 4, within 6 scores 3,
  within 10 scores 2; the clue-giver earns the average. Individual play only.
  Its look is an old radio tuner: teal enamel, cream face, amber bands.
- **My Top Five reveal.** One row per rank: the author's real answer, the
  viewer's own guess under a miss, and a chip per guesser (green when they
  matched). Scores sit below; full lists open in a dialog.
- **Prompts.** Conversation starters should be personal and easy to argue
  about (little luxuries, worst habits in a housemate, pizza toppings), not
  abstract or whimsical trivia (front-door colours, animals as guides, biscuit
  shapes). Retired prompts keep their id and are never dealt again. Players
  can flag a prompt with *Bad prompt?*; flags land in the `content_flags`
  table (one per player per prompt) for the next catalog pass.

## Players lock choices; the host moves the game on (23 September 2026)

Playtesting showed that asking every player to confirm each next step made
games longer and left the table waiting on whoever was slowest. This applies to
every game, solo and online:

- Wait for player input only when a player locks in their own decision: a
  ranking, a guess, a pin, a card, a final submit. Those locks stay explicit.
- Never ask every player to confirm moving on (next category, next list, next
  round, finish). One **Next** belongs to the table host, and the game waits
  for the host to press it, even when everyone has locked in, so the table can
  talk about the reveal.
- The host is the player who created the table by default. The host can hand
  hosting to any other player from the lobby's player list (**Make host**).
  The new host configures, starts and moves the game on; the creator stays at
  the table and cannot be removed.
- If the host disconnects mid-match, any seated player may press Next, so the
  table never stalls. Other players see who moves the table on instead of a
  button.
- Bots never move the table on. In local play the person at the device is host.

My Top Five and Atlas follow this now: their reveals use one host `next` move in
place of the old everyone-presses-Continue `ready` step. Their rules are
otherwise unchanged.

## Shared progress and human-only party games (21 September 2026)

Progress always sits directly below the top-left back/name control, in the shared
`GameProgress` component, on desktop and mobile. This supersedes previous centered
round counters. Atlas omits the difficulty badge. My Top Five and Atlas require
human players in every seat, including learning sessions; online starts cannot fill
empty seats with bots, and disconnected humans cannot be replaced by bots.


## Folio: host picks, boss reroll, removing a game, one top bar (26 September 2026)

At William's request: Folio's top bar is the phone layout on every screen,
difficulty and round in the centre of the bar and the crew with the hearts
beneath it (an exception to the round-pill rule below). The host alone picks
the path, rerolls a boss (once per act, after round 2, a die beside the boss)
and moves the crew on; the others' taps are votes shown as initials in seat
colours. After a boss the crew may remove any one of the ten games still in
the run, down to six. Each game keeps its original look and gets a few small
printed touches (stamps, letterpress, halftone, pen strokes). Details in
`docs/folio.md`.

## Mobile navigation refinement (21 September 2026)

On phones (including short landscape), back/name and icon-only Menu (vertical dots) and Others share the first row. Player badges occupy a horizontally scrollable second row. Desktop keeps the existing stacked Menu/Others layout. Nox is the exception: only its table-rim player badges are rendered, with no Others control. Online Table administration is host-only during play and sits below the navigation and player rows. Nox's centered arrow shows alternating exchange direction during passing and clockwise order during tricks, using the engine's seat-order calculation.

## Phone top bar, round pill and portrait lock (24 September 2026)

Supersedes the two sections above where they differ. Games with a fixed number
of rounds (Nox, Mora, Yata, Folio) show the round as a pill centred at the top,
on its own plate so it reads over the artwork; on wide screens it hangs just
under the centred player badges, on phones it sits in the centre of the top
bar. Know Me and Quiz, whose length changes as they go, show no round count
and no Others control (there is nothing private to see). On phones every game
uses Mora's bar: back left, round centre, Others then Menu right, badges on a
second row showing full names while they fit and the contracted badge once the
row would scroll (`useBadgeFit`). The badge row keeps headroom so the placement
die on a badge corner is never clipped. Nox keeps its seat badges on the table.
The contract is `components/game/mobile-hud.css`.

Phones are portrait only. A tap while a game is open asks for fullscreen and a
portrait lock where the browser allows it (Android Chrome); leaving fullscreen
from the menu is respected. Where the lock is unavailable (iOS Safari), a
landscape phone shows a rotate screen. Short landscape phone layouts are no
longer an acceptance target. The one exception is Diner, which plays sideways
(see the Diner section of 9 October 2026).

On phones the Nox and Yata docks are a grid: the stage takes the free height,
one control row (die or menus, the confirm plate, Undo in its own right-hand
slot) rests directly on the hand whatever its height, then the hand. Yata's
tickets grow to a third of the width. Mora's lit habitats keep their on-stage
label nudge so the cards no longer jump when a creature is chosen, and Release
reads at 12 px.

## Global navigation and viewport rule (21 September 2026)

This rule supersedes conflicting layout exceptions below and applies to all games, including party games, practice and online play. Top left holds only back/return and the game name. Menu and Others stay on the right, with Others directly below Menu on desktop and beside Menu on phones, as detailed above; time/advance-time and fullscreen controls also belong on the right. Mobile player badges use a separate horizontally scrollable second row. Nox uses only its table-rim badges and has no Others control.

A playing screen should fit one viewport. Players must not have to scroll the whole page between choices, board, hand and confirmation. Reflow the active game, remove duplicate headings and reduce decorative spacing first. Preserve legible labels and usable touch targets. Put long rules, history, guess comparisons and optional inspections in overlays with internal scrolling; never conceal inaccessible gameplay using overflow clipping. Test portrait, short landscape, tablet and browser zoom; report any remaining accessibility/extreme-size scrolling fallback explicitly.

Top Tier retains a private order for every visited topic until the next round. Switching restores that order. Refreshing from an active ranking selects the first fresh topic and stays in the ranking view; refreshing from the initial chooser stays there. Two refreshes per player per round. Compact topic cards keep their title and answer chips, without a category heading.


This is the visual and interaction contract for future work. Mechanics are the stable core; names, fiction, characters, scenery and cultural references may evolve within these worlds. Do not reconstruct the previous Tide/Mora/Yatai presentation from old assets or memory.

## Mora cleanup and future-game requirements

This requirement supersedes historical sidebar and portrait-pan guidance below. Each game's entire UI—not only its board—needs its own material and shape language: hand tray, die, extension actions, habitat indicators, player badges and goals. Within a game those roles must also be visually distinct, not identical rounded panels recoloured. Preserve shared accessible interactions and the shared rules presentation (`components/game/rules.tsx`).

Design dedicated landscape and tall portrait boards with independent measured coordinates but identical gameplay. Portrait play must expose every area on one screen without board scrolling. Establish readable shape/pattern correspondence between die restrictions and placement sites; names and colour alone are insufficient. Preserve existing rule memberships.

Brief new boards with localized animation layers/masks and foliage pivots so water and trees can move without moving targets or text. Respect reduced motion and visibility suspension; sound effects are deferred. See the shared world-layout skill for acceptance requirements. These are requirements, not a claim that the new artwork is already integrated.

(Advanced view was removed on 26 September 2026; the Others control still opens this inspection, reworked the same evening as described at the top of this file.) The all-player board inspection is adaptive and never taller than the screen, with your own seat in the passing loop and a prominent close button. Omit the duplicate self board; show each opponent’s goal progress and remaining extension uses, even when spent. It must never push or shrink the live board.

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
| Mora | `wildgrove` | Strange wildlife reclaiming human infrastructure | The Observatory; Floodline Station; Sunset Motel; Glacier Dam |
| Yata | `midnight` | Street food: an Asian night-market counter and a Mexican plaza | Tokyo; Bangkok; Mexico; Puebla |
| My Top Five | `orin` | Personal rankings and shared guesses | Two rounds |
| Atlas | `miro` | Satellite globe and shared destinations | Places; Photos; Three facts |
| Rota | `rota` | A mill town that grows round the routes, ink lines, live 3D (3 October 2026) | Meadow; Harbour; Ridge; Capital |

Nox, Mora and Yata share one rules module (`lib/games/trio/engine.ts`) because they
share a deck, a die and a trick. My Top Five and Atlas use their own party
engines behind `lib/games/standalone/registry.ts`.

Internal IDs remain stable for routes, account preferences and records. Subject kind indices remain stable within each content set; changing a picture or name must never silently alter its scoring identity.

## Artwork

Nox's visual language is the Chart (26 September 2026, see the section at the top of this file): confident mid-century flat poster graphics on a pirate treasure map at night, built from a few large clean shapes in navy, teal, cream, palm green, black and treasure red, with flat offset shadows and no texture. It replaced the earlier printmaking and painted-hold looks. Elsewild and Nightshift must explore independent visual languages; their former field-note and gig-poster treatments are not constraints. Cultural references should contribute an idea or silhouette, not overwhelm recognition with decoration.

Avoid glossy plastic, hyper-detailed rendering, uniform soft lighting, stock fantasy cuteness and tiny decorative detail that disappears at play size. Mature means assured graphic decisions, not obligatory darkness or violence. Keep each species and food visually distinct at thumbnail size.

Generate fresh illustrations through the imagegen skill and a delegated image-generation agent. Review actual outputs before wiring them in. Save versioned files, prompts and provenance in the repository; project assets must not depend on generated-image cache paths. Do not repeatedly edit a degraded image or substitute CSS panels for an illustrated world.

Map composition and interaction geometry are one design. Paint habitat spaces as actual places with enough room for their full capacity; set hit targets and slots against the final image. Each environment owns independent coordinates. Environment scale must make sense around the existing readable creature size. Do not shrink creatures to repair a miniature-looking map. Die groups use recognizable placement shapes and physical ground materials. Never add cryptic glyph rows or arbitrary habitat emblems; group memberships and placement rules remain unchanged.

Render gameplay numbers, names, suit symbols, formulas and explanatory text as crisp accessible DOM content. Box-cover titles are the exception: generate their lettering inside the artwork, with accessible names on the surrounding controls. Keep responsive covers, loading manifests and optimized images synchronized. Preserve alpha on tokens.

## Extension contract

One extension means one mechanic. Content sets are independent of extensions. Every extension works alone and in every combination for its game.

- Nox: Gold (29 September 2026; Shields, Turning Tide and Salvage retired); Dawn (1 October 2026); Anchor (2 October 2026, replacing Mutiny).
- Elsewild: Roam; Sanctuary Goals; Census (Migration retired 29 September 2026).
- Nightshift: Customer Orders; Specialty Stalls; Market Seasons.
- Rota: Rivers; Plans; Mills; Rockfall.

Setup has one Extensions heading. Tiles contain the same emblem used in-game, a short title, an unmistakable enabled state, and a separate information button within the tile boundary. Never nest interactive controls. Opening rules must not change selection.

All overview and individual rules use the shared rules pieces (`Rules`, `RuleSection`, `RuleList`) in Arena's pattern: a short heading, a short paragraph with bold key words, limits in the one purple note. Reuse these components in setup and match help. Show setup rules in a larger viewport-constrained modal with scrolling, accessible title, keyboard and long-press access, and restored focus. Do not append explanatory blocks below tiles.

Game actions are tactile graphical pieces with clear available, selected, waiting and spent states. Larger controls may use reclaimed interface space, but must never cover card slots or inflate the illustrated board. Short labels and counters are useful; rules prose belongs in inspection. Stalls are a prominent action, not an inconspicuous utility icon.

## Attention and confirmation

The top player display is the source of turn and readiness information. Identify who can act and who is still deciding, including simultaneous exchanges and drafting. Do not restore the bottom status strip. Use the shared animated, nonverbal status indicators for deciding, committed and waiting, plus a separate die-roller indicator. Shapes and accessible labels remain meaningful with reduced motion. Connection problems must remain visible near these states.

Use a brief animation and a distinct sound when a player becomes actionable, respecting mute and reduced motion. Do not loop attention effects or replay cues on ordinary rerenders. Place confirmation immediately beside the hand in every game. There is no move-confirmation preference (removed 26 September 2026): moves play at once, and only exchanges have an explicit lock action.

Nox seats players around a table, anchored to the viewer. Card position communicates ownership; a clockwise marker and lead badge communicate order. Reveal completed tricks before gathering them toward the winner. Display ordinary penalties, Gold, Anchor and Dawn swings distinctly. Process capture events once and in sequence; do not infer captures from current cards after a round reset.

Ambient animation enhances the place without becoming another game object. Floodline water uses a transparent masked canvas with DOM hit targets above it. Suspend it off-screen and in hidden tabs; reduced motion gets a static frame. No wandering CSS rabbits.

## Rules and data

Gold subtracts its value from the trick that holds it; the Anchor doubles the cards of the trick that holds it, Gold included, before Dawn adds its points. Negative scores are valid. Printed ranks and follow-suit rules never change.

Migration moves one sheltered creature once per match before normal placement. It ignores the die for relocation, excludes Release, requires destination capacity, preserves remaining source order, and appends to the destination. Normal placement is validated against that resulting board. Submit both changes atomically; cancellation spends nothing. Roam can accompany the normal placement.

Goals must reinforce habitat rules. Floodline's path goal requires A–B–A; its Beacon goal requires other occupied habitats without the Beacon species. Content-aware logic is shared by scoring, goal progress, explanations and bots.

State version 4 replaces earlier playable saves. Old solo resumptions are removed on load; incompatible online games return to their existing lobbies on server startup, without manufacturing results. Accounts, memberships, preferences and completed history remain. No old game engine is retained for those matches.

## Validation

Run tests, typecheck, lint and build. Cover independent extensions, combination matrices, normal/Fast decks, both content sets, all seat counts, private submissions, invalid actions, reconnects, stale requests, state resets and bots using only public information.

Bot simulations measure particular bots, not proven human balance. Report counterexamples and limits honestly.

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

Nox is the captain's cabin. The chart table is painted; the DOM table only anchors the crew's seat tags and played cards. Each player's avatar, name, penalty score and turn state sit on the painted stool for that seat (`seats` per player count in the plate metadata), so Nox has no top player row; the spoken turn status and connection warning remain. The hand is a plank shelf whose cards overlap along it and fold into a second overlapping row only when one row would overflow (flex wrap; never a horizontal scroll). the extension tokens (since retired) were hung iron objects beside the same bone cube die as Mora, its faces cut with the four suits (spades and hearts repeat on the last two); confirm is a brass plate beside the hand on wide screens and above it elsewhere. Since 19 September 2026 (evening) Nox has no Sort, Pass-to or seating-popover controls and no selection count: a selected card rises out of the overlapping fan and comes to the front instead of relying on an outline the next card would hide; the round note sits top centre as an iron version of Mora's paper label; and four brass arrows chased into the table rim show the round's direction (clockwise on odd rounds, the other way on even), changing once per round rather than per trick.

Yata is the toon night market. The collection board stands on the painted red counter as six outlined plates; the hand is a row of tickets on the wooden ledge, two rows of three in portrait. On wide screens the chosen menus, the stall permit and the Market Seasons forecast hang on the painted left signboards and passing on the right ones; narrower screens use the bottom dock. Player tags are outlined pennants under the lantern string.

The plates are the closest of the generated candidates (`production-README.md` in the concepts folder records every attempt); all missed the strict band targets, so the framing metadata absorbs the difference. `tests/table-worlds.test.mjs` checks source and derived sizes, the play box inside the stage across the device set, edge coverage on desktops and stable variant identity. `scripts/optimize-paper-worlds.mjs` now derives WebP plates and overviews for every world; `scripts/measure-table-bounds.mjs` reports a plate's table bounds. The `ArtVariantSwitcher` takes a game and flips Nox between its two landscape cabins; remove it once one is chosen. Browser checks covered desktop and portrait for both games in solo play; online tables share the same components.

## Nox: the Gilt Hold (19 September 2026, night; superseded by the Chart, 26 September 2026)

The captain's cabin plates are replaced by the **Gilt Hold**: the treasure hold below the waterline, drawn as a straight-down plan so the flat cards lie on a flat surface (see the "Flat pieces on a painted world" section of the game-world-layout skill). The playing surface is the black oilcloth lid of an iron-banded chest with a riveted rim; loot, a skull in a tricorn, a rat and an open grating over black water fill the room around it. Chosen plates: `nox-gilthold-landscape-v2-a.png` and `nox-gilthold-portrait-v2-a.png`, the two that passed the band measurements (`docs/concepts/2026-09-19-nox-cabins/README.md`). The Poison Lantern direction was not selected.

Geometry in `lib/games/nox-world-{landscape,portrait}.json`: `table` is the rim's outer edge, `seatRing` a small margin around it, and the seat anchors sit on the rim band (viewer on the bottom rim, left of centre so the confirm plate stays clear; the others clockwise on the left rim, top corners, top centre and right rim; portrait pulls the side seats one tag inside the rim so phones do not clip them). The direction ring became four arrowed strokes along the inside of the rim. Animation: the lantern pool breathes, the water under the grating shifts, and marked coins glint (`animation.glints`, drawn by `world-scene.tsx`); all still under reduced motion. The variant registry is empty again. Card shadows fall downward to match the lantern above the far edge.

## Yata: the counter from above (19 September 2026, night)

The night-market plates are replaced by **the counter from above**: the same toon night market, now drawn as a straight-down plan so the flat plates and tickets lie on a flat surface (the "Flat pieces on a painted world" rule). The serving counter is a red enamel rounded rectangle with a cream rim; the customers' plank ledge runs along the bottom for the hand, the cook's side with steamer, wok, bottles and the one big lantern sits above, and two blank cream menu boards lie flat on the cobbles beside the counter for the chosen menus, the stall permit and the seasons forecast (left) and passing (right). Light comes from the lantern above the far edge, so every drawn shadow falls straight down. The approved toon style paragraph, the enamel chips, the angular tickets, the outlined pennants and the red arcade confirm are unchanged.

Candidates `yata-counter-{landscape,portrait}-v2-{a,b}.png` all came back in true plan view and passed the side and bottom bands; both portraits carry a deeper cook's band above the counter than briefed (kept, since it is expendable scenery). `lib/games/yata-world-{landscape,portrait}.json` describe the `-a` plates with the counter box set to the intersection of both candidates so the plate grid lines up on either; both candidates are registered in `lib/games/table-world-variants.json` for the floating switcher until one is chosen. The menu-board pins in `table-worlds.css` read the board source coordinates from custom properties; plates carry per-dish rings (no red ring on the red enamel). Portrait tightens the ticket hand and reserves `--world-dock-reserve` for the wrapping dock rows so they no longer climb onto the counter; phone plates drop the dish names. Measurements and prompts: [yata counter concepts](concepts/2026-09-19-yata-counter/README.md). The superseded night-market plates moved to the art archive.

## Night library and open-box setup (19 September 2026)

**Shelf rows (26 September 2026):** at William's request every kind of game is its own row on the landing page and in the table lobby: `ShelfRow` in `components/game/library.tsx`, a sideways carousel with previous/next arrows on the right of the row title (muted at either end, hidden when the row fits). Each row runs to at least eight boxes; plain sealed boxes (`SealedBox` in `game-box.tsx`, no art, no title, no chips text) fill it after the real games, at least three per row, and pose and lift like real boxes but open nothing, so the shelf reads as room for more games. Phones show three boxes and a peek of the fourth. The in-progress ribbon was removed. Boxes now pose at eye level (`--lift: 0deg` in `game-box.css`, was 7deg, and hover no longer tips them): tipped up or down, the base or the lid showed as a two-to-three-pixel slanted strip that stair-stepped however it was drawn. The cover also lost its 4px dark bottom border. Time badges count only minutes and top out at `60 min+`: party sets and Folio read `5–60 min+`, Lucky `60 min+`.

**Superseded for the library page (24 September 2026):** the library is now only the games that play. At William's request the Direction D filler was removed: the icon rail and its dead items, filter chips, grid/list and filters tools, the fake account, the "Tonight" hero with friend avatars, tables open now, weekly leaders, friends-playing stacks and all twenty-two placeholder games. `components/game/library.tsx` is a compact sticky top bar (brand left; sound settings and Play with friends, which creates a table at `/tables`, right) above equal square boxes grouped by kind — Strategy (Nox, Mora, Yata), then Solo & co-op (Folio, Lucky), then Party (Know Me, Quiz); a table lobby leads with Party, then Strategy, then Solo & co-op. Each tile shows its box (in-progress ribbon kept), name, players and time, and opens the same setup modal as before. The grouping is data: `librarySections` in `lib/games/library-fixtures.ts`; a new game goes into `libraryGames` and one section, a new kind gets a new section. Short sections share a row and longer ones wrap onto their own rows, all at one tile size (three across a phone, two below 360px, about 140–190px from 700px up). A search field appears in the bar once the catalog reaches 13 games (`SEARCH_FROM`). The fixtures no longer carry fake friends, so no game shows anyone playing. The paragraphs below describe the earlier front page.

The user chose Direction D from the library concepts (`concepts/2026-09-19-library-directions`, queue 04 landscape and queue 13 portrait; the images live in the art archive). `components/game/library.tsx` is now a magazine front page: a slim icon rail, a search-and-filter bar, a "Tonight" hero with stat chips, six friend avatars and the only Play button, a live column (open tables, weekly leaders) and four horizontal shelves. Boxes no longer carry Play or Resume; each shows player count and play time and opens the setup modal. Phones stack the hero and live column and show shelves as two-column tiles under section dividers.

`components/game/game-box.tsx` draws every box from three CSS faces at one shared angle with a deep visible side; sizes travel as `--gw/--gh/--gd` so stylesheets can resize per breakpoint. The three real covers are crops of the live board plates (`public/art/box-*-v3.png`: the Nox cabin, the Mora observatory, the Yata canal market). Twenty-two placeholder games in `lib/games/library-fixtures.ts` fill the shelves with material, palette and motif only; friends, open tables and the leaderboard there are fixtures too, and no navigation item beyond Play with friends and Settings leads anywhere yet.

**Superseded for the tray (25 September 2026), see Setup modal and wide covers above.** Setup follows the Direction M open-box concept in `components/game/setup-box.tsx`: the lid carries the cover, title and stat chips; the kraft tray holds a Learn leaflet, seat tokens for players, three pawns for bot difficulty, folded boards for content sets (Nox shows its Fast mode deck instead), printed extension tiles with emblem, check and info mark, and one cream Play plate. A saved match appears as a continue strip at the top of the tray, which replaces the library's Resume button. Since 24 September 2026 the bottom row is Learn, Play and, when a match is saved, Continue on the right; games that keep several runs (Folio, Relic) show New run and a Continue that opens a list of runs in progress (`RunPicker`). On phones the modal fits without scrolling: shorter cover, one chip row, no world sentence, Players and Bot difficulty on one row.

### Shared table navigation

Across every game, align the top player badges with the floating navigation controls. Put Others directly below Menu, retaining the public-information inspection and focus return. Do not add separate Table or pass-to-player controls. Artwork candidate switches belong to development review, never the accepted playing scene. Keep these placements consistent through landscape, portrait and narrow layouts.

### September 20: requested rule and library refinements

The library opens with the six implemented IDs on one shelf and concept games below. Developed games have dedicated illustrated fronts and spines, varied compact proportions and a complete bottom face. Setup keeps its cover and tag strip, uses a quiet plain insert and places equally prominent Play and Continue actions together.

Nox uses a centered table-plane arrow, larger seat labels and played cards, and a centered near-side seat at three players. *Exchange sizes and deck values superseded 2 October 2026 (see the Papayoo deck section).* Already-started exchanges finish with their saved configuration.

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
mute. Teammates share drafts; only the rotating captain locks. The host moves
each reveal on with one Next, including in practice and online play (superseded
by the 23 September host rule above).

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
Each reveal waits for the host to press Next. Individual play skips discussion.
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

## Mora rules pass and Floodline three rounds (23 September 2026)

Observatory (beginner, two rounds): the Glasshouse trail echoes the rest of
the board: each creature earns 3 if its species also lives in another of your
habitats (maximum 9). The Dry channel no longer asks for different species; a
full channel of any species earns 6, otherwise nothing. Both reward spreading
species across the sanctuary rather than hoarding or avoiding them. Goals were checked against the habitat rules:
Mirror terraces now asks for four of one species across Courtyard and Roof
garden (herd below, pairs above) instead of two species in both, which fought
Courtyard's largest-group scoring. Full houses counts only habitats of three or
more spaces; Glasshouse guests became Glass walk (fill the trail); Big family
became Hollow twins; Three families became Four families.

Floodline Station (intermediate) plays three rounds with a 108-creature supply
and a regenerated board of 23 spaces (5/5/3/4/4/2). Its habitats were rethought
for plain wording: Rock pools exact pairs, Nesting beach all different,
Mangrove roots three alike, Pier A–B–A–B in order, Sea cave echoes your other
habitats, Lighthouse keeps two lone species. Its twelve goals are its own and
keep the same ids, so saved draws stay valid. Packets pass left in odd rounds
and right in even rounds. The shared die face Empty is now Emptiest (least
crowded habitat with room), which removed forced releases late in a long game.
Details, prompts and measurements:
[floodline three rounds](concepts/2026-09-23-floodline-three-rounds/README.md).

## Table admin, hand-over and Folio suggestions (26 September 2026)

- **The Table button.** During any game played at a table, the admin alone
  has a Table button at the top left. It stands alone in the back control's
  slot: for the admin the back arrow and game name are hidden, so the top
  left never holds two controls. It wears the game's menu tokens, so it reads
  as part of each world. Its panel drops along the left side like the Menu
  does on the right: the players (tap one for Make admin, or a bot for an
  away seat in Nox, Mora and Yata), then Leave (what the back control would
  do, its leave dialog included), Back to lobby and Close table. Ending the
  game or closing the table asks once, inside the panel, never in a browser
  dialog. Table settings left Folio's and Lucky's menus.
- **The admin passes on.** The creator is the admin until they hand it over,
  leave the lobby, or stay away for thirty seconds; then the earliest joiner
  still here takes it for good, even if the old admin returns. The last one
  to leave an empty lobby closes the table. A Folio run launched from the
  table takes the table's admin as its host.
- **No board previews on hover.** Player badges open nothing on hover or tap;
  Others is the one way to look at another board.
- **Folio suggestions.** The host plays the shared board. Everyone else plays
  on their own board, and each move they enter (a word, a code, a swap, a
  square) becomes a suggestion under the board, with their initial, for the
  whole crew to see. The host plays it with the tick or turns it down with
  the cross; its author can take it back. Suggestions are checked the way the
  original game checks a move, so a word not in the list is refused at once.
  The same move from two players is one suggestion; each player may have
  three open; a move that no longer fits the board drops away, and all of
  them clear when the puzzle ends. Suggesting never makes the host's move
  stale. A host who stays away thirty seconds hands the run to the next
  player still here.
