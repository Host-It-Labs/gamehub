# Arena audio

Sound effects for Arena, generated with ElevenLabs text-to-sound (MCP
`text_to_sound_effects`, 27 September 2026). Since 11 October 2026 only the
troops' clips (arrivals, attacks, falls, abilities, shots and blasts) and the
music are still used; the cards, towers, clock, Meteor, stings and Quest cues
are synthesised in the browser (`lib/games/sound/books/arena.ts`), and their
clips, raw takes and `quest-v1/` moved to the art archive
(`gamehub-art-archive/assets/arena/audio`). Raw downloads live in `raw/`
(`<id>[-<n>].mp3`, mp3 44.1 kHz 128 kbps); first takes that were replaced are
in `raw/rejected/`. Processed files are in `public/audio/arena/` and listed in
`lib/games/arena/audio.json`.

## Music (27 September 2026)

Original ElevenLabs Music v2 orchestral score, generated through the connected
creative flow. Prompt, generation IDs and the selected take are preserved in
`music-v1/generation.json`; three completed 120-second sources are in
`music-v1/take-{1,2,3}.mp3`. The fourth variation failed; it was not retried.
Take 1 has the strongest rise in rhythmic energy. Automated onset analysis
found about 96 BPM throughout despite the requested tempo change, so its
second half uses pitch-preserving `atempo=1.5` to reach about 144 BPM.

`python3 assets/arena/audio/music-v1/process.py` produces the two stereo,
48 kHz, 192 kbps MP3 loops: 57.5 seconds calm and 38.335 seconds urgent.
A one-bar circular crossfade removes the tail/head break. Both are normalized
to -20 LUFS with a -2 dBTP ceiling before encoding; measured encoded true peaks
are -3.46 and -5.35 dBTP. Playback is 0.8 × the music bus (0.55 × the saved
Ambient level); effects retain their existing levels. Major battle cues duck
music to 38% with quick attack and gentle recovery, and both buses feed a
shared safety compressor. Browser checks remain muted: these measurements do
not constitute human listening approval of the composition or mix.

## Settings

- Every clip: `loop: false`, `output_format: mp3_44100_128`. Prompt influence
  is not exposed by the MCP tool, so every clip uses the API default (0.3).
- Duration below is the requested generation length in seconds.
- Processing (`ffmpeg`): trim leading silence (-50 dB) and the tail below
  -50 dB; gain toward -16 LUFS (short clips measured by max momentary
  loudness on a padded copy), boost capped at +20 dB and at 6 dB of limiting;
  4x-oversampled limiter to -1.6 dBFS; fade-out of 12 % of the clip (30–120 ms);
  mono, 44.1 kHz, 96 kbps CBR. File name `<id>[-<n>]-<sha256 first 8>.mp3`.
- Every processed clip measures true peak at -1.1 dBTP or lower.

## Prompts

