import { audioAssets } from './audio-catalog.ts';
import type { Ambience } from './ambience.ts';
type GameId = Ambience['id'];

/** Experimental mixes are available in Sound Lab only. */
const base = '/audio/ambience';
const world = (
  id: GameId,
  world: string,
  level: number,
  beds: [string, number][],
  gap: [number, number],
  events: [string, number, number, ([number, number] | undefined)?, number?][],
): Ambience => ({
  id,
  world,
  level,
  beds: beds.map(([name, gain]) => ({ src: `${base}/${world}/${name}.m4a`, gain })),
  gap,
  events: events.map(([name, gain, weight, pan, detune]) => ({
    src: `${base}/${world}/${name}.m4a`,
    gain,
    weight,
    pan,
    detune,
  })),
});

export const labAmbiences: Ambience[] = [
  // Mora: a paper forest garden in daylight. Breeze in the leaves, birds and insects far off.
  world(
    'wildgrove' as GameId,
    'forest',
    0.48,
    [],
    [18, 38],
    [
      ['thrush-1', 0.5, 1, [-0.8, 0.8], 60],
      ['jay', 0.35, 0.6, [-0.9, 0.9], 40],
      ['woodpecker-1', 0.4, 0.7, [-0.9, 0.9], 30],
      ['woodpecker-2', 0.4, 0.5, [-0.9, 0.9], 30],
      ['crow-1', 0.3, 0.5, [-1, 1], 40],
      ['crow-2', 0.3, 0.4, [-1, 1], 40],
      ['owl', 0.3, 0.2, [-0.6, 0.6], 30],
      ['branch-1', 0.45, 0.5, [-0.7, 0.7], 80],
      ['branch-2', 0.45, 0.4, [-0.7, 0.7], 80],
      ['leaves', 0.4, 0.6, [-0.5, 0.5], 40],
      ['frog', 0.35, 0.4, [-0.9, 0.9], 60],
    ],
  ),
  // Nox: the hold of a ship. Water against the hull, timbers working, the deck far above.
  world(
    'undertow' as GameId,
    'ship',
    0.5,
    [],
    [14, 32],
    [
      ['creak-1', 0.55, 1, [-0.8, 0.8], 80],
      ['creak-2', 0.55, 1, [-0.8, 0.8], 80],
      ['creak-3', 0.55, 0.8, [-0.8, 0.8], 80],
      ['creak-short-1', 0.5, 0.8, [-0.9, 0.9], 120],
      ['creak-short-2', 0.5, 0.8, [-0.9, 0.9], 120],
      ['bell-single', 0.25, 0.3, [-0.3, 0.3], 10],
      ['bell-double', 0.22, 0.15, [-0.3, 0.3], 10],
      ['gull-1', 0.22, 0.5, [-1, 1], 50],
      ['gull-2', 0.22, 0.5, [-1, 1], 50],
      ['sail', 0.3, 0.5, [-0.5, 0.5], 40],
      ['oar', 0.3, 0.4, [-0.8, 0.8], 40],
      ['wash', 0.16, 0.35, [-0.6, 0.6], 20],
    ],
  ),
  // Yata: cooking at a small street counter, with voices softened by distance.
  world(
    'midnight' as GameId,
    'street',
    0.46,
    [],
    [17, 36],
    [
      ['plate', 0.4, 1, [-0.7, 0.7], 60],
      ['dishes-1', 0.35, 0.8, [-0.7, 0.7], 60],
      ['dishes-2', 0.35, 0.8, [-0.7, 0.7], 60],
      ['chopsticks', 0.35, 0.7, [-0.5, 0.5], 40],
      ['wok-1', 0.3, 0.6, [-0.6, 0.6], 20],
      ['wok-2', 0.3, 0.6, [-0.6, 0.6], 20],
    ],
  ),
];

// Original ElevenLabs beds carry the setting. Quiet individual accents stay irregular.
for (const ambience of labAmbiences) {
  const generated = audioAssets.filter((asset) => asset.game === ambience.id);
  ambience.beds = generated.filter((asset) => asset.kind === 'bed' && asset.category === 'base')
    .map((asset) => ({ src: asset.src, gain: 0.85, label: asset.label }));
  ambience.events.push(...generated.filter((asset) => asset.kind === 'detail').map((asset) => ({
    src: asset.src, label: asset.label, gain: asset.category.includes('crew') || asset.category.includes('market') ? 0.22 : 0.42,
    weight: asset.category.includes('crew') ? 0.35 : 1.2, pan: [-0.55, 0.55] as [number, number], detune: 12,
  })));
}

const coast = world('wildgrove' as GameId, 'coast', 0.58,
  [['surf', 0.95], ['shore', 0.35]], [14, 32], [
    ['gulls-near', 0.32, 1, [-0.8, 0.8], 25],
    ['gulls-far', 0.23, 1, [-1, 1], 30],
    ['wash', 0.3, 0.7, [-0.6, 0.6], 15],
  ]);
labAmbiences.push(coast);
