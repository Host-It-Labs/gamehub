import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../server/database.ts';
import { Tables } from '../server/tables.ts';
import {
  standaloneGames,
  standaloneIds,
  botMove,
  decisionKey,
} from '../lib/games/standalone/registry.ts';
const identity = (id, user = false) => ({
  id,
  name: id,
  userId: user ? id : null,
  sessionHash: 'test',
  expires: Date.now() + 99999,
});
function setup() {
  const db = openDatabase(':memory:');
  db.prepare('INSERT INTO users VALUES (?,?,?,?)').run(
    'host',
    'host@example.com',
    'host',
    'unused',
  );
  return {
    db,
    tables: new Tables(db, () => true),
    host: identity('host', true),
  };
}
function cmd(tables, t, who, action, requestId = randomUUID()) {
  return tables.command(t.token, who, {
    action,
    requestId,
    revision: t.revision,
    matchId: t.matchId,
  });
}
for (const id of standaloneIds)
  await test(`${id}: human-only starts, reload views, tutorial reset`, () => {
    const { db, tables, host } = setup();
    try {
      for (const n of standaloneGames[id].seatChoices)
        for (const humans of [1, n]) {
          let t = tables.create(host);
          t = cmd(tables, t, host, {
            type: 'configure',
            gameId: id,
            difficulty: 'hard',
            capacity: n,
          });
          const actors = [host];
          for (let s = 1; s < humans; s++) {
            const who = identity(`guest${s}`);
            actors.push(who);
            t = tables.join(t.token, who);
          }
          if (humans < n) {
            for (const learning of [false, true]) {
              assert.throws(() => cmd(tables, t, host, { type: 'start', learning }), /human in every seat/);
              assert.equal(tables.get(t.token).status, 'lobby');
            }
            continue;
          }
          t = cmd(tables, t, host, { type: 'start', learning: true });
          assert.equal(t.game, null);
          assert.equal(t.adventure.tutorial, true);
          const oldMatch = t.matchId;
          t = cmd(tables, t, host, { type: 'lesson', step: 2 });
          assert.equal(t.adventure.lesson, 2);
          t = cmd(tables, t, host, { type: 'begin-match' });
          assert.notEqual(t.matchId, oldMatch);
          assert.equal(t.adventure.round, 1);
          assert.equal(t.adventure.tutorial, false);
          let i = 0;
          while (t.status === 'playing' && i++ < 1000) {
            const g = t.adventure;
            if (g.phase === 'reveal') {
              // Reveals wait only on the host; other seats cannot move the table on.
              if (humans > 1)
                assert.throws(
                  () => cmd(tables, t, actors[1], { type: 'adventure-move', move: { type: 'next' }, key: decisionKey(g) }),
                  /host moves the table on/,
                );
              t = cmd(tables, t, host, { type: 'adventure-move', move: { type: 'next' }, key: decisionKey(g) });
              continue;
            }
            const s = standaloneGames[id].actingSeats(g)[0],
              move = botMove(g, s);
            if (t.seats[s].bot) {
              tables.adventureBot(t.token, decisionKey(g), s);
              t = tables.get(t.token);
            } else
              t = cmd(tables, t, actors[s], {
                type: 'adventure-move',
                move,
                key: decisionKey(g),
              });
            for (let v = 0; v < humans; v++) {
              const view = tables.view(t, actors[v]);
              assert.equal(view.game, null);
              assert.equal(view.adventure.rngState, 0);
              // A Sabi table may be playing Sizes after the opening vote.
              if (view.adventure.kind === 'size')
                assert.deepEqual(view.adventure.used, []);
              if (view.adventure.kind === 'miro') {
                assert.deepEqual(view.adventure.deck, []);
                assert.deepEqual(view.adventure.cityIds, []);
                if (view.adventure.phase === 'guess')
                  view.adventure.guesses.forEach((guess, seat) => {
                    if (seat !== v)
                      assert.deepEqual(guess.pins, [null, null, null]);
                  });
              }
            }
          }
          assert.equal(t.status, 'finished');
          t = cmd(tables, t, host, { type: 'abandon' });
          assert.equal(t.adventure, null);
        }
    } finally {
      db.close();
    }
  });
