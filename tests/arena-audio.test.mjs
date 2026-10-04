import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const manifest = JSON.parse(
  readFileSync(new URL('../lib/games/arena/audio.json', import.meta.url)),
);
const compiled = ts.transpileModule(
  readFileSync(
    new URL('../components/game/arena/sound.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  },
).outputText;
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

function fixture() {
  const requests = new Map(),
    sources = [],
    gains = [],
    timers = new Map();
  const parameter = () => ({
    value: 0,
    target: 0,
    setTargetAtTime(value) {
      this.target = value;
    },
  });
  const node = () => ({
    connect(to) {
      return to;
    },
    disconnect() {
      this.disconnected = true;
    },
  });
  const events = (extra = {}) => {
    const listeners = new Map();
    return {
      ...extra,
      addEventListener(name, fn) {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name).add(fn);
      },
      removeEventListener(name, fn) {
        listeners.get(name)?.delete(fn);
      },
      emit(name) {
        for (const fn of listeners.get(name) ?? []) fn();
      },
    };
  };
  const context = {
    currentTime: 1,
    state: 'running',
    destination: node(),
    resume() {
      this.state = 'running';
      return Promise.resolve();
    },
    createDynamicsCompressor() {
      return {
        ...node(),
        ...Object.fromEntries(
          ['threshold', 'knee', 'ratio', 'attack', 'release'].map((k) => [
            k,
            parameter(),
          ]),
        ),
      };
    },
    createGain() {
      const n = { ...node(), gain: parameter() };
      gains.push(n);
      return n;
    },
    createStereoPanner() {
      return { ...node(), pan: parameter() };
    },
    createBufferSource() {
      const n = {
        ...node(),
        playbackRate: parameter(),
        started: false,
        stopped: false,
        start() {
          this.started = true;
        },
        stop() {
          assert.ok(this.started, 'never stop a pending, unstarted source');
          this.stopped = true;
          this.onended?.();
        },
      };
      sources.push(n);
      return n;
    },
  };
  const document = events({ hidden: false });
  const window = events({
    setTimeout(fn) {
      const id = timers.size + 1;
      timers.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  });
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    document,
    window,
    require(id) {
      if (id.endsWith('audio.json')) return manifest;
      if (id.endsWith('audio-context'))
        return {
          audioContext: () => context,
          audioBuffer: (_, src) => {
            if (!requests.has(src)) {
              let resolve;
              const promise = new Promise((r) => {
                resolve = r;
              });
              requests.set(src, { promise, resolve });
            }
            return requests.get(src).promise;
          },
        };
      throw new Error(id);
    },
  });
  const sound = new exports.ArenaSound();
  return {
    sound,
    module: exports,
    requests,
    context,
    sources,
    gains,
    document,
    window,
    timers,
    async load(id) {
      for (const src of manifest[id].srcs)
        requests.get(src).resolve({ duration: manifest[id].duration, src });
      await settle();
    },
  };
}

await test('music changes at the last minute, stays urgent in overtime and stops on resynced results', async () => {
  const f = fixture();
  await f.load('music-battle');
  await f.load('music-final');
  f.sound.frame({ phase: 'battle' }, 61, false);
  await settle();
  const calm = f.sources.at(-1);
  assert.equal(calm.buffer.src, manifest['music-battle'].srcs[0]);
  f.sound.frame({ phase: 'battle' }, 60, true);
  await settle();
  const fast = f.sources.at(-1);
  assert.equal(calm.stopped, true);
  assert.equal(fast.buffer.src, manifest['music-final'].srcs[0]);
  f.sound.frame({ phase: 'overtime' }, 60, true);
  await settle();
  assert.equal(f.sources.at(-1), fast);
  f.sound.frame({ phase: 'over' }, 0, false);
  assert.equal(fast.stopped, true);
  f.sound.dispose();
});

