import { audioBuffer, audioContext } from './audio-context.ts';
import {
  ambienceFor,
  bedPass,
  between,
  pickEvent,
  type Ambience,
  type AmbienceBed,
  type AmbienceEvent,
} from './ambience.ts';
import type { GameId as TrioGameId } from './trio/engine';
type GameId = TrioGameId | 'orin' | 'miro' | 'dial' | 'size';

/** Ambience sits under the cue sounds even at full volume. */
const CEILING = 0.52;
let active: Session | undefined;
let paused: { ambience: Ambience; volume: number } | undefined;

type Session = {
  ambience: Ambience;
  key: string;
  context: AudioContext;
  master: GainNode;
  timers: Set<ReturnType<typeof setTimeout>>;
  sources: Set<AudioScheduledSourceNode>;
  stopped: boolean;
  recent: AmbienceEvent[];
  volume: number;
  releaseWake: () => void;
};


function later(session: Session, seconds: number, run: () => void) {
  const timer = setTimeout(() => {
    session.timers.delete(timer);
    if (!session.stopped) run();
  }, seconds * 1000);
  session.timers.add(timer);
}

function play(
  session: Session,
  buffer: AudioBuffer,
  options: { gain: number; at?: number; offset?: number; duration?: number; fade?: number; pan?: number; detune?: number },
) {
  const { context, master } = session;
  const at = options.at ?? context.currentTime,
    fade = options.fade ?? 0.02,
    source = context.createBufferSource(),
    gain = context.createGain();
  source.buffer = buffer;
  if (options.detune) source.detune.value = options.detune;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, options.gain), at + fade);
  const length = options.duration ?? buffer.duration - (options.offset ?? 0);
  gain.gain.setValueAtTime(Math.max(0.0001, options.gain), at + Math.max(fade, length - fade));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  source.connect(gain);
  let tail: AudioNode = gain;
  if (options.pan !== undefined && typeof context.createStereoPanner === 'function') {
    const panner = context.createStereoPanner();
    panner.pan.value = options.pan;
    gain.connect(panner);
    tail = panner;
  }
  tail.connect(master);
  source.start(at, options.offset ?? 0, length);
  session.sources.add(source);
  source.onended = () => {
    session.sources.delete(source);
    source.disconnect();
    gain.disconnect();
    tail.disconnect();
  };
}

/** Each bed pass covers a random stretch of the recording and crossfades into the next. */
function runBed(session: Session, bed: AmbienceBed, buffer: AudioBuffer, at: number, first: boolean) {
  if (session.stopped) return;
  const pass = bedPass(buffer.duration);
  play(session, buffer, {
    gain: bed.gain * between([0.8, 1]),
    at,
    offset: pass.start,
    duration: pass.length,
    fade: first ? Math.min(pass.fade, 2.5) : pass.fade,
  });
  const next = at + pass.length - pass.fade;
  later(session, Math.max(0, next - session.context.currentTime - 0.5), () =>
    runBed(session, bed, buffer, next, false),
  );
}

function runEvents(session: Session, decoded: Map<AmbienceEvent, AudioBuffer>) {
  if (session.stopped || !decoded.size) return;
  later(session, between(session.ambience.gap), () => {
    const event = pickEvent([...decoded.keys()], session.recent);
    session.recent.push(event);
    if (session.recent.length > Math.min(5, decoded.size - 1)) session.recent.shift();
    const buffer = decoded.get(event);
    if (buffer)
      play(session, buffer, {
        gain: event.gain * between([0.7, 1]),
        pan: event.pan ? between(event.pan) : undefined,
        detune: event.detune ? between([-event.detune, event.detune]) : undefined,
        fade: 0.03,
      });
    later(session, buffer?.duration ?? 0, () => runEvents(session, decoded));
  });
}

function level(volume: number, ambience: Ambience) {
  return Math.max(0.0001, Math.min(1, volume) * CEILING * ambience.level);
}

