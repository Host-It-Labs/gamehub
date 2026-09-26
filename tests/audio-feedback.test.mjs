import test from 'node:test';
import assert from 'node:assert/strict';
import { audioAssets, sharedAudioAssets, soundGames, effectFor } from '../lib/games/audio-catalog.ts';
import { stat } from 'node:fs/promises';
import { effectLevel, gameSound, preloadGameSounds, stopGameSounds } from '../lib/games/game-sound.ts';
import { cue, eventCue } from '../lib/games/trio/sound.ts';
import { adventureCue } from '../lib/games/adventures/sound.ts';
import { pauseAmbienceWhenHidden, previewAmbience, setAmbienceVolume, stopAmbience } from '../lib/games/ambience-player.ts';
import { cleanMix, mixedAmbience, readAmbienceMix, saveAmbienceMix } from '../lib/games/ambience-mix.ts';
import { labAmbiences } from '../lib/games/lab-ambiences.ts';

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

/** No network, speakers or wall-clock sleeps: exercise the actual asynchronous schedulers. */
function webAudio(t) {
  let now = 0, timerId = 0;
  const timers = new Map(), requests = new Map(), storage = new Map(), sources = [], gains = [];
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
      emit(type) { for (const callback of listeners.get(type) ?? []) callback(); },
    };
  }
  const document = events({ hidden: false });
  const window = events();
  const parameter = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const node = () => ({ disconnected: false, connect() {}, disconnect() { this.disconnected = true; } });
  class AudioContext {
    state = 'running';
    destination = node();
    get currentTime() { return now / 1000; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    decodeAudioData(data) { return Promise.resolve(data); }
    createGain() { const gain = { ...node(), gain: parameter() }; gains.push(gain); return gain; }
    createStereoPanner() { return { ...node(), pan: parameter() }; }
    createBufferSource() {
      const source = {
        ...node(), detune: parameter(), buffer: null, stopped: false,
        start(...args) { this.started = args; },
        stop(at) { this.stopped = true; this.stoppedAt = at; this.onended?.(); },
      };
      sources.push(source);
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
    document, sources, gains, requests, storage,
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

  await t.test('resolved tricks and finish events never play a reward or a score cue', async () => {
    for (const id of ['undertow', 'wildgrove', 'midnight']) {
      eventCue({ type: 'trick', points: 0 }, id, .5);
      eventCue({ type: 'trick', points: 8 }, id, .5);
      eventCue({ type: 'finish' }, id, .5);
    }
    await settle();
    assert.equal(audio.requests.size, 0);
    assert.equal(audio.sources.length, 0);
  });

  await t.test('muted or hidden input never fetches effects', () => {
    gameSound('undertow', 'select', 0);
    audio.document.hidden = true;
    gameSound('undertow', 'select', .5);
    audio.document.hidden = false;
    assert.equal(audio.requests.size, 0);
  });

  await t.test('muting invalidates a pending effect; stopping disconnects an audible source', async () => {
    const start = audio.sources.length;
    gameSound('undertow', 'select', .5);
    stopGameSounds('undertow');
    audio.resolve(effectFor('undertow', 'select').src);
    await settle();
    assert.equal(audio.sources.length, start);
    gameSound('undertow', 'move', .5);
    audio.resolve(effectFor('undertow', 'move').src);
    await settle();
    const source = audio.sources.at(-1);
    assert.equal(audio.sources.length, start + 1);
    assert.ok(source.started);
    assert.equal(audio.gains.at(-1).gain.value, effectLevel(.5, effectFor('undertow', 'move').gain));
    stopGameSounds('undertow');
    assert.equal(source.stopped, true);
    assert.equal(source.disconnected, true);
  });

  await t.test('slow network responses and hidden-tab responses do not play stale moves', async () => {
    const start = audio.sources.length;
    gameSound('wildgrove', 'turn', .5);
    audio.tick(451);
    audio.resolve(effectFor('wildgrove', 'turn').src);
    await settle();
    assert.equal(audio.sources.length, start);
    gameSound('midnight', 'scores', .5);
    audio.visibility(true);
    audio.resolve(effectFor('midnight', 'scores').src);
    await settle();
    audio.visibility(false);
    assert.equal(audio.sources.length, start);
  });

  await t.test('rapid repeated input coalesces and the party alias cancels its pending sound', async () => {
    const start = audio.sources.length;
    gameSound('orin', 'select', .5);
    gameSound('dial', 'select', .5);
    stopGameSounds('dial');
    await settle();
    assert.equal(audio.sources.length, start);
    audio.tick(100);
    gameSound('dial', 'select', .5);
    gameSound('orin', 'select', .5);
    await settle();
    assert.equal(audio.sources.length, start + 1);
    stopGameSounds();
  });

  await t.test('shared buffers retain the calling game ownership, including alias cancellation', async () => {
    audio.tick(200);
    const before = audio.sources.length;
    gameSound('undertow', 'pickup', .5);
    gameSound('wildgrove', 'pickup', .5);
    stopGameSounds('undertow');
    await settle();
    assert.equal(audio.sources.length, before + 1, 'cancelling Nox leaves Mora playback intact');
    const mora = audio.sources.at(-1);
    stopGameSounds('undertow');
    assert.equal(mora.stopped, false);
    stopGameSounds('wildgrove');
    assert.equal(mora.stopped, true);

    gameSound('size', 'place', .5);
    await settle();
    const quiz = audio.sources.at(-1);
    stopGameSounds('miro');
    assert.equal(quiz.stopped, true, 'mini-games cancel under their public game family');
  });

  await t.test('all cue entry points use shared files and global cancellation catches anonymous callers', async () => {
    audio.tick(200);
    let before = audio.sources.length;
    cue('pickup', .5);
    stopGameSounds();
    await settle();
    assert.equal(audio.sources.length, before, 'pending id-less cues are cancelled');

    audio.tick(200);
    cue('pickup', .5);
    adventureCue('orin', 'win', .5);
    eventCue({ type: 'roll' }, 'midnight', .5);
    await settle();
    assert.deepEqual(audio.sources.slice(before).map((source) => source.buffer.src), [
      effectFor('global', 'pickup').src,
      effectFor('orin', 'place').src,
      effectFor('midnight', 'place').src,
    ]);
    stopGameSounds();
    before = audio.sources.length;
    gameSound('folio', 'scores', .5);
    await settle();
    assert.equal(audio.sources.at(-1).buffer.src, effectFor('folio', 'scores').src);
    assert.equal(audio.sources.length, before + 1);
    stopGameSounds();
  });

  await t.test('the final score cue replaces busy action tails and pending actions', async () => {
    audio.tick(200);
    const before = audio.sources.length;
    for (const kind of ['pickup', 'place', 'turn']) gameSound('relic', kind, .5);
    await settle();
    assert.equal(audio.sources.length, before + 3);
    gameSound('relic', 'scores', .5);
    await settle();
    assert.equal(audio.sources.length, before + 4, 'final score cue survives a full action channel');
    assert.ok(audio.sources.slice(before, before + 3).every((source) => source.stopped));
    assert.equal(audio.sources.at(-1).buffer.src, effectFor('relic', 'scores').src);
    stopGameSounds();

    audio.tick(200);
    const pending = audio.sources.length;
    gameSound('relic', 'place', .5);
    gameSound('relic', 'scores', .5);
    await settle();
    assert.equal(audio.sources.length, pending + 1, 'pending action stays cancelled');
    assert.equal(audio.sources.at(-1).buffer.src, effectFor('relic', 'scores').src);
    stopGameSounds();
  });

  await t.test('preloading is shared and simultaneous effects stay bounded', async () => {
    audio.tick(200);
    for (const game of soundGames) preloadGameSounds(game.id);
    assert.deepEqual([...audio.requests.keys()].sort((a, b) => a.localeCompare(b)), sharedAudioAssets.map((asset) => asset.src).sort());
    const before = audio.sources.length;
    for (const game of soundGames) gameSound(game.id, 'place', .5);
    await settle();
    assert.equal(audio.sources.length, before + 3);
    audio.visibility(true);
    assert.ok(audio.sources.slice(before).every((source) => source.stopped && source.disconnected));
    audio.visibility(false);
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

  await t.test('mix preferences reject stale paths and non-finite levels while clamping valid numbers', () => {
    const ambience = labAmbiences.find((a) => a.id === 'undertow');
    const bed = ambience.beds[0].src, detail = ambience.events[0].src;
    const clean = cleanMix(ambience, {
      bed: '/old/recording.mp3',
      spacing: NaN,
      levels: { [bed]: Infinity, [detail]: -1, '/foreign/recording.mp3': .8 },
    });
    assert.deepEqual(clean, { levels: { [detail]: 0 }, spacing: 1 });
    const bounded = cleanMix(ambience, { bed, spacing: 99, levels: { [bed]: 6 } });
    assert.deepEqual(bounded, { bed, levels: { [bed]: 1 }, spacing: 2.5 });
  });

  await t.test('saving a mix is device-local and preserves settings for the other world', () => {
    const ship = labAmbiences.find((a) => a.id === 'undertow'), forest = labAmbiences.find((a) => a.id === 'wildgrove');
    const localKey = 'gamehub.ambience-mixes.v1';
    const before = audio.requests.size;
    audio.storage.set(localKey, JSON.stringify({ [forest.world]: { spacing: 2, levels: {} } }));
    assert.equal(saveAmbienceMix(ship, { spacing: 1.5, levels: { [ship.events[0].src]: .25 } }), true);
    assert.equal(readAmbienceMix(ship).spacing, 1.5);
    assert.equal(readAmbienceMix(forest).spacing, 2);
    assert.equal(audio.requests.size, before, 'preferences never send a host/table/network update');
    audio.storage.set(localKey, '{broken');
    assert.deepEqual(readAmbienceMix(ship), { spacing: 1, levels: {} });
    assert.equal(saveAmbienceMix(ship, { spacing: 1, levels: {} }), true);
    assert.equal(readAmbienceMix(ship).spacing, 1);
  });

  await t.test('disabled detail layers are neither fetched nor scheduled, including a fully silent mix', async () => {
    const original = scene('disabled', ['disabled-detail']);
    const mix = mixedAmbience(original, { levels: { [original.events[0].src]: 0 }, spacing: 1 });
    assert.equal(mix.events.length, 0);
    const pending = previewAmbience(mix, .5);
    audio.resolve(mix.beds[0].src, 60);
    assert.equal(await pending, true);
    const start = audio.sources.length;
    audio.tick(30_000);
    assert.equal(audio.sources.length, start);
    assert.equal(audio.requests.has(original.events[0].src), false);
    stopAmbience();
    const silent = mixedAmbience(original, { levels: { [original.beds[0].src]: 0, [original.events[0].src]: 0 }, spacing: 1 });
    assert.equal(await previewAmbience(silent, .5), true, 'a deliberately silent mix is valid');
    audio.tick(30_000);
    assert.equal(audio.sources.length, start);
    stopAmbience();
  });
});

await test('shared gameplay cues retain historical Sound Lab recordings and strategy alternatives', async () => {
  assert.equal(new Set(audioAssets.map((a) => a.src)).size, audioAssets.length);
  for (const game of soundGames) {
    const effects = audioAssets.filter((a) => a.game === game.id && a.kind === 'effect');
    assert.deepEqual(effects.map((a) => a.category).sort(), ['move', 'reveal', 'reward', 'select']);
    for (const category of ['move', 'reveal', 'reward', 'select']) assert.ok(effectFor(game.id, category));
    const beds = audioAssets.filter((a) => a.game === game.id && a.kind === 'bed');
    assert.equal(beds.length, ['undertow', 'wildgrove', 'midnight'].includes(game.id) ? 2 : 0);
  }
  let bytes = 0;
  for (const asset of [...audioAssets, ...sharedAudioAssets]) {
    assert.match(asset.src, /^\/audio\/elevenlabs\/[a-z0-9-]+\.mp3$/);
    assert.ok(asset.duration > 0 && asset.duration <= 31);
    const info = await stat(`public${asset.src}`);
    assert.ok(info.size > 2000);
    bytes += info.size;
  }
  assert.ok(bytes < 5_000_000, 'the complete library stays below five MB');
});

await test('every game shares restrained pickup, place, turn and final score cues', () => {
  assert.deepEqual(sharedAudioAssets.map((asset) => asset.category).sort(), ['pickup', 'place', 'scores', 'turn']);
  for (const game of [...soundGames.map((entry) => entry.id), 'dial', 'size', 'global']) {
    for (const kind of ['tap', 'pickup', 'select'])
      assert.equal(effectFor(game, kind), sharedAudioAssets.find((asset) => asset.category === 'pickup'));
    for (const kind of ['drop', 'move', 'shuffle', 'roll', 'creature', 'dish', 'ward', 'reveal', 'win', 'reward', 'combo', 'prize', 'upgrade'])
      assert.equal(effectFor(game, kind), sharedAudioAssets.find((asset) => asset.category === 'place'));
    assert.equal(effectFor(game, 'turn').category, 'turn');
    assert.equal(effectFor(game, 'scores').category, 'scores');
  }
  assert.equal(effectLevel(.5, .6), .195);
  assert.equal(effectLevel(2, 1), .39);
  for (const invalid of [NaN, Infinity, -1]) assert.equal(effectLevel(invalid, .6), 0);
});
