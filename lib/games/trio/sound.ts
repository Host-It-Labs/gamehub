import type { Event, GameId } from './engine';
let context: AudioContext | undefined,
  voices = 0,
  last = 0;
export function cue(kind: string, volume = 0.5, variant = 0) {
  if (!volume || typeof window === 'undefined') return;
  try {
    context ??= new AudioContext();
    void context.resume();
    const now = context.currentTime;
    if (voices > 18 || (kind === 'pickup' && now - last < 0.08)) return;
    last = now;
    const pitches: Record<string, number[]> = {
      turn: [330, 495, 660],
      pickup: [392, 523],
      drop: [392, 587],
      shuffle: [392, 494, 587],
      roll: [294, 392, 440, 494, 587, 784],
      ward: [220, 330, 440, 660],
      creature: [392, 494, 659],
      dish: [520, 780],
      combo: [440, 554, 659, 880],
      penalty: [392, 440],
      win: [392, 494, 587, 784, 988],
      tap: [420],
    };
    const notes = pitches[kind] ?? pitches.tap;
    notes.forEach((frequency, i) => {
      if (!context) return;
      const t = now + i * (kind === 'roll' ? 0.065 : 0.06),
        osc = context.createOscillator(),
        gain = context.createGain();
      voices++;
      osc.type = ['drop', 'shuffle', 'roll'].includes(kind)
        ? 'triangle'
        : kind === 'creature'
          ? 'sine'
          : 'sine';
      const f = frequency * (1 + variant * 0.065);
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(
        f * (kind === 'creature' ? 1.06 : 1.015),
        t + 0.12,
      );
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.075 * volume, t + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(t);
      osc.stop(t + 0.24);
      osc.onended = () => {
        voices--;
        osc.disconnect();
        gain.disconnect();
      };
    });
    if (['drop', 'shuffle', 'roll'].includes(kind)) {
      const length = Math.floor(context.sampleRate * 0.08),
        buffer = context.createBuffer(1, length, context.sampleRate),
        samples = buffer.getChannelData(0);
      for (let i = 0; i < length; i++)
        samples[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
      const source = context.createBufferSource(),
        gain = context.createGain(),
        filter = context.createBiquadFilter();
      source.buffer = buffer;
      filter.type = 'lowpass';
      filter.frequency.value = kind === 'roll' ? 1400 : 3500;
      gain.gain.value = 0.05 * volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      source.start();
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
    }
  } catch {
    /* Audio is optional. */
  }
}
export function eventCue(event: Event, id: GameId, volume: number) {
  cue(
    event.type === 'roll'
      ? 'roll'
      : event.type === 'deal' || event.type === 'pass'
        ? 'shuffle'
        : event.type === 'finish'
          ? 'win'
          : event.type === 'trick'
            ? event.points
              ? 'penalty'
              : 'combo'
            : id === 'wildgrove'
              ? 'creature'
              : id === 'midnight'
                ? 'dish'
                : 'drop',
    volume,
    event.kind ?? 0,
  );
}