function wakeOnGesture(context: AudioContext) {
  if (context.state !== 'suspended' || typeof window === 'undefined') return () => {};
  const wake = () => {
    void context.resume().catch(() => {});
    for (const type of ['pointerdown', 'keydown', 'touchend']) window.removeEventListener(type, wake, true);
  };
  for (const type of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(type, wake, true);
  return () => { for (const type of ['pointerdown', 'keydown', 'touchend']) window.removeEventListener(type, wake, true); };
}

/** Start (or switch to) the soundscape for a game; a second call with the same game is a no-op. */
export function startAmbience(id: GameId | null | undefined, volume: number, contentSet?: 'beginner' | 'intermediate') {
  const ambience = ambienceFor(id, contentSet);
  if (!ambience) { stopAmbience(); return; }
  void previewAmbience(ambience, volume);
}

/** Preview a supplied mix with the same scheduler used in play. */
export async function previewAmbience(ambience: Ambience, volume: number): Promise<boolean> {
  if (!Number.isFinite(volume) || volume <= 0 || typeof window === 'undefined') {
    stopAmbience();
    return false;
  }
  if (document.hidden) {
    stopAmbience();
    paused = { ambience, volume };
    return true;
  }
  const key = JSON.stringify(ambience);
  if (active?.key === key) {
    setAmbienceVolume(volume);
    return true;
  }
  stopAmbience();
  try {
    const context = audioContext();
    const releaseWake = wakeOnGesture(context);
    const master = context.createGain();
    master.gain.value = 0.0001;
    master.connect(context.destination);
    const session: Session = { ambience, key, context, master, timers: new Set(), sources: new Set(), stopped: false,
    recent: [], volume, releaseWake };
    active = session;
    master.gain.setTargetAtTime(document.hidden ? 0.0001 : level(volume, ambience), context.currentTime, 1.2);
    const pending: Promise<boolean>[] = [];
    let stagger = 0;
    for (const bed of ambience.beds) {
      const offset = stagger;
      stagger += 3;
      pending.push(audioBuffer(context, bed.src)
        .then((buffer) => { runBed(session, bed, buffer, context.currentTime + offset, true); return true; })
        .catch(() => false));
    }
    pending.push(Promise.all(
      ambience.events.map((event) =>
        audioBuffer(context, event.src)
          .then((buffer) => [event, buffer] as const)
          .catch(() => undefined),
      ),
    ).then((entries) => {
      const decoded = new Map<AmbienceEvent, AudioBuffer>();
      for (const entry of entries) if (entry) decoded.set(entry[0], entry[1]);
      runEvents(session, decoded);
      return decoded.size > 0;
    }));
    const loaded = await Promise.all(pending);
    return !session.stopped && (loaded.some(Boolean) || (!ambience.beds.length && !ambience.events.length));
  } catch {
    /* Ambience is optional. */
    return false;
  }
}

export function setAmbienceVolume(volume: number) {
  if (!Number.isFinite(volume) || volume <= 0) {
    stopAmbience();
    return;
  }
  if (paused) paused.volume = volume;
  if (!active) return;
  active.volume = volume;
  active.master.gain.setTargetAtTime(document.hidden ? 0.0001 : level(volume, active.ambience), active.context.currentTime, 0.4);
}

export function stopAmbience() {
  paused = undefined;
  const session = active;
  if (!session) return;
  active = undefined;
  session.stopped = true;
  session.releaseWake();
  for (const timer of session.timers) clearTimeout(timer);
  const { context, master } = session;
  const end = context.currentTime + 1;
  master.gain.setTargetAtTime(0.0001, context.currentTime, 0.3);
  for (const source of session.sources) {
    try {
      source.stop(end);
    } catch {}
  }
  setTimeout(() => master.disconnect(), 1200);
}

/** Browsers keep playing hidden tabs; the table should fall silent when it is not in view. */
export function pauseAmbienceWhenHidden(resumeWhenVisible = true) {
  if (typeof document === 'undefined') return () => {};
  const toggle = () => {
    if (document.hidden) {
      const previous = active ? { ambience: active.ambience, volume: active.volume } : paused;
      stopAmbience();
      if (resumeWhenVisible) paused = previous;
    } else if (paused) {
      const resume = paused;
      paused = undefined;
      void previewAmbience(resume.ambience, resume.volume);
    }
  };
  document.addEventListener('visibilitychange', toggle);
  return () => document.removeEventListener('visibilitychange', toggle);
}

export const ambienceCeiling = CEILING;
