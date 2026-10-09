import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginCampaign,
  buyDinerUpgrade,
  checkpointCampaignMatch,
  DINER_CAMPAIGN_SAVE,
  DINER_LEVELS_SAVE,
  driveCampaign,
  endCampaignRun,
  levelOpen,
  nextLevel,
  pickCampaignGear,
  readCampaign,
  readLevels,
  recordLevel,
  rememberLevel,
  restartCampaign,
  settleCampaignMatch,
  workshopOpen,
} from '../components/game/diner/diner-store.ts';
import { runChoices } from '../lib/games/diner/campaign.ts';
import { HZ, open, step } from '../lib/games/diner/engine.ts';

function storage() {
  const records = new Map();
  let blocked = false;
  globalThis.localStorage = {
    getItem: (key) => records.get(key) ?? null,
    setItem(key, value) {
      if (blocked) throw new Error('Quota exceeded');
      records.set(key, value);
    },
    removeItem: (key) => records.delete(key),
  };
  return { records, block: (value) => (blocked = value) };
}
const finish = (m, stars = m.stars) => {
  const match = structuredClone(m);
  match.tick = match.config.seconds * HZ;
  match.phase = 'over';
  match.stars = stars;
  match.coins = 150;
  match.medals = 2;
  return match;
};

await test('levels keep their best medals, and a medal opens the next level', () => {
  storage();
  let r = readLevels();
  assert.ok(levelOpen(r, 1));
  assert.ok(!levelOpen(r, 2), 'level 2 waits for a medal on level 1');
  assert.equal(nextLevel(r), 1);
  const fail = recordLevel(1, 0, 40);
  assert.equal(fail.opened, null, 'no medal, nothing opens');
  assert.ok(!levelOpen(fail.record, 2));
  const first = recordLevel(1, 1, 80);
  assert.equal(first.opened, 2);
  assert.equal(first.best, true);
  const again = recordLevel(1, 3, 60);
  assert.equal(again.opened, null, 'opened only once');
  assert.equal(again.best, false);
  rememberLevel(2);
  r = readLevels();
  assert.equal(r.medals[0], 3);
  assert.equal(r.best[0], 80);
  assert.equal(r.last, 2);
  assert.ok(levelOpen(r, 2) && !levelOpen(r, 3));
  assert.equal(nextLevel(r), 2);
  assert.ok(localStorage.getItem(DINER_LEVELS_SAVE));
});

await test('a new run replaces the one under way, keeping the tokens', () => {
  storage();
  let save = beginCampaign(11);
  save = driveCampaign(runChoices(save.run)[0].id);
  const old = save.run.id;
  const tokens = save.profile.tokens;
  save = restartCampaign(12);
  assert.notEqual(save.run.id, old);
  assert.equal(save.run.status, 'route');
  assert.equal(save.run.visited.length, 0);
  assert.equal(save.profile.tokens, tokens);
});

await test('a run is saved at every step and banks its tokens once', () => {
  const box = storage();
  let save = beginCampaign(42);
  assert.equal(save.run.status, 'route');
  assert.ok(box.records.has(DINER_CAMPAIGN_SAVE));
  save = driveCampaign(runChoices(save.run)[0].id);
  assert.equal(save.run.status, 'shift');
  const m = structuredClone(save.run.savedMatch);
  open(m);
  for (let i = 0; i < 6 * HZ; i++) step(m, []);
  save = checkpointCampaignMatch(m);
  assert.equal(readCampaign().run.savedMatch.tick, m.tick);
  const done = finish(m);
  save = settleCampaignMatch(done);
  const tokens = save.profile.tokens;
  assert.ok(tokens > 0);
  assert.deepEqual(
    settleCampaignMatch(done).profile.tokens,
    tokens,
    'banked once',
  );
  if (save.run.status === 'reward') save = pickCampaignGear(save.run.offers[0]);
  assert.equal(save.run.status, 'route');
  // A second start does not replace a run under way.
  assert.equal(beginCampaign(7).run.id, save.run.id);
});

await test('the Workshop waits until the run is over once the truck is on the road', () => {
  storage();
  let save = beginCampaign(5);
  save = driveCampaign(runChoices(save.run)[0].id);
  localStorage.setItem(
    DINER_CAMPAIGN_SAVE,
    JSON.stringify({
      ...JSON.parse(localStorage.getItem(DINER_CAMPAIGN_SAVE)),
      profile: { ...save.profile, tokens: 200 },
    }),
  );
  save = buyDinerUpgrade('gas-can');
  assert.equal(save.profile.upgrades['gas-can'], undefined, 'not during a run');
  save = endCampaignRun();
  assert.equal(save.run.status, 'over');
  save = buyDinerUpgrade('gas-can');
  assert.equal(save.profile.upgrades['gas-can'], 1);
  assert.equal(save.profile.tokens, 175);
});

await test('blocked storage keeps the run in memory and says so', () => {
  const box = storage();
  beginCampaign(9);
  box.block(true);
  const save = driveCampaign(runChoices(readCampaign().run)[0].id);
  assert.equal(save.persisted, false);
  assert.equal(readCampaign().run.status, 'shift', 'the tab still has the run');
  box.block(false);
});

await test('a broken run never costs the Workshop its tokens', () => {
  const box = storage();
  const envelope = structuredClone({ ...readCampaign(), persisted: undefined });
  envelope.revision = 999;
  envelope.profile.tokens = 77;
  envelope.run = { ...envelope.run, lives: 'many' };
  box.records.set(DINER_CAMPAIGN_SAVE, JSON.stringify(envelope));
  const save = readCampaign();
  assert.equal(save.profile.tokens, 77);
  assert.equal(save.run, null);
});

await test('a run with a null inside its shift is dropped, the Workshop kept', async () => {
  const box = storage();
  let save = beginCampaign(4);
  save = driveCampaign(runChoices(save.run)[0].id);
  const envelope = JSON.parse(box.records.get(DINER_CAMPAIGN_SAVE));
  envelope.revision = 5000;
  envelope.profile = {
    ...envelope.profile,
    tokens: 777,
    upgrades: { 'gas-can': 1 },
  };
  envelope.run.savedMatch.tables[0] = null;
  envelope.run.savedMatch.stations[0] = null;
  box.records.set(DINER_CAMPAIGN_SAVE, JSON.stringify(envelope));
  const read = readCampaign();
  assert.equal(read.profile.tokens, 777);
  assert.equal(read.profile.upgrades['gas-can'], 1);
  assert.equal(read.run, null);
});

await test('the Workshop sells at the start line and the run takes the upgrade', () => {
  const box = storage();
  let save = beginCampaign(21);
  assert.ok(workshopOpen(save.run), 'open before the first stop');
  const envelope = JSON.parse(box.records.get(DINER_CAMPAIGN_SAVE));
  envelope.profile.tokens = 400;
  box.records.set(DINER_CAMPAIGN_SAVE, JSON.stringify(envelope));
  const id = save.run.id;
  save = buyDinerUpgrade('spare-tire');
  assert.equal(save.profile.upgrades['spare-tire'], 1);
  assert.equal(save.run.id, id, 'the same run');
  assert.equal(save.run.maxLives, 5);
  assert.equal(save.run.lives, 5);
  assert.equal(save.run.upgradeRanks['spare-tire'], 1);
  save = driveCampaign(runChoices(save.run)[0].id);
  assert.ok(!workshopOpen(save.run), 'closed once on the road');
  assert.equal(
    buyDinerUpgrade('gas-can').profile.upgrades['gas-can'],
    undefined,
  );
});
