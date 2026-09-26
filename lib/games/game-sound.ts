import { audioBuffer, audioContext } from './audio-context.ts';
import { sharedAudioAssets, effectFor, soundGame } from './audio-catalog.ts';

const recent = new Map<string, number>();
const generations = new Map<string, number>();
const playing = new Map<AudioBufferSourceNode, { game: string; gain: GainNode }>();
let listening = false;

export function stopGameSounds(game?: string) {
  const games = game ? [soundGame(game) ?? game] : [...generations.keys()];
  for (const id of games) generations.set(id, (generations.get(id) ?? 0) + 1);
  for (const [source, entry] of playing) {
    if (game && entry.game !== (soundGame(game) ?? game)) continue;
    try { source.stop(); } catch { /* Already ended. */ }
  }
}

export function preloadGameSounds(_id: string) {
  if (typeof window === 'undefined' || document.hidden) return;
  try {
    const context = audioContext();
    for (const asset of sharedAudioAssets)
      void audioBuffer(context, asset.src).catch(() => {});
  } catch { /* Sound is optional. */ }
}

/** Match the Sound Lab audition to the same restrained level used in play. */
export function effectLevel(volume: number, gain: number) {
  if (!Number.isFinite(volume) || !Number.isFinite(gain)) return 0;
  return Math.max(0, Math.min(1, volume)) * Math.max(0, Math.min(0.6, gain)) * 0.65;
}

/** Shared quiet foley. Rapid input coalesces; late responses never replay old moves. */
export function gameSound(id: string, kind: string, volume = 0.5, variant = 0) {
  if (typeof window === 'undefined' || document.hidden || !Number.isFinite(volume) || volume <= 0) return;
  const asset = effectFor(id, kind, variant);
  if (!asset) return;
  const game = soundGame(id) ?? id;
  const now = performance.now(), key = `${game}:${asset.category}`;
  if (now - (recent.get(key) ?? -Infinity) < (asset.category === 'pickup' ? 75 : 130)) return;
  recent.set(key, now);
  // Final presentation owns the foreground; discard that game's action tails
  // and pending decodes so a busy last move cannot mask its score cue.
  if (asset.category === 'scores') stopGameSounds(game);
  if (!listening) {
    listening = true;
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopGameSounds(); });
    window.addEventListener('pagehide', () => stopGameSounds());
  }
  try {
    const context = audioContext(), generation = generations.get(game) ?? 0;
    generations.set(game, generation);
    void audioBuffer(context, asset.src).then((buffer) => {
      if (document.hidden || context.state !== 'running' || performance.now() - now > 450 ||
        generation !== (generations.get(game) ?? 0) || playing.size >= 3) return;
      const source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffer;
      // Each clip already carries its mastered attack and release. A constant
      // level preserves the soft transient and matches its Sound Lab audition.
      gain.gain.value = effectLevel(volume, asset.gain);
      source.connect(gain);
      gain.connect(context.destination);
      playing.set(source, { game, gain });
      source.onended = () => { playing.delete(source); source.disconnect(); gain.disconnect(); };
      source.start();
    }).catch(() => {});
  } catch { /* Audio must never block play. */ }
}
