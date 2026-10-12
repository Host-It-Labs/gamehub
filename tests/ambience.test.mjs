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

await test('every world plays one real recording, quietly, with no one-shots', async () => {
  assert.deepEqual(ambiences.map((a) => a.id).sort(), ['midnight', 'undertow', 'wildgrove']);
  assert.equal(ambienceFor('wildgrove', 'intermediate'), ambienceFor('wildgrove'), 'every Mora board shares the forest');
  for (const a of ambiences) {
    assert.equal(a.beds.length, 1, `${a.world} is one recording`);
    assert.equal(a.events.length, 0, `${a.world} adds nothing on top`);
    assert.ok(a.level > 0 && a.level <= 1);
    const { size } = await stat(`public${a.beds[0].src}`);
    assert.ok(size > 100_000 && size < 4_000_000, `${a.beds[0].src} is a real recording and stays light`);
  }
  assert.equal(ambienceFor('nothing'), undefined);
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