| id | dur | prompt |
| --- | --- | --- |
| card-drop-1 | 0.6 | Cartoon game card placed on a battlefield: a quick bright magical whoosh swooping down that ends in a soft padded thump and a small dust poof. Clean, punchy, satisfying, no music, no voices. |
| card-drop-2 | 0.6 | Magic card slammed onto a cartoon game board: a short sparkly swoosh diving downward into a soft muffled thud with a tiny puff of smoke. Crisp and satisfying, no music, no voices. |
| card-pick | 0.6 | Close-up sound of picking up a stiff playing card: a clear crisp card snap and swish, with a small bright magical twinkle, clean and present. |
| no-elixir | 0.6 | Cartoon game error sound when you cannot afford an action: a short low double buzz, clear and present, blunt and soft-edged, not a siren. |
| countdown-tick | 0.6 | Loud crisp close-up clock tick, a single sharp wooden tock of a big pendulum clock, dry and clear, one tick only. |
| battle-start | 2.0 | Battle begins: one short bold medieval war horn blast followed by a single big booming drum hit, no other music. |
| overtime | 1.5 | Short urgent brass horn call, alert signal for sudden-death overtime in a fantasy battle, two quick rising notes. |
| crown | 1.5 | Bright magical reward chime with a short brass fanfare flourish, winning a crown point in a cartoon fantasy game. |
| sting-win | 4.5 | Short triumphant orchestral victory fanfare for a cartoon fantasy game: bright brass and timpani, rising flourish ending on a big held major chord. |
| sting-lose | 3.5 | Short deflated cartoon brass sting for losing a game: a sad descending trombone wah-wah-wah-waaah, comic. |
| sting-draw | 2.5 | Short neutral orchestral sting for a tied game: a gentle unresolved brass and string chord with a soft cymbal, calm, neither happy nor sad. |
| archers-deploy | 1.2 | Two retro 1960s space cadets land on the ground: a short sci-fi radio chirp with a static blip, then a quick double boot stomp. Cartoon style, no voices, no music. |
| archers-attack-1 | 0.6 | Retro 1960s toy ray gun firing one shot: a bright cartoon laser zap pew, single shot, sci-fi, no music. |
| archers-attack-2 | 0.6 | Old sci-fi ray gun firing a single warbling laser beam blast, cartoony electric zap, quick, one shot only, no music. |
| archers-death | 0.9 | Cartoon sci-fi character defeated: a descending warbly laser fizzle ending in a small comic poof of smoke, no voices, no music. |
| ogre-deploy | 1.4 | A big cartoon armoured T-rex dinosaur lands: a short fierce roar and one heavy ground-shaking stomp with a metal armour clank, no music. |
| ogre-attack-1 | 0.7 | Huge cartoon dinosaur chomp bite: heavy jaws snapping shut with a meaty crunch, punchy, single bite, no music. |
| ogre-attack-2 | 0.7 | Giant T-rex snapping bite: a powerful jaw clack with a thudding impact and short growl, cartoon game, no music. |
| ogre-death | 1.2 | Big cartoon dinosaur defeated: a sad descending groan, a heavy thud as it collapses with a metal armour rattle and a dust poof, no music. |
| imps-deploy | 1.2 | Three small 1950s tin wind-up toy robots arrive: a clockwork key winding ratchet, then a cute little electronic beep-boop and tiny metal feet clattering, no music. |
| imps-attack-1 | 0.5 | Small tin toy robot punch: a light hollow metallic clank bonk, cartoon, quick single hit, no music. |
| imps-attack-2 | 0.5 | Tiny wind-up robot tin fist hitting something: a tinny clang with a little spring boing, cartoon, single hit, no music. |
| imps-death | 0.8 | Tiny tin wind-up robot breaks apart: springs sproing, little metal parts clatter and a fizzling beep winding down, cartoon, no music. |
| duelist-deploy | 1.3 | Samurai warrior arrives: a steel katana slowly drawn from a wooden sheath with a long bright ringing shing, then a sharp wordless battle cry "hai!", close and clear, no music. |
| duelist-attack-1 | 0.5 | Fast katana sword slash: a sharp airy swish with a crisp metallic slice, single strike, cartoon game, no music. |
| duelist-attack-2 | 0.5 | Quick samurai blade swing: a fast whoosh and a clean cutting steel shing, single strike, cartoon game, no music. |
| duelist-death | 0.9 | Cartoon warrior defeated: a sword clattering onto the ground, a soft body thud and a little poof of smoke, no voices, no music. |
| ranger-deploy | 1.3 | An old west cowboy arrives: jingling spurs with two boot steps on dirt, then a lever-action rifle cocked with a crisp mechanical clack. No music. |
| ranger-attack-1 | 0.8 | Lever-action rifle firing a single gunshot followed by a quick lever cock, old western, punchy but cartoonish, no music. |
| ranger-attack-2 | 0.8 | Western lever rifle shot: a sharp crack with a short echo, then a metallic lever reload click, one shot only, no music. |
| ranger-death | 0.9 | Cartoon cowboy defeated: a comic slide whistle going down, a floppy hat flop and a soft thud with a dust poof, no voices, no music. |
| drake-deploy | 1.5 | A vintage 1917 biplane flies in: the propeller engine sputters then drones past close overhead, short fly-by, no music. |
| drake-attack-1 | 1.0 | Cartoon falling bomb whistle: a quick descending pitch whistle as a small bomb drops from a plane, ending abruptly with no explosion, no music. |
| drake-attack-2 | 1.0 | Small bomb released from an old biplane: a metal latch click then a short falling whistle sliding down in pitch, cuts off before impact, cartoon, no music. |
| drake-death | 1.6 | An old biplane shot down: the engine sputters and coughs, a descending whine, then a cartoon crash of splintering wood and rattling metal, no music. |
| mage-deploy | 1.2 | A wizard appears: a rising sparkling magical shimmer, crystal chime twinkles and the soft whoosh of a cloak, cartoon fantasy, no music. |
| mage-attack-1 | 0.7 | A wizard casts a fireball: a quick crackling fire whoosh launching forward, magical, cartoon game, no music. |
| mage-attack-2 | 0.7 | Fireball spell shot from a crystal staff: a magic crackle and a roaring flame swoosh flying away, cartoon game, no music. |
| mage-death | 0.9 | Cartoon wizard defeated: magic fizzles out with a descending sparkle and a puff of smoke, no voices, no music. |
| arrow-shot-1 | 0.5 | Longbow arrow shot: a taut bowstring twang and a quick arrow whoosh flying away, single arrow, no music. |
| arrow-shot-2 | 0.5 | A single arrow released from a wooden longbow: a quick string thwip and an airy whistle, no music. |
| cannon-shot-1 | 1.0 | An old bronze cannon fires a single shot: a deep punchy boom with a cartoon thump and a brief smoke hiss, no music. |
| cannon-shot-2 | 1.0 | Castle cannon firing one cannonball: a heavy round boom and a metallic ring of the bronze barrel, short, cartoon game, no music. |
| tower-hit-1 | 0.7 | Loud impact of a blow hitting a stone castle tower: a heavy close stone thud with cracking rock chips scattering, punchy cartoon game hit. |
| tower-hit-2 | 0.6 | Something strikes a thick stone castle wall: a solid heavy knock with a gravelly crunch and dust trickle, short, no music. |
| tower-fall | 3.0 | A big stone castle tower crumbling and collapsing: a deep rumble, heavy stone blocks crashing down, rubble settling, cartoon game, no music. |
| king-wake | 2.2 | A low ground rumble building up, then a short bold war horn call as a great castle tower awakens for battle, no music. |
| hit-melee-1 | 0.5 | Generic cartoon melee impact: a punchy padded thud, one quick hit, no music. |
| hit-melee-2 | 0.6 | Loud cartoon impact: a solid punchy body blow, deep thump with a slap on top, close and full, single hit. |
| bomb-blast | 1.2 | Cartoon bomb explosion: a punchy round boom with a burst of debris, short and satisfying, no music. |
| fire-blast | 1.0 | Fireball impact explosion: a whooshing burst of flames with crackling embers, cartoon magic, short, no music. |
| meteor-fall | 1.1 | A falling meteor: a descending fiery whistle and roar rushing in from the sky, getting louder, cuts off right before impact, no explosion, no music. |
| meteor-crash | 2.0 | A huge meteor crashes into the ground: a massive explosion boom, flying rock debris and a deep rolling rumble, cartoon game, no music. |

