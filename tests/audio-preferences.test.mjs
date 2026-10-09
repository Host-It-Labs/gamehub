import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VOLUME_KEY,
  defaultAudioLevel,
  readAudioLevel,
  saveAudioLevel,
  readAudioMuted,
  saveAudioMuted,
} from '../lib/games/audio-preferences.ts';

const levelKeys = [
  [VOLUME_KEY, 0.5],
  ['gamehub.ambience.v1', 0.6],
  ['gamehub.folio.volume', 0.5],
  ['gamehub.alto.volume', 0.5],
  ['gamehub.rota.volume', 0.5],
  ['gamehub.sound-lab.volume', 0.45],
];
const muteKey = 'gamehub-relic-muted';

function fixture(t, mode) {
  const previousMode = process.env.NODE_ENV;
  const descriptors = new Map(
    ['localStorage', 'sessionStorage'].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  process.env.NODE_ENV = mode;
  function install(name, values = new Map()) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
      },
    });
    return values;
  }
  const local = install('localStorage');
  const session = install('sessionStorage');
  t.after(() => {
    if (previousMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousMode;
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return { local, session, newSession: () => install('sessionStorage') };
}

await test('development starts silent even with saved production sound preferences', (t) => {
  const f = fixture(t, 'development');
  for (const [key, level] of levelKeys) {
    f.local.set(key, String(level));
    assert.equal(defaultAudioLevel(level), 0);
    assert.equal(readAudioLevel(key, level), 0);
  }
  f.local.set(muteKey, 'false');
  assert.equal(readAudioMuted(muteKey), true);
  assert.equal(f.session.size, 0);
});

await test('development unmute survives reloads and ends with the tab session', async (t) => {
  const f = fixture(t, 'development');
  for (const [key, level] of levelKeys) saveAudioLevel(level, key);
  saveAudioMuted(false, muteKey);
  // A new module instance stands for a reload or a separate page in this tab.
  const reloaded = await import('../lib/games/audio-preferences.ts?reload');
  for (const [key, level] of levelKeys) {
    assert.equal(reloaded.readAudioLevel(key, level), level);
  }
  assert.equal(reloaded.readAudioMuted(muteKey), false);
  assert.equal(f.local.size, 0, 'development never writes device preferences');

  saveAudioLevel(0);
  saveAudioMuted(true, muteKey);
  assert.equal(reloaded.readAudioLevel(), 0);
  assert.equal(reloaded.readAudioMuted(muteKey), true);

  f.newSession();
  for (const [key, level] of levelKeys) {
    assert.equal(readAudioLevel(key, level), 0);
  }
  assert.equal(readAudioMuted(muteKey), true);
});

await test('production keeps device preferences and its existing audible defaults', (t) => {
  const f = fixture(t, 'production');
  for (const [key, level] of levelKeys) {
    f.session.set(key, '0');
    assert.equal(defaultAudioLevel(level), level);
    assert.equal(readAudioLevel(key, level), level);
    saveAudioLevel(0, key);
    assert.equal(f.local.get(key), '0');
    assert.equal(readAudioLevel(key, level), 0);
  }
  f.session.set(muteKey, 'true');
  assert.equal(readAudioMuted(muteKey), false);
  saveAudioMuted(true, muteKey);
  assert.equal(f.local.get(muteKey), 'true');
  assert.equal(readAudioMuted(muteKey), true);
  saveAudioMuted(false, muteKey);
  assert.equal(readAudioMuted(muteKey), false);
});

await test('unavailable or invalid session storage keeps development silent', (t) => {
  const f = fixture(t, 'development');
  f.session.set(VOLUME_KEY, 'invalid');
  f.session.set(muteKey, 'invalid');
  assert.equal(readAudioLevel(), 0);
  assert.equal(readAudioMuted(muteKey), true);
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get() { throw new Error('Storage disabled'); },
  });
  assert.equal(readAudioLevel(), 0);
  assert.equal(readAudioLevel('gamehub.ambience.v1', 0.6), 0);
  assert.equal(readAudioMuted(muteKey), true);
  assert.doesNotThrow(() => saveAudioLevel(0.5));
  assert.doesNotThrow(() => saveAudioMuted(false, muteKey));
  assert.equal(f.local.size, 0);
});
