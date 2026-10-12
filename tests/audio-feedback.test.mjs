import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { audioContext } from '../lib/games/audio-context.ts';
import { auditionCue, gameSound, setAuditionVolume, stopGameSounds } from '../lib/games/game-sound.ts';
import { cue, eventCue } from '../lib/games/trio/sound.ts';
import { adventureCue } from '../lib/games/adventures/sound.ts';
import { bookFor, cueFor, soundBooks } from '../lib/games/sound/index.ts';
import { renderCue, soundBus } from '../lib/games/sound/cues.ts';
import { cueFingerprint } from '../lib/games/sound/fingerprint.ts';
import levels from '../lib/games/sound/levels.json' with { type: 'json' };
import arenaAudio from '../lib/games/arena/audio.json' with { type: 'json' };
import { TURN_EVENT } from '../lib/games/turn-signal.ts';
import { pauseAmbienceWhenHidden, previewAmbience, setAmbienceVolume, stopAmbience } from '../lib/games/ambience-player.ts';
import { ambiences } from '../lib/games/ambience.ts';

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
/** The game output a cue rings into: stopping a game fades it, tails too. */
const bus = (out) => out.targets[0];
const level = (key) => levels[key].gain;

/** An AudioParam that refuses what a browser would throw on (or silently
 *  mangle): non-finite values or times, exponential ramps to zero, and
 *  frequencies outside what the context can play. */
function parameter(name, value = 0) {
  const check = (v, at) => {
    assert.ok(Number.isFinite(v), `${name}: finite value`);
    assert.ok(Number.isFinite(at) && at >= 0, `${name}: finite time`);
    if (name === 'frequency' || name === 'cutoff') assert.ok(v > 0 && v <= 24000, `${name}: ${v} Hz`);
  };
  return {
    value,
    setValueAtTime(v, at) { check(v, at); return this; },
    linearRampToValueAtTime(v, at) { check(v, at); return this; },
    exponentialRampToValueAtTime(v, at) { check(v, at); assert.ok(v > 0, `${name}: exponential ramps stay above zero`); return this; },
    setTargetAtTime(v, at, constant) { check(v, at); assert.ok(constant > 0); this.target = v; return this; },
    cancelScheduledValues(at) { assert.ok(Number.isFinite(at)); return this; },
  };
}
const node = (extra = {}) => ({
  targets: [], disconnected: false,
  connect(to) { assert.ok(to, 'connect to a node'); this.targets.push(to); return to; },
  disconnect() { this.disconnected = true; },
  ...extra,
});
/** The node factories a synthesised cue uses; `voices` collects every
 *  oscillator and buffer source it starts. */
function synthesis(context, voices, gains = []) {
  return Object.assign(context, {
    sampleRate: 48000,
    createGain() { const gain = node({ gain: parameter('gain'), context }); gains.push(gain); return gain; },
    createStereoPanner() { return node({ pan: parameter('pan') }); },
    createBiquadFilter() { return node({ type: 'lowpass', frequency: parameter('cutoff', 350), Q: parameter('Q', 1) }); },
    createWaveShaper() { return node({ curve: null }); },
    createConvolver() { return node({ buffer: null }); },
    createDynamicsCompressor() { return node(Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map((k) => [k, parameter(k)]))); },
    createBuffer(channels, length, rate) {
      assert.ok(channels > 0 && length > 0 && rate > 0);
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { numberOfChannels: channels, length, sampleRate: rate, duration: length / rate, getChannelData: (c) => data[c] };
    },
    createOscillator() {
      const osc = node({
        type: 'sine', frequency: parameter('frequency', 440), detune: parameter('detune'),
        start(at) { assert.ok(Number.isFinite(at)); this.started = at; },
        stop(at) { assert.ok(at >= this.started, 'stops after it starts'); this.stoppedAt = at; },
      });
      voices.push(osc);
      return osc;
    },
  });
}

