import { audioContext } from '../trio/sound';
import type { WorldId } from './types.ts';

let voices = 0;

/** Each world sounds like its own material: a bell carrying over cold water, a
 * light run of bamboo in the air, a struck pane of glass. Zero volume always
 * disables them, and audio never blocks a move. */
const palettes: Record<
  WorldId,
  {
    tones: number[];
    wave: OscillatorType;
    filter: BiquadFilterType;
    cutoff: number;
    /** Seconds of ring. Tin and glass hold; silk does not. */
    ring: number;
  }
> = {
  coast: {
    tones: [196, 294, 392],
    wave: 'sine',
    filter: 'lowpass',
    cutoff: 620,
    ring: 0.9,
  },
  meadow: {
    tones: [523, 659, 784],
    wave: 'triangle',
    filter: 'bandpass',
    cutoff: 1400,
    ring: 0.42,
  },
  canal: {
    tones: [349, 523, 1047],
    wave: 'sine',
    filter: 'highpass',
    cutoff: 1800,
    ring: 0.75,
  },
};

export function worldCue(
  id: WorldId,
  kind: 'move' | 'reveal' | 'win' | 'lose',
  volume: number,
) {
  if (volume <= 0 || typeof window === 'undefined' || voices > 16) return;
  try {
    const c = audioContext(),
      t = c.currentTime,
      p = palettes[id];
    const count = kind === 'win' ? 4 : kind === 'reveal' ? 2 : 1;
    // A loss falls instead of rising: the same material, the light going out.
    const falling = kind === 'lose';
    for (let i = 0; i < count; i++) {
      const o = c.createOscillator(),
        g = c.createGain();
      o.type = p.wave;
      const base = p.tones[i % p.tones.length] * (kind === 'win' ? 1.5 : 1);
      const at = t + i * 0.11;
      o.frequency.setValueAtTime(base, at);
      o.frequency.exponentialRampToValueAtTime(
        base * (falling ? 0.62 : 1.04),
        at + p.ring * 0.6,
      );
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(volume * 0.055, at + 0.014);
      g.gain.exponentialRampToValueAtTime(0.0001, at + p.ring);
      o.connect(g);
      g.connect(c.destination);
      voices++;
      o.start(at);
      o.stop(at + p.ring + 0.05);
      o.onended = () => {
        voices--;
        o.disconnect();
        g.disconnect();
      };
    }
    // A breath of the material under the tone: fog, grass, or the leading.
    const len = Math.floor(c.sampleRate * 0.2),
      buf = c.createBuffer(1, len, c.sampleRate),
      d = buf.getChannelData(0);
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    src.buffer = buf;
    filter.type = p.filter;
    filter.frequency.value = p.cutoff;
    filter.Q.value = 1.2;
    gain.gain.value = volume * 0.07;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start();
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  } catch {
    /* Audio must never block a move. */
  }
}
