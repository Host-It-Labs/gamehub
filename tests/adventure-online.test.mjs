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
            const g = t.adventure,
              s = standaloneGames[id].actingSeats(g)[0],
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
              if (id === 'miro') {
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
    const guest = identity('guest');
    t = tables.join(t.token, guest);
    t = tables.join(t.token, identity('guest2'));
    t = tables.join(t.token, identity('guest3'));
    t = cmd(tables, t, host, { type: 'start' });
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
await test('all three online games retain exactly two equal teams through setup, practice and full matches',()=>{
  const {db,tables,host}=setup();
  try{
    for(const id of standaloneIds)for(const n of [4,6]){
      let t=tables.create(host);
      t=cmd(tables,t,host,{type:'configure',gameId:id,capacity:n,difficulty:'medium',partyMode:'teams'});
      assert.equal(t.partyMode,'teams');
      const actors=[host];for(let s=1;s<n;s++){const actor=identity(`member-${s}`);actors.push(actor);t=tables.join(t.token,actor);}
      t=cmd(tables,t,host,{type:'start',learning:true});
      assert.equal(t.adventure.mode,'teams');
      t=cmd(tables,t,host,{type:'begin-match'});
      assert.equal(t.adventure.scores.length,2);
      assert.deepEqual([0,1].map(group=>t.adventure.teams.filter(v=>v===group).length),[n/2,n/2]);
      let steps=0;
      while(t.status==='playing'&&steps++<1000){const g=t.adventure,seat=standaloneGames[id].actingSeats(g)[0],move=botMove(g,seat);t=cmd(tables,t,actors[seat],{type:'adventure-move',move,key:decisionKey(g)});}
      assert.equal(t.status,'finished');
      assert.ok(standaloneGames[id].isSavedGame(t.adventure));
    }
  }finally{db.close();}
});

await test('host custom teams persist through removal, practice, reload and match start', () => {
  const { db, tables, host } = setup();
  try {
    let t=tables.create(host);
    t=cmd(tables,t,host,{type:'configure',gameId:'miro',difficulty:'medium',capacity:5,partyMode:'teams',teams:[1,0,1,0,0]});
    const a=identity('a'), b=identity('b');
    t=tables.join(t.token,a); t=tables.join(t.token,b);
    assert.throws(()=>cmd(tables,t,a,{type:'configure',gameId:'miro',difficulty:'medium',capacity:5,teams:[0,1,0,1,0]}),{status:403});
    assert.throws(()=>cmd(tables,t,host,{type:'configure',gameId:'miro',difficulty:'medium',capacity:5,teams:[0,0,0,0,0]}),{status:400});
    t=cmd(tables,t,host,{type:'remove',memberId:'a'});
    assert.deepEqual(t.teams,[1,1,0,0,0]);
    assert.deepEqual(tables.view(tables.get(t.token),host).teams,t.teams);
    for (const name of ['c', 'd', 'e']) t = tables.join(t.token, identity(name));
    t=cmd(tables,t,host,{type:'start',learning:true});
    assert.deepEqual(t.adventure.teams,[1,1,0,0,0]);
    t=cmd(tables,t,host,{type:'lesson',step:1});
    assert.deepEqual(t.adventure.teams,[1,1,0,0,0]);
    t=cmd(tables,t,host,{type:'begin-match'});
    assert.deepEqual(t.adventure.teams,[1,1,0,0,0]);
  } finally {db.close();}
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

await test('Atlas persists one three-pin team turn and rejects previous-team submissions after switching', () => {
  const { db, tables, host } = setup();
  try {
    let t = tables.create(host);
    t = cmd(tables, t, host, { type: 'configure', gameId: 'miro', difficulty: 'medium', capacity: 4, partyMode: 'teams' });
    const actors = [host, ...[1, 2, 3].map(s => identity(`atlas${s}`))];
    for (const actor of actors.slice(1)) t = tables.join(t.token, actor);
    t = cmd(tables, t, host, { type: 'start' });
    const entry = standaloneGames.miro;
    while (t.adventure.phase === 'guess') {
      const seat = entry.actingSeats(t.adventure)[0];
      t = cmd(tables, t, actors[seat], { type: 'adventure-move', key: decisionKey(t.adventure), move: botMove(t.adventure, seat) });
    }
    const firstCaptain = entry.actingSeats(t.adventure)[0];
    const firstTeam = t.adventure.teams[firstCaptain], key = decisionKey(t.adventure);
    for (const prompt of [2, 0, 1]) {
      t = cmd(tables, t, actors[firstCaptain], { type: 'adventure-move', key, move: { type: 'choose', prompt, seat: firstCaptain } });
      assert.equal(t.adventure.turn, 0);
      assert.equal(t.adventure.result, null);
    }
    t = new Tables(db, () => true).get(t.token);
    assert.deepEqual(t.adventure.choices[firstTeam].seats, Array(3).fill(firstCaptain));
    t = cmd(tables, t, actors[firstCaptain], { type: 'adventure-move', key, move: { type: 'lock' } });
    assert.equal(t.adventure.turn, 1);
    assert.equal(t.adventure.phase, 'discuss');
    assert.throws(() => cmd(tables, t, actors[firstCaptain], { type: 'adventure-move', key, move: { type: 'choose', prompt: 0, seat: firstCaptain } }), /round has advanced/);
    for (const actor of actors) assert.equal(tables.view(t, actor).adventure.result, null);
    while (t.adventure.phase === 'discuss') {
      const seat = entry.actingSeats(t.adventure)[0];
      t = cmd(tables, t, actors[seat], { type: 'adventure-move', key: decisionKey(t.adventure), move: botMove(t.adventure, seat) });
    }
    assert.equal(t.adventure.phase, 'reveal');
    assert.ok(t.adventure.choices.every(c => c.locked && c.seats.length === 3));
  } finally { db.close(); }
});
