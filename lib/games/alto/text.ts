import {
  goods,
  leftoverPer,
  type Effect,
  type Family,
  type Plan,
} from './content.ts';

/** Plain words for Alto's upgrades: a short line for the shop, a sentence
 *  for inspections and the rules. Numbers always come from the data. */
export const familyNames: Record<Family, [string, string]> = {
  ship: ['ship part', 'ship parts'],
  base: ['base module', 'base modules'],
};
const lower = (k: number) => goods[k].toLowerCase();

export function effectShort(e: Effect): string {
  switch (e.type) {
    case 'hold':
      return `Hold +${e.amount}`;
    case 'yield':
      return `+${e.amount} ${lower(e.good)}`;
    case 'alone':
      return `Alone +${e.amount}`;
    case 'share':
      return `Shared +${e.amount}`;
    case 'discount':
      return `${e.family === 'base' ? 'Base modules' : e.family === 'ship' ? 'Ship parts' : 'Upgrades'} −${e.amount}`;
    case 'points':
      return `${e.points}`;
    case 'race':
      return `${e.ladder[0]}`;
    case 'per':
      return e.family
        ? `${e.points} per ${familyNames[e.family][0]}`
        : `${e.points} per upgrade`;
    case 'perHold':
      return `${e.points} per hold`;
    case 'thrift':
      return `1 per ${e.per} left`;
    case 'sets':
      return `${e.points} per set`;
  }
}

export function effectRule(e: Effect): string {
  switch (e.type) {
    case 'hold':
      return `Your ship carries ${e.amount} more home from every flight.`;
    case 'yield':
      return `Every flight to a ${lower(e.good)} planet loads ${e.amount} more ${lower(e.good)}, even past your hold.`;
    case 'alone':
      return `Alone on a planet, you take ${e.amount} more.`;
    case 'share':
      return `Sharing a planet, you take ${e.amount} more.`;
    case 'discount':
      return `Every later ${e.family ? familyNames[e.family][0] : 'upgrade'} costs ${e.amount} cargo less.`;
    case 'points':
      return `Scores ${e.points}.`;
    case 'race':
      return `Scores ${e.ladder[0]} for the first to build it, then ${e.ladder.slice(1).join(', ')}.`;
    case 'per':
      return e.family
        ? `At the end, scores ${e.points} for every ${familyNames[e.family][0]} you own.`
        : `At the end, scores ${e.points} for every upgrade you own, itself included.`;
    case 'perHold':
      return `At the end, scores ${e.points} for every cargo your ship holds.`;
    case 'thrift':
      return `At the end, every ${e.per} cargo left score 1 instead of every ${leftoverPer}.`;
    case 'sets':
      return `At the end, every set of all four kinds of cargo left scores ${e.points}.`;
  }
}

/** Whether the shop's figure is points (a star) rather than an ability. */
export const scoresPoints = (e: Effect) =>
  e.type === 'points' ||
  e.type === 'race' ||
  e.type === 'per' ||
  e.type === 'perHold' ||
  e.type === 'sets' ||
  e.type === 'thrift';

export const familyLabel = (family: Family) =>
  familyNames[family][0][0].toUpperCase() + familyNames[family][0].slice(1);
export const planRule = (p: Plan) => p.effects.map(effectRule).join(' ');