await test('simultaneous stale revisions accepted once; changed match and locked choices rejected', () => {
  const { db, tables, host } = setup();
  try {
    let t = tables.create(host);
    t = cmd(tables, t, host, {
      type: 'configure',
      gameId: 'orin',
      capacity: 4,
      difficulty: 'hard',
    });
    const guest = identity('guest'),
      guest2 = identity('guest2'),
      guest3 = identity('guest3');
    t = tables.join(t.token, guest);
    t = tables.join(t.token, guest2);
    t = tables.join(t.token, guest3);
    t = cmd(tables, t, host, { type: 'start' });
    // Tribu's opening vote: everyone picks Top Five.
    for (const who of [host, guest, guest2, guest3])
      t = cmd(tables, t, who, {
        type: 'adventure-move',
        move: { type: 'vote', choice: 'orin' },
        key: decisionKey(t.adventure),
      });
    assert.equal(t.adventure.phase, 'rank');
    const original = t,
      g = t.adventure;
    const m0 = standaloneGames.orin.legalMoves(g, 0)[0],
      m1 = standaloneGames.orin.legalMoves(g, 1)[0],
      key = decisionKey(g);
    const requestId = randomUUID();
    t = cmd(
      tables,
      t,
      host,
      { type: 'adventure-move', move: m0, key },
      requestId,
    );
    const revision = t.revision;
    t = cmd(
      tables,
      original,
      host,
      { type: 'adventure-move', move: m0, key },
      requestId,
    );
    assert.equal(t.revision, revision);
    t = cmd(tables, original, guest, { type: 'adventure-move', move: m1, key });
    assert.ok(t.adventure.ballots[1]);
    t = cmd(tables, t, guest, {
      type: 'adventure-move',
      move: { type: 'arrange', order: [1, 0, 2, 3, 4] },
      key,
    });
    t = cmd(tables, t, guest, {
      type: 'adventure-move',
      move: { type: 'lock' },
      key,
    });
    assert.throws(() => cmd(tables, t, guest, { type: 'lesson', step: 1 }));
    assert.throws(() =>
      tables.command(t.token, guest, {
        requestId: randomUUID(),
        revision: t.revision,
        matchId: 'wrong',
        action: { type: 'adventure-move', move: m1, key },
      }),
    );
    assert.throws(() =>
      cmd(tables, t, guest, { type: 'adventure-move', move: m1, key }),
    );
  } finally {
    db.close();
  }
});
await test('party tables always play everyone for themselves, even when a stale client asks for teams',()=>{
  const {db,tables,host}=setup();
  try{
    for(const id of standaloneIds){
      let t=tables.create(host);
      t=cmd(tables,t,host,{type:'configure',gameId:id,capacity:4,difficulty:'medium',partyMode:'teams',teams:[0,0,1,1]});
      assert.equal(t.partyMode,undefined);
      assert.equal(t.teams,undefined);
      const actors=[host];for(let s=1;s<4;s++){const actor=identity(`member-${s}`);actors.push(actor);t=tables.join(t.token,actor);}
      t=cmd(tables,t,host,{type:'start',learning:true});
      assert.equal(t.adventure.mode,'individual');
      t=cmd(tables,t,host,{type:'begin-match'});
      assert.equal(t.adventure.mode,'individual');
      assert.equal(t.adventure.scores.length,4);
    }
  }finally{db.close();}
});

await test('disconnected lobby guests must reconnect or be removed before starting', () => {
  const {db,tables,host}=setup();
  try {
    let t=tables.create(host); const guest=identity('offline');
    t=tables.join(t.token,guest);
    tables.connected=(_,id)=>id!=='offline';
    assert.equal(tables.view(t,host).members.find(m=>m.id==='offline').connected,false);
    assert.throws(()=>cmd(tables,t,host,{type:'start'}),/Disconnected players: offline/);
    assert.equal(tables.get(t.token).status,'lobby');
    tables.connected=()=>true;
    t=cmd(tables,t,host,{type:'start'});
    t=cmd(tables,t,host,{type:'abandon'});
    tables.connected=(_,id)=>id!=='offline';
    t=cmd(tables,t,host,{type:'remove',memberId:'offline'});
    t=cmd(tables,t,host,{type:'start'});
    assert.equal(t.status,'playing');
    assert.equal(t.seats.some(s=>s.id==='offline'),false);
  }finally{db.close();}
});