/** No network, speakers or wall-clock sleeps: exercise the actual asynchronous schedulers. */
function webAudio(t) {
  let now = 0, timerId = 0;
  const timers = new Map(), requests = new Map(), storage = new Map(), sources = [], gains = [], voices = [];
  const originals = new Map();
  function global(name, value) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  function events(extra = {}) {
    const listeners = new Map();
    return {
      ...extra,
      addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); },
      removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
      dispatchEvent(event) { this.emit(event.type); return true; },
      emit(type) { for (const callback of listeners.get(type) ?? []) callback(); },
    };
  }
  const document = events({ hidden: false });
  const window = events();
  class AudioContext {
    state = 'running';
    destination = node();
    constructor() {
      synthesis(this, voices, gains);
    }
    get currentTime() { return now / 1000; }
    // Like a browser, unlocking settles a moment later.
    resume() { return Promise.resolve().then(() => { this.state = 'running'; }); }
    decodeAudioData(data) { return Promise.resolve(data); }
    createBufferSource() {
      const source = {
        ...node(), detune: parameter('detune'), playbackRate: parameter('rate', 1), buffer: null, stopped: false,
        start(...args) { this.started = args; },
        stop(at) { this.stopped = true; this.stoppedAt = at; this.onended?.(); },
      };
      sources.push(source);
      voices.push(source);
      return source;
    }
  }
  global('window', window);
  global('document', document);
  global('AudioContext', AudioContext);
  global('localStorage', { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) });
  global('performance', { now: () => now });
  global('setTimeout', (run, delay = 0) => { const id = ++timerId; timers.set(id, { run, at: now + delay }); return id; });
  global('clearTimeout', (id) => timers.delete(id));
  global('fetch', (src) => {
    assert.ok(!requests.has(src), `one in-flight fetch per source: ${src}`);
    return new Promise((resolve) => requests.set(src, resolve));
  });
  const random = Math.random;
  Math.random = () => .5;
  t.after(() => {
    stopGameSounds(); stopAmbience();
    Math.random = random;
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return {
    document, window, sources, gains, voices, requests, storage,
    /** Each drawn cue's own gain, which feeds its game's output; that output
     *  feeds the shared one. */
    outs() {
      const master = soundBus(audioContext()).master;
      const games = gains.filter((gain) => gain.targets.includes(master));
      return gains.filter((gain) => gain.targets.some((target) => games.includes(target)));
    },
    resolve(src, duration = 1) {
      assert.ok(requests.has(src), `requested ${src}`);
      requests.get(src)({ ok: true, arrayBuffer: () => Promise.resolve({ src, duration }) });
    },
    tick(milliseconds) {
      const until = now + milliseconds;
      for (let count = 0; ; count++) {
        assert.ok(count < 500, 'scheduler must not spin');
        const first = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!first) break;
        now = first[1].at;
        timers.delete(first[0]);
        first[1].run();
      }
      now = until;
    },
    visibility(hidden) { document.hidden = hidden; document.emit('visibilitychange'); },
  };
}

const scene = (name, events = []) => ({
  id: 'undertow', world: name, level: .5,
  beds: [{ src: `/test/${name}-bed.mp3`, gain: .5 }],
  events: events.map((id) => ({ src: `/test/${id}.mp3`, gain: .3, weight: 1 })),
  gap: [10, 10],
});

