import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import {
  ambiences,
  ambienceFor,
  bedPass,
  between,
  pickEvent,
} from '../lib/games/ambience.ts';

const sequence = (values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

await test('every game with a world has a soundscape with beds and a varied pool of one-shots', () => {
  assert.deepEqual([...new Set(ambiences.map((a) => a.id))].sort(), [
    'midnight',
    'undertow',
    'wildgrove',
  ]);
  for (const a of ambiences) {
    assert.ok(a.beds.length >= 1, `${a.world} has a bed`);
    assert.ok(
      a.events.length >= (a.world === 'coast' ? 3 : 8),
      `${a.world} has enough one-shots to avoid repetition`,
    );
    assert.ok(a.level > 0 && a.level <= 1);
    assert.ok(
      a.gap[0] >= 3 && a.gap[1] > a.gap[0],
      `${a.world} leaves room between one-shots`,
    );
    for (const e of a.events)
      assert.ok(e.gain <= 0.6, `${e.src} stays under the cue sounds`);
  }
  assert.equal(ambienceFor('nothing'), undefined);
});

await test('the shipped files exist and the whole soundscape stays light', async () => {
  for (const a of ambiences) {
    let total = 0;
    for (const { src } of [...a.beds, ...a.events]) {
      const { size } = await stat(`public${src}`);
      assert.ok(size > 2000, `${src} is not empty`);
      total += size;
    }
    assert.ok(
      total < 2_500_000,
      `${a.world} is ${(total / 1024).toFixed(0)} KB; keep each world under 2.5 MB`,
    );
  }
});

await test('one-shots are weighted and never repeat back to back', () => {
  const events = [
    { weight: 1, n: 'a' },
    { weight: 0.25, n: 'b' },
    { weight: 1, n: 'c' },
  ];
  assert.equal(pickEvent(events, undefined, () => 0).n, 'a');
  assert.equal(pickEvent(events, undefined, () => 0.99).n, 'c');
  assert.equal(pickEvent(events, events[0], () => 0).n, 'b');
  for (let i = 0; i < 200; i++)
    assert.notEqual(pickEvent(events, events[2]).n, 'c');
  assert.equal(pickEvent([events[0]], events[0]).n, 'a');
});

await test('bed passes cover random windows with a crossfade that fits the recording', () => {
  assert.equal(
    between([5, 15], () => 0.5),
    10,
  );
  const pass = bedPass(56, sequence([0.5, 0.2]));
  assert.ok(pass.length > 39 && pass.length < 54);
  assert.ok(pass.start >= 0 && pass.start + pass.length <= 56);
  assert.equal(pass.fade, 7);
  const short = bedPass(8, () => 0.9);
  assert.ok(short.length > 5 && short.length < 8);
  assert.ok(short.start >= 0 && short.start + short.length <= 8);
  assert.equal(short.fade, 2);
});

await test('Floodline uses the coast while Observatory keeps the forest', () => {
  assert.equal(ambienceFor('wildgrove', 'beginner').world, 'forest');
  assert.equal(ambienceFor('wildgrove', 'intermediate').world, 'coast');
});
await test('recent events are excluded, with a safe fallback for small pools', () => {
  const events = Array.from({ length: 8 }, (_, n) => ({ weight: 1, n }));
  for (let i = 0; i < 100; i++)
    assert.ok(
      !events.slice(0, 5).includes(pickEvent(events, events.slice(0, 5))),
    );
  assert.notEqual(pickEvent(events, events), events.at(-1));
});

await test('retired adventure ambience never plays in the replacement party games', () => {
  for (const id of ['orin', 'miro'])
    assert.equal(ambienceFor(id), undefined);
});
