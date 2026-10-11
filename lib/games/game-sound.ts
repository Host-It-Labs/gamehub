import { audioContext } from './audio-context.ts';
import { prepareRoom, renderCue, soundBus, type SoundBook } from './sound/cues.ts';
import { bookFor, cueFor } from './sound/index.ts';
import { signalTurn } from './turn-signal.ts';

/**
 * Every game's sound effects, synthesised in the browser (`lib/games/sound`):
 * each game has its own, and only Your turn is shared. Rapid input
 * coalesces, a hidden page is silent, and the final scores clear the game's
 * other cues so a busy last move cannot mask them.
 *
 * Each game rings into its own output (room included), so stopping a game
 * fades everything it is still sounding, tails too, and a cue waiting for
 * sound to unlock is dropped if the game stops before it can play.
 */
type Live = { game: string; dry: number };
const live = new Set<Live>();
const outputs = new Map<string, GainNode>();
const generations = new Map<string, number>();
let epoch = 0;
const recent = new Map<string, number>();
const QUICK = new Set(['tap', 'pickup', 'select', 'drop']);
/** Cues ringing at once before a new one is dropped (Your turn and the
 *  final scores always play). */
const VOICES = 5;
let listening = false;

const gameOf = (id: string) => bookFor(id)?.id ?? id;

function output(context: BaseAudioContext, game: string) {
  let bus = outputs.get(game);
  if (!bus) {
    bus = context.createGain();
    bus.connect(soundBus(context).master);
    outputs.set(game, bus);
  }
  return bus;
}

/** Count a cue until its voices stop; let its nodes go once it rings out. */
function track(game: string, render: { out: GainNode; end: number; dry: number }, context: BaseAudioContext) {
  const entry = { game, dry: render.dry };
  live.add(entry);
  setTimeout(() => {
    live.delete(entry);
    render.out.disconnect();
  }, (render.end - context.currentTime) * 1000 + 100);
}

export function stopGameSounds(game?: string) {
  const only = game && gameOf(game);
  if (only) generations.set(only, (generations.get(only) ?? 0) + 1);
  else epoch++;
  for (const entry of live) if (!only || entry.game === only) live.delete(entry);
  for (const [id, bus] of outputs) {
    if (only && id !== only) continue;
    outputs.delete(id);
    try {
      const now = bus.context.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setTargetAtTime(0, now, 0.012);
    } catch {
      /* Already gone. */
    }
    setTimeout(() => bus.disconnect(), 150);
  }
}

/** Build the output and the game's room ahead of the first cue. */
export function preloadGameSounds(id: string) {
  if (typeof window === 'undefined' || document.hidden) return;
  try {
    const context = audioContext();
    const book = bookFor(id);
    if (book) prepareRoom(context, book.space, output(context, book.id));
  } catch {
    /* Sound is optional. */
  }
}

/** Play a game's cue for a kind of moment (`pickup`, `place`, `reveal`,
 *  `scores`, `turn`…) at the player's effects volume. */
export function gameSound(id: string, kind: string, volume = 0.5, variant = 0) {
  if (typeof window === 'undefined' || document.hidden) return;
  // The glow shows even with sound off.
  if (kind === 'turn') signalTurn();
  if (!Number.isFinite(volume) || volume <= 0) return;
  const found = cueFor(id, kind);
  if (!found) return;
  const game = gameOf(id);
  const asked = performance.now();
  const key = `${game}:${found.name}`;
  if (asked - (recent.get(key) ?? -Infinity) < (QUICK.has(kind) ? 75 : 130)) return;
  recent.set(key, asked);
  if (kind === 'scores') stopGameSounds(game);
  if (!listening) {
    listening = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopGameSounds();
    });
    window.addEventListener('pagehide', () => stopGameSounds());
  }
  let context: AudioContext;
  try {
    context = audioContext();
  } catch {
    return;
  }
  const generation = generations.get(game) ?? 0;
  const started = epoch;
  const play = () => {
    if (generation !== (generations.get(game) ?? 0) || started !== epoch) return;
    let ringing = 0;
    for (const entry of live) if (entry.dry > context.currentTime) ringing++;
    if (ringing >= VOICES && kind !== 'turn' && kind !== 'scores') return;
    // Another seat's card is a touch higher or lower, never one sample.
    const pitch = variant ? 1 + ((((variant % 5) + 5) % 5) - 2) * 0.025 : 1;
    const render = renderCue(context, found.book, found.name, {
      volume: Math.min(1, volume),
      pitch,
      dest: output(context, game),
    });
    if (render) track(game, render, context);
  };
  try {
    if (context.state === 'running') play();
    // The first tap unlocks sound: play once it has, unless that took too
    // long or the game stopped meanwhile.
    else if (context.state === 'suspended')
      void context
        .resume()
        .then(() => {
          if (!document.hidden && performance.now() - asked < 300) play();
        })
        .catch(() => {});
  } catch {
    /* Audio must never block play. */
  }
}

/** The Sound Lab's audition of any cue, at the same level as play; it
 *  replaces the one before. Returns how long it rings, in seconds. */
export function auditionCue(book: SoundBook, name: string, volume: number) {
  stopGameSounds('lab');
  if (!Number.isFinite(volume) || volume <= 0) return 0;
  let context: AudioContext;
  try {
    context = audioContext();
  } catch {
    return 0;
  }
  const bus = output(context, 'lab');
  bus.gain.value = Math.min(1, volume);
  const render = renderCue(context, book, name, { volume: 1, dest: bus });
  if (!render) return 0;
  track('lab', render, context);
  return render.end - context.currentTime;
}

/** The lab's volume slider, applied to an audition already ringing. */
export function setAuditionVolume(volume: number) {
  const bus = outputs.get('lab');
  if (!bus) return;
  const level = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
  bus.gain.setTargetAtTime(level, bus.context.currentTime, 0.02);
}
