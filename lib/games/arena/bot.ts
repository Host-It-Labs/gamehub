import {
  cards,
  isSpell,
  troopCards,
  troopOf,
  type CardId,
  type SpellStats,
  type TroopCard,
  type TroopTag,
} from './cards.ts';
import {
  BRIDGES,
  LENGTH,
  TICK,
  WIDTH,
  canDeployAt,
  clearAttackLine,
  dist,
  onField,
  sideOf,
  supports,
  unitStats,
  type Difficulty,
  type Match,
  type Side,
  type Tower,
  type Unit,
} from './engine.ts';

/**
 * The bot plays with the same deck, elixir and placement rules as you. It lets
 * attackers walk into its towers' range and meets them there with a fitting,
 * cheap counter; it attacks when its elixir runs high, a tank at the back
 * first and support behind it once it reaches the bridge, and it backs up the
 * troops that survive a defence. It casts the Meteor on clusters of troops
 * worth more than the rock, aiming where they will be when it lands, and on
 * a tower the rock would finish. Difficulty sets its reaction time, how well
 * it picks counters, where it places them and how well it aims.
 *
 * `botStep` only decides: it returns the card and spot, and the caller plays
 * it (at once in a solo match, as a relayed command online). The bot keeps
 * its own dice so thinking never changes the match itself.
 */
export type BotMemory = {
  player: number;
  side: Side;
  level: Difficulty;
  rng: number;
  nextThink: number;
  /** When the current threat first appeared, to model reaction time. */
  threatSince: number | null;
};

export type BotMove = { player: number; slot: number; x: number; y: number };

export const botMemory = (
  player = 1,
  level: Difficulty = 'medium',
  seed = 1,
): BotMemory => ({
  player,
  side: sideOf(player),
  level,
  rng: (seed ^ Math.imul(player + 1, 0x9e3779b1)) >>> 0,
  // Teammates think a moment apart so they do not answer the same attack.
  nextThink: 0.8 + player * 0.23,
  threatSince: null,
});

function random(mem: BotMemory) {
  mem.rng = (Math.imul(mem.rng, 1664525) + 1013904223) >>> 0;
  return mem.rng / 4294967296;
}

/** How a bot aims a spell at moving troops: where they stand now, where
 *  they would be walking straight on, or also where they stop to fight. */
type Lead = 'none' | 'plain' | 'smart';

export const botLevels = {
  easy: {
    think: 1.4,
    react: 2.2,
    attackAt: 10,
    smart: 0.35,
    jitter: 2.5,
    /** How deep an attacker may come before the bot meets it. */
    engage: 16,
    support: false,
    punish: false,
    /** Whether it counts its own troops already fighting a threat. */
    coverage: false,
    meteor: {
      /** Chance per decision that it thinks of the Meteor at all. */
      chance: 0.35,
      /** Elixir worth a cast must destroy; one troop alone needs half more. */
      worth: 5,
      /** Elixir it likes to keep after a cast; each point short needs 0.5
       *  more worth. */
      reserve: 0,
      lead: 'none' as Lead,
      /** Random miss, in tiles. */
      aim: 2,
      /** Whether it picks the richest spot or any spot worth a cast. */
      best: false,
      /** Value of clipping a tower on the way. */
      clip: 0,
    },
  },
  medium: {
    think: 0.6,
    react: 1,
    attackAt: 8.5,
    smart: 0.8,
    jitter: 0.9,
    engage: 14.5,
    support: true,
    punish: false,
    coverage: true,
    meteor: {
      chance: 0.6,
      worth: 4.2,
      reserve: 0,
      lead: 'plain' as Lead,
      aim: 0.5,
      best: true,
      clip: 0.4,
    },
  },
  hard: {
    think: 0.25,
    react: 0.4,
    attackAt: 8.5,
    smart: 1,
    jitter: 0.6,
    engage: 14.5,
    support: true,
    punish: true,
    coverage: true,
    meteor: {
      chance: 1,
      worth: 4.2,
      reserve: 3,
      lead: 'smart' as Lead,
      aim: 0,
      best: true,
      clip: 0.8,
    },
  },
};