await test('audio feedback respects cancellation, background state and bounded scheduling', async (t) => {
  const audio = webAudio(t);
  const drawn = () => audio.outs().length;

  await t.test('resolved tricks and finish events never play a reward or a score cue', async () => {
    for (const id of ['undertow', 'wildgrove', 'midnight']) {
      eventCue({ type: 'trick', points: 0 }, id, .5);
      eventCue({ type: 'trick', points: 8 }, id, .5);
      eventCue({ type: 'finish' }, id, .5);
    }
    await settle();
    assert.equal(drawn(), 0);
    assert.equal(audio.requests.size, 0, 'effects never fetch anything');
  });

  await t.test('muted or hidden input draws nothing', () => {
    gameSound('undertow', 'pickup', 0);
    audio.document.hidden = true;
    gameSound('undertow', 'pickup', .5);
    audio.document.hidden = false;
    assert.equal(drawn(), 0);
    assert.equal(audio.voices.length, 0);
  });

  await t.test('each cue plays at the player volume times its level; stopping a game fades only its cues', () => {
    gameSound('undertow', 'pickup', .5);
    gameSound('wildgrove', 'pickup', .5);
    const [nox, mora] = audio.outs();
    assert.equal(nox.gain.value, .5 * level('nox:pickup'));
    assert.equal(mora.gain.value, .5 * level('mora:pickup'));
    assert.notEqual(bus(nox), bus(mora), 'each game rings into its own output');
    assert.ok(audio.voices.length > 0);
    stopGameSounds('undertow');
    assert.equal(bus(nox).gain.target, 0, 'its room tail fades with it');
    assert.equal(bus(mora).gain.target, undefined, 'stopping Nox leaves Mora ringing');
    audio.tick(200);
    assert.ok(bus(nox).disconnected);
    assert.ok(!bus(mora).disconnected);
    audio.tick(5000);
    assert.ok(nox.disconnected && mora.disconnected, 'a cue lets its nodes go once it has rung out');
    gameSound('undertow', 'place', .5);
    assert.notEqual(bus(audio.outs().at(-1)), bus(nox), 'a stopped game gets a fresh output');
    stopGameSounds();
    audio.tick(5000);
  });

  await t.test('rapid input coalesces; the games inside Know Me and Quiz stop with their set', () => {
    const start = drawn();
    gameSound('orin', 'select', .5);
    gameSound('orin', 'select', .5);
    assert.equal(drawn(), start + 1);
    audio.tick(100);
    gameSound('orin', 'select', .5);
    gameSound('dial', 'select', .5);
    assert.equal(drawn(), start + 3);
    const family = audio.outs().slice(start);
    stopGameSounds('coins');
    assert.ok(family.every((out) => bus(out).gain.target === 0));
    gameSound('size', 'select', .5);
    const quiz = audio.outs().at(-1);
    stopGameSounds('miro');
    assert.equal(bus(quiz).gain.target, 0);
    audio.tick(5000);
  });

  await t.test('Your turn sounds the same in every game and shows its glow even muted', () => {
    let glows = 0;
    const glow = () => glows++;
    audio.window.addEventListener(TURN_EVENT, glow);
    const start = drawn();
    gameSound('undertow', 'turn', 0);
    assert.equal(glows, 1);
    assert.equal(drawn(), start);
    gameSound('rota', 'turn', .5);
    cue('turn', .5);
    assert.equal(glows, 3);
    assert.equal(drawn(), start + 2);
    assert.equal(audio.outs().at(-1).gain.value, .5 * level('shared:turn'));
    audio.document.hidden = true;
    gameSound('alto', 'turn', .5);
    audio.document.hidden = false;
    assert.equal(glows, 3, 'a hidden page neither sounds nor glows');
    audio.window.removeEventListener(TURN_EVENT, glow);
    stopGameSounds();
    audio.tick(5000);
  });

  await t.test('the final scores clear the game’s busy action tails', () => {
    const start = drawn();
    for (const kind of ['pickup', 'place', 'shuffle']) gameSound('midnight', kind, .5);
    assert.equal(drawn(), start + 3);
    gameSound('midnight', 'scores', .5);
    const outs = audio.outs().slice(start);
    assert.ok(outs.slice(0, 3).every((out) => bus(out).gain.target === 0));
    assert.equal(bus(outs[3]).gain.target, undefined);
    assert.equal(outs[3].gain.value, .5 * level('yata:scores'));
    stopGameSounds();
    audio.tick(5000);
  });

  await t.test('simultaneous cues stay bounded, Your turn always gets through, hiding silences all', () => {
    const start = drawn();
    for (const id of ['undertow', 'wildgrove', 'midnight', 'orin', 'miro', 'impostor', 'rota', 'alto']) gameSound(id, 'place', .5);
    assert.equal(drawn(), start + 5);
    gameSound('alto', 'turn', .5);
    assert.equal(drawn(), start + 6);
    audio.visibility(true);
    assert.ok(audio.outs().slice(start).every((out) => bus(out).gain.target === 0));
    audio.visibility(false);
    audio.tick(5000);
  });

  await t.test('Puzzles stays silent while typing and choosing, and sounds a submission', () => {
    const start = drawn();
    for (const kind of ['tap', 'pickup', 'select', 'move']) gameSound('folio', kind, .5);
    assert.equal(drawn(), start);
    gameSound('folio', 'submit', .5);
    assert.equal(drawn(), start + 1);
    stopGameSounds();
    audio.tick(5000);
  });

  await t.test('a draft placement sounds once even after delayed table resolution and auto-roll', () => {
    for (const id of ['wildgrove', 'midnight']) {
      audio.tick(500);
      const before = drawn();
      gameSound(id, 'place', .5);
      assert.equal(drawn(), before + 1);
      audio.tick(1000);
      for (const type of ['play', 'play', 'pass', 'roll', 'deal']) eventCue({ type, player: 1 }, id, .5);
      assert.equal(drawn(), before + 1, 'resolution must not echo placement');
      stopGameSounds();
    }
    audio.tick(5000);
  });

  await t.test('other seats’ Nox cards vary in pitch; callers without a game only sound Your turn', () => {
    const start = drawn();
    cue('pickup', .5);
    assert.equal(drawn(), start, 'a cue without a game has no sound of its own');
    eventCue({ type: 'play', player: 1, kind: 4 }, 'undertow', .5);
    adventureCue('impostor', 'move', .5);
    assert.equal(drawn(), start + 2);
    stopGameSounds();
    audio.tick(5000);
  });

  await t.test('the first tap waits for sound to unlock, and a slow unlock drops the stale cue', async () => {
    const context = audioContext();
    const start = drawn();
    context.state = 'suspended';
    gameSound('alto', 'select', .5);
    assert.equal(drawn(), start);
    await settle();
    assert.equal(drawn(), start + 1);
    audio.tick(200);
    context.state = 'suspended';
    context.resume = () => new Promise((done) => setTimeout(() => { context.state = 'running'; done(); }, 400));
    gameSound('alto', 'select', .5);
    audio.tick(400);
    await settle();
    assert.equal(drawn(), start + 1);
    delete context.resume;
    audio.tick(200);
    context.state = 'suspended';
    gameSound('rota', 'select', .5);
    stopGameSounds('rota');
    await settle();
    assert.equal(drawn(), start + 1, 'stopping a game drops a cue still waiting to unlock');
    context.state = 'suspended';
    gameSound('rota', 'place', .5);
    audio.visibility(true);
    audio.visibility(false);
    await settle();
    assert.equal(drawn(), start + 1, 'hiding the page drops it too');
    stopGameSounds();
    audio.tick(5000);
  });

  await t.test('a Sound Lab audition replaces the one before', () => {
    const start = drawn();
    assert.ok(auditionCue(bookFor('arena'), 'tower-fall', .5) > 1);
    auditionCue(bookFor('relic'), 'prize', .5);
    const [first, second] = audio.outs().slice(start);
    assert.equal(bus(first).gain.target, 0);
    assert.equal(bus(second).gain.target, undefined);
    assert.equal(bus(second).gain.value, .5, 'the lab plays at its own volume');
    setAuditionVolume(0);
    assert.equal(bus(second).gain.target, 0, 'the slider reaches a ringing audition');
    assert.equal(auditionCue(bookFor('relic'), 'prize', 0), 0);
    audio.tick(5000);
  });

  await t.test('an abandoned ambience preview never schedules late-decoded beds or details', async () => {
    const mix = scene('cancelled', ['cancelled-detail']);
    const start = audio.sources.length;
    const pending = previewAmbience(mix, .5);
    stopAmbience();
    audio.resolve(mix.beds[0].src, 60);
    audio.resolve(mix.events[0].src, 2);
    assert.equal(await pending, false);
    audio.tick(120_000);
    assert.equal(audio.sources.length, start);
  });

  await t.test('switching worlds during startup keeps only the latest preview even when the old load finishes last', async () => {
    const oldMix = scene('startup-old'), nextMix = scene('startup-next');
    const start = audio.sources.length;
    const oldLoad = previewAmbience(oldMix, .5);
    const nextLoad = previewAmbience(nextMix, .5);
    audio.resolve(nextMix.beds[0].src, 60);
    assert.equal(await nextLoad, true);
    audio.resolve(oldMix.beds[0].src, 60);
    assert.equal(await oldLoad, false);
    assert.equal(audio.sources.length, start + 1);
    assert.equal(audio.sources.at(-1).buffer.src, nextMix.beds[0].src);
    stopAmbience();
  });

  await t.test('details leave silence after playback; bed passes overlap and stop cancels future scheduling', async () => {
    const mix = scene('schedule', ['detail-one', 'detail-two']);
    const pending = previewAmbience(mix, .5);
    audio.resolve(mix.beds[0].src, 60);
    for (const event of mix.events) audio.resolve(event.src, 2);
    assert.equal(await pending, true);
    const start = audio.sources.length;
    audio.tick(9_999);
    assert.equal(audio.sources.length, start);
    audio.tick(1);
    const first = audio.sources.at(-1);
    audio.tick(11_999);
    assert.equal(audio.sources.at(-1), first);
    audio.tick(1);
    assert.notEqual(audio.sources.at(-1).buffer.src, first.buffer.src);
    audio.tick(20_000);
    const beds = audio.sources.filter((source) => source.buffer.src === mix.beds[0].src);
    assert.equal(beds.length, 2);
    assert.ok(beds[1].started[0] < beds[0].started[0] + beds[0].started[2]);
    const stoppedAt = audio.sources.length;
    stopAmbience();
    audio.tick(120_000);
    assert.equal(audio.sources.length, stoppedAt);
    assert.ok(beds.every((source) => source.stopped));
  });

  await t.test('hiding pauses a mix, explicit stop invalidates resume, and hidden switches resume only the latest world', async () => {
    const release = pauseAmbienceWhenHidden();
    try {
      const mix = scene('visibility');
      const pending = previewAmbience(mix, .5);
      audio.resolve(mix.beds[0].src, 60);
      await pending;
      audio.visibility(true);
      const stoppedAt = audio.sources.length;
      stopAmbience();
      audio.visibility(false);
      await settle();
      assert.equal(audio.sources.length, stoppedAt, 'explicit stop stays stopped');
      await previewAmbience(mix, .5);
      audio.visibility(true);
      const replacement = scene('replacement');
      await previewAmbience(replacement, .3);
      assert.equal(audio.requests.has(replacement.beds[0].src), false, 'hidden mix is queued without fetching');
      audio.visibility(false);
      audio.resolve(replacement.beds[0].src, 60);
      await settle();
      assert.equal(audio.sources.at(-1).buffer.src, replacement.beds[0].src);
      stopAmbience();
    } finally { release(); }
  });

  await t.test('Sound Lab previews stay stopped after a background round trip', async () => {
    const release = pauseAmbienceWhenHidden(false);
    try {
      const mix = scene('lab');
      const pending = previewAmbience(mix, .5);
      audio.resolve(mix.beds[0].src, 60);
      await pending;
      audio.visibility(true);
      const stoppedAt = audio.sources.length;
      audio.visibility(false);
      await settle();
      assert.equal(audio.sources.length, stoppedAt);
    } finally { release(); stopAmbience(); }
  });

  await t.test('setting ambience volume to zero also cancels a paused mix', async () => {
    const release = pauseAmbienceWhenHidden();
    try {
      const mix = scene('paused-mute');
      const pending = previewAmbience(mix, .5);
      audio.resolve(mix.beds[0].src, 60);
      await pending;
      audio.visibility(true);
      const stoppedAt = audio.sources.length;
      setAmbienceVolume(0);
      audio.visibility(false);
      await settle();
      assert.equal(audio.sources.length, stoppedAt);
    } finally { release(); stopAmbience(); }
  });
});