await test('switching or leaving during a pending decode never starts stale music or stops an unstarted node', async () => {
  const f = fixture();
  f.sound.setMusic('music-battle');
  f.sound.setMusic('music-final');
  await f.load('music-battle');
  assert.equal(f.sources[0].started, false);
  f.sound.dispose();
  await f.load('music-final');
  assert.ok(f.sources.every((s) => !s.started && s.disconnected));
});

await test('mute, pause and backgrounding cancel pending effects and silence music independently', async () => {
  const f = fixture();
  f.sound.play('card-pick');
  f.sound.levels(0, 0.6);
  await f.load('card-pick');
  assert.equal(f.sources.length, 0);
  f.sound.levels(0.5, 0.6);
  f.sound.play('card-pick');
  await settle();
  const effect = f.sources.at(-1);
  assert.ok(effect.started);
  f.sound.pause(true);
  assert.ok(effect.stopped);
  assert.equal(f.gains[1].gain.target, 0);
  f.sound.pause(false);
  assert.ok(f.gains[1].gain.target > 0);
  f.document.hidden = true;
  f.document.emit('visibilitychange');
  assert.equal(f.gains[1].gain.target, 0);
  f.document.hidden = false;
  f.document.emit('visibilitychange');
  f.sound.levels(0.5, 0);
  assert.equal(f.gains[1].gain.target, 0);
  f.sound.dispose();
});

await test('major effects duck music and leave room for cues during a crowded battle', async () => {
  const f = fixture();
  await f.load('tower-fall');
  const normal = f.gains[1].gain.target;
  f.sound.play('tower-fall');
  await settle();
  assert.ok(f.gains[1].gain.target < normal * 0.5);
  f.context.currentTime += 3;
  f.sound.frame({ phase: 'battle' }, 90, false);
  assert.equal(f.gains[1].gain.target, normal);
  const ids = ['card-drop', 'arrow-shot', 'hit-melee', 'tower-hit'];
  for (const id of ids) await f.load(id);
  for (let i = 0; i < 4; i++) {
    f.context.currentTime += 0.1;
    for (const id of ids) f.sound.play(id);
    await settle();
  }
  assert.ok(
    f.sources.filter((s) => s.started && !s.stopped && !s.loop).length <= 11,
  );
  await f.load('overtime');
  f.sound.play('overtime');
  await settle();
  assert.equal(f.sources.at(-1).buffer.src, manifest.overtime.srcs[0]);
  f.sound.dispose();
});

await test('leaving cancels delayed troop and crown cues and releases all music nodes', async () => {
  const f = fixture();
  f.sound.events(
    { towers: [] },
    [{ type: 'deploy', card: 'ogre', side: 0, x: 0, y: 0 }],
    0,
    () => 0,
  );
  assert.equal(f.timers.size, 1);
  await f.load('music-battle');
  f.sound.setMusic('music-battle');
  await settle();
  f.sound.dispose();
  assert.equal(f.timers.size, 0);
  assert.ok(f.sources.every((s) => s.disconnected));
});

await test('opening waits for battle and plays one cue at a stable pitch', async () => {
  const f = fixture();
  await f.load('music-battle');
  await f.load('battle-start');
  f.sound.frame({ phase: 'ready' }, 180, false);
  await settle();
  assert.equal(f.sources.filter((s) => s.started).length, 0);
  f.sound.events(
    { towers: [], phase: 'battle' },
    [{ type: 'phase', phase: 'battle' }],
    0,
    () => 0,
  );
  f.sound.frame({ phase: 'battle' }, 180, false);
  await settle();
  const effects = f.sources.filter((s) => s.started && !s.loop);
  assert.equal(effects.length, 1);
  assert.equal(effects[0].buffer.src, manifest['battle-start'].srcs[0]);
  assert.equal(effects[0].playbackRate.value, 1);
  assert.equal(f.sources.filter((s) => s.started && s.loop).length, 1);
  f.sound.dispose();
});