type Threat = {
  lane: 0 | 1;
  units: Unit[];
  cost: number;
  air: number;
  swarm: number;
  tank: boolean;
  fighter: boolean;
  ranged: boolean;
  lead: Unit;
  /** How far the lead is from our back line. */
  depth: number;
  /** Elixir worth of our own troops already fighting it. */
  covered: number;
};

/** Distance from a side's back line. */
const depthOf = (side: Side, y: number) => (side === 0 ? y : LENGTH - y);
/** The y at a given depth for a side. */
const atDepth = (side: Side, depth: number) =>
  side === 0 ? depth : LENGTH - depth;
const laneX = (lane: 0 | 1) => BRIDGES[lane];
const laneOf = (x: number): 0 | 1 => (x < WIDTH / 2 ? 0 : 1);

/** Elixir worth of one troop of a card; a spawned bee counts for half an
 *  elixir, so a swarm of them is worth answering. */
const each = (u: Unit) =>
  troopCards[u.card].token
    ? 0.5
    : troopCards[u.card].cost / troopCards[u.card].formation.length;

const durability = (u: Unit) => u.hp + u.shield;
const fullDurability = (u: Unit) => u.maxHp + u.maxShield;
const healthShare = (u: Unit) => durability(u) / fullDurability(u);

/** Whether a spell our side already cast will finish this troop. */
function doomed(m: Match, side: Side, u: Unit) {
  const r = unitStats(u).radius;
  return m.spells.some(
    (s) =>
      s.side === side &&
      s.damage >= durability(u) &&
      dist(u.x - s.x, u.y - s.y) <= s.radius + r,
  );
}

function threats(m: Match, side: Side): Threat[] {
  const out: Threat[] = [];
  for (const lane of [0, 1] as const) {
    // Enemy troops on this lane that have come within reach of our half.
    const units = m.units.filter(
      (u) =>
        u.side !== side &&
        u.state !== 'deploying' &&
        laneOf(u.x) === lane &&
        depthOf(side, u.y) < 20.5 &&
        !doomed(m, side, u),
    );
    if (!units.length) continue;
    let cost = 0;
    for (const u of units) cost += each(u) * healthShare(u);
    const lead = units.reduce((a, b) =>
      depthOf(side, b.y) < depthOf(side, a.y) ? b : a,
    );
    let covered = 0;
    for (const f of m.units)
      if (
        f.side === side &&
        dist(f.x - lead.x, f.y - lead.y) < 5 &&
        depthOf(side, f.y) < 17
      )
        covered += each(f) * healthShare(f);
    out.push({
      lane,
      units,
      cost,
      air: units.filter((u) => unitStats(u).flying).length / units.length,
      swarm: units.filter((u) => u.maxHp < 400).length,
      tank: units.some((u) => tagged(u, 'tank') && u.hp + u.shield > 900),
      fighter: units.some((u) => tagged(u, 'fighter') && u.hp > 400),
      ranged: units.some((u) => tagged(u, 'ranged')),
      lead,
      depth: depthOf(side, lead.y),
      covered,
    });
  }
  return out.sort((a, b) => b.cost - a.cost);
}

const bonus = (table: Partial<Record<CardId, number>>, id: CardId) =>
  table[id] ?? 0;
const tagged = (u: Unit, tag: TroopTag) =>
  troopCards[u.card].tags.includes(tag);

