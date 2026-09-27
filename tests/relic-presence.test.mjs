import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { DeskPresence } from '../server/desk-presence.ts';
import { Expeditions } from '../server/expeditions.ts';
import { openDatabase } from '../server/database.ts';
import { handFor } from '../lib/games/relic/scratch.ts';

const start = 1789992000000;
const actor = (id) => ({
  id,
  name: id.toUpperCase(),
  userId: null,
  sessionHash: 'test',
  expires: start + 1e12,
});
/** A stand-in for an SSE response that keeps what was written. */
function stream() {
  const res = new EventEmitter();
  res.lines = [];
  res.writableLength = 0;
  res.writeHead = () => res;
  res.write = (chunk) => {
    res.lines.push(chunk);
    return true;
  };
  res.end = () => res.emit('close');
  res.destroy = () => res.emit('close');
  res.events = (name) =>
    res.lines
      .filter((l) => l.startsWith(`event: ${name}\n`))
      .map((l) => JSON.parse(l.split('\ndata: ')[1]));
  return res;
}
const session = (n) => `session-${String(n).padStart(12, '0')}`;

await test('a player’s tab, view and pointer reach everyone else at the desk, checked and bounded', () => {
  const hub = new DeskPresence(),
    ann = stream(),
    bo = stream();
  hub.connect('desk', actor('ann'), session(1), ann);
  hub.connect('desk', actor('bo'), session(2), bo);
  hub.post('desk', actor('ann'), {
    session: session(1),
    tab: 'factory',
    cursor: { area: 'floor', x: 3.5, y: 2.25 },
    view: {
      tool: 'belt',
      dir: 2,
      selected: [{ x: 1, y: 2 }, { x: 'no', y: 1 }],
      secret: 'dropped',
      levels: { seven: 2, twins: 9 },
    },
    screen: { w: 1512, h: 860 },
    desktop: true,
  });
  const [seen] = bo.events('presence');
  assert.equal(seen.member, 'ann');
  assert.equal(seen.name, 'ANN');
  assert.equal(seen.tab, 'factory');
  assert.deepEqual(seen.cursor, { area: 'floor', x: 3.5, y: 2.25 });
  assert.deepEqual(seen.view, {
    tool: 'belt',
    dir: 2,
    selected: [{ x: 1, y: 2 }],
    levels: { seven: 2 },
  });
  assert.deepEqual(seen.screen, { w: 1512, h: 860 });
  assert.equal(ann.events('presence').length, 0, 'nobody hears their own');
  // A late arrival is told where everyone already is.
  const cy = stream();
  hub.connect('desk', actor('cy'), session(3), cy);
  assert.equal(cy.events('presence')[0].member, 'ann');
  for (const bad of [
    { session: 'short', tab: 'factory' },
    { session: session(1), tab: 'kitchen' },
  ])
    assert.throws(() => hub.post('desk', actor('ann'), bad));
  hub.post('desk', actor('ann'), {
    session: session(1),
    tab: 'tickets',
    cursor: { area: 'window', x: 0.5, y: 0.5 },
  });
  assert.equal(bo.events('presence').at(-1).cursor, null);
  ann.emit('close');
  assert.deepEqual(bo.events('leave').at(-1), { session: session(1), member: 'ann' });
  hub.close();
});
await test('commands nudge the others; a stroke carries its points so a Watch TV scratches along', () => {
  const db = openDatabase(':memory:'),
    hub = new DeskPresence(),
    desks = new Expeditions(db, hub);
  const created = desks.create(actor('ann'), { title: 'Desk', world: 'dunes' }, start);
  desks.join(created.token, actor('bo'), start);
  const bo = stream();
  hub.connect(created.token, actor('bo'), session(2), bo);
  desks.command(
    created.token,
    actor('ann'),
    { requestId: 'r'.repeat(20), action: { type: 'scratch-open', pack: 'seven' } },
    start,
  );
  assert.equal(bo.events('changed').length, 1);
  const g = JSON.parse(
    db.prepare('SELECT state FROM expeditions WHERE token=?').get(created.token).state,
  );
  const t = handFor(g.scratch, 'ann');
  const stroke = {
    type: 'scratch-stroke',
    ticket: t.id,
    sequence: 0,
    points: [
      { x: 0.1, y: 0.1 },
      { x: 0.3, y: 0.1 },
      { x: 0.8, y: 0.9 },
    ],
    breaks: [2],
  };
  desks.command(created.token, actor('ann'), { requestId: 's'.repeat(20), action: stroke }, start);
  assert.deepEqual(bo.events('stroke'), [
    {
      stroke: true,
      by: 'ann',
      ticket: t.id,
      sequence: 0,
      points: stroke.points,
      breaks: [2],
    },
  ]);
  // A retried command is answered from the log and not relayed twice.
  desks.command(created.token, actor('ann'), { requestId: 's'.repeat(20), action: stroke }, start);
  assert.equal(bo.events('stroke').length, 1);
  assert.equal(bo.events('changed').length, 1, 'an unfinished stroke asks for no fetch');
  hub.close();
  db.close();
});
