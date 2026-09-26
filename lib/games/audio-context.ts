let context: AudioContext | undefined;

/** A single context for effects, scratching and ambience; unlock only on a gesture. */
export function audioContext() {
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume().catch(() => {});
  return context;
}

const buffers = new Map<string, Promise<AudioBuffer>>();
export function audioBuffer(context: AudioContext, src: string) {
  let pending = buffers.get(src);
  if (!pending) {
    pending = fetch(src).then((response) => {
      if (!response.ok) throw new Error(`Audio unavailable: ${response.status}`);
      return response.arrayBuffer();
    }).then((data) => context.decodeAudioData(data));
    buffers.set(src, pending);
    void pending.catch(() => buffers.delete(src));
  }
  return pending;
}
