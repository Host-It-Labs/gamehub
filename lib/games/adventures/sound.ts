import { audioContext } from '../trio/sound';
import type { StandaloneId } from '../standalone/types';
let voices = 0;
/** Short original party-game cues; zero volume always disables them. */
export function adventureCue(id: StandaloneId, kind: string, volume: number) {
  if (volume <= 0 || typeof window === 'undefined' || voices > 16) return;
  try {
    const c = audioContext(),
      t = c.currentTime;
    const palette =
      id === 'orin'
        ? [330, 440, 660]
        : [220, 440, 880];
    const success = ['lock', 'ready', 'win'].includes(kind);
    const count = kind === 'win' ? 5 : success ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const o = c.createOscillator(),
        g = c.createGain();
      o.type = 'sine';
      const f = palette[i % 3] * (kind === 'win' ? 1.5 : 1);
      o.frequency.setValueAtTime(f, t + i * 0.09);
      o.frequency.exponentialRampToValueAtTime(
        f * (id === 'orin' ? 1.18 : 0.94),
        t + i * 0.09 + 0.25,
      );
      g.gain.setValueAtTime(0, t + i * 0.09);
      g.gain.linearRampToValueAtTime(volume * 0.06, t + i * 0.09 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.6);
      o.connect(g);
      g.connect(c.destination);
      voices++;
      o.start(t + i * 0.09);
      o.stop(t + i * 0.09 + 0.65);
      o.onended = () => {
        voices--;
        o.disconnect();
        g.disconnect();
      };
    }
    const len = c.sampleRate * 0.22,
      buf = c.createBuffer(1, len, c.sampleRate),
      d = buf.getChannelData(0);
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    src.buffer = buf;
    filter.type =
      id === 'orin' ? 'lowpass' : 'highpass';
    filter.frequency.value = id === 'orin' ? 700 : 2200;
    filter.Q.value = 1.5;
    gain.gain.value = volume * 0.09;
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