### Replaced first takes (`raw/rejected/`)

These came back nearly silent or too thin (peaks of -23 to -36 dBFS, or only
0.1 s of sound) and were regenerated with the prompts above:

- card-pick (0.5 s): A single playing card lifted and flicked off a table: light soft paper flick with a faint sparkle. Very short and clean, no music.
- no-elixir (0.5 s): Short dull cartoon denied sound for a game interface: a soft low buzz with a hollow wooden bonk, not harsh, no music.
- countdown-tick (0.5 s): A single clock tick: one crisp wooden mechanical tick, loud and clear, dry, no music.
- hit-melee-2 (0.5 s): Cartoon punch hit: a meaty thwack with a soft bounce, single impact, no music.
- tower-hit-1 (0.6 s): Impact on a stone tower wall: a hard punchy thud with small rock chips crumbling off, cartoon game, no music.
- duelist-deploy (1.2 s): A samurai lands ready to fight: a katana drawn from its sheath with a bright ringing metallic shing, then one short sharp wordless warrior shout. No music.

## Opening cue v2 (28 September 2026)

One single short cheerful brass battle horn chord, bright rounded cartoon orchestral timbre, immediate confident attack and clean quick decay, total sound less than one second. An original mobile strategy game start signal. No percussion, no drum hit, no second sound, no voice, no melody, no ambience, no long reverb.

ElevenLabs eleven_text_to_sound_v2, flow `6OyABLHBr0w9u5MKeEPq`, selected generation `NMMTqjaYvoMsyzvE6rL0` (1 second). Source `battle-start-v2.mp3`.


### 28 September: gentle final minute and two Sound Lab alternatives

`music-v2/process.py` keeps the current battle recording and derives its final
minute from that same recording at 1.08×, with stronger low end and restrained
compression. Sound Lab offers the previously unused take 2 and take 3, each
with its own battle/final pair. Native stereo 48 kHz, 192 kbps MP3; loops are
normalized to -20 LUFS with a -2 dBTP target and a one-bar circular crossfade.
The new ElevenLabs requests failed with insufficient funds; their exact prompt,
flow and generation IDs are in `music-v2/generation.json`. No new generated
composition is claimed. Audio was measured, not listened to in browser.


