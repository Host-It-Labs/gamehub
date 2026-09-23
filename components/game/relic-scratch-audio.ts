/** Procedural paper/metal sounds; no loop downloads, timers, or autoplay. */
export class ScratchAudio {
  private context: AudioContext | null = null;
  private noise: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private volume: GainNode | null = null;
  private muted = false;
  setMuted(value: boolean) {
    this.muted = value;
    if (value) this.stop();
  }
  async unlock() {
    if (this.muted || typeof window === 'undefined' || !window.AudioContext)
      return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') await this.context.resume();
    } catch {
      /* Sound is optional when the device disallows audio. */
    }
  }
  scratch(speed: number, metal: boolean) {
    const c = this.context;
    if (this.muted || !c || c.state !== 'running') return;
    if (!this.noise) {
      const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate),
        data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + (Math.random() * 2 - 1) * 0.14) / 1.14;
        data[i] = last * 3;
      }
      this.noise = c.createBufferSource();
      this.noise.buffer = buffer;
      this.noise.loop = true;
      this.filter = c.createBiquadFilter();
      this.filter.type = 'bandpass';
      this.filter.Q.value = metal ? 1.8 : 0.7;
      this.volume = c.createGain();
      this.volume.gain.value = 0;
      this.noise.connect(this.filter);
      this.filter.connect(this.volume);
      this.volume.connect(c.destination);
      this.noise.start();
    }
    const now = c.currentTime;
    this.filter!.frequency.setTargetAtTime(
      (metal ? 2100 : 950) + Math.min(speed, 1) * 1800,
      now,
      0.025,
    );
    this.volume!.gain.cancelScheduledValues(now);
    this.volume!.gain.setTargetAtTime(
      0.045 + Math.min(speed, 1) * 0.09,
      now,
      0.012,
    );
    // A stationary held pointer goes quiet even without a pointer-up event.
    this.volume!.gain.setTargetAtTime(0, now + 0.055, 0.035);
  }
  stop() {
    if (this.context && this.volume) {
      this.volume.gain.cancelScheduledValues(this.context.currentTime);
      this.volume.gain.setTargetAtTime(0, this.context.currentTime, 0.015);
    }
  }
  cue(kind: 'reveal' | 'prize' | 'paper' | 'upgrade', rare = false) {
    const c = this.context;
    if (this.muted || !c || c.state !== 'running') return;
    const notes =
      kind === 'prize'
        ? [523, 659, 784, 1046]
        : kind === 'upgrade'
          ? [440, 554, 880]
          : kind === 'paper'
            ? [180, 130]
            : [rare ? 1174 : 740];
    notes.forEach((note, i) => {
      const o = c.createOscillator(),
        g = c.createGain(),
        at = c.currentTime + i * 0.055;
      o.type = kind === 'paper' ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(note, at);
      o.frequency.exponentialRampToValueAtTime(
        note * (kind === 'paper' ? 0.55 : 1.015),
        at + 0.13,
      );
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(
        kind === 'paper' ? 0.025 : 0.07,
        at + 0.006,
      );
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      o.connect(g);
      g.connect(c.destination);
      o.start(at);
      o.stop(at + 0.24);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
    });
  }
  dispose() {
    this.stop();
    this.noise?.stop();
    this.noise?.disconnect();
    this.noise = null;
    this.filter?.disconnect();
    this.volume?.disconnect();
    void this.context?.close();
    this.context = null;
  }
}
