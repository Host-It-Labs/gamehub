import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { makeServer } from '../server/index.ts';

await test('generated and retained sound files have playable audio content types', async () => {
  const app = await makeServer({ database: ':memory:', staticDir: 'public', bots: false });
  try {
    await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    for (const [path, type] of [
      ['/audio/elevenlabs/nox-select-v1.mp3', 'audio/mpeg'],
      ['/audio/ambience/ship/creak-1.m4a', 'audio/mp4'],
    ]) {
      const response = await fetch(base + path, { method: 'HEAD' });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), type);
      assert.ok(Number(response.headers.get('content-length')) > 2000);
    }
  } finally { await app.close(); }
});
const origin = 'http://localhost:3017';
async function fixture(bots = false) {
  const app = await makeServer({ database: ':memory:', origin, bots });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  function client() {
    let cookie = '';
    return {
      async request(path, input, headers = {}) {
        const res = await fetch(base + path, {
          method: input === undefined ? 'GET' : 'POST',
          headers: {
            Cookie: cookie,
            Origin: origin,
            ...(input === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
            ...headers,
          },
          body: input === undefined ? undefined : JSON.stringify(input),
        });
        const set = res.headers.get('set-cookie');
        if (set) cookie = set.split(';')[0];
        return { status: res.status, data: await res.json(), cookie: set };
      },
      events: (path, signal) =>
        fetch(base + path, {
          headers: { Cookie: cookie, Origin: origin },
          signal,
        }),
    };
  }
  return { app, client };
}
async function hostTable(client) {
  const host = client();
  assert.equal(
    (
      await host.request('/api/auth/signup', {
        name: 'Host',
        email: 'Host@example.com',
        password: 'test-password-123',
      })
    ).status,
    200,
  );
  const create = await host.request('/api/tables', {});
  return { host, path: `/api/tables/${create.data.token}` };
}
async function act(client, path, t, action, requestId = randomUUID()) {
  return client.request(path + '/commands', {
    revision: t.revision,
    matchId: t.matchId,
    requestId,
    action,
  });
}

await test('HTTP accounts, guest identity, authorization, renamed guests and logout', async () => {
  const { app, client } = await fixture();
  try {
    const anon = client();
    assert.equal((await anon.request('/api/tables', {})).status, 401);
    assert.equal(
      (
        await anon.request('/api/auth/signup', {
          name: 'A',
          email: 'a@example.com',
          password: 'short',
        })
      ).status,
      400,
    );
    const { host, path } = await hostTable(client);
    assert.equal(
      (await host.request('/api/tables', {}, { Origin: 'https://evil.test' }))
        .status,
      403,
    );
    const session = await host.request('/api/session');
    assert.equal(session.data.user.email, 'host@example.com');
    const guest = client();
    assert.equal((await guest.request(path + '/join', {})).status, 400);
    let joined = await guest.request(path + '/join', { name: 'Sam' });
    assert.equal(joined.status, 200);
    assert.match(joined.cookie, /HttpOnly/);
    assert.match(joined.cookie, /SameSite=Lax/);
    const id = joined.data.viewerId;
    joined = await guest.request(path + '/join', {});
    assert.equal(joined.data.viewerId, id);
    assert.equal(joined.data.members.length, 2);
    const impostor = client();
    const separate = await impostor.request(path + '/join', { name: 'Sam' });
    assert.notEqual(separate.data.viewerId, id);
    const denied = await act(guest, path, (await guest.request(path)).data, {
      type: 'close',
    });
    assert.equal(denied.status, 403);
    const changed = await act(guest, path, (await guest.request(path)).data, {
      type: 'rename',
      name: 'New name',
    });
    assert.equal(changed.status, 200);
    assert.equal(
      (await guest.request('/api/session')).data.guest.name,
      'New name',
    );
    assert.equal((await anon.request(path)).status, 401);
    await host.request('/api/auth/logout', {});
    assert.equal((await host.request('/api/session')).data.user, null);
    assert.equal(
      (
        await host.request('/api/auth/login', {
          email: 'host@example.com',
          password: 'wrong',
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await host.request('/api/auth/login', {
          email: 'HOST@example.com',
          password: 'test-password-123',
        })
      ).status,
      200,
    );
    assert.equal((await host.request('/api/tables')).data.length, 1);
  } finally {
    await app.close();
  }
});
await test('move confirmation preferences follow accounts and guests keep browser defaults', async () => {
  const { app, client } = await fixture();
  try {
    const anonymous = client();
    assert.deepEqual(
      (await anonymous.request('/api/preferences/confirm-moves.undertow')).data,
      { account: false, value: null },
    );
    const signedIn = client();
    await signedIn.request('/api/auth/signup', {
      name: 'Preference owner',
      email: 'preferences@example.com',
      password: 'test-password-123',
    });
    assert.deepEqual(
      (await signedIn.request('/api/preferences/confirm-moves.undertow')).data,
      { account: true, value: null },
    );
    assert.deepEqual(
      (
        await signedIn.request('/api/preferences/confirm-moves.undertow', {
          value: true,
        })
      ).data,
      { account: true, value: true },
    );
    assert.deepEqual(
      (await signedIn.request('/api/preferences/confirm-moves.undertow')).data,
      { account: true, value: true },
    );
  } finally {
    await app.close();
  }
});
await test('SSE sends only viewer state, tracks presence and reconnects; moves deduplicate', async () => {
  const { app, client } = await fixture();
  const controller = new AbortController();
  try {
    const { host, path } = await hostTable(client),
      guest = client();
    await guest.request(path + '/join', { name: 'Guest' });
    let t = (await host.request(path)).data;
    t = (
      await act(host, path, t, {
        type: 'configure',
        gameId: 'midnight',
        difficulty: 'easy',
        capacity: 2,
      })
    ).data;
    // Keep the guest present in the lobby before the host starts.
    const lobbyStream = await guest.events(path + '/events', controller.signal);
    await lobbyStream.body.getReader().read();
    t = (await host.request(path)).data;
    t = (await act(host, path, t, { type: 'start' })).data;
    const res = await guest.events(path + '/events', controller.signal);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/event-stream/);
    const reader = res.body.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    const view = JSON.parse(first.split('data: ')[1].split('\n')[0]);
    assert.equal(view.viewerSeat, 1);
    assert.ok(view.game.players[0].hand.every((c) => c.kind === -1));
    assert.ok(view.game.players[1].hand.every((c) => c.kind >= 0));
    assert.equal('knownPackets' in view.game, false);
    assert.equal(
      view.members.find((m) => m.id === view.viewerId).connected,
      true,
    );
    assert.equal(
      (await act(host, path, t, { type: 'replace', memberId: view.viewerId }))
        .status,
      409,
    );
    const envelope = {
      revision: t.revision,
      matchId: t.matchId,
      requestId: randomUUID(),
      action: {
        type: 'move',
        move: { type: 'play', card: t.game.players[0].hand[0].id },
      },
    };
    const results = await Promise.all([
      host.request(path + '/commands', envelope),
      host.request(path + '/commands', envelope),
    ]);
    assert.ok(results.every((r) => r.status === 200));
    assert.equal(results[0].data.revision, results[1].data.revision);
    const fresh = (await guest.request(path)).data;
    assert.equal(fresh.game.active, 1);
    const invalid = await act(guest, path, fresh, {
      type: 'move',
      move: { type: 'play', card: -999 },
    });
    assert.equal(invalid.status, 400);
    const update = new TextDecoder().decode((await reader.read()).value);
    assert.match(update, /"active":1/);
    controller.abort();
    await reader.cancel().catch(() => {});
    await new Promise((r) => setTimeout(r, 50));
    t = (await host.request(path)).data;
    assert.equal(
      t.members.find((m) => m.id === view.viewerId).connected,
      false,
    );
    t = (await act(host, path, t, { type: 'replace', memberId: view.viewerId }))
      .data;
    assert.equal((await guest.request(path)).data.game, null);
    const waiter = client();
    assert.equal(
      (await waiter.request(path + '/join', { name: 'Late' })).data.game,
      null,
    );
    const end = await act(host, path, t, { type: 'abandon' }); // stale after late join
    assert.equal(end.status, 409);
    t = (await host.request(path)).data;
    assert.equal((await act(host, path, t, { type: 'close' })).status, 200);
    // Closing deletes the table, so its link no longer resolves.
    assert.equal((await guest.request(path + '/join', {})).status, 404);
  } finally {
    controller.abort();
    await app.close();
  }
});
await test('real bot worker advances an online turn', async () => {
  const { app, client } = await fixture(true);
  try {
    const { host, path } = await hostTable(client);
    let t = (await host.request(path)).data;
    t = (
      await act(host, path, t, {
        type: 'configure',
        gameId: 'midnight',
        difficulty: 'medium',
        capacity: 2,
      })
    ).data;
    t = (await act(host, path, t, { type: 'start' })).data;
    t = (
      await act(host, path, t, {
        type: 'move',
        move: { type: 'play', card: t.game.players[0].hand[0].id },
      })
    ).data;
    const deadline = Date.now() + 8000;
    while (t.game.pick < 2 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
      t = (await host.request(path)).data;
    }
    assert.equal(t.botError, false);
    assert.equal(t.game.pick, 2);
    assert.ok(t.game.players.every((player) => player.zones[0].length === 1));
    // The bot may already have submitted its hidden choice for the next pick.
    assert.ok(t.game.revision === 2 || t.game.revision === 3);
  } finally {
    await app.close();
  }
});

await test('development permits alternate local origins while production rejects them', async () => {
  const previous = process.env.NODE_ENV;
  try {
    for (const mode of ['development', 'production']) {
      process.env.NODE_ENV = mode;
      const { app, client } = await fixture();
      try {
        const { path } = await hostTable(client);
        const guest = client();
        const joined = await guest.request(
          path + '/join',
          { name: 'Local tester' },
          { Origin: 'http://127.0.0.1:4317' },
        );
        assert.equal(joined.status, mode === 'development' ? 200 : 403);
      } finally {
        await app.close();
      }
    }
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

await test('party HTTP and SSE views stay private, practice resets, and geography reveals the same task only after all human locks', async () => {
  const {app,client}=await fixture(false);
  const presenceController = new AbortController();
  try{
    const {standaloneGames,decisionKey}=await import('../lib/games/standalone/registry.ts');
    const {host,path}=await hostTable(client);
    const guest=client();
    let t=(await host.request(path)).data;
    async function command(who,action){
      const snapshot=(await who.request(path)).data;
      const response=await act(who,path,snapshot,action);
      assert.equal(response.status,200,JSON.stringify(response.data));
      t=(await host.request(path)).data;
      return response.data;
    }
    t=await command(host,{type:'configure',gameId:'orin',capacity:2,difficulty:'medium'});
    assert.equal((await guest.request(path+'/join',{name:'Guest'})).status,200);
    const presenceStream = await guest.events(path+'/events', presenceController.signal);
    await presenceStream.body.getReader().read();
    for(const gameId of ['orin','miro']){
      await command(host,{type:'configure',gameId,capacity:2,difficulty:'medium'});
      await command(host,{type:'start',learning:true});
      assert.equal(t.adventure.tutorial,true);
      const practiceId=t.matchId;
      await command(host,{type:'advance-practice'});
      await command(host,{type:'begin-match'});
      assert.notEqual(t.matchId,practiceId);
      assert.equal(t.adventure.revision,0);
      const controller=new AbortController();
      const stream=await guest.events(path+'/events',controller.signal);
      assert.equal(stream.status,200);
      const reader=stream.body.getReader();
      const {value}=await reader.read();
      const payload=new TextDecoder().decode(value).split('data: ')[1].split('\n')[0];
      const view=JSON.parse(payload);
      assert.equal(view.adventure.rngState,0);
      assert.deepEqual(view.adventure.deck,[]);
      if(gameId==='miro')assert.deepEqual(view.adventure.cityIds,[]);
      else assert.deepEqual(view.adventure.offers[0],[]);
      controller.abort();
      {
        // Both sets open with a vote between their games; both pick the team game.
        await command(host,{type:'adventure-move',move:{type:'vote',choice:gameId},key:decisionKey(t.adventure)});
        await command(guest,{type:'adventure-move',move:{type:'vote',choice:gameId},key:decisionKey(t.adventure)});
        assert.equal(t.adventure.phase,gameId==='miro'?'guess':'rank');
      }
      const move=gameId==='miro'?{type:'pin',prompt:0,lat:10,lng:20}:standaloneGames[gameId].legalMoves(t.adventure,0)[0];
      await command(host,{type:'adventure-move',move,key:decisionKey(t.adventure)});
      if(gameId!=='miro'){
        const v=(await guest.request(path)).data;
        assert.deepEqual(v.adventure.ballots[0].order,[]);
        assert.equal(v.adventure.ballots[0].topic,-1);
      }else{
        const hidden=(await guest.request(path)).data.adventure;
        assert.deepEqual(hidden.prompts,t.adventure.prompts);
        assert.deepEqual(hidden.guesses[0].pins,[null,null,null]);
        assert.equal(hidden.result,null);
        for (const prompt of [1,2]) await command(host,{type:'adventure-move',move:{type:'pin',prompt,lat:10,lng:20},key:decisionKey(t.adventure)});
        await command(host,{type:'adventure-move',move:{type:'lock'},key:decisionKey(t.adventure)});
        assert.equal(t.adventure.phase,'guess');
        for (const [prompt,lat,lng] of [[0,10,20],[1,10,20],[2,10,20]]) await command(guest,{type:'adventure-move',move:{type:'pin',prompt,lat,lng},key:decisionKey(t.adventure)});
        await command(guest,{type:'adventure-move',move:{type:'lock'},key:decisionKey(t.adventure)});
        assert.equal(t.adventure.phase,'reveal');
        assert.equal(t.adventure.result.gains[0],t.adventure.result.gains[1]);
        const reconnected=(await guest.request(path)).data;
        assert.deepEqual(reconnected.adventure.result,t.adventure.result);
        assert.deepEqual(reconnected.adventure.cityIds,[]);
        assert.deepEqual(reconnected.adventure.deck,[]);
      }
      await command(host,{type:'abandon'});
      assert.equal(t.adventure,null);
    }
  }finally{presenceController.abort();await app.close();}
});

await test('host ambience changes reach guests over SSE and guests cannot override them', async () => {
  const { app, client } = await fixture();
  const controller = new AbortController();
  let reader;
  try {
    const { host, path } = await hostTable(client);
    const guest = client();
    const joined = await guest.request(path + '/join', { name: 'Listener' });
    assert.equal(joined.data.ambienceEnabled, false);
    const events = await guest.events(path + '/events', controller.signal);
    reader = events.body.getReader();
    assert.match(new TextDecoder().decode((await reader.read()).value), /"ambienceEnabled":false/);
    let t = (await host.request(path)).data;
    const rejected = await act(guest, path, t, { type: 'ambience', enabled: true });
    assert.equal(rejected.status, 403);
    for (const enabled of [true, false]) {
      const changed = await act(host, path, t, { type: 'ambience', enabled });
      assert.equal(changed.status, 200);
      t = changed.data;
      assert.equal(t.ambienceEnabled, enabled);
      const update = new TextDecoder().decode((await reader.read()).value);
      assert.match(update, new RegExp(`"ambienceEnabled":${enabled}`));
      assert.equal((await guest.request(path)).data.ambienceEnabled, enabled);
    }
  } finally {
    controller.abort();
    await reader?.cancel().catch(() => {});
    await app.close();
  }
});

await test('tables nobody is connected to are deleted after the grace period', async () => {
  const { app, client } = await fixture();
  const controller = new AbortController();
  try {
    const { host, path } = await hostTable(client);
    const second = (await host.request('/api/tables', {})).data.token;
    const stream = await host.events(path + '/events', controller.signal);
    await stream.body.getReader().read();
    const now = Date.now();
    app.sweep(now);
    app.sweep(now + 10 * 60_000);
    // The watched table stays; the empty one is gone for good.
    assert.equal((await host.request(path)).status, 200);
    assert.equal((await host.request(`/api/tables/${second}`)).status, 404);
    assert.equal((await host.request(`/api/tables/${second}/join`, {})).status, 404);
    assert.deepEqual((await host.request('/api/tables')).data.map((t) => `/api/tables/${t.token}`), [path]);
  } finally {
    controller.abort();
    await app.close();
  }
});

await test('the host sends the whole table to Folio or Relic in one room', async () => {
  const { app, client } = await fixture();
  const controller = new AbortController();
  try {
    const { host, path } = await hostTable(client), guest = client();
    await guest.request(path + '/join', { name: 'Guest' });
    const stream = await guest.events(path + '/events', controller.signal);
    await stream.body.getReader().read();
    assert.equal((await guest.request(path + '/launch', { kind: 'relic', world: 'dunes' })).status, 403);
    const relic = await host.request(path + '/launch', { kind: 'relic' });
    assert.equal(relic.status, 200);
    const room = relic.data.url.replace('/expedition/', '/api/expeditions/');
    assert.equal((await guest.request(room)).status, 200);
    assert.equal((await guest.request(path)).data.handoff.url, relic.data.url);
    const folio = await host.request(path + '/launch', { kind: 'folio', difficulty: 1 });
    assert.equal(folio.status, 200);
    const run = (await guest.request(folio.data.url.replace('/folio/', '/api/folio/'))).data;
    assert.equal(run.members.length, 2);
  } finally {
    controller.abort();
    await app.close();
  }
});

await test('saved solo games continue at a table without resetting progress; the host returns everyone to the lobby', async () => {
  const { app, client } = await fixture();
  const controller = new AbortController();
  try {
    const { host, path } = await hostTable(client);
    const solo = (await host.request('/api/folio', { seats: 1, difficulty: 2 })).data;
    const folioPath = `/api/folio/${solo.token}`;
    const node = solo.game.map.find((n) => n.row === 0);
    const played = await host.request(`${folioPath}/commands`, {
      requestId: randomUUID(), revision: solo.game.revision, action: { type: 'node', id: node.id },
    });
    assert.equal(played.status, 200);
    const desk = (await host.request('/api/expeditions', { title: 'Saved desk', world: 'dunes' })).data;
    const deskPath = `/api/expeditions/${desk.token}`;
    const bought = await host.request(`${deskPath}/commands`, {
      requestId: randomUUID(), action: { type: 'scratch-open', pack: 'seven', level: 0 },
    });
    assert.equal(bought.status, 200);
    const guest = client();
    await guest.request(path + '/join', { name: 'Guest' });
    const stream = await guest.events(path + '/events', controller.signal);
    const reader = stream.body.getReader();
    await reader.read();
    const resumed = await host.request(path + '/launch', { kind: 'folio', token: solo.token });
    assert.equal(resumed.status, 200);
    assert.equal(resumed.data.url, `/folio/${solo.token}`);
    const shared = (await guest.request(folioPath)).data;
    assert.equal(shared.joined, true);
    assert.equal(shared.members.length, 2);
    assert.equal(shared.game.seats, 2);
    assert.equal(shared.game.at, played.data.game.at);
    assert.deepEqual(shared.game.puzzle, played.data.game.puzzle);
    assert.deepEqual(shared.game.path, played.data.game.path);
    assert.equal(shared.game.lives, played.data.game.lives);
    const t = (await host.request(path)).data;
    assert.equal((await act(guest, path, t, { type: 'abandon' })).status, 403);
    const lobby = await act(host, path, t, { type: 'abandon' });
    assert.equal(lobby.status, 200);
    assert.equal(lobby.data.handoff, null);
    assert.deepEqual((await host.request(folioPath)).data.game.puzzle, shared.game.puzzle);
    const again = await host.request(path + '/launch', { kind: 'folio', token: solo.token });
    assert.equal(again.status, 200);
    assert.ok(again.data.at > resumed.data.at);
    const lucky = await host.request(path + '/launch', { kind: 'relic', token: desk.token });
    assert.equal(lucky.status, 200);
    assert.equal(lucky.data.url, `/expedition/${desk.token}`);
    const watching = (await guest.request(deskPath)).data;
    assert.deepEqual(watching.game.scratch.hands, bought.data.game.scratch.hands);
    assert.equal(watching.game.coins, bought.data.game.coins);
    // Watching is read-only: a player cannot scratch somebody else's ticket.
    const ownerTicket = Object.values(watching.game.scratch.hands)[0];
    const attempted = await guest.request(`${deskPath}/commands`, {
      requestId: randomUUID(), action: { type: 'scratch-stroke', ticket: ownerTicket.id, sequence: 0, points: [{ x: .1, y: .1 }] },
    });
    assert.deepEqual((await host.request(deskPath)).data.game.scratch.hands, watching.game.scratch.hands);
    assert.equal(attempted.status, 400);
    const closed = await act(host, path, (await host.request(path)).data, { type: 'close' });
    assert.equal(closed.status, 200);
    assert.equal((await host.request(deskPath)).status, 200);
  } finally { controller.abort(); await app.close(); }
});

await test('saved-game table attachment checks membership and the combined three-player cap atomically', async () => {
  const { app, client } = await fixture();
  const controller = new AbortController();
  try {
    const { host, path } = await hostTable(client);
    const guest = client(), outsider = client(), third = client(), fourth = client();
    await guest.request(path + '/join', { name: 'Guest' });
    const stream = await guest.events(path + '/events', controller.signal);
    await stream.body.getReader().read();
    const privateDesk = (await outsider.request('/api/expeditions', { name: 'Other', title: 'Private', world: 'dunes' })).data;
    assert.equal((await host.request(path + '/launch', { kind: 'relic', token: privateDesk.token })).status, 403);
    const privateRun = (await outsider.request('/api/folio', { seats: 1 })).data;
    assert.equal((await host.request(path + '/launch', { kind: 'folio', token: privateRun.token })).status, 403);
    const fullDesk = (await host.request('/api/expeditions', { title: 'Full', world: 'dunes' })).data;
    const dp = `/api/expeditions/${fullDesk.token}`;
    await third.request(dp + '/join', { name: 'Third' });
    await fourth.request(dp + '/join', { name: 'Fourth' });
    assert.equal((await guest.request(dp + '/join', {})).status, 409);
    assert.equal((await host.request(path + '/launch', { kind: 'relic', token: fullDesk.token })).status, 409);
    assert.equal((await guest.request(dp)).status, 403);
    assert.equal((await host.request(path)).data.handoff, null);
    const fullRun = (await host.request('/api/folio', { seats: 3 })).data;
    const fp = `/api/folio/${fullRun.token}`;
    await third.request(fp + '/join', {});
    await fourth.request(fp + '/join', {});
    assert.equal((await host.request(path + '/launch', { kind: 'folio', token: fullRun.token })).status, 409);
    assert.equal((await guest.request(fp)).data.joined, false);
    assert.equal((await host.request(fp)).data.members.length, 3);
  } finally { controller.abort(); await app.close(); }
});