/** How well a troop card answers a threat; higher is better. */
export function counterScore(card: TroopCard, t: Threat) {
  const u = card.unit;
  let score = 1;
  if (t.air > 0) score += (u.targets === 'any' ? 4 : -8) * t.air;
  // Splash clears a swarm; the Cadets pick it apart from range.
  if (t.swarm >= 2)
    score +=
      u.splash || u.spin || u.chain || u.cone
        ? 4
        : u.armour
          ? 3
          : card.id === 'archers'
            ? 1
            : -1.5;
  if (t.tank)
    score += bonus(
      {
        duelist: 6,
        imps: 4,
        pirate: 3,
        inventor: 2,
        viking: 2,
        gladiator: 1,
        archers: 1,
        ranger: 1,
        // Frost and tackles hold a tank back while the towers shoot it.
        explorer: 3,
        linebacker: 2,
        jetpack: 1,
      },
      card.id,
    );
  // The Samurai cannot touch a Biplane and wastes its blows on Robots.
  if (t.fighter)
    score += bonus(
      {
        imps: 3,
        drake: 3,
        gladiator: 2,
        inventor: 2,
        archers: 1,
        firefighter: 3,
        linebacker: 2,
        explorer: 2,
        jetpack: 2,
        diver: 1,
      },
      card.id,
    );
  if (t.ranged)
    score += bonus(
      {
        duelist: 2,
        imps: 2,
        drake: 2,
        pirate: 3,
        miner: 2,
        jetpack: 3,
        linebacker: 2,
      },
      card.id,
    );
  // A tower-only tank never defends, nor does a healer or a siege gun.
  // The Beekeeper's bees do defend, slowly; ground-only fighters lose
  // nothing to a flyer when bees answer it.
  if (u.targets === 'buildings') score -= 12;
  if (u.spawn) score += t.air > 0 ? 0.5 : -1;
  else if (supports(u)) score -= 12;
  // A big tank is a poor answer unless the threat is big too.
  if (card.tags.includes('tank') && card.cost >= 5 && t.cost < 5) score -= 2;
  if (u.minRange) score -= 1.5;
  // Cheap answers keep the elixir lead.
  score -= 0.6 * Math.max(0, card.cost - t.cost);
  return score;
}

function place(
  m: Match,
  side: Side,
  x: number,
  y: number,
  card?: CardId,
  target?: Unit,
): [number, number] | null {
  // Try the spot, then rings around it, until the rules allow one.
  for (let r = 0; r <= 4; r += 0.5) {
    const steps = r === 0 ? 1 : Math.ceil(r * 8);
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const px = Math.round((x + Math.cos(a) * r) * 2) / 2;
      const py = Math.round((y + Math.sin(a) * r) * 2) / 2;
      if (!canDeployAt(m, side, px, py, card)) continue;
      const troop = card && troopOf(card);
      // A legal drop behind a tower can still leave every shot blocked.
      // Defenders choose a nearby opening, including each swarm member.
      if (
        target &&
        troop &&
        !troop.unit.flying &&
        troop.unit.projectile?.kind !== 'shell' &&
        !troop.formation.every(([ox, oy]) =>
          clearAttackLine(
            m,
            {
              x: px + ox * (side === 0 ? 1 : -1),
              y: py + oy * (side === 0 ? 1 : -1),
            },
            target,
          ),
        )
      )
        continue;
      return [px, py];
    }
  }
  return null;
}

function play(
  m: Match,
  mem: BotMemory,
  slot: number,
  x: number,
  y: number,
  target?: Unit,
): BotMove | null {
  const card = m.players[mem.player].hand.cards[slot];
  const spot = place(m, mem.side, x, y, card, target);
  return spot ? { player: mem.player, slot, x: spot[0], y: spot[1] } : null;
}

/** The troop cards in hand it can pay for now. */
function affordable(m: Match, mem: BotMemory) {
  const seat = m.players[mem.player];
  const out: { slot: number; card: TroopCard }[] = [];
  seat.hand.cards.forEach((id, slot) => {
    const card = troopOf(id);
    if (card && card.cost <= seat.elixir) out.push({ slot, card });
  });
  return out;
}

/** A troop card's slot in hand, if it matches and can be paid for. */
function troopSlot(
  m: Match,
  mem: BotMemory,
  test: (card: TroopCard) => boolean,
) {
  const seat = m.players[mem.player];
  return seat.hand.cards.findIndex((id) => {
    const card = troopOf(id);
    return !!card && card.cost <= seat.elixir && test(card);
  });
}