for (const id of standaloneIds) await test(`${id}: disconnected humans cannot be replaced with bots`, () => {
  const { db, tables, host } = setup();
  try {
    let t = tables.create(host);
    t = cmd(tables, t, host, { type: 'configure', gameId: id, capacity: 2, difficulty: 'medium' });
    t = tables.join(t.token, identity('guest'));
    t = cmd(tables, t, host, { type: 'start' });
    tables.connected = (_, seat) => seat !== 'guest';
    assert.throws(() => cmd(tables, t, host, { type: 'replace', memberId: 'guest' }), /cannot replace players with bots/);
    assert.equal(tables.get(t.token).seats.some(s => s.bot), false);
  } finally { db.close(); }
});

await test('the creator keeps hosting the table; a picked player leads only the next match', () => {
  const connected = new Set(['host', 'ada', 'bo']);
  const db = openDatabase(':memory:');
  db.prepare('INSERT INTO users VALUES (?,?,?,?)').run('host', 'host@example.com', 'host', 'unused');
  const tables = new Tables(db, (_table, member) => connected.has(member));
  const host = identity('host', true), ada = identity('ada'), bo = identity('bo');
  try {
    let t = tables.create(host);
    t = cmd(tables, t, host, { type: 'configure', gameId: 'orin', difficulty: 'medium', capacity: 3 });
    t = tables.join(t.token, ada);
    t = tables.join(t.token, bo);
    assert.equal(tables.view(t, host).isHost, true);
    assert.equal(tables.view(t, ada).isHost, false);
    assert.throws(() => cmd(tables, t, ada, { type: 'host', memberId: 'ada' }), /Only the host/);
    t = cmd(tables, t, host, { type: 'host', memberId: 'ada' });
    // In the lobby the creator still runs everything; Ada is only marked.
    let view = tables.view(t, host);
    assert.equal(view.isHost, true);
    assert.equal(tables.view(t, ada).isHost, false);
    assert.deepEqual(view.members.filter(m => m.host).map(m => m.id), ['host']);
    assert.deepEqual(view.members.filter(m => m.nextHost).map(m => m.id), ['ada']);
    t = cmd(tables, t, host, { type: 'configure', gameId: 'orin', difficulty: 'medium', capacity: 3 });
    assert.throws(() => cmd(tables, t, ada, { type: 'configure', gameId: 'orin', difficulty: 'medium', capacity: 3 }), /Only the host/);
    assert.throws(() => cmd(tables, t, ada, { type: 'start' }), /Only the host/);
    assert.throws(() => cmd(tables, t, ada, { type: 'remove', memberId: 'host' }), /Only the host/);
    t = cmd(tables, t, host, { type: 'start' });
    assert.throws(() => cmd(tables, t, host, { type: 'host', memberId: 'bo' }), /lobby/);
    // During the match Ada leads: she moves the table on.
    view = tables.view(t, bo);
    assert.deepEqual(view.members.filter(m => m.host).map(m => m.id), ['ada']);
    const actors = [host, ada, bo];
    while (t.adventure.phase !== 'reveal') {
      const g = t.adventure, seat = standaloneGames.orin.actingSeats(g)[0];
      t = cmd(tables, t, actors[seat], { type: 'adventure-move', move: botMove(g, seat), key: decisionKey(g) });
    }
    const next = () => ({ type: 'adventure-move', move: { type: 'next' }, key: decisionKey(t.adventure) });
    assert.equal(tables.view(t, ada).canAdvance, true);
    assert.equal(tables.view(t, host).canAdvance, false);
    assert.equal(tables.view(t, bo).canAdvance, false);
    assert.throws(() => cmd(tables, t, bo, next()), /host moves the table on/);
    // A dropped leader must not stall the table: any seated player may move on.
    connected.delete('ada');
    assert.equal(tables.view(t, bo).canAdvance, true);
    const target = t.adventure.target;
    t = cmd(tables, t, bo, next());
    assert.equal(t.adventure.target, target + 1);
    connected.add('ada');
    // Back in the lobby the pick is spent and the creator leads again.
    t = cmd(tables, t, host, { type: 'abandon' });
    view = tables.view(t, host);
    assert.deepEqual(view.members.filter(m => m.host).map(m => m.id), ['host']);
    assert.equal(view.members.some(m => m.nextHost), false);
    t = cmd(tables, t, host, { type: 'start' });
    assert.deepEqual(tables.view(t, host).members.filter(m => m.host).map(m => m.id), ['host']);
  } finally {
    db.close();
  }
});