await test('every game has its own synthesised sounds and only Your turn is shared', () => {
  const ids = ['undertow', 'wildgrove', 'midnight', 'orin', 'miro', 'impostor', 'folio', 'relic', 'rota', 'alto', 'arena'];
  assert.equal(new Set(ids.map(bookFor)).size, ids.length);
  assert.deepEqual(Object.keys(soundBooks.find((b) => b.id === 'shared').cues), ['turn']);
  for (const id of ids) assert.equal(cueFor(id, 'turn').book.id, 'shared');
  const drawings = new Set();
  for (const book of soundBooks)
    for (const [name, c] of Object.entries(book.cues)) {
      assert.ok(!drawings.has(c.play), `${book.id}:${name} is its own sound`);
      drawings.add(c.play);
    }
});

await test('every moment a game sounds reaches that game’s own cue', () => {
  const table = ['pickup', 'place', 'drop', 'shuffle', 'scores'];
  const party = ['select', 'move', 'reveal', 'scores', 'tap'];
  const moments = {
    undertow: table, wildgrove: table, midnight: table,
    orin: party, dial: party, coins: party, miro: party, size: party, year: party, order: party, impostor: party,
    folio: ['submit', 'reward', 'invalid', 'scores'],
    relic: ['reveal', 'star', 'prize', 'paper', 'upgrade'],
    rota: ['select', 'place', 'invalid', 'scores'],
    alto: ['select', 'place', 'move', 'scores'],
  };
  for (const [id, kinds] of Object.entries(moments))
    for (const kind of kinds) assert.equal(cueFor(id, kind)?.book, bookFor(id), `${id} ${kind}`);
  assert.equal(cueFor('dial', 'select').name, 'dial:select');
  assert.equal(cueFor('coins', 'pickup').name, 'coins:select');
  assert.equal(cueFor('year', 'select').name, 'year:select');
  assert.equal(cueFor('orin', 'select').name, 'select');
  assert.equal(cueFor('miro', 'select').name, 'miro:select');
  for (const kind of ['tap', 'pickup', 'select', 'move']) assert.equal(cueFor('folio', kind), undefined);
  assert.equal(cueFor('global', 'pickup'), undefined);
});

