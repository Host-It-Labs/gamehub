import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { makeServer } from '../server/index.ts';
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
    assert.equal((await guest.request(path + '/join', {})).status, 410);
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
    for(const gameId of ['orin','vela','miro']){
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
      const move=gameId==='miro'?{type:'arrange',order:[4,3,2,1,0]}:standaloneGames[gameId].legalMoves(t.adventure,0)[0];
      await command(host,{type:'adventure-move',move,key:decisionKey(t.adventure)});
      if(gameId!=='miro'){
        const v=(await guest.request(path)).data;
        assert.deepEqual(v.adventure.ballots[0].order,[]);
        assert.equal(v.adventure.ballots[0].topic,-1);
      }else{
        const hidden=(await guest.request(path)).data.adventure;
        assert.deepEqual(hidden.cities,t.adventure.cities);
        assert.deepEqual(hidden.guesses[0].order,[]);
        assert.equal(hidden.result,null);
        await command(host,{type:'adventure-move',move:{type:'lock'},key:decisionKey(t.adventure)});
        assert.equal(t.adventure.phase,'guess');
        await command(guest,{type:'adventure-move',move:{type:'arrange',order:[4,3,2,1,0]},key:decisionKey(t.adventure)});
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
  }finally{await app.close();}
});
