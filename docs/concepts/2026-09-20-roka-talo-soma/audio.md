# Original adventure soundscapes

Generated locally with `scripts/generate-adventure-audio.mjs`; no downloaded recordings, licensed samples, or reused existing-game beds. Re-run with Node and ffmpeg installed. Existing outputs are preserved.

Each game has two stereo AAC beds (42 and 37 seconds) plus three accent events. The existing ambience player randomizes offsets, crossfades beds, spaces events, changes stereo placement and avoids recent repeats. It pauses when the document is hidden, stops on exit, and respects the device volume and ambience sliders.

- Roka: filtered surf and deep water, low volcanic resonance, distant creature-like whistles.
- Talo: dry air and low stone resonance, sparse metallic harmonic rings.
- Soma: engine hum, moving air, tensioned rigging and valve-like accents.

`lib/games/adventures/sound.ts` adds game-specific layered action cues with different pitches, waveforms and filtered noise. Successful actions and wins use longer phrases. These are synthesized interpretations of materials, not field recordings. Listening and device/browser acceptance are separate from file validation.