await test('every cue draws valid Web Audio, rings out within three seconds and was measured as it is now', () => {
  for (const book of soundBooks)
    for (const [name, c] of Object.entries(book.cues)) {
      const voices = [];
      const context = synthesis({ currentTime: 0, destination: node() }, voices);
      context.createBufferSource = () => {
        const source = node({ buffer: null, start(at) { this.started = at; }, stop(at) { assert.ok(at >= this.started); } });
        voices.push(source);
        return source;
      };
      const render = renderCue(context, book, name, { volume: 1, at: 0 });
      assert.ok(voices.length > 0, `${book.id}:${name} makes a sound`);
      assert.ok(render.dry > 0.05 && render.dry < 3.3, `${book.id}:${name} lasts ${render.dry}s`);
      assert.ok(render.end >= render.dry);
      const measured = levels[`${book.id}:${name}`];
      assert.ok(Number.isFinite(measured?.gain) && measured.gain > 0.05 && measured.gain < 8, `${book.id}:${name} has a level`);
      assert.equal(measured.hash, cueFingerprint(book.id, name), `${book.id}:${name} changed since it was measured: run node scripts/sound-levels.mjs`);
      assert.ok(c.loud <= -15 && c.loud >= -40, `${book.id}:${name} target`);
    }
  const cues = new Set(soundBooks.flatMap((book) => Object.keys(book.cues).map((name) => `${book.id}:${name}`)));
  assert.deepEqual(Object.keys(levels).filter((key) => !cues.has(key)), [], 'no stale levels');
});

await test('only the ambience recordings and Arena’s music and troops remain as audio files', async () => {
  // Generated and assembled soundscapes were retired: one real recording per world.
  assert.deepEqual((await readdir('public/audio')).sort(), ['ambience', 'arena']);
  const recordings = new Set(ambiences.flatMap((a) => [...a.beds, ...a.events]).map((s) => s.src.split('/').at(-1)));
  assert.deepEqual((await readdir('public/audio/ambience')).filter((file) => file !== 'CREDITS.md' && !recordings.has(file)), []);
  const arena = new Set(Object.values(arenaAudio).flatMap((entry) => entry.srcs.map((src) => src.split('/').at(-1))));
  assert.deepEqual((await readdir('public/audio/arena')).filter((file) => !arena.has(file)), []);
});