## Quest troops and Quest screens (29 September 2026)

Clips for the eight new troops, their abilities and the Quest map, generated
with the same MCP tool and settings as above (`eleven_text_to_sound_v2`
default, `mp3_44100_128`, no loop). The list, prompts, requested lengths and
levels are in `quest-v1/clips.json`; raw takes are `raw/<id>.mp3`.
`python3 assets/arena/audio/process-effects.py assets/arena/audio/quest-v1/clips.json`
reproduces the processing described under Settings (rebuilt as a script: it
matches the existing clips within 0.1 LU on crown, ogre-death and sting-lose;
clips from 0.9 s are gained by integrated loudness, shorter ones by max
momentary on a padded copy) and writes the entries into
`lib/games/arena/audio.json`. `medic-death` allows 12 dB of limiting
(`maxLimit`) because one glass clink peaks 20 dB above the rest.

The account is on the free tier and had 256 credits left (10 per second of
audio), so every clip is a single take and some are missing: no
`<troop>-attack` clips (the melee troops keep `hit-melee` on each swing, the
Inventor and Gunner shots use `zap-chain` / `shell-shot`, the Balloon's bomb
is heard as `drop-blast`), no `miner-deploy` (`miner-dig` and
`miner-emerge` carry his arrival) and no `balloon-death` (`balloon-crash` is
its fall). `sound.ts` skips missing ids, so they can be added after the
credits reset (26 October) without code changes. 251 credits used, 5 left.

Measured after processing: every clip at -1.6 dBTP or lower, max momentary
-16.4 to -21 LUFS except `medic-death` (-24) and `quest-victory` (-14.9);
nothing clips. Weakest takes worth replacing: `gladiator-death` (0.18 s, a
single bonk), `medic-deploy` (0.3 s) and `medic-death` (quiet). Measured,
not listened to.