await test('Sound Lab has two complete music pairs with a gentle final-minute increase', async () => {
  const { arenaMusicOptions } = await import('../lib/games/arena/music.ts');
  assert.equal(arenaMusicOptions.length, 2);
  const sources = new Set();
  for (const option of arenaMusicOptions) {
    const normal = manifest[option.battle];
    const final = manifest[option.final];
    assert.ok(normal.loop && final.loop);
    assert.ok(Math.abs(normal.duration / final.duration - 1.08) < 0.01);
    for (const entry of [normal, final]) {
      assert.ok(
        readFileSync(new URL(`../public${entry.srcs[0]}`, import.meta.url))
          .length > 100000,
      );
      sources.add(entry.srcs[0]);
    }
  }
  assert.equal(sources.size, 4);
  assert.ok(
    Math.abs(
      manifest['music-battle'].duration / manifest['music-final'].duration -
        1.08,
    ) < 0.01,
  );
});

await test('a match does not fetch or decode Sound Lab music alternatives', () => {
  const f = fixture();
  assert.ok(f.requests.has(manifest['music-battle'].srcs[0]));
  assert.ok(f.requests.has(manifest['music-final'].srcs[0]));
  for (const [id, entry] of Object.entries(manifest))
    if (id.startsWith('music-option-'))
      assert.equal(f.requests.has(entry.srcs[0]), false);
  f.sound.dispose();
});

await test('Quest troops play their ability clips and Quest cues stay out of battle preloads', async () => {
  const f = fixture();
  for (const id of Object.keys(manifest))
    if (id.startsWith('quest-'))
      assert.equal(f.requests.has(manifest[id].srcs[0]), false);
  const ids = [
    'medic-heal',
    'pirate-leap',
    'shield-break',
    'miner-emerge',
    'viking-rage',
    'stun',
    'zap-chain',
    'shell-shot',
    'shell-blast',
    'drop-blast',
    'balloon-crash',
  ];
  for (const id of ids) await f.load(id);
  const m = {
    towers: [],
    units: [
      { id: 1, card: 'inventor', x: 0, y: 0 },
      { id: 2, card: 'gunner', x: 0, y: 0 },
      { id: 3, card: 'pirate', x: 0, y: 0 },
    ],
  };
  f.sound.events(
    m,
    [
      { type: 'heal', id: 9, x: 0, y: 0, radius: 2 },
      { type: 'leap', id: 3 },
      { type: 'shield', id: 9, x: 0, y: 0 },
      { type: 'emerge', id: 9, x: 0, y: 0 },
      { type: 'rage', id: 9 },
      { type: 'stun', id: 9, x: 0, y: 0 },
      { type: 'shot', id: 1, kind: 'zap' },
      { type: 'shot', id: 2, kind: 'shell' },
      { type: 'impact', kind: 'shell', x: 0, y: 0, splash: 1 },
      { type: 'impact', kind: 'drop', x: 0, y: 0, splash: 1 },
      { type: 'impact', kind: 'crash', x: 0, y: 0, splash: 1 },
    ],
    0,
    () => 0,
  );
  await settle();
  const played = new Set(f.sources.map((s) => s.buffer.src));
  for (const id of ids) assert.ok(played.has(manifest[id].srcs[0]), id);
  f.sound.events(
    m,
    [{ type: 'deploy', card: 'miner', side: 0, x: 0, y: 0 }],
    0,
    () => 0,
  );
  assert.equal(f.timers.size, 1);
  f.sound.dispose();
});

await test('Quest cues play once at the given volume and stay silent when muted', async () => {
  const f = fixture();
  const { playQuestSound } = f.module;
  playQuestSound('quest-coin', 0);
  assert.equal(f.requests.has(manifest['quest-coin'].srcs[0]), false);
  playQuestSound('quest-coin', 0.5);
  await f.load('quest-coin');
  const cue = f.sources.at(-1);
  assert.ok(cue.started);
  assert.equal(cue.buffer.src, manifest['quest-coin'].srcs[0]);
  assert.ok(f.gains.at(-1).gain.value > 0);
  f.sound.dispose();
});
