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

type ScoringEffect = Extract<
  Effect,
  {
    type:
      | 'points'
      | 'race'
      | 'per'
      | 'perHold'
      | 'sets'
      | 'thrift'
      | 'perLevel';
  }
>;

/** Every score uses one star; the words say when or what it counts. */
export const scoresPoints = (e: Effect): e is ScoringEffect =>
  e.type === 'points' ||
  e.type === 'race' ||
  e.type === 'per' ||
  e.type === 'perHold' ||
  e.type === 'perLevel' ||
  e.type === 'sets' ||
  e.type === 'thrift';

export function scoreBadge(e: ScoringEffect, next?: number, earned?: number) {
  switch (e.type) {
    case 'points':
      return { points: e.points, target: 'now' };
    case 'race':
      return earned !== undefined
        ? { points: earned, target: 'earned' }
        : {
            points: next ?? e.ladder[0],
            target: next === undefined ? 'first in race' : 'next in race',
          };
    case 'per':
      return {
        points: e.points,
        target: `per ${e.family ? familyNames[e.family][0] : 'upgrade'}`,
      };
    case 'perLevel':
      return { points: e.points, target: 'per ship level' };
    case 'perHold':
      return { points: e.points, target: 'per cargo slot' };
    case 'thrift':
      return { points: 1, target: `per ${e.per} cargo left` };
    case 'sets':
      return { points: e.points, target: 'per cargo set' };
  }
}

export function effectShort(e: Effect, next?: number): string {
  if (scoresPoints(e)) {
    const score = scoreBadge(e, next);
    return `${score.points} ${score.points === 1 ? 'point' : 'points'} ${score.target}`;
  }
  switch (e.type) {
    case 'hold':
      return `Hold +${e.amount}`;
    case 'yield':
      return `+${e.amount} ${lower(e.good)}`;
    case 'alone':
      return `Alone +${e.amount}`;
    case 'share':
      return `Shared +${e.amount}`;
    case 'route':
      return `New cargo +${e.amount}`;
    case 'byproduct':
      return `${lower(e.good)} → +${e.amount} ${lower(e.cargo)}`;
    case 'discount':
      return `${e.family === 'base' ? 'Base modules' : e.family === 'ship' ? 'Ship parts' : 'Upgrades'} −${e.amount}`;
  }
}

type RulePart = string | { bold: string };

/** One wording for accessible labels, lists and the shared rule inspection. */
export function effectRuleParts(e: Effect): RulePart[] {
  switch (e.type) {
    case 'hold':
      return [
        'Your ship carries ',
        { bold: `${e.amount} more cargo` },
        ' home from every flight.',
      ];
    case 'yield':
      return [
        `Every flight to ${e.good === 2 ? 'an' : 'a'} ${lower(e.good)} planet loads `,
        { bold: `${e.amount} more ${lower(e.good)}` },
        ', even past your hold.',
      ];
    case 'alone':
      return [
        'Alone on a planet, load ',
        { bold: `${e.amount} extra cargo` },
        ', even past your hold.',
      ];
    case 'share':
      return [
        'Sharing a planet, load ',
        { bold: `${e.amount} extra cargo` },
        ', even past your hold.',
      ];
    case 'route':
      return [
        'Fly to a different cargo kind from your previous flight and load ',
        { bold: `${e.amount} extra cargo` },
        ', even past your hold. Your first flight has no route bonus.',
      ];
    case 'byproduct':
      return [
        `Every flight to ${e.good === 2 ? 'an' : 'a'} ${lower(e.good)} planet also brings home `,
        { bold: `${e.amount} ${lower(e.cargo)}` },
        ', even past your hold.',
      ];
    case 'perLevel':
      return [
        'At the end, score ',
        { bold: `${e.points} ${e.points === 1 ? 'point' : 'points'}` },
        ' for each ',
        { bold: 'fitted ship level' },
        '. A level III part counts as three.',
      ];
    case 'discount':
      return [
        'Every later ',
        { bold: e.family ? familyNames[e.family][0] : 'upgrade' },
        ' costs ',
        { bold: `${e.amount} less cargo` },
        ' of any kind.',
      ];
    case 'points':
      return ['Score ', { bold: `${e.points} points` }, ' when you build it.'];
    case 'race':
      return [
        'The ',
        { bold: 'first builder' },
        ' scores ',
        { bold: `${e.ladder[0]} points` },
        `; later builders score ${e.ladder.slice(1).join(', ')} points, in order.`,
      ];
    case 'per':
      return [
        'At the end, score ',
        { bold: `${e.points} ${e.points === 1 ? 'point' : 'points'}` },
        ' for every ',
        { bold: e.family ? familyNames[e.family][0] : 'upgrade' },
        ` you own${e.family === 'ship' ? '' : ', including this one'}.`,
      ];
    case 'perHold':
      return [
        'At the end, score ',
        { bold: `${e.points} points` },
        ' for every ',
        { bold: 'cargo slot in your hold' },
        ', even when empty.',
      ];
    case 'thrift':
      return [
        'At the end, every ',
        { bold: `${e.per} cargo left` },
        ' score ',
        { bold: '1 point' },
        ` instead of every ${leftoverPer}.`,
      ];
    case 'sets':
      return [
        'At the end, each set of ',
        { bold: '1 food, 1 metal, 1 ice and 1 crystal' },
        ' left in your cargo scores ',
        { bold: `${e.points} points` },
        ', on top of the usual leftover points.',
      ];
  }
}

export const effectRule = (e: Effect) =>
  effectRuleParts(e)
    .map((part) => (typeof part === 'string' ? part : part.bold))
    .join('');

export const familyLabel = (family: Family) =>
  familyNames[family][0][0].toUpperCase() + familyNames[family][0].slice(1);
export const planRule = (p: Plan) => p.effects.map(effectRule).join(' ');