| id | requested | processed | prompt |
| --- | --- | --- | --- |
| shell-shot | 0.8 | 0.8 | A small bronze field cannon fires one shell: a deep punchy round boom with a wooden carriage thump and a short smoke hiss, cartoon game, no music. |
| zap-chain | 0.6 | 0.6 | Crackling cartoon electric lightning arc jumping quickly between targets: three fast snapping zaps with a buzzing tesla hum, sci-fi, no music. |
| shell-blast | 0.7 | 0.57 | Cannon shell landing on a dirt battlefield: an earthy thudding explosion with clods of soil scattering, punchy cartoon game, no music. |
| drop-blast | 0.9 | 0.88 | Heavy bomb dropped from a hot-air balloon explodes on the ground: a big deep punchy boom with a burst of dirt and debris, cartoon game, no music. |
| balloon-crash | 1.2 | 1.1 | Cartoon hot-air balloon deflating fast with a rubbery flapping raspberry, then a wicker basket crashing into the ground with a big bang, no voices, no music. |
| medic-heal | 0.7 | 0.37 | Soft warm healing spell: a gentle glassy chime with a rising twinkle of sparkles, soothing and magical, cartoon game, no music, no voices. |
| shield-break | 0.7 | 0.68 | Wooden shield with a bronze boss shattering: a sharp splintering wood crack and a ringing bronze clang with pieces clattering, cartoon game, no music. |
| miner-dig | 0.9 | 0.76 | Digging fast underground: a muffled low rumble with scraping pickaxe and shovel sounds through the earth, cartoon game, no music, no voices. |
| miner-emerge | 0.7 | 0.68 | Bursting up out of the ground: a quick crunchy dirt eruption with a spray of pebbles and soil pattering down, cartoon game, no music, no voices. |
| pirate-leap | 0.5 | 0.34 | Quick cartoon jump: a short airy whoosh swooping up and over with a light springy hop, single leap, no music, no voices. |
| viking-rage | 0.7 | 0.68 | Viking warrior battle roar: one short fierce wordless bellow from a big bearded man, gruff and powerful, cartoon game, no words, no music. |
| stun | 0.5 | 0.48 | Tiny cartoon dizzy sound: a quick twinkly circling sparkle of little stars chirping, very short, light and cute, no music. |
| pirate-deploy | 0.7 | 0.68 | A swaggering pirate arrives: a cutlass swished from its scabbard with a bright ring and a quick confident boot stomp on wooden planks, no words, no music. |
| viking-deploy | 0.7 | 0.61 | Norse warrior lands: one heavy boot stomp, a long iron axe hefted onto a shoulder with a clank, and a short gruff wordless grunt, no music. |
| gladiator-deploy | 0.6 | 0.39 | Loud close-up clang: a short sword struck hard against a bronze shield boss, one bright ringing metal bang with a wooden thump, cartoon game, no music. |
| medic-deploy | 0.7 | 0.3 | Field medic arrives: a leather satchel buckle snap, glass bottles clinking softly and a small warm magical chime, cartoon game, no voices, no music. |
| balloon-deploy | 0.7 | 0.55 | Hot-air balloon floats in: a roaring gas burner whoosh and creaking wicker basket with ropes straining, short, cartoon game, no voices, no music. |
| inventor-deploy | 0.7 | 0.62 | Retro inventor arrives: a backpack tesla coil powering up with a rising electric hum, a crackle and a brass switch click, cartoon sci-fi, no voices, no music. |
| gunner-deploy | 0.7 | 0.48 | Small bronze field cannon rolled into place: wooden spoked wheels creaking and rumbling, stopping with a heavy clunk and a metal ramrod rattle, no voices, no music. |
| pirate-death | 0.6 | 0.54 | Cartoon pirate defeated: a cutlass clattering on the ground, a comic splash-like flop and a soft thud with a little poof of smoke, no voices, no music. |
| viking-death | 0.7 | 0.68 | Big cartoon viking defeated: a heavy iron axe and helmet clanging down, a deep body thud and a dust poof, comic knock-out, no voices, no music. |
| gladiator-death | 0.5 | 0.18 | Cartoon gladiator knocked out: a bronze helmet clonks down and rolls around wobbling with metallic rattles, then a soft body thud and a dust poof, no voices, no music. |
| medic-death | 0.6 | 0.33 | Cartoon field medic knocked out: glass tonic bottles clinking in a leather satchel, a soft cloth flop and a gentle descending sparkle fizzle, no voices, no music. |
| miner-death | 0.6 | 0.4 | Miner defeated: a metal pickaxe clanging onto rocks, a tin hard hat bonking and rolling, and a soft dusty thud, cartoon, no voices, no music. |
| inventor-death | 0.6 | 0.6 | Inventor gadget short-circuits: a sputtering electric fizzle, a spring sproing and a small comic pop of smoke, cartoon, no voices, no music. |
| gunner-death | 0.6 | 0.6 | Old artilleryman defeated: a wooden cannon wheel creaking over and clattering down, a tall hat flopping and a soft thud, cartoon, no voices, no music. |
| quest-step | 0.5 | 0.37 | Loud clear close-up magical bell ping: one bright crystal chime note with a quick sparkle, a map marker lighting up in a cartoon game, present and crisp. |
| quest-reward | 0.9 | 0.61 | Bright game reward chime: a sparkling rising glockenspiel arpeggio with a shimmering magical finish, cheerful and short, no drums, no voices. |
| quest-coin | 0.6 | 0.6 | Handful of gold coins dropped into a pile: a bright jingling clink of a few coins, crisp and satisfying, game reward sound, no music. |
| quest-upgrade | 0.9 | 0.42 | Card levelling up in a fantasy game: a quick rising magical whoosh climbing in pitch into a bright sparkling twinkle burst, no music, no voices. |
| quest-heart-lost | 0.6 | 0.6 | Losing a life in a cartoon game: a soft sad low thud with a gentle descending two-note wooden bonk, muted and short, no music, no voices. |
| quest-victory | 2.4 | 1.76 | Short triumphant cartoon brass fanfare for completing a quest: a bold rising trumpet flourish with a timpani roll, ending on a bright held major chord. |

### Replaced first takes (`raw/rejected/`)

- quest-step (0.5 s, peak -32.6 dBFS): Game map marker lighting up: a single soft bright magical ping with a small warm glow shimmer, clean user interface sound, no music.
- gladiator-deploy (0.7 s, peak -26 dBFS): Roman gladiator arrives: a short sword banged twice on a big wooden shield with a bronze boss, a solid thumping clang, cartoon game, no voices, no music.
- gladiator-death (0.6 s, 0.13 s of sound): Gladiator knocked out: a bronze helmet bonking and rolling with a metallic wobble, a short sword clinking and a soft thud, cartoon, no voices, no music.