function defend(m: Match, mem: BotMemory, t: Threat) {
  const level = botLevels[mem.level];
  const side = mem.side;
  const options = affordable(m, mem);
  if (!options.length) return null;
  let choice: (typeof options)[number];
  if (random(mem) > level.smart)
    choice = options[Math.floor(random(mem) * options.length)];
  else {
    choice = options.reduce((a, b) =>
      counterScore(b.card, t) > counterScore(a.card, t) ? b : a,
    );
    if (counterScore(choice.card, t) < 0) return null;
  }
  const jitter = () => (random(mem) - 0.5) * 2 * level.jitter;
  const lead = t.lead;
  let x: number;
  let depth: number;
  if (choice.card.unit.minRange) {
    // A siege gun stands far back and shells them on the way in.
    x = laneX(t.lane);
    depth = 2;
  } else if (choice.card.unit.projectile) {
    // Ranged help stands back, between the towers, out of reach.
    x = t.lane === 0 ? laneX(0) + 2.5 : laneX(1) - 2.5;
    depth = Math.min(t.depth - choice.card.unit.range + 1, 6);
  } else if (t.ranged && !t.tank && !t.fighter) {
    // Drop fighters right onto archers and mages.
    x = lead.x;
    depth = t.depth - 0.5;
  } else {
    // Otherwise meet the attacker just in front, inside tower range,
    // pulled a little towards the middle so both towers can help.
    x = lead.x + (lead.x < WIDTH / 2 ? 1 : -1);
    depth = t.depth - 2.5;
  }
  depth = Math.max(1.5, Math.min(depth, 14));
  return play(
    m,
    mem,
    choice.slot,
    x + jitter(),
    atDepth(side, depth) + jitter(),
    lead,
  );
}

