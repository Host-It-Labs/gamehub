# Gamehub sound library

## Shared cues and audition options

Gameplay uses four shared ElevenLabs cues from `lib/games/global-audio-assets.json`: pickup, placement, your turn and final scores. Listening feedback selected **pickup B (Bright wood tick)**, **place F (Gentle settle)**, **your turn C (Rising chimes)** and the earlier **final scores B (Marimba flourish, 1.28 s)**. All four now supply the live cues. Longer final-score candidates remain previews.

Sound Lab's second comparison round keeps each liked recording next to two variations, with three new choices for the other actions:

- **Pick up:** the liked **B**, plus **D** and **E**.
- **Place:** fresh **D**, **E** and **F**.
- **Your turn:** the liked **C**, plus **D** and **E**.
- **Final scores:** longer, playful **D**, **E** and **F**, with space for a complete cadence and decay.

Letters identify individual sounds, not fixed instrumental families. The ten new candidates are in `lib/games/audio-round2-{variants,place,scores}.json`, combined with the two liked references by `audio-options.ts`. Unchosen sounds are **preview only**: pressing a play button never changes gameplay or ambient settings. Earlier A/B/C comparisons remain in a collapsed section.

Generation provenance is recorded in the matching `elevenlabs-round2-*-2026-09-26.json` files. The first comparison round is preserved in `audio-option-{a,b,c}.json` and `elevenlabs-option-{a,b,c}-2026-09-26.json`; the initial global set is recorded in `elevenlabs-global-2026-09-26.json`. Original sources remain under `assets/audio/elevenlabs/2026-09-26/`. Preview copies use versioned filenames in `public/audio/elevenlabs/`.

All shared auditions use the same gain function as gameplay. Only one preview plays at a time; switching, leaving or hiding the page stops it. Technical checks confirm that clips decode and stay within the documented peak levels. They do not establish subjective listening quality or speaker/headphone acceptance. The user chooses each action's letter after listening.

Nox trick-result events are silent. Final-score feedback belongs to the actual results presentation and is consumed once per match, including when muted. Winning local players see a short decorative spark burst; ties count and spectators do not. Reduced motion shows static ornaments. Lucky keeps continuous foil scratching and uses the shared placement cue for discrete actions, without a match-ending celebration.

## Earlier recordings and ambience

`lib/games/audio-assets.json` holds the earlier per-game effects and experimental ambience. Its exact prompts and measurements are recorded in `elevenlabs-2026-09-26.json`. Per-game effects remain in collapsed comparison sections in Sound Lab.

The generated ambience alternatives are also restricted to Sound Lab. Games retain the original recordings, levels and timing in `lib/games/ambience.ts`: Nox's ship, Mora's forest/coast and Yata's market. Saved lab mixes never override those game defaults.

## Audition and save

Open **Sound → Sound Lab** from the library or go to `/sound-lab`. The latest shared options appear first. For ambience, select a game,
then **Play mix** for the experimental blend, or a layer's play button to
listen to it alone. Background buttons switch between the two recordings;
sliders attenuate individual layers and the spacing control changes the pause
between occasional sounds. **Save preview** saves only this world's audition settings
on this device. **Reset** restores the defaults for comparison; save again to
keep them. Saved previews never change the ambience heard in games.

The full mix uses the game's normal master ceiling and crossfade scheduler.
Individual ambient layers are slightly more audible so quiet details can be identified.
All previews stop when switching games, navigating away, or hiding the tab.

## Integration checks

The original rollout passed 539 tests, and the production build, TypeScript, lint and
production-asset allowlist checks passed. An isolated production HTTP smoke
served `/sound-lab` and all 43 clips with the correct audio content type. Audio/controller tests cover muted
and hidden states, cancellation during loading, stale responses, rapid input,
mix validation and deliberately silent layers. See [motion coverage](motion-validation.md)
for the non-strategy feedback paths.

After restoring the original in-game ambience, all 29 focused audio/ambience
tests, TypeScript, lint and the production asset check passed. Browser and
listening checks were not repeated for this configuration-only restoration.

Focused Chrome checks covered the Sound Lab's mix/solo playback controls,
alternative selection, keyboard level adjustment, saving and reload persistence,
and its desktop and 390 px portrait layout. Strategy checks exercised Nox's
six-seat exchange-to-play transition, Mora creature placement/score updates,
and Yata drafting. Nox was also inspected at 390×844 and 820×1180. These checks
do not establish every party/puzzle state, physical touch, browser zoom,
long-label fit or subjective speaker balance.

The 0.26.0 selection uses pickup B, place F, turn C and Marimba flourish B.
The release check passed all 552 tests, TypeScript, lint and the asset allowlist.
A focused Chrome check confirmed the selected catalog and that Marimba flourish
reaches its native ended event at 1.28 seconds. The host's ambient toggle was
checked independently from effects; disabling ambience leaves current and
subsequent effects playing. Physical-device audio acceptance remains separate.
