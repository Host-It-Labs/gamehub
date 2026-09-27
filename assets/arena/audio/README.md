# Arena audio

Sound effects for Arena, generated with ElevenLabs text-to-sound (MCP
`text_to_sound_effects`, 27 September 2026). Raw downloads live in `raw/`
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