function attack(m: Match, mem: BotMemory): BotMove | null {
  const level = botLevels[mem.level];
  const side = mem.side;
  const hand = m.players[mem.player].hand.cards;
  const elixir = m.players[mem.player].elixir;
  const enemySide: Side = side === 0 ? 1 : 0;
  const jitter = () => (random(mem) - 0.5) * 2 * level.jitter;
  if (level.support) {
    // Back up our troops as they reach the bridge: a tank, or survivors of
    // a defence walking back up the lane.
    const push = m.units
      .filter(
        (u) =>
          u.side === side &&
          u.state === 'walking' &&
          u.hp > u.maxHp * 0.45 &&
          Math.abs(depthOf(side, u.y) - 15.5) < 3.5,
      )
      .sort((a, b) => b.maxHp - a.maxHp)[0];
    if (push && elixir >= 4) {
      const ranged = troopSlot(
        m,
        mem,
        (c) => !!c.unit.projectile && !c.unit.minRange,
      );
      // Support (the Medic, the Drummer, the Beekeeper) walks behind.
      const medic = troopSlot(m, mem, (c) => supports(c.unit));
      // A tank, or a fighter walking back from a defence, leads the push.
      const tank = tagged(push, 'tank') || tagged(push, 'fighter');
      const slot =
        medic >= 0 && tank && random(mem) < (tagged(push, 'tank') ? 0.65 : 0.4)
          ? medic
          : ranged >= 0 && tank
            ? ranged
            : troopSlot(
                m,
                mem,
                (c) =>
                  c.unit.targets !== 'buildings' &&
                  !c.unit.burrow &&
                  !(c.tags.includes('tank') && c.cost >= 5) &&
                  c.cost <= 4,
              );
      if (slot >= 0) {
        const behind = troopOf(hand[slot])?.unit.projectile ? 2.5 : 1;
        return play(
          m,
          mem,
          slot,
          push.x + jitter(),
          atDepth(side, Math.min(depthOf(side, push.y) - behind, 14)),
        );
      }
    }
  }
  // Knowing the enemy just spent big is the moment to punish the other lane.
  const enemies = m.players.filter((p) => p.side === enemySide);
  const theirs = enemies.reduce((sum, p) => sum + p.elixir, 0) / enemies.length;
  const committed = m.units
    .filter(
      (u) => u.side === enemySide && u.hp > 0 && depthOf(enemySide, u.y) > 6,
    )
    .sort((a, b) => each(b) * healthShare(b) - each(a) * healthShare(a))[0];
  const punishLane = committed ? (laneOf(committed.x) === 0 ? 1 : 0) : null;
  // Low elixir alone does not mean an open lane: the troop they just
  // bought may be defending it. Punish a push committed to the other
  // lane, and keep building a supported attack when both lanes are held.
  const punish =
    level.punish &&
    theirs < 3 &&
    elixir >= 4 &&
    punishLane !== null &&
    !m.units.some(
      (u) =>
        u.side === enemySide &&
        u.hp > 0 &&
        laneOf(u.x) === punishLane &&
        depthOf(enemySide, u.y) < 20 &&
        healthShare(u) > 0.4,
    );
  if (elixir < level.attackAt && !punish) return null;
  const enemy = m.towers.filter(
    (t) => t.side === enemySide && t.kind === 'princess',
  );
  // The weaker lane, or the pocket where a tower already fell.
  let lane = enemy
    .slice()
    .sort((a, b) => (a.destroyed ? -1 : a.hp) - (b.destroyed ? -1 : b.hp))[0]
    .lane as 0 | 1;
  if (punish) lane = punishLane!;
  if (mem.level === 'easy') {
    const options = affordable(m, mem);
    if (!options.length) return null;
    const o = options[Math.floor(random(mem) * options.length)];
    return play(
      m,
      mem,
      o.slot,
      2 + random(mem) * 14,
      atDepth(side, 3 + random(mem) * 11),
    );
  }
  // A big tank (the Dino, the Balloon, the Diver, the Sumo) starts a push
  // from the back, where it has time to gather support.
  const heavy = hand.findIndex((id) => {
    const c = troopOf(id);
    return (
      !!c &&
      (c.unit.targets === 'buildings' ||
        (c.tags.includes('tank') && c.cost >= 5))
    );
  });
  if (
    !punish &&
    heavy >= 0 &&
    elixir >= Math.max(cards[hand[heavy]].cost, level.attackAt)
  )
    return play(m, mem, heavy, laneX(lane) + jitter(), atDepth(side, 1.5));
  // The Miner digs up right beside the tower it goes for.
  const miner = hand.findIndex((id) => !!troopOf(id)?.unit.burrow);
  if (miner >= 0 && cards[hand[miner]].cost <= elixir) {
    const target = enemy.find((t) => t.lane === lane && !t.destroyed);
    if (target)
      return play(
        m,
        mem,
        miner,
        target.x + (target.x < WIDTH / 2 ? 1 : -1) * (target.radius + 0.5),
        target.y + (side === 0 ? -1 : 1) * (target.radius + 0.5),
      );
  }
  // A siege gun sets up at the bridge; a quick fighter goes with it.
  const gun = hand.findIndex((id) => !!troopOf(id)?.unit.minRange);
  if (!punish && gun >= 0 && cards[hand[gun]].cost <= elixir)
    return play(m, mem, gun, laneX(lane) + jitter(), atDepth(side, 12));
  // Otherwise a quick fighter at the bridge, keeping ranged cards back.
  const lead: CardId[] = punish
    ? ['imps', 'linebacker', 'duelist', 'drake']
    : ['duelist', 'linebacker', 'drake', 'imps', 'archers'];
  const rank = (id: CardId) => {
    const i = lead.indexOf(id);
    if (i >= 0) return i;
    if (punish && id === 'archers') return 99;
    return lead.length + (punish ? cards[id].cost : 10 - cards[id].cost);
  };
  const fighters = hand
    .map((id, slot) => ({ id, slot, card: troopOf(id) }))
    .filter(
      (o) =>
        o.card &&
        o.card.cost <= elixir &&
        !supports(o.card.unit) &&
        !o.card.unit.burrow &&
        (o.card.tags.includes('fighter') ||
          o.card.tags.includes('swarm') ||
          o.card.tags.includes('air')),
    )
    // Cheap ones first when punishing, the strongest otherwise; the
    // Samurai, the Biplane and the Robots lead, as they always have.
    .sort((a, b) => rank(a.id) - rank(b.id));
  if (fighters.length)
    return play(
      m,
      mem,
      fighters[0].slot,
      laneX(lane) + jitter(),
      atDepth(side, 14),
    );
  if (punish) return null;
  const slot = troopSlot(m, mem, (c) => !supports(c.unit));
  return slot >= 0
    ? play(m, mem, slot, laneX(lane) + 2 * (lane ? -1 : 1), atDepth(side, 5))
    : null;
}

/**
 * Where a troop will stand when a spell cast now lands. 'plain' assumes it
 * walks straight on at the pace it just moved; 'smart' also stops it where it
 * reaches its target and lets a troop still deploying set off forwards.
 */
function lead(m: Match, u: Unit, delay: number, how: Lead): [number, number] {
  if (how === 'none') return [u.x, u.y];
  const s = unitStats(u);
  if (u.state === 'deploying') {
    if (how === 'plain') return [u.x, u.y];
    const walk = Math.max(0, delay - u.deployLeft) * s.speed;
    return [u.x, u.y + (u.side === 0 ? walk : -walk)];
  }
  const vx = (u.x - u.px) / TICK;
  const vy = (u.y - u.py) / TICK;
  const speed = dist(vx, vy);
  if (speed < 0.05) return [u.x, u.y];
  let reach = speed * delay;
  if (how === 'smart' && u.targetId !== null) {
    const t: Unit | Tower | undefined =
      m.units.find((e) => e.id === u.targetId) ??
      m.towers.find((e) => e.id === u.targetId);
    if (t) {
      const r = 'kind' in t ? t.radius : unitStats(t).radius;
      const gap = dist(t.x - u.x, t.y - u.y) - r - s.range;
      reach = Math.min(reach, Math.max(0, gap));
    }
  }
  return [u.x + (vx / speed) * reach, u.y + (vy / speed) * reach];
}

/** Elixir worth a spell destroys on a troop, with a little extra for a kill. */
function spellWorth(u: Unit, spell: SpellStats) {
  const remaining = durability(u);
  const dealt = Math.min(remaining, spell.damage);
  return (
    (each(u) * dealt) / fullDurability(u) +
    (dealt >= remaining ? each(u) * 0.25 : 0)
  );
}

/**
 * The Meteor: on the richest cluster of enemy troops (where they will be when
 * it lands), nudged to clip a tower when that costs nothing, or on a tower it
 * would finish. Troops and towers already under one of our falling rocks are
 * left out, so teammates do not throw two at one fight.
 */
function meteor(m: Match, mem: BotMemory): BotMove | null {
  const level = botLevels[mem.level].meteor;
  const seat = m.players[mem.player];
  const slot = seat.hand.cards.findIndex(isSpell);
  if (slot < 0) return null;
  const card = cards[seat.hand.cards[slot]];
  if (card.kind !== 'spell' || seat.elixir < card.cost) return null;
  if (random(mem) > level.chance) return null;
  const spell = card.spell;
  const side = mem.side;
  const falling = m.spells.filter((s) => s.side === side);
  const under = (x: number, y: number, r: number) =>
    falling.some((s) => dist(x - s.x, y - s.y) <= s.radius + r);
  const marks: { x: number; y: number; r: number; worth: number }[] = [];
  for (const u of m.units) {
    if (u.side === side || u.hp <= 0) continue;
    const r = unitStats(u).radius;
    if (under(u.x, u.y, r)) continue;
    const [x, y] = lead(m, u, spell.delay, level.lead);
    marks.push({ x, y, r, worth: spellWorth(u, spell) });
  }
  const towers = m.towers.filter(
    (t) => t.side !== side && !t.destroyed && !under(t.x, t.y, t.radius),
  );
  const finish = towers.filter((t) => t.hp <= spell.towerDamage);
  if (!marks.length && !finish.length) return null;
  // Troops count when well inside, since their walk is only a guess.
  const score = (cx: number, cy: number) => {
    let hits = 0;
    let value = 0;
    for (const k of marks)
      if (dist(k.x - cx, k.y - cy) <= spell.radius + k.r - 0.25) {
        hits++;
        value += k.worth;
      }
    for (const t of towers) {
      if (dist(t.x - cx, t.y - cy) > spell.radius + t.radius - 0.1) continue;
      if (t.hp <= spell.towerDamage) value += t.kind === 'king' ? 50 : 10;
      // Waking their king hands them a third shooter.
      else if (t.kind === 'king' && !t.active) value -= 1.5;
      else value += level.clip;
    }
    return { hits, value };
  };
  const spots: [number, number][] = finish.map((t) => [t.x, t.y]);
  for (let i = 0; i < marks.length; i++) {
    const a = marks[i];
    spots.push([a.x, a.y]);
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let j = 0; j < marks.length; j++) {
      const b = marks[j];
      const d = dist(b.x - a.x, b.y - a.y);
      if (d <= spell.radius) {
        sx += b.x;
        sy += b.y;
        n++;
      }
      if (j > i && d <= spell.radius * 2 - 0.5)
        spots.push([(a.x + b.x) / 2, (a.y + b.y) / 2]);
    }
    if (n > 1) spots.push([sx / n, sy / n]);
  }
  // Each spot also slid towards a tower just out of reach.
  if (level.clip > 0)
    for (const [x, y] of spots.slice()) {
      for (const t of towers) {
        const d = dist(t.x - x, t.y - y);
        const gap = d - (spell.radius + t.radius - 0.3);
        if (gap > 0 && gap < 1.5)
          spots.push([x + ((t.x - x) / d) * gap, y + ((t.y - y) / d) * gap]);
      }
    }
  // Spending the elixir kept for defence asks for a richer target.
  const short = Math.max(0, level.reserve - (seat.elixir - card.cost)) * 0.5;
  const good: { at: [number, number]; value: number }[] = [];
  for (const at of spots) {
    const { hits, value } = score(at[0], at[1]);
    // One troop alone must be worth half as much again.
    // A defensive cast already buys the time that the reserve protects.
    // Keeping three elixir should not prevent clearing a push at home.
    const reserve = depthOf(side, at[1]) < LENGTH / 2 ? 0 : short;
    const need = (hits >= 2 ? level.worth : level.worth + 0.5) + reserve;
    if (value >= need) good.push({ at, value });
  }
  if (!good.length) return null;
  // A careless bot throws at any spot worth it, not the best one.
  const best = level.best
    ? good.reduce((a, b) => (b.value > a.value ? b : a)).at
    : good[Math.floor(random(mem) * good.length)].at;
  const miss = () => (random(mem) - 0.5) * 2 * level.aim;
  const x = Math.round(clamp(best[0] + miss(), 0.5, WIDTH - 0.5) * 2) / 2;
  const y = Math.round(clamp(best[1] + miss(), 0.5, LENGTH - 0.5) * 2) / 2;
  return onField(x, y) ? { player: mem.player, slot, x, y } : null;
}

const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

/** Call every tick; the bot decides a few times a second and returns the
 *  card it wants to play, if any. */
export function botStep(m: Match, mem: BotMemory): BotMove | null {
  if (m.phase !== 'battle' && m.phase !== 'overtime') return null;
  if (m.time < mem.nextThink) return null;
  const level = botLevels[mem.level];
  mem.nextThink = m.time + level.think * (0.75 + random(mem) * 0.5);
  const main = threats(m, mem.side).find((t) =>
    level.coverage
      ? // Small leaks inside tower range are the tower's job.
        t.cost - t.covered * 0.9 >= (t.depth < 13 ? 2.2 : 1.2)
      : t.cost >= 1.2,
  );
  mem.threatSince = main ? (mem.threatSince ?? m.time) : null;
  // A Meteor worth throwing comes first, a defence or an attack after.
  const cast = meteor(m, mem);
  if (cast) return cast;
  if (main) {
    const ready =
      m.time - (mem.threatSince ?? m.time) >= level.react &&
      // Let the attacker walk into tower range first, unless it is big.
      (main.depth <= level.engage ||
        (main.cost >= 5 && main.depth <= 16) ||
        (main.ranged && main.depth <= 15.5));
    const move = ready ? defend(m, mem, main) : null;
    if (move) {
      mem.threatSince = null;
      return move;
    }
    // While a threat is on the board, only a full bar makes it attack.
    if (m.players[mem.player].elixir < 9.5) return null;
  }
  return attack(m, mem);
}
